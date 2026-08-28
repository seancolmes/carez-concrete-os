import type { Metadata } from 'next';
import './globals.css';
import './polish.css';
import './construction-ui.css';
import './plain-language.css';
import './employee-clock.css';
import './schedule.css';
import './os2-ui.css';

export const metadata: Metadata = {
  title: 'Carez Concrete OS',
  description: 'Private operating system for Carez Concrete',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
