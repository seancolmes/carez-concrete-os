import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
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
import './carez-figma.css';
import './estimating-workstation.css';
import './commercial-workstation.css';
import './review-workstation.css';
import './crm-workstation.css';
import './build-identity.css';
import './b2-estimator.css';
import './b2-modules.css';
import './b2-estimating-surfaces.css';
import './b2-theme.css';
import './b2-workstation-pass2.css';
import './b2-design-system.css';

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
      {children}
      {showBuildIdentity && <div className="carez-build-identity" aria-label="Non-production build identity">
        {environmentLabel} · {branch || 'detached'} · {shortSha || 'unknown'}
      </div>}
    </body>
  </html>;
}
