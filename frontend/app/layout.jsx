import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata = {
  title: 'RAG Pipeline - AI Assistant',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
