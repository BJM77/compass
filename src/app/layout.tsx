
import type { Metadata } from 'next';
import './globals.css';
import { DESKTOP_NAV_QUERY } from '@/hooks/use-mobile';
import { AuthProvider } from '@/contexts/auth-context';
import { DiagnosticsProvider } from '@/contexts/diagnostics-context';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { AnnouncementBanner } from '@/components/ui/announcement-banner';
import { THEME_INIT_SCRIPT } from '@/lib/theme-mode';

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0B2545' },
    { media: '(prefers-color-scheme: dark)', color: '#0A1220' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved light/dark theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Set the mobile/tablet layout class before first paint (mirrors useIsMobileNav). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=window.matchMedia('${DESKTOP_NAV_QUERY}').matches;var f=localStorage.getItem('forceMobile')==='true';document.documentElement.classList.toggle('mobile-layout',f||!d);}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
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
