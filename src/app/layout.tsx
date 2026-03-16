import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Dale's PA - Voice Assistant",
  description: 'Retell.ai + Claude voice personal assistant for Floor Giants Group',
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75" fill="%238a9a66">🎧</text></svg>',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-950">
          {children}
        </div>
      </body>
    </html>
  );
}
