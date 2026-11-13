import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import BasketComposer from '@/components/suggestions/BasketComposer';
import BasketNoteText from '@/components/suggestions/BasketNoteText';
import BasketPost from '@/components/suggestions/BasketPost';
import BasketPostList, { BasketTile } from '@/components/suggestions/BasketPostList';
import { basketConfig, basketOrigin, voterHash } from '@/lib/suggestions/access';
import { basketCookie, VOTER_COOKIE } from '@/lib/suggestions/model';
import { openBasket } from '@/lib/suggestions/store';
import '@/styles/suggestions-discussion.css';

export default async function BasketPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const config = basketConfig();
  const requestHeaders = await headers();
  if (!config || !basketOrigin(config, requestHeaders)) notFound();

  const { page: rawPage } = await searchParams;
  const requested = typeof rawPage === 'string' ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested - 1 : 0;
  const voter = voterHash(basketCookie(requestHeaders.get('cookie') ?? '', VOTER_COOKIE));
  const basket = openBasket(config.connection);
  const [{ posts, hasNext }, recaps] = await Promise.all([
    basket.publicFeed(voter, page),
    page === 0 ? basket.showcase() : [],
  ]);

  return (
    <main className="basket-shell">
      <BasketComposer />
      {(posts.length > 0 || recaps.length > 0 || page > 0) && (
        <section className="basket-board" id="from-the-basket" aria-labelledby="basket-board-title">
          <h2 id="basket-board-title">From the Basket</h2>
          {(posts.length > 0 || recaps.length > 0) && (
            <BasketPostList>
              {posts.map(post => <BasketPost key={post.id} post={post} />)}
              {recaps.map(recap => (
                <BasketTile className="basket-tile basket-recap" key={recap.id}>
                  <span className="basket-recap-status">{recap.status === 'tried' ? 'Tried' : 'Implemented'}</span>
                  <h3>{recap.summary}</h3>
                  <BasketNoteText text={recap.outcome} />
                </BasketTile>
              ))}
            </BasketPostList>
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
