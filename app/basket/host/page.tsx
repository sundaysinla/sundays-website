import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import HostAccess from '@/components/suggestions/HostAccess';
import HostDiscussion from '@/components/suggestions/HostDiscussion';
import HostReview from '@/components/suggestions/HostReview';
import { basketConfig, basketOrigin, validHostSession } from '@/lib/suggestions/access';
import { reviewStatuses, statusLabels } from '@/lib/suggestions/model';
import { openBasket } from '@/lib/suggestions/store';
import '@/styles/suggestions-host.css';

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });

export default async function BasketHostPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const config = basketConfig();
  const requestHeaders = await headers();
  if (!config || !basketOrigin(config, requestHeaders)) notFound();
  const signedIn = validHostSession(config, requestHeaders.get('cookie') ?? '');

  const query = await searchParams;
  const status = reviewStatuses.find(value => value === query.status);
  const rawPage = typeof query.page === 'string' ? Number(query.page) : 1;
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage - 1 : 0;
  const inbox = signedIn ? await openBasket(config.connection).inbox({ status, page }) : null;

  function pageLink(index: number) {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (index > 0) query.set('page', String(index + 1));
    return query.size ? `/basket/host?${query}` : '/basket/host';
  }

  return (
    <main className="basket-shell basket-host">
      <Link className="basket-text-link" href="/basket" prefetch={false}><ArrowLeft size={15} aria-hidden="true" /> The Basket</Link>
      <div className="basket-host-heading">
        <h1>Basket inbox</h1>
        {signedIn && <HostAccess signedIn />}
      </div>

      {inbox ? (
        <>
          <form className="basket-host-filters" action="/basket/host" method="get" aria-label="Filter notes">
            <div>
              <label htmlFor="basket-filter-status">Review status</label>
              <select id="basket-filter-status" name="status" defaultValue={status ?? ''}>
                <option value="">All statuses</option>
                {reviewStatuses.map(value => <option value={value} key={value}>{statusLabels[value]}</option>)}
              </select>
            </div>
            <button className="basket-button" type="submit">Filter notes</button>
          </form>

          {inbox.notes.length ? (
            <div className="basket-inbox-list">
              {inbox.notes.map(note => (
                <article className="basket-inbox-note" key={note.id}>
                  <div className="basket-inbox-paper">
                    <div className="basket-inbox-meta">
                      <time dateTime={new Date(note.createdAt).toISOString()}>{shortDate.format(note.createdAt)}</time>
                    </div>
                    <p>{note.note}</p>
                    <span className="basket-inbox-permission">
                      {note.publicPost ? 'Public posting allowed' : note.allowRecap ? 'Recap permitted' : 'Private note'}
                    </span>
                  </div>
                  <HostReview key={note.version} note={note} statusFilter={status} />
                  {note.publicPost && <HostDiscussion id={note.id} />}
                </article>
              ))}
            </div>
          ) : <p className="basket-host-empty">{status || page ? 'No notes match this view.' : 'The basket is empty.'}</p>}

          {(page > 0 || inbox.hasNext) && (
            <nav className="basket-inbox-pages" aria-label="Inbox pages">
              {page > 0 && <Link className="basket-text-link" prefetch={false} href={pageLink(page - 1)}><ArrowLeft size={15} aria-hidden="true" /> Newer</Link>}
              {inbox.hasNext && <Link className="basket-text-link" prefetch={false} href={pageLink(page + 1)}>Older <ArrowRight size={15} aria-hidden="true" /></Link>}
            </nav>
          )}
        </>
      ) : <HostAccess signedIn={false} />}
    </main>
  );
}
