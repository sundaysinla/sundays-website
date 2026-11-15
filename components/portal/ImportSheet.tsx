"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import type { ImportRow } from "@/lib/carpool/import";
import { adminImportCommit, adminImportPreview } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

const label = "font-ui text-[10px] uppercase tracking-wide text-ink/55";
const body = "font-body text-ink/85";

/** Upload a CSV / Excel of people, preview what will happen, then import. */
export default function ImportSheet() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; placed: number; failed: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importable = rows?.filter((r) => !r.skip) ?? [];

  function reset() {
    setRows(null);
    setFileName(null);
    setError(null);
    setDone(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className="space-y-4 border-t border-dashed border-ink/15 pt-8">
      <div>
        <h2 className={label}>Import a spreadsheet</h2>
        <p className={cn(body, "mt-1 text-sm text-ink/55")}>
          A .csv or .xlsx with columns <span className="text-ink/85">name, email, phone, role, address, seats, notes, car</span>. Put a driver&apos;s name in <span className="text-ink/85">car</span> to seat a rider with them.{" "}
          <a href="/carpool-import-template.csv" download className="underline decoration-blueberry-200 underline-offset-4 hover:decoration-blueberry">
            Download the template
          </a>
          .
        </p>
      </div>

      {done ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-ink/25 bg-paper-2 p-4">
          <p className={cn(body, "text-base text-ink")}>
            Imported {done.created} {done.created === 1 ? "person" : "people"}
            {done.placed ? `, seated ${done.placed}` : ""}.
          </p>
          {done.failed.length > 0 ? (
            <ul className={cn(body, "list-disc pl-5 text-sm text-red-700")}>
              {done.failed.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : null}
          <button type="button" onClick={reset} className="font-ui text-[10px] uppercase text-ink underline decoration-blueberry-200 underline-offset-4">
            Import another
          </button>
        </div>
      ) : rows ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={cn(body, "text-sm")}>
              <span className="text-ink">{fileName}</span> · {importable.length} of {rows.length} rows will import
            </p>
            <button type="button" onClick={reset} className="font-ui text-[10px] uppercase text-ink/55 hover:text-ink">
              Choose another file
            </button>
          </div>
          <div className="max-h-80 overflow-auto rounded-2xl border border-ink/15">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-paper-2">
                <tr>
                  {["Name", "Role", "Address", "Car", "Notes"].map((h) => (
                    <th key={h} className={cn(label, "px-3 py-2 font-normal")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-ink/12">
                {rows.map((r) => (
                  <tr key={r.row} className={r.skip ? "opacity-50" : ""}>
                    <td className={cn(body, "px-3 py-2 align-top")}>
                      <span className="text-ink">{r.name || `(row ${r.row})`}</span>
                      {r.email ? <span className="block text-xs text-ink/55">{r.email}</span> : null}
                      {r.phone ? <span className="block text-xs text-ink/55">{r.phone}</span> : null}
                    </td>
                    <td className={cn(body, "px-3 py-2 align-top")}>
                      {r.role}
                      {r.role === "driver" && r.seats ? <span className="text-ink/55"> · {r.seats} seats</span> : null}
                    </td>
                    <td className={cn(body, "px-3 py-2 align-top")}>
                      {r.geo?.placeName ?? r.address ?? <span className="text-ink/55">—</span>}
                      {r.geo?.neighborhood ? <span className="block text-xs text-ink/55">{r.geo.neighborhood}</span> : null}
                    </td>
                    <td className={cn(body, "px-3 py-2 align-top")}>{r.car ?? <span className="text-ink/55">—</span>}</td>
                    <td className={cn(body, "px-3 py-2 align-top text-xs")}>
                      {r.issues.length ? (
                        <ul className={r.skip ? "text-red-700" : "text-ink/55"}>
                          {r.issues.map((i, k) => (
                            <li key={k}>{i}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-ink/55">ok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="dark"
              size="sm"
              disabled={pending || importable.length === 0}
              onClick={() => {
                setError(null);
                const fd = new FormData();
                fd.set("rows", JSON.stringify(rows));
                startTransition(async () => {
                  const r = await adminImportCommit(fd);
                  if (r.ok) {
                    setDone({ created: r.created, placed: r.placed, failed: r.failed });
                    router.refresh();
                  } else setError(r.error);
                });
              }}
            >
              {pending ? "Importing…" : `Import ${importable.length} ${importable.length === 1 ? "person" : "people"}`}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            const f = fd.get("file");
            if (!(f instanceof File) || !f.size) {
              setError("Choose a file first");
              return;
            }
            setFileName(f.name);
            startTransition(async () => {
              const r = await adminImportPreview(fd);
              if (r.ok) setRows(r.rows);
              else setError(r.error);
            });
          }}
        >
          <input
            ref={fileRef}
            name="file"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="block max-w-full font-body text-sm text-ink/85 file:mr-3 file:rounded-2xl file:border file:border-ink/15 file:bg-white file:px-3 file:pt-1.5 file:pb-1 file:font-ui file:text-[11px] file:uppercase file:text-ink hover:file:bg-paper-2"
          />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Reading…" : "Preview"}
          </Button>
        </form>
      )}
      {error ? <p className={cn(body, "text-sm text-red-700")}>{error}</p> : null}
    </section>
  );
}
