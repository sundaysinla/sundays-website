"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Suggestion = {
  id: string;
  placeName: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
};

const LA_PROXIMITY = "-118.36,34.04";

export const inputClass =
  "h-11 w-full rounded-2xl border border-ink/15 bg-white px-4 font-body text-base text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-lime";

/**
 * Address field with Mapbox autocomplete. When a suggestion is picked, the
 * coordinates ride along as hidden inputs (lat, lng, placeName, neighborhood)
 * so the server doesn't have to guess. Typing again clears them.
 */
export default function AddressInput({
  name = "address",
  token,
  defaultValue = "",
  defaultCoords,
  placeholder,
  required,
  className,
  onPick,
}: {
  name?: string;
  token: string | null;
  defaultValue?: string;
  defaultCoords?: { lat: number; lng: number; neighborhood?: string | null } | null;
  placeholder?: string;
  required?: boolean;
  className?: string;
  onPick?: (s: Suggestion | null) => void;
}) {
  const listId = useId();
  const [text, setText] = useState(defaultValue);
  const [picked, setPicked] = useState<Suggestion | null>(
    defaultCoords
      ? { id: "initial", placeName: defaultValue, lat: defaultCoords.lat, lng: defaultCoords.lng, neighborhood: defaultCoords.neighborhood ?? null }
      : null
  );
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) return;
    if (picked && picked.placeName === text) return; // nothing to search
    const q = text.trim();
    if (q.length < 3) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`);
        url.searchParams.set("access_token", token);
        url.searchParams.set("autocomplete", "true");
        url.searchParams.set("country", "US");
        url.searchParams.set("proximity", LA_PROXIMITY);
        url.searchParams.set("types", "address,poi,neighborhood,locality,place");
        url.searchParams.set("limit", "5");
        const res = await fetch(url.toString(), { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as {
          features?: { id: string; place_name: string; center: [number, number]; text?: string; context?: { id: string; text: string }[] }[];
        };
        const next = (data.features ?? []).map((f) => ({
          id: f.id,
          placeName: f.place_name,
          lng: f.center[0],
          lat: f.center[1],
          neighborhood:
            f.context?.find((c) => c.id.startsWith("neighborhood"))?.text ||
            f.context?.find((c) => c.id.startsWith("locality"))?.text ||
            f.context?.find((c) => c.id.startsWith("place"))?.text ||
            null,
        }));
        setItems(next);
        setOpen(next.length > 0);
        setActive(-1);
      } catch {
        // aborted or offline; keep whatever is shown
      }
    }, 220);
    return () => clearTimeout(t);
  }, [text, token, picked]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(s: Suggestion) {
    setPicked(s);
    setText(s.placeName);
    setOpen(false);
    onPick?.(s);
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <input
        name={name}
        value={text}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={inputClass}
        onChange={(e) => {
          setText(e.target.value);
          if (picked) {
            setPicked(null);
            onPick?.(null);
          }
        }}
        onFocus={() => items.length > 0 && !picked && setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(items[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <input type="hidden" name="lat" value={picked?.lat ?? ""} />
      <input type="hidden" name="lng" value={picked?.lng ?? ""} />
      <input type="hidden" name="placeName" value={picked?.placeName ?? ""} />
      <input type="hidden" name="neighborhood" value={picked?.neighborhood ?? ""} />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-[0_8px_24px_rgba(1,1,1,0.06)]"
        >
          {items.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "cursor-pointer px-4 py-2.5 font-body text-sm text-ink/85",
                i === active ? "bg-paper-2" : "bg-white"
              )}
            >
              {s.placeName}
            </li>
          ))}
        </ul>
      )}
      {!token && (
        <p className="mt-1 font-body text-xs text-ink/55">
          Type the full street address — suggestions are off until a public Mapbox token is set.
        </p>
      )}
    </div>
  );
}
