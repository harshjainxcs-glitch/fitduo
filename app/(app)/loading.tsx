// Instant skeleton shown while a page's server component streams — makes tab
// navigation feel immediate instead of "hanging" on the click.
export default function Loading() {
  return (
    <div className="space-y-4 px-4 py-2" aria-hidden>
      <div className="h-24 animate-pulse rounded-3xl bg-muted" />
      <div className="h-52 animate-pulse rounded-3xl bg-muted" />
      <div className="h-20 animate-pulse rounded-2xl bg-muted" />
      <div className="h-20 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
