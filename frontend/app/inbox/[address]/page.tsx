import { redirect } from "next/navigation";

// Legacy deep-link route. The inbox UI now lives on `/`; this shim forwards
// to the SPA with the address pre-filled via the URL hash so existing
// `/inbox/...` links keep working.
export default async function InboxRedirect({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);
  redirect(`/#address=${encodeURIComponent(decoded)}`);
}
