'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { OpportunityListItem } from '@careerstack/contracts';
import { StatusBadge } from '@/components/common/status-badge';
import { DateTime } from '@/components/common/date-time';
import {
  EMPLOYMENT_TYPE_LABELS,
  formatLocations,
  formatSalary,
  WORK_ARRANGEMENT_LABELS,
} from '@/lib/opportunity-options';
import { FirstPartyMarker } from './first-party-marker';
import { SaveDismissActions } from './save-dismiss-actions';

const columnHelper = createColumnHelper<OpportunityListItem>();

const columns = [
  columnHelper.accessor('title', {
    header: 'Role',
    cell: (ctx) => {
      const item = ctx.row.original;
      return (
        <div className="flex items-center gap-2">
          <Link
            href={`/app/opportunities/${item.id}`}
            className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.title}
          </Link>
          {item.isFirstParty ? <FirstPartyMarker /> : null}
        </div>
      );
    },
  }),
  columnHelper.accessor('company', { header: 'Company' }),
  columnHelper.display({
    id: 'location',
    header: 'Location',
    cell: (ctx) => {
      const item = ctx.row.original;
      const location = formatLocations(item.locations);
      const arrangement = item.workArrangement
        ? WORK_ARRANGEMENT_LABELS[item.workArrangement]
        : undefined;
      return [location, arrangement].filter(Boolean).join(' · ') || '—';
    },
  }),
  columnHelper.accessor('employmentType', {
    header: 'Type',
    cell: (ctx) => {
      const value = ctx.getValue();
      return value ? EMPLOYMENT_TYPE_LABELS[value] : '—';
    },
  }),
  columnHelper.display({
    id: 'salary',
    header: 'Salary',
    cell: (ctx) => formatSalary(ctx.row.original.salary) ?? '—',
  }),
  columnHelper.display({
    id: 'status',
    header: 'Status',
    cell: (ctx) => (
      <StatusBadge canonical={ctx.row.original.status} userState={ctx.row.original.userState} />
    ),
  }),
  columnHelper.accessor('lastUpdatedAt', {
    header: 'Updated',
    cell: (ctx) => <DateTime value={ctx.getValue()} />,
  }),
  columnHelper.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: (ctx) => (
      <SaveDismissActions
        opportunityId={ctx.row.original.id}
        title={ctx.row.original.title}
        userState={ctx.row.original.userState}
        variant="icon"
        className="flex items-center justify-end"
      />
    ),
  }),
];

/** Tabular explorer view backed by TanStack Table (Req 40.1). */
export function OpportunitiesTable({ items }: { items: OpportunityListItem[] }) {
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b bg-muted/40 text-left">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b transition-colors last:border-0 hover:bg-muted/30">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-3 py-2 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
