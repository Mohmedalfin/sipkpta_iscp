const optionalNumber = (value) => value === '' || value === null || value === undefined
  ? null : Number(value);

export function buildKpFormPayload(formData) {
  return {
    tema_penelitian_id: Number(formData.tema_penelitian_id),
    judul_penelitian: formData.judul_penelitian?.trim(),
    objek_penelitian: formData.objek_penelitian?.trim() || null,
    lokasi_penelitian: formData.lokasi_penelitian?.trim() || null,
    usulan_pembimbing_id: optionalNumber(formData.usulan_pembimbing_id),
    ipk_saat_pengajuan: optionalNumber(formData.ipk_saat_pengajuan),
    jumlah_sks_saat_pengajuan: optionalNumber(formData.jumlah_sks_saat_pengajuan),
    memiliki_nilai_de: formData.memiliki_nilai_de,
    daftar_mk_nilai_de: formData.memiliki_nilai_de
      ? formData.daftar_mk_nilai_de?.trim() || null : null,
    sudah_bayar_spp_variabel: formData.sudah_bayar_spp_variabel,
  };
}

export function validateKpDraftNumbers(formData) {
  const errors = {};
  const ipk = optionalNumber(formData.ipk_saat_pengajuan);
  const sks = optionalNumber(formData.jumlah_sks_saat_pengajuan);
  if (ipk !== null && (!Number.isFinite(ipk) || ipk < 0 || ipk > 4)) {
    errors.ipk_saat_pengajuan = 'IPK harus berupa angka antara 0 dan 4.';
  }
  if (sks !== null && (!Number.isInteger(sks) || sks < 0 || sks > 32767)) {
    errors.jumlah_sks_saat_pengajuan = 'Jumlah SKS harus berupa bilangan bulat yang valid.';
  }
  return errors;
}

export function selectKpApplication(applications, periodId, historyId = null) {
  const current = applications.find((item) => item.periode_akademik?.id === periodId) || null;
  const selected = applications.find((item) => item.id === historyId) || current ||
    (periodId === null ? applications[0] || null : null);
  return { current, selected, history: applications.filter((item) => item.id !== current?.id) };
}
