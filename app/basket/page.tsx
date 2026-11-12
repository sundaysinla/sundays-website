import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import BasketComposer from '@/components/suggestions/BasketComposer';
import { basketHostKey, localOrigin } from '@/lib/suggestions/access';
import { openBasket } from '@/lib/suggestions/store';

export default async function BasketPage() {
  if (!basketHostKey() || !localOrigin(headers().get('host'))) notFound();
  const recaps = (await openBasket()).showcase();

  return (
    <main className="basket-shell">
      <BasketComposer />
      <section className="basket-recaps" id="from-the-basket" aria-labelledby="basket-recaps-title">
        <h2 id="basket-recaps-title">From the Basket</h2>
        {recaps.length ? (
          <div className="basket-recap-list">
            {recaps.map(recap => (
              <article className="basket-recap" key={recap.id}>
                <span className="basket-recap-status">{recap.status === 'tried' ? 'Tried' : 'Implemented'}</span>
                <h3>{recap.summary}</h3>
                <p>{recap.outcome}</p>
              </article>
            ))}
          </div>
        ) : <p>When we try a suggestion, we’ll share how it went here.</p>}
      </section>
    </main>
  );
}
