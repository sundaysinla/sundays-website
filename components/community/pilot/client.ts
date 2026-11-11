export class PilotRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function pilotRequest<T>(action: string, fields: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("/api/community/pilot", {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ ...fields, action }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new PilotRequestError(body.error || "Couldn’t connect. Try again.", response.status);
  return body as T;
}
