import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
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

export const metadata: Metadata = {
  title: 'Carez Concrete OS',
  description: 'Private operating system for Carez Concrete',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}><body className={GeistSans.className}>{children}</body></html>;
}
