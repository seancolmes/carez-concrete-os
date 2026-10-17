import type { Metadata } from 'next';
import { Inter, Source_Code_Pro } from 'next/font/google';
import { CarezAppearanceProvider } from '@/components/CarezAppearanceProvider';
import { CAREZ_APPEARANCE_BOOT_SCRIPT } from '@/lib/ui/appearance';
import { GatewayTransitionProvider } from '@/components/brand/GatewayTransitionProvider';
import 'flexlayout-react/style/light.css';
import 'react-resizable/css/styles.css';
import './globals.css';
import './takeoff-v3.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro',
  weight: ['400', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pourtrace',
  description: 'Concrete estimating and operations workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const vercelEnvironment = process.env.VERCEL_ENV;
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  const shortSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const showBuildIdentity = Boolean(vercelEnvironment && vercelEnvironment !== 'production');
  const environmentLabel = branch === 'staging' ? 'STAGING' : 'PREVIEW';

  return <html lang="en" suppressHydrationWarning data-theme="light" style={{colorScheme:'only light'}} className={`${inter.variable} ${sourceCodePro.variable}`}>
    <head>
      <script dangerouslySetInnerHTML={{ __html: CAREZ_APPEARANCE_BOOT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('pourtrace-landing-boot')==='seen')document.documentElement.dataset.ptBootSeen='true'}catch{}" }} />
      <style>{'html[data-pt-boot-seen="true"] .pt-splash{display:none!important}'}</style>
    </head>
    <body>
      <GatewayTransitionProvider><CarezAppearanceProvider>{children}</CarezAppearanceProvider></GatewayTransitionProvider>
      {showBuildIdentity && <div className="carez-build-identity" aria-label="Non-production build identity">
        {environmentLabel} · {branch || 'detached'} · {shortSha || 'unknown'}
      </div>}
    </body>
  </html>;
}

