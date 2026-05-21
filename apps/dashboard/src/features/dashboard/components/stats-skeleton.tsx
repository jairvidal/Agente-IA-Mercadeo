export function StatsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      aria-busy="true"
      aria-label="Cargando estadísticas"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-xl border border-border p-5 shadow-soft animate-pulse"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-4 rounded bg-secondary" />
            <div className="h-3 w-24 rounded bg-secondary" />
          </div>
          <div className="h-8 w-16 rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}
