import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Datawrapper – Journalistverktøy',
  description: 'Last opp data, beskriv hva du vil lage, og la AI lage Datawrapper-grafen for deg.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
