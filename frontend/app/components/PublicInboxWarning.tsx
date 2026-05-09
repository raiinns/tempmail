export default function PublicInboxWarning() {
  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
      <strong>Public inbox</strong>: Anyone who knows this email address can view this
      inbox. Do not use it for sensitive accounts.
    </div>
  );
}
