import { redirect } from "next/navigation";

// Root-level deep-link route. This allows users to simply visit
// `http://localhost:3000/test@kanop.site` to open an inbox.
// It forwards to the SPA with the address pre-filled via the URL hash.
export default async function InboxRedirect({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);
  redirect(`/#address=${encodeURIComponent(decoded)}`);
}
