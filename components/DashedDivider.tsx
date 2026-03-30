export default function DashedDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full border-t border-dashed border-[#C0B9A5]/40 ${className}`} />
  );
}
