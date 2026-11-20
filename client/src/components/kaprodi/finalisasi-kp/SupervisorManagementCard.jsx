import { useState } from 'react';
import {
  IconCheckCircle,
  IconClose,
  IconEdit,
  IconExclamationTriangle,
  IconInformationCircle,
  IconSpinner,
  IconUser,
  IconUsers,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';
import { BimbinganStatusBadge } from './FinalisasiKpStatusBadge.jsx';

/**
 * Format tanggal Indonesia ringkas
 */
function formatShortDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}

/**
 * Ekstraksi inisial nama
 */
function getInitials(name) {
  if (!name) return 'D';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Komponen Pengelolaan Dosen Pembimbing Aktif & Penggantian Pembimbing
 * Menggunakan gaya minimalis modern selaras dengan modul Penugasan Reviewer.
 *
 * @param {object} props
 * @param {object} props.pembimbing - Data penugasan pembimbing aktif saat ini
 * @param {string} props.statusBimbingan - Status aktivitas bimbingan ('SUDAH_DIMULAI' | 'BELUM_DIMULAI')
 * @param {Array} props.candidates - Daftar kandidat dosen pembimbing prodi
 * @param {boolean} props.submittingReplace - Status proses submit penggantian
 * @param {Function} props.onReplace - Handler submit penggantian ({ dosen_baru_id, alasan_penggantian })
 */
export default function SupervisorManagementCard({
  pembimbing,
  statusBimbingan = 'BELUM_DIMULAI',
  candidates = [],
  submittingReplace = false,
  onReplace,
}) {
  const [showReplaceForm, setShowReplaceForm] = useState(false);
  const [newDosenId, setNewDosenId] = useState('');
  const [reason, setReason] = useState('');

  const currentDosen = pembimbing?.dosen;
  const currentDosenId = pembimbing?.dosen_id;
  const isStarted = statusBimbingan === 'SUDAH_DIMULAI';

  // Opsi kandidat pengganti: kecualikan dosen pembimbing yang sedang aktif
  const replacementOptions = candidates
    .filter((c) => c.id !== currentDosenId)
    .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
    .map((c) => ({
      value: String(c.id),
      label: `${c.nama_lengkap} (Beban: ${c.jumlah_penugasan_pembimbing_aktif ?? 0} mhs)`,
    }));

  const handleCancelReplace = () => {
    setShowReplaceForm(false);
    setNewDosenId('');
    setReason('');
  };

  const handleSubmitReplace = (e) => {
    e.preventDefault();
    if (!newDosenId || !reason.trim() || reason.trim().length < 10 || submittingReplace) {
      return;
    }

    onReplace({
      dosen_baru_id: Number(newDosenId),
      alasan_penggantian: reason.trim(),
    });
  };

  return (
    <div className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 space-y-3.5 shadow-none">
      <div className="flex items-center justify-between border-b border-slate-900/[0.06] pb-2.5">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
          Pembimbing Resmi Ditugaskan
        </span>
        <BimbinganStatusBadge status={statusBimbingan} />
      </div>

      {/* Row Dosen Pembimbing Aktif */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-900/[0.08] bg-white shadow-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-full bg-brand/10 text-brand font-bold text-xs flex items-center justify-center shrink-0 select-none">
            {getInitials(currentDosen?.nama_lengkap)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-ink truncate">
              {currentDosen?.nama_lengkap || 'Dosen Pembimbing'}
            </p>
            <p className="text-[10px] text-muted font-mono">
              Kode Dosen: {currentDosen?.kode_dosen || '-'} • Ditetapkan:{' '}
              {formatShortDate(pembimbing?.mulai_at)}
            </p>
          </div>
        </div>

        {!isStarted && !showReplaceForm && (
          <button
            type="button"
            onClick={() => setShowReplaceForm(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-900/10 px-2.5 py-1 text-xs font-medium text-secondary hover:text-ink hover:bg-slate-50 transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
            title="Ganti pembimbing dengan dosen lain"
          >
            <IconEdit className="size-3" />
            <span>Ganti</span>
          </button>
        )}
      </div>

      {/* Catatan jika Bimbingan Sudah Dimulai */}
      {isStarted && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-900/[0.06] bg-slate-50 p-3 text-xs text-secondary">
          <IconInformationCircle className="size-4 text-brand shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Bimbingan Kerja Praktik telah dimulai. Dosen pembimbing tidak dapat diganti lagi melalui menu ini.
          </p>
        </div>
      )}

      {/* Form Inline Penggantian Pembimbing (Hanya jika belum dimulai) */}
      {!isStarted && showReplaceForm && (
        <form
          onSubmit={handleSubmitReplace}
          className="rounded-[18px] border border-slate-900/[0.12] bg-slate-50/50 p-4 space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <IconEdit className="size-3.5 text-brand" />
              <span>Ganti Pembimbing: {currentDosen?.nama_lengkap}</span>
            </div>
            <button
              type="button"
              onClick={handleCancelReplace}
              className="text-muted hover:text-ink cursor-pointer"
              title="Batal"
            >
              <IconClose className="size-3.5" />
            </button>
          </div>

          <div>
            <label
              htmlFor="select-replacement-supervisor"
              className="block text-[11px] font-bold text-secondary mb-1"
            >
              Pilih Dosen Pembimbing Pengganti <span className="text-rose-600">*</span>
            </label>
            <CustomSelect
              id="select-replacement-supervisor"
              value={newDosenId}
              options={replacementOptions}
              onChange={(val) => setNewDosenId(val)}
              placeholder="Pilih dosen pengganti..."
              searchable={true}
              icon={IconUser}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="reason-replace-supervisor"
                className="block text-[11px] font-bold text-secondary"
              >
                Alasan Penggantian <span className="text-rose-600">*</span>
              </label>
              <span className="text-[10px] text-muted font-mono">
                {reason.length}/500 (min. 10)
              </span>
            </div>
            <textarea
              id="reason-replace-supervisor"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tuliskan alasan resmi penggantian dosen pembimbing…"
              maxLength={500}
              className="w-full rounded-xl border border-slate-900/[0.12] bg-white p-2.5 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancelReplace}
              disabled={submittingReplace}
              className="rounded-lg border border-slate-900/10 bg-white px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!newDosenId || reason.trim().length < 10 || submittingReplace}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white px-3 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submittingReplace ? (
                <>
                  <IconSpinner className="size-3 animate-spin text-white" />
                  <span>Menyimpan…</span>
                </>
              ) : (
                <span>Simpan Penggantian</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
