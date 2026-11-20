const reviewActions = {
  TERVALIDASI: 'VALIDASI',
  PERLU_PERBAIKAN: 'PERBAIKAN',
  DITOLAK: 'TOLAK',
};

export function bimbinganHistoryAction(event) {
  return event.aksi === 'PERIKSA' ? reviewActions[event.status_sesudah] : event.aksi;
}

export function latestBimbinganAttachments(detail) {
  const submission = detail?.riwayat?.find((event) =>
    (event.aksi === 'KIRIM' || event.aksi === 'KIRIM_REVISI') &&
    event.versi_pengiriman === detail.versi_pengiriman_terakhir);
  return submission?.lampiran_bimbingan ?? [];
}
