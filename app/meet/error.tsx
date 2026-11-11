"use client";

export default function MeetError({ reset }: { reset: () => void }) {
  return <main className="meet-surface meet-loading"><h1>A little interruption.</h1><p>We couldn’t load your introductions.</p><button className="meet-button is-dark" onClick={reset}>Try again</button></main>;
}
