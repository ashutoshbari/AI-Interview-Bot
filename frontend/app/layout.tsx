import type { Metadata } from 'next';
import '@/app/globals.css';

export const metadata: Metadata = {
    title: 'AI Interview Bot',
    description: 'AI-powered technical interview platform. Upload your resume and start your personalized interview.',
    keywords: 'AI interview, technical interview, resume-based questions, hiring',
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
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
