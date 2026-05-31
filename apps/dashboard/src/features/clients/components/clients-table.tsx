import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Client } from "../schemas/client-schema";

interface ClientsTableProps {
  data: Client[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

type ColumnMeta = { className?: string };

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="h-3 w-3" />;
  if (sorted === "desc") return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
}

function nextDirectionLabel(sorted: false | "asc" | "desc"): string {
  return sorted === "asc" ? "descendente" : "ascendente";
}

interface SortableHeaderProps {
  label: string;
  column: Column<Client, unknown>;
}

function SortableHeader({ label, column }: SortableHeaderProps) {
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting()}
      className="flex items-center gap-1 hover:text-foreground"
      aria-label={`Ordenar por ${label.toLowerCase()} (${nextDirectionLabel(column.getIsSorted())})`}
    >
      {label}
      <SortIcon sorted={column.getIsSorted()} />
    </button>
  );
}

export function ClientsTable({
  data,
  sorting,
  onSortingChange,
  onEdit,
  onDelete,
}: ClientsTableProps) {
  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader label="Nombre" column={column} />,
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "company",
        header: ({ column }) => <SortableHeader label="Empresa" column={column} />,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {getValue<string | null>() ?? "—"}
          </span>
        ),
        meta: { className: "hidden sm:table-cell" } satisfies ColumnMeta,
      },
      {
        accessorKey: "email",
        header: ({ column }) => <SortableHeader label="Email" column={column} />,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {getValue<string | null>() ?? "—"}
          </span>
        ),
        meta: { className: "hidden md:table-cell" } satisfies ColumnMeta,
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortableHeader label="Estado" column={column} />,
        cell: ({ getValue }) => {
          const status = getValue<Client["status"]>();
          return (
            <Badge variant={status === "ACTIVE" ? "success" : "default"}>
              {status}
            </Badge>
          );
        },
      },
      {
        id: "quotes",
        header: ({ column }) => (
          <SortableHeader label="Cotizaciones" column={column} />
        ),
        accessorFn: (row) => row._count.quotes,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<number>()}</span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(row.original)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Editar ${row.original.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(row.original)}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Eliminar ${row.original.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b bg-secondary text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                return (
                  <th
                    key={header.id}
                    className={`px-4 py-3 ${meta?.className ?? ""}`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-accent/50 transition-colors"
            >
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                return (
                  <td
                    key={cell.id}
                    className={`px-4 py-3 ${meta?.className ?? ""}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
