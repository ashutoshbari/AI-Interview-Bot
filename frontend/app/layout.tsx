import type { Metadata } from 'next';
import '@/app/globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
    title: 'Smart Interview AI – Practice Like the Real Google Loop',
    description: 'AI-powered technical interview suite. Sit down with a senior AI interviewer who listens, adapts, and grades every answer.',
    keywords: 'AI interview, technical interview, Google loop, resume-based questions, hiring scorecard',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body className="antialiased min-h-screen flex flex-col">
                <Header />
                <main className="flex-1">
                    {children}
                </main>
            </body>
        </html>
    );
}
