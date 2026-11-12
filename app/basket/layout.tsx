import type { Metadata } from 'next';
import Image from 'next/image';
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
          <Image src="/smiley.png" width={32} height={32} alt="" className="opacity-80 hover:opacity-100 transition-opacity" />
        </Link>
        <Image className="basket-wordmark" src="/sundays-mobile.png" width={1528} height={490} alt="" />
      </header>
      {children}
    </div>
  );
}
