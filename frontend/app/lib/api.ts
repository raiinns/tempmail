// Thin typed wrappers around the TempMail REST API.
// Base URL is read from NEXT_PUBLIC_API_BASE_URL (required for client-side env in Next.js).

const BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
  "";

const API_KEY =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_KEY) || "";

export type Email = {
  id: number;
  fromAddress: string;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  recipient: string;
  receivedAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (API_KEY) {
    headers.set("x-api-key", API_KEY);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = `Failed to fetch ${path}: ${res.status} ${res.statusText}`;
    try {
      const parsed = (await res.json()) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** Fetch all emails (no filter). */
export function getEmails(): Promise<Email[]> {
  return request<Email[]>("/api/emails");
}

/** Fetch a single email by numeric ID. */
export function getEmailById(id: number): Promise<Email> {
  return request<Email>(`/api/emails/${encodeURIComponent(id)}`);
}

/** Fetch emails for a specific recipient address. */
export function getEmailsByRecipient(recipient: string): Promise<Email[]> {
  return request<Email[]>(
    `/api/emails?recipient=${encodeURIComponent(recipient)}`
  );
}
