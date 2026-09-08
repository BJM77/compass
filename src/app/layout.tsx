
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { DiagnosticsProvider } from '@/contexts/diagnostics-context';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { AnnouncementBanner } from '@/components/ui/announcement-banner';

export const metadata: Metadata = {
  title: 'BDM Compass',
  description: 'Enterprise Sales Operations Platform',
  other: {
    'permissions-policy': 'clipboard-write=(self), clipboard-read=(self)'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background">
        <FirebaseClientProvider>
          <AuthProvider>
            <DiagnosticsProvider>
              <AnnouncementBanner />
              {children}
              <Toaster />
            </DiagnosticsProvider>
          </AuthProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
