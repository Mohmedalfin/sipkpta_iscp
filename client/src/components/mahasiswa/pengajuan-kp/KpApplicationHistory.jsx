export default function KpApplicationHistory({ items, selectedId, onSelect, onReturn }) {
  if (!items.length && !selectedId) return null;

  return <section aria-label="Riwayat Pengajuan KP" className="rounded-xl border border-line bg-white p-5 shadow-2xs">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
      <h2 className="text-sm font-bold text-ink">Riwayat Pengajuan KP</h2>
      {selectedId && <button type="button" onClick={onReturn} className="text-xs font-semibold text-brand hover:underline">
        Kembali ke periode saat ini
      </button>}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)}
        aria-current={selectedId === item.id ? 'true' : undefined}
        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selectedId === item.id
          ? 'border-brand bg-brand-soft text-brand' : 'border-line text-secondary hover:bg-subtle'}`}>
        <span className="font-semibold">{item.periode_akademik?.semester} {item.periode_akademik?.tahun_ajaran}</span>
        <span className="ml-2">#{item.id} · {item.status_pengajuan}</span>
      </button>)}
    </div>
  </section>;
}
