/** The faint dotted 16-column grid behind the main site, reused by the portal. */
export default function GridLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 grid grid-cols-8 md:grid-cols-[repeat(16,1fr)]"
    >
      {[...Array(16)].map((_, i) => (
        <div
          key={i}
          className={`h-full ${i >= 8 ? "hidden md:block" : ""}`}
          style={{
            backgroundImage: i > 0 ? "linear-gradient(#f5f5f4 4px, transparent 2px)" : "none",
            backgroundSize: "1px 12px",
            backgroundPosition: "left top",
            backgroundRepeat: "repeat-y",
          }}
        />
      ))}
    </div>
  );
}
