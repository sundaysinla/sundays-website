export default function DashedDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full border-t border-dashed border-[color:var(--sundays-divider)] ${className}`} />
  );
}
