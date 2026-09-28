import type { Metadata } from 'next';
import { Fira_Sans, Roboto_Slab, Source_Code_Pro } from 'next/font/google';
import { CarezAppearanceProvider } from '@/components/carez/appearance-provider';
import { PourtraceAntProvider } from '@/components/PourtraceAntProvider';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CAREZ_APPEARANCE_BOOT_SCRIPT } from '@/lib/ui/appearance';
import './globals.css';
import './takeoff-v3.css';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  variable: '--font-fira-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  variable: '--font-roboto-slab',
  weight: ['400', '700'],
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

  return <html lang="en" suppressHydrationWarning className={`${firaSans.variable} ${robotoSlab.variable} ${sourceCodePro.variable}`}>
    <head>
      <script dangerouslySetInnerHTML={{ __html: CAREZ_APPEARANCE_BOOT_SCRIPT }} />
    </head>
    <body className={firaSans.className}>
      <CarezAppearanceProvider>
        <AntdRegistry><PourtraceAntProvider><TooltipProvider>{children}</TooltipProvider></PourtraceAntProvider></AntdRegistry>
      </CarezAppearanceProvider>
      {showBuildIdentity && <div className="carez-build-identity" aria-label="Non-production build identity">
        {environmentLabel} · {branch || 'detached'} · {shortSha || 'unknown'}
      </div>}
    </body>
  </html>;
}

