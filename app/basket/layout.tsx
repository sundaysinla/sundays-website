import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import SiteGrid from '@/components/SiteGrid';
import SundaysWordmark from '@/components/SundaysWordmark';
import { basketConfig, basketOrigin } from '@/lib/suggestions/access';
import '@/styles/suggestions-basket.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata: Metadata = {
  title: 'The Suggestions Basket · Sundays in LA',
  description: 'Leave a little note for the Sundays hosts.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function BasketLayout({ children }: { children: React.ReactNode }) {
  const config = basketConfig();
  if (!config || !basketOrigin(config, await headers())) notFound();

  return (
    <div className="basket-page">
      <SiteGrid />
      <header className="basket-masthead px-6 md:px-12">
        <Link className="basket-brand" href="/" prefetch={false} aria-label="Sundays in LA home">
          <Image src="/smiley.png" width={32} height={32} alt="" className="opacity-80 hover:opacity-100 transition-opacity" />
        </Link>
        <SundaysWordmark compact />
      </header>
      {children}
    </div>
  );
}
