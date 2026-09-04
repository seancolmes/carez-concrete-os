import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import {TooltipProvider} from '@/components/ui/tooltip';

/*
 * Legacy structural CSS remains temporarily for routes not yet converted to
 * literal shadcn components. The old B2/light visual override stack is no
 * longer loaded. globals.css + carez-shadcn-compat.css are the visual authority.
 */
import './polish.css';
import './construction-ui.css';
import './plain-language.css';
import './employee-clock.css';
import './schedule.css';
import './os2-ui.css';
import './carez-v3.css';
import './takeoff-v3.css';
import './estimating-v3.css';
import './estimate-editor-v3.css';
import './proposal-v3.css';
import './jobs-v3.css';
import './navigation-v3.css';
import './owner-home-v3.css';
import './employee-v3.css';
import './globals.css';
import './carez-shadcn-compat.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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

  return <html lang="en" className={`${inter.variable} ${GeistMono.variable}`}>
    <body className={inter.className}>
      <TooltipProvider>
        {children}
      </TooltipProvider>
      {showBuildIdentity && <div className="carez-build-identity" aria-label="Non-production build identity">
        {environmentLabel} · {branch || 'detached'} · {shortSha || 'unknown'}
      </div>}
    </body>
  </html>;
}
