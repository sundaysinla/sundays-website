/**
 * The Luma event page, embedded. Luma serves an iframe-friendly version at
 * lu.ma/embed/event/<id>/simple; the cover image sits above it so the panel
 * reads well even before the frame loads.
 */
export default function LumaEmbed({
  lumaEventId,
  lumaUrl,
  title,
  coverUrl,
}: {
  lumaEventId: string;
  lumaUrl: string | null;
  title: string;
  coverUrl: string | null;
}) {
  const embedUrl = `https://luma.com/embed/event/${encodeURIComponent(lumaEventId)}/simple`;
  const openUrl = lumaUrl ?? `https://luma.com/${lumaEventId}`;

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="overflow-hidden rounded-[24px] border border-[#C0B9A5]/50 bg-[#FCFAF7]">
        {coverUrl ? (
          <a href={openUrl} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={`${title} on Luma`} className="aspect-[16/10] w-full object-cover" loading="lazy" />
          </a>
        ) : null}
        <iframe
          src={embedUrl}
          title={`${title} on Luma`}
          className="block h-[520px] w-full border-0 border-t border-dashed border-[#C0B9A5]/50 bg-white"
          loading="lazy"
          allow="payment"
          allowFullScreen
        />
        <div className="flex items-center justify-between border-t border-dashed border-[#C0B9A5]/50 px-4 py-2.5">
          <span className="font-['Monument-Grotesk'] text-[10px] uppercase tracking-wide text-[#C0B9A5]">Live from Luma</span>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-['Monument-Grotesk'] text-[10px] uppercase tracking-wide text-[#010101] underline decoration-[#C0B9A5] underline-offset-4 hover:decoration-black"
          >
            Open on Luma
          </a>
        </div>
      </div>
    </aside>
  );
}
