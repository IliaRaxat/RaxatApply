# Design Document: Fix HH.ru Application System

## Overview

Система будет исправлена путем добавления метода для получения списка резюме пользователя через API HH.ru и использования правильного ID резюме при отправке откликов. Основные изменения будут внесены в `httpClient.js` и `applicator_http.js`.

## Architecture

Система состоит из следующих компонентов:

1. **HHHttpClient** - HTTP клиент для взаимодействия с API HH.ru
   - Получение списка резюме пользователя
   - Отправка откликов на вакансии
   
2. **Applicator** - модуль для отправки откликов
   - Использует HHHttpClient для получения ID резюме
   - Отправляет отклики с правильным ID резюме

## Components and Interfaces

### HHHttpClient

```javascript
class HHHttpClient {
  constructor(hhtoken, xsrf)
  
  // Новый метод для получения списка резюме
  async getResumes(): Promise<Array<{id: string, title: string}>>
  
  // Существующие методы
  async parseVacancyListPage(url): Promise<Array<Vacancy>>
  async getVacancyDetails(vacancyId): Promise<VacancyDetails>
  async applyToVacancy(vacancyId, resumeId, coverLetter): Promise<{success: boolean, reason?: string}>
}
```

### Applicator

```javascript
async function applyToVacancyHTTP(vacancy) {
  // 1. Получить ID резюме
  // 2. Отправить отклик с правильным ID
  // 3. Обработать ответ
}
```

## Data Models

### Resume
```javascript
{
  id: string,           // ID резюме на HH.ru
  title: string,        // Название резюме
  status: string        // Статус резюме (active, blocked, etc.)
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Resume retrieval returns valid data

*For any* valid HHTOKEN and XSRF tokens, calling getResumes() should return an array of resume objects with id and title fields

**Validates: Requirements 1.1, 1.2**

### Property 2: Application uses resume ID

*For any* vacancy and resume ID, when applying to a vacancy, the system should use the resume ID (not the token) in the application request

**Validates: Requirements 2.1, 2.2**

### Property 3: Error messages are descriptive

*For any* error that occurs during resume retrieval or application, the system should log a message that includes the error type and description

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Response handling is correct

*For any* response from HH.ru API, the system should correctly identify whether it represents success, already_responded, rate_limited, or other failure

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

## Error Handling

1. **Resume retrieval errors**
   - HTTP errors (401, 403, 500) - log error and return null
   - Empty resume list - log warning and return null
   - Network errors - retry once, then fail

2. **Application errors**
   - Already responded - update status to 'already_responded'
   - Rate limit exceeded - update status to 'rate_limited'
   - Other errors - update status to 'failed_application'

## Testing Strategy

### Unit Tests

1. Test `getResumes()` with mock HTTP responses
   - Valid response with resumes
   - Empty resume list
   - HTTP error responses

2. Test `applyToVacancy()` with different resume IDs
   - Valid resume ID
   - Invalid resume ID
   - Different error responses

### Property-Based Tests

We will use **fast-check** library for property-based testing in JavaScript.

Each property-based test should run a minimum of 100 iterations.

Property tests will be tagged with comments in the format:
`// **Feature: fix-hh-apply, Property {number}: {property_text}**`

1. **Property 1 Test**: Generate random valid tokens, call getResumes(), verify all returned objects have id and title
2. **Property 2 Test**: Generate random vacancy and resume IDs, verify application request contains resume ID
3. **Property 3 Test**: Generate random errors, verify error messages contain error type
4. **Property 4 Test**: Generate random API responses, verify correct status classification
