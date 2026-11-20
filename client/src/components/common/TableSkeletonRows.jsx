export default function TableSkeletonRows({ count = 5, columns = 6 }) {
  return Array.from({ length: count }, (_, row) => (
    <tr key={row} aria-hidden="true" className="motion-safe:animate-pulse border-b border-slate-900/[0.04]">
      {Array.from({ length: columns }, (_, column) => (
        <td key={column} className="px-4 py-4 first:pl-6 last:pr-6">
          <div className="h-3 w-4/5 max-w-40 rounded bg-slate-200/70" />
          <div className="mt-2 h-2.5 w-1/2 max-w-24 rounded bg-slate-200/40" />
        </td>
      ))}
    </tr>
  ));
}

export function ListSkeleton({ columns = 5 }) {
  return <div role="status" aria-label="Memuat data" className="overflow-hidden rounded-[18px] border border-slate-900/[0.08] bg-white">
    <span className="sr-only">Memuat data?</span>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]" aria-hidden="true">
        <thead><tr className="border-b border-line bg-slate-50/50">
          {Array.from({ length: columns }, (_, index) => <th key={index} className="px-4 py-3.5">
            <div className="h-2.5 w-20 rounded bg-slate-200/70 motion-safe:animate-pulse" />
          </th>)}
        </tr></thead>
        <tbody><TableSkeletonRows columns={columns} /></tbody>
      </table>
    </div>
  </div>;
}
