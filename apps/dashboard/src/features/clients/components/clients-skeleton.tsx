export function ClientsSkeleton() {
  return (
    <div
      className="bg-card rounded-xl border border-border overflow-hidden"
      aria-busy="true"
      aria-label="Cargando clientes"
    >
      <div className="border-b bg-secondary px-4 py-3">
        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-4 flex items-center gap-4 animate-pulse"
          >
            <div className="h-4 flex-1 rounded bg-secondary" />
            <div className="h-4 w-32 rounded bg-secondary hidden sm:block" />
            <div className="h-4 w-40 rounded bg-secondary hidden md:block" />
            <div className="h-5 w-16 rounded-full bg-secondary" />
            <div className="h-4 w-8 rounded bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}
