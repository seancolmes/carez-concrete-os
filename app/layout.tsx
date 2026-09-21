import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import { CarezAppearanceProvider } from '@/components/carez/appearance-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CAREZ_APPEARANCE_BOOT_SCRIPT } from '@/lib/ui/appearance';
import './globals.css';
import './takeoff-v3.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Carez Concrete OS',
  description: 'Private operating system for Carez Concrete',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const vercelEnvironment = process.env.VERCEL_ENV;
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  const shortSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const showBuildIdentity = Boolean(vercelEnvironment && vercelEnvironment !== 'production');
  const environmentLabel = branch === 'staging' ? 'STAGING' : 'PREVIEW';

  return <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${ibmPlexMono.variable}`}>
    <head>
      <script dangerouslySetInnerHTML={{ __html: CAREZ_APPEARANCE_BOOT_SCRIPT }} />
    </head>
    <body className={manrope.className}>
      <CarezAppearanceProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </CarezAppearanceProvider>
      {showBuildIdentity && <div className="carez-build-identity" aria-label="Non-production build identity">
        {environmentLabel} · {branch || 'detached'} · {shortSha || 'unknown'}
      </div>}
    </body>
  </html>;
}

