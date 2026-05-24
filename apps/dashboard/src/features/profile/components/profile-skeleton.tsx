export function ProfileSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="space-y-4">
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <div className="h-9 w-40 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="h-4 w-20 rounded bg-muted animate-pulse" />
      <div className="h-9 w-full rounded-lg bg-muted animate-pulse" />
    </div>
  );
}
