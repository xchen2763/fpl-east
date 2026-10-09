import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Custom Fixture Difficulty Rating | FPL East',
  description: 'Build a personal Fantasy Premier League fixture difficulty table from your own team ratings.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
