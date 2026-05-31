import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Client } from "../schemas/client-schema";

interface ClientsTableProps {
  data: Client[];
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

type ColumnMeta = { className?: string };

export function ClientsTable({ data, onEdit, onDelete }: ClientsTableProps) {
  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nombre",
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "company",
        header: "Empresa",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {getValue<string | null>() ?? "—"}
          </span>
        ),
        meta: { className: "hidden sm:table-cell" } satisfies ColumnMeta,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {getValue<string | null>() ?? "—"}
          </span>
        ),
        meta: { className: "hidden md:table-cell" } satisfies ColumnMeta,
      },
      {
        accessorKey: "status",
        header: "Estado",
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
        header: "Cotizaciones",
        accessorFn: (row) => row._count.quotes,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<number>()}</span>
        ),
      },
      {
        id: "actions",
        header: () => null,
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
    getCoreRowModel: getCoreRowModel(),
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
