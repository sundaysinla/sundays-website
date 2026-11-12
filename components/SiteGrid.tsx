export default function SiteGrid() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 pointer-events-none grid grid-cols-8 md:grid-cols-16">
      {Array.from({ length: 16 }, (_, index) => (
        <div
          key={index}
          className={index >= 8 ? 'hidden h-full md:block' : 'h-full'}
          style={index > 0 ? {
            background: 'linear-gradient(#f5f5f4 4px, transparent 2px) left top / 1px 12px repeat-y',
          } : undefined}
        />
      ))}
    </div>
  );
}
