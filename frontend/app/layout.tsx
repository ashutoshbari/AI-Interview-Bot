import type { Metadata } from 'next';
import '@/app/globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackgroundAI from '@/components/BackgroundAI';

export const metadata: Metadata = {
  title: 'ASHVANCE TECH — Smart Interview AI',
  description: 'AI-powered resume analysis, adaptive technical interviews, real-time voice interaction, and intelligent candidate assessment by ASHVANCE TECH.',
  keywords: 'ASHVANCE TECH, Smart Interview AI, AI Interview, Technical Assessment, Adaptive Interviewing, Scorecard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('ashvance_theme') || 
                  (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                if (t === 'light') {
                  document.documentElement.classList.add('light');
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col relative bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
        <BackgroundAI />
        <Header />
        <main className="flex-1 relative z-10 w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
