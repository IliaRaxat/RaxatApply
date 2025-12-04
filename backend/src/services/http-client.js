// services/http-client.js

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export class HHHttpClient {
  constructor(hhtoken, xsrf) {
    this.hhtoken = hhtoken;
    this.xsrf = xsrf;
    this.baseHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cookie': `hhtoken=${this.hhtoken}; hhuid=${this.xsrf}; _xsrf=${this.xsrf}`
    };
  }

  async parseVacancyListPage(url) {
    try {
      const response = await fetch(url, {
        headers: this.baseHeaders,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.extractVacanciesFromHTML(html);
    } catch (error) {
      console.error(`Ошибка парсинга: ${error.message}`);
      return [];
    }
  }

  extractVacanciesFromHTML(html) {
    const vacancies = [];
    const $ = cheerio.load(html);
    
    $('[data-qa="vacancy-serp__vacancy"]').each((index, element) => {
      try {
        const $vacancy = $(element);
        
        const titleLink = $vacancy.find('[data-qa="serp-item__title"]');
        const href = titleLink.attr('href');
        if (!href) return;
        
        const idMatch = href.match(/vacancy\/(\d+)/);
        if (!idMatch) return;
        const vacancy_id = parseInt(idMatch[1]);
        
        const title = titleLink.text().trim() || 'Без названия';
        const company = $vacancy.find('[data-qa="vacancy-serp__vacancy-employer"]').text().trim() || 'Компания не указана';
        const salary = $vacancy.find('[data-qa="vacancy-serp__vacancy-compensation"]').text().trim() || null;
        
        const vacancyText = $vacancy.text();
        const hasResponse = 
          vacancyText.includes('Вы откликнулись') || 
          vacancyText.includes('Отклик отправлен') ||
          vacancyText.includes('Резюме отправлено') ||
          vacancyText.includes('Приглашение') ||
          vacancyText.includes('Отказ') ||
          vacancyText.includes('Просмотрен');
        
        const link = `https://hh.ru/vacancy/${vacancy_id}`;
        let status = hasResponse ? 'already_applied_hh' : null;
        
        vacancies.push({
          vacancy_id,
          title,
          company,
          link,
          salary,
          status_on_list_page: status
        });
      } catch (e) {
        console.error('Ошибка парсинга блока:', e.message);
      }
    });

    return vacancies;
  }

  async getVacancyDetails(vacancyId) {
    try {
      const url = `https://hh.ru/vacancy/${vacancyId}`;
      const response = await fetch(url, {
        headers: this.baseHeaders,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      const descriptionElement = $('[data-qa="vacancy-description"]');
      const description_html = descriptionElement.html() || null;
      const description_text = descriptionElement.text().trim() || null;

      let response_url = null;
      const responseLink = $('[data-qa="vacancy-response-link-top"]').attr('href') ||
                          $('[data-qa="vacancy-response-link"]').attr('href') ||
                          $('a[href*="applicant/vacancy_response"]').attr('href');
      
      if (responseLink) {
        response_url = responseLink.startsWith('http') ? responseLink : `https://hh.ru${responseLink}`;
      }

      return { vacancy_id: vacancyId, description_html, description_text, response_url };
    } catch (error) {
      console.error(`Ошибка деталей вакансии ${vacancyId}: ${error.message}`);
      return null;
    }
  }

  async applyToVacancy(vacancyId, resumeId, coverLetter = '') {
    try {
      console.log(`📤 [HTTP] Отправка отклика на вакансию ${vacancyId}...`);
      
      const vacancyUrl = `https://hh.ru/vacancy/${vacancyId}`;
      const vacancyResponse = await fetch(vacancyUrl, {
        headers: this.baseHeaders,
        redirect: 'follow'
      });

      if (!vacancyResponse.ok) {
        return { success: false, reason: 'failed_to_load_vacancy_page' };
      }

      const vacancyHtml = await vacancyResponse.text();
      const $ = cheerio.load(vacancyHtml);

      if (vacancyHtml.includes('Вы откликнулись') || 
          vacancyHtml.includes('Отклик отправлен') ||
          $('[data-qa="already-responded-text"]').length > 0) {
        return { success: false, reason: 'already_responded' };
      }

      const responsePageUrl = `https://hh.ru/applicant/vacancy_response?vacancyId=${vacancyId}`;
      const pageResponse = await fetch(responsePageUrl, {
        headers: { ...this.baseHeaders, 'Referer': vacancyUrl },
        redirect: 'follow'
      });

      if (!pageResponse.ok) {
        return { success: false, reason: 'failed_to_load_response_page' };
      }

      const pageHtml = await pageResponse.text();
      if (pageHtml.includes('Вы откликнулись')) {
        return { success: false, reason: 'already_responded' };
      }

      const resumeHashMatch = /name="resume"[^>]*value="([^"]+)"/.exec(pageHtml);
      const resumeHash = resumeHashMatch ? resumeHashMatch[1] : resumeId;

      const applyUrl = 'https://hh.ru/applicant/vacancy_response/popup';
      const formData = new URLSearchParams({
        'vacancyId': vacancyId.toString(),
        'resume': resumeHash,
        'letter': coverLetter,
        '_xsrf': this.xsrf
      });

      const applyResponse = await fetch(applyUrl, {
        method: 'POST',
        headers: {
          ...this.baseHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Xsrftoken': this.xsrf,
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': responsePageUrl,
          'Origin': 'https://hh.ru',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        body: formData.toString(),
        redirect: 'manual'
      });

      const responseText = await applyResponse.text();

      if (applyResponse.status === 200 || applyResponse.status === 302) {
        if (responseText.includes('success') || 
            responseText.includes('"ok":true') ||
            applyResponse.status === 302) {
          return { success: true };
        }
        
        if (responseText.includes('лимит') || responseText.includes('200 откликов')) {
          return { success: false, reason: 'rate_limit_exceeded' };
        }

        if (responseText.includes('уже откликнулись')) {
          return { success: false, reason: 'already_responded' };
        }
      }

      return { success: false, reason: 'unknown_error', details: responseText.substring(0, 500) };
    } catch (error) {
      console.error(`❌ [HTTP] Ошибка: ${error.message}`);
      return { success: false, reason: error.message };
    }
  }

  async getResumes() {
    try {
      const url = 'https://hh.ru/applicant/resumes';
      const response = await fetch(url, {
        headers: this.baseHeaders,
        redirect: 'follow'
      });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      
      const resumes = [];
      $('[data-qa="resume"]').each((index, element) => {
        const $resume = $(element);
        const link = $resume.find('a[data-qa="resume-title-link"]').attr('href');
        if (link) {
          const idMatch = link.match(/resume\/([a-f0-9]+)/);
          if (idMatch) {
            resumes.push({
              id: idMatch[1],
              title: $resume.find('[data-qa="resume-title-link"]').text().trim()
            });
          }
        }
      });

      return resumes;
    } catch (error) {
      console.error(`Ошибка получения резюме: ${error.message}`);
      return [];
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
