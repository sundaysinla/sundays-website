export default function BasketNoteText({ text }: { text: string }) {
  const preview = Array.from(text.split('\n', 4).join('\n')).slice(0, 120).join('').trimEnd();
  if (preview === text) return <p className="basket-post-note">{text}</p>;

  return (
    <details className="basket-post-text">
      <summary>
        <span className="basket-post-note basket-post-excerpt">{preview}…</span>
        <span className="basket-post-read-more">Read more</span>
        <span className="basket-post-read-less">Show less</span>
      </summary>
      <p className="basket-post-note">{text}</p>
    </details>
  );
}
