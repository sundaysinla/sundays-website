import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { basketHostKey, localOrigin } from '@/lib/suggestions/access';
import '@/styles/suggestions-basket.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata: Metadata = {
  title: 'The Suggestions Basket · Sundays in LA',
  description: 'Leave a little note for the Sundays hosts.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function BasketLayout({ children }: { children: React.ReactNode }) {
  if (!basketHostKey() || !localOrigin(headers().get('host'))) notFound();

  return (
    <div className="basket-page">
      <header className="basket-masthead basket-shell">
        <Link className="basket-brand" href="/" prefetch={false} aria-label="Sundays in LA home">
          <svg viewBox="0 0 34 34" width="32" height="32" aria-hidden="true">
            <circle cx="17" cy="17" r="14.8" fill="#f3eddf" stroke="currentColor" strokeWidth="1.1" />
            <path d="M6 13c2.2-5.9 7.9-9.2 13.5-8.2M28.8 20.8c-2 6-7 9-12.8 8.8" fill="none" stroke="#b5a892" strokeWidth="1" strokeLinecap="round" />
            <path d="M11.4 18.3c1.2 3 3.4 4.5 5.7 4.5s4.5-1.6 5.7-4.5" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
            <circle cx="12.5" cy="13.4" r="1.25" fill="currentColor" /><circle cx="21.5" cy="13.4" r="1.25" fill="currentColor" />
          </svg>
          <span>Sundays in LA</span>
        </Link>
      </header>
      {children}
    </div>
  );
}
