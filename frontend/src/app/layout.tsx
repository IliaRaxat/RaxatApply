import type { Metadata } from 'next';
import '@/app/styles/globals.css';

export const metadata: Metadata = {
  title: 'HH Auto Apply',
  description: 'Автоматизация откликов на вакансии HH.ru',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
