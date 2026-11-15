import { useState } from 'react';
import {
  IconCheckCircle,
  IconClipboardCheck,
  IconExclamationCircle,
  IconInformationCircle,
  IconLockClosed,
  IconSpinner,
} from '../../common/Icons.jsx';
import { KP_DOCUMENT_CODES } from '../../../services/pengajuanKp.js';

/**
 * Komponen Sidebar Ringkasan Kelengkapan & Aksi Simpan / Kirim Pengajuan KP
 * 
 * @param {object} props
 * @param {object} props.formData - State formulir saat ini
 * @param {Array} props.dokumenList - Daftar berkas terunggah saat ini
 * @param {object|null} props.dataDiri - Data status kelengkapan data diri mahasiswa
 * @param {object|null} props.jadwal - Data jadwal aktif (untuk cek is_open)
 * @param {boolean} props.setujuPernyataan - Nilai persetujuan pernyataan integritas
 * @param {Function} props.onTogglePernyataan - Handler toggle persetujuan
 * @param {Function} props.onSaveDraft - Handler klik simpan draf
 * @param {Function} props.onSubmitPengajuan - Handler klik kirim pengajuan (submit)
 * @param {boolean} [props.isSaving] - Loading state simpan draf
 * @param {boolean} [props.isSubmitting] - Loading state kirim pengajuan
 * @param {boolean} [props.readOnly] - Status hanya-baca jika pengajuan sudah dikirim
 */
