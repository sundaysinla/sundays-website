/**
 * The Luma event page, embedded. Luma serves an iframe-friendly version at
 * luma.com/embed/event/<id>/simple.
 */
export default function LumaEmbed({
  lumaEventId,
  lumaUrl,
  title,
}: {
  lumaEventId: string;
  lumaUrl: string | null;
  title: string;
}) {
  const embedUrl = `https://luma.com/embed/event/${encodeURIComponent(lumaEventId)}/simple`;
  const openUrl = lumaUrl ?? `https://luma.com/${lumaEventId}`;

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="overflow-hidden rounded-[24px] border border-ink/15 bg-paper-2">
        <iframe
          src={embedUrl}
          title={`${title} on Luma`}
          className="block h-[560px] w-full border-0 bg-white"
          loading="lazy"
          allow="payment"
          allowFullScreen
        />
        <div className="flex items-center justify-between border-t border-dashed border-ink/15 px-4 py-2.5">
          <span className="font-ui text-[10px] uppercase tracking-wide text-ink/55">Live from Luma</span>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-ui text-[10px] uppercase tracking-wide text-ink underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry"
          >
            Open on Luma
          </a>
        </div>
      </div>
    </aside>
  );
}
