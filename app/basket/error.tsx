'use client';

export default function BasketErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="basket-shell basket-error-page">
      <h1>The basket is unavailable.</h1>
      <p>Give it a moment, then try again.</p>
      <button className="basket-button" type="button" onClick={reset}>Try again</button>
    </main>
  );
}
