"use client";

import { cn } from "@/lib/utils";

export type PillOption<T extends string> = { value: T; label: string; hint?: string };

/**
 * Segmented control in the site's pill language. Replaces native radios and
 * selects across the portal. Submits `name` via a hidden input.
 */
export default function PillToggle<T extends string>({
  name,
  value,
  onChange,
  options,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  name?: string;
  value: T;
  onChange: (v: T) => void;
  options: PillOption<T>[];
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  const squircle = { cornerShape: "squircle" } as React.CSSProperties;
  const pad = size === "sm" ? "px-3 pt-1.5 pb-1 text-[11px]" : "px-4 pt-2 pb-1.5 text-[12px] md:text-[13px]";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex flex-wrap gap-2", className)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        const next = e.key === "ArrowRight" ? (i + 1) % options.length : (i - 1 + options.length) % options.length;
        onChange(options[next].value);
      }}
    >
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            style={squircle}
            title={o.hint}
            className={cn(
              "rounded-2xl border font-ui uppercase transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
              pad,
              selected
                ? "border-ink bg-ink text-paper"
                : "border-paper-2 bg-paper-2 text-ink hover:bg-blueberry-200/30"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