export default function KpChecklistSidebar({
  formData,
  dokumenList = [],
  dataDiri = null,
  jadwal = null,
  setujuPernyataan = false,
  onTogglePernyataan,
  onSaveDraft,
  onSubmitPengajuan,
  isSaving = false,
  isSubmitting = false,
  readOnly = false,
}) {
  // 1. Cek Kelayakan Seksi 1: Mitra KP
  const isMitraLengkap = Boolean(
    formData.objek_penelitian?.trim() && formData.lokasi_penelitian?.trim()
  );

  // 2. Cek Kelayakan Seksi 2: Topik & Pembimbing
  const isTopikLengkap = Boolean(
    formData.tema_penelitian_id &&
      formData.judul_penelitian?.trim()?.length >= 5 &&
      formData.usulan_pembimbing_id
  );

  // 3. Cek Kelayakan Seksi 3: Syarat Akademik
  const ipkNum = Number(formData.ipk_saat_pengajuan);
  const sksNum = Number(formData.jumlah_sks_saat_pengajuan);
  const isIpkValid = formData.ipk_saat_pengajuan !== '' &&
    Number.isFinite(ipkNum) && ipkNum >= 0 && ipkNum <= 4;
  const isSksValid = formData.jumlah_sks_saat_pengajuan !== '' &&
    Number.isInteger(sksNum) && sksNum >= 0 && sksNum <= 32767;
  const isDeValid =
    formData.memiliki_nilai_de === false ||
    (formData.memiliki_nilai_de === true && Boolean(formData.daftar_mk_nilai_de?.trim()));
  const isSppAnswered = typeof formData.sudah_bayar_spp_variabel === 'boolean';
  const isAkademikLengkap = isIpkValid && isSksValid && isDeValid && isSppAnswered;

  // 4. Cek Kelayakan Seksi 4: Berkas Persyaratan KP
  const getDocCode = (d) =>
    d?.persyaratan_pengajuan?.jenis_dokumen?.kode_jenis ||
    d?.jenis_dokumen?.kode_jenis ||
    d?.persyaratan?.jenis_dokumen?.kode_jenis ||
    d?.kode_jenis ||
    null;

  const hasDocMatching = (allowedCodes) =>
    dokumenList.some(
      (d) => allowedCodes.includes(getDocCode(d)) && d.is_terkini !== false
    );

  const hasProposal = hasDocMatching(['PROPOSAL_KP']);
  const hasBuktiBayar = hasDocMatching(['BUKTI_BAYAR_PROPOSAL_KP', 'BUKTI_PEMBAYARAN_KP']);
  const hasSppDoc =
    formData.sudah_bayar_spp_variabel === true
      ? hasDocMatching(['BUKTI_SPP_VARIABEL_KP', 'SPP_VARIABEL_KP'])
      : true; // Tidak wajib jika SPP variabel false
  const hasSosialisasi = hasDocMatching([
    'SERTIFIKAT_SOSIALISASI_KP',
    'SOSIALISASI_KP',
    'SURAT_PERNYATAAN_SOSIALISASI_KP',
    'SURAT_SOSIALISASI_KP',
  ]);
  const isDokumenKpLengkap = hasProposal && hasBuktiBayar && hasSppDoc && hasSosialisasi;

  // 5. Cek Kelayakan Seksi 5: Data Diri Mahasiswa (6/6 terunggah)
  const isDataDiriLengkap = Boolean(dataDiri?.lengkap);

  // Hitung total checklist selesai
  const checklistItems = [
    { label: 'Data Mitra & Lokasi KP', completed: isMitraLengkap },
    { label: 'Topik & Usulan Pembimbing', completed: isTopikLengkap },
    { label: 'Prasyarat Akademik & Nilai', completed: isAkademikLengkap },
    { label: 'Berkas Persyaratan KP', completed: isDokumenKpLengkap },
    { label: 'Kelengkapan Data Diri (6/6)', completed: isDataDiriLengkap },
  ];

  const completedCount = checklistItems.filter((i) => i.completed).length;
  const percentage = Math.round((completedCount / checklistItems.length) * 100);
  const isAllComplete = completedCount === checklistItems.length;

  const isOpen = Boolean(jadwal?.is_open);
  const canSubmit = isOpen && isAllComplete && setujuPernyataan && !isSaving && !isSubmitting && !readOnly;

  return (
    <aside
      aria-label="Panel Kelengkapan dan Tindakan Pengajuan KP"
      className="sticky top-20 space-y-5"
    >
      {/* Kartu Ringkasan Progres */}
      <div className="rounded-xl border border-line bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <IconClipboardCheck className="size-5 text-brand" />
            <h3 className="text-sm font-bold text-ink">
              Kelengkapan Pengajuan
            </h3>
          </div>
          <span className="text-xs font-bold text-brand">
            {percentage}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
            <div
              className={`h-full transition-all duration-300 ${
                percentage === 100 ? 'bg-emerald-500' : 'bg-brand'
              }`}
              style={{ width: `${percentage}%` }}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="mt-1.5 text-right text-xs text-muted">
            {completedCount} dari {checklistItems.length} tahap terpenuhi
          </p>
        </div>

        {/* Daftar Checklist Dinamis */}
        <ul className="mt-4 space-y-2.5 text-xs">
          {checklistItems.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2.5">
              <span
                className={`flex size-4.5 shrink-0 items-center justify-center rounded-full ${
                  item.completed
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-subtle text-muted border border-line'
                }`}
              >
                {item.completed ? (
                  <IconCheckCircle className="size-3.5" />
                ) : (
                  <span className="size-1.5 rounded-full bg-slate-300" />
                )}
              </span>
              <span
                className={
                  item.completed
                    ? 'font-medium text-ink'
                    : 'text-secondary'
                }
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        {/* Checkbox Pernyataan Integritas */}
        {!readOnly && (
          <div className="mt-5 border-t border-line pt-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-ink">
              <input
                type="checkbox"
                checked={setujuPernyataan}
                onChange={(e) => onTogglePernyataan(e.target.checked)}
                disabled={isSaving || isSubmitting}
                className="mt-0.5 size-4 rounded border-line text-brand focus:ring-brand"
              />
              <span className="leading-snug">
                Saya menyatakan dengan sesungguhnya bahwa seluruh data dan berkas yang saya serahkan adalah <strong>benar, sah, dan dapat dipertanggungjawabkan</strong>.
              </span>
            </label>
          </div>
        )}

        {/* Tombol Aksi Simpan Draf & Kirim */}
        {!readOnly && (
          <div className="mt-5 space-y-2.5">
            {/* Tombol Kirim Pengajuan (Submit) */}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onSubmitPengajuan}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white shadow-xs transition focus:outline-hidden ${
                canSubmit
                  ? 'bg-brand hover:bg-brand-hover active:bg-brand-pressed'
                  : 'cursor-not-allowed bg-slate-300 text-slate-500 opacity-80'
              }`}
            >
              {isSubmitting ? (
                <>
                  <IconSpinner className="size-4 animate-spin" />
                  Mengirim Pengajuan...
                </>
              ) : (
                'Kirim Pengajuan (Submit)'
              )}
            </button>

            {/* Petunjuk bila submit belum bisa diklik */}
            {!canSubmit && (
              <div className="rounded-lg bg-subtle/80 p-2.5 text-xs text-secondary leading-relaxed">
                {!isOpen ? (
                  <span className="flex items-center gap-1.5 text-danger font-medium">
                    <IconLockClosed className="size-3.5 shrink-0" />
                    Jadwal pengajuan sedang ditutup.
                  </span>
                ) : !isAllComplete ? (
                  <span>
                    ℹ️ Lengkapi seluruh 5 tahap persyaratan di atas untuk mengaktifkan tombol kirim.
                  </span>
                ) : !setujuPernyataan ? (
                  <span>
                    ⚠️ Centang kotak pernyataan kebenaran data di atas untuk melanjutkan.
                  </span>
                ) : null}
              </div>
            )}

            {/* Tombol Simpan Draf */}
            <button
              type="button"
              disabled={isSaving || isSubmitting}
              onClick={onSaveDraft}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-xs font-semibold text-ink shadow-xs transition hover:bg-subtle focus:outline-hidden disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <IconSpinner className="size-3.5 animate-spin text-brand" />
                  Menyimpan Draf...
                </>
              ) : (
                'Simpan Sebagai Draf'
              )}
            </button>
          </div>
        )}

        {/* Mode Read-Only Notice */}
        {readOnly && (
          <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
            <div className="flex items-center gap-1.5 font-bold">
              <IconCheckCircle className="size-4 text-emerald-700" />
              Pengajuan Telah Dikirim
            </div>
            <p className="mt-1 text-emerald-950/80">
              Formulir berada dalam mode hanya-baca. Pantau tahapan verifikasi dan review pada riwayat di atas.
            </p>
          </div>
        )}
      </div>

      {/* Catatan Panduan Mahasiswa */}
      <div className="rounded-xl border border-line bg-white p-4 text-xs text-secondary">
        <h4 className="font-bold text-ink">Ketentuan Pengajuan KP:</h4>
        <ul className="mt-2 space-y-1.5 list-disc pl-4 leading-relaxed">
          <li>Pengajuan hanya dapat dilakukan pada periode akademik yang aktif dan terbuka.</li>
          <li>Setiap perubahan proposal tercatat secara transparan sebagai riwayat versi dokumen.</li>
          <li>Penetapan resmi dosen pembimbing dilakukan oleh Kaprodi saat keputusan ACC pengajuan diterbitkan.</li>
        </ul>
      </div>
    </aside>
  );
}

