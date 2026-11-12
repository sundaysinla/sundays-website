import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import BasketComposer from '@/components/suggestions/BasketComposer';
import BasketNoteText from '@/components/suggestions/BasketNoteText';
import BasketPost from '@/components/suggestions/BasketPost';
import { basketHostKey, localOrigin, voterHash } from '@/lib/suggestions/access';
import { basketCookie, VOTER_COOKIE } from '@/lib/suggestions/model';
import { openBasket } from '@/lib/suggestions/store';
import '@/styles/suggestions-discussion.css';

export default async function BasketPage({ searchParams }: { searchParams: { page?: string | string[] } }) {
  const requestHeaders = headers();
  if (!basketHostKey() || !localOrigin(requestHeaders.get('host'))) notFound();

  const requested = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested - 1 : 0;
  const voter = voterHash(basketCookie(requestHeaders.get('cookie') ?? '', VOTER_COOKIE));
  const basket = await openBasket();
  const { posts, hasNext } = basket.publicFeed(voter, page);
  const recaps = page === 0 ? basket.showcase() : [];

  return (
    <main className="basket-shell">
      <BasketComposer />
      {(posts.length > 0 || recaps.length > 0 || page > 0) && (
        <section className="basket-board" id="from-the-basket" aria-labelledby="basket-board-title">
          <h2 id="basket-board-title">From the Basket</h2>
          {(posts.length > 0 || recaps.length > 0) && (
            <div className="basket-post-list">
              {posts.map(post => <BasketPost key={post.id} post={post} />)}
              {recaps.map(recap => (
                <article className="basket-tile basket-recap" key={recap.id}>
                  <span className="basket-recap-status">{recap.status === 'tried' ? 'Tried' : 'Implemented'}</span>
                  <h3>{recap.summary}</h3>
                  <BasketNoteText text={recap.outcome} />
                </article>
              ))}
            </div>
          )}
          {(page > 0 || hasNext) && (
            <nav className="basket-post-pages" aria-label="More suggestions">
              {page > 0 && <a className="basket-text-link" href={page === 1 ? '/basket#from-the-basket' : `/basket?page=${page}#from-the-basket`}>Newer posts</a>}
              {hasNext && <a className="basket-text-link" href={`/basket?page=${page + 2}#from-the-basket`}>Older posts</a>}
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
