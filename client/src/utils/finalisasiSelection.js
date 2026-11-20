export function isFinalisasiSelectable(item) {
  return Boolean(item?.is_eligible && item.status_finalisasi === 'SIAP_DITETAPKAN' && item.proposal_terkini?.id);
}

export function toggleFinalisasiSelection(selected, item) {
  if (!isFinalisasiSelectable(item)) return selected;
  return selected.some((row) => row.id === item.id)
    ? selected.filter((row) => row.id !== item.id) : [...selected, item];
}

export function toggleFinalisasiPage(selected, items) {
  const eligible = items.filter(isFinalisasiSelectable);
  if (!eligible.length) return selected;
  const ids = new Set(eligible.map((row) => row.id));
  if (eligible.every((row) => selected.some((item) => item.id === row.id))) {
    return selected.filter((row) => !ids.has(row.id));
  }
  return [...new Map([...selected, ...eligible].map((row) => [row.id, row])).values()];
}
