import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Carez Concrete OS',
  description: 'Private operating system for Carez Concrete',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
