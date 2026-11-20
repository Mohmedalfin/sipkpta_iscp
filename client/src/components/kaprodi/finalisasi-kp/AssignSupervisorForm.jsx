import { useState } from 'react';
import {
  IconCheckCircle,
  IconSpinner,
  IconUser,
  IconUsers,
} from '../../common/Icons.jsx';
import CustomSelect from '../../common/CustomSelect.jsx';

/**
 * Form Penetapan Dosen Pembimbing KP Individual oleh Kaprodi
 * Gaya minimalis modern selaras dengan modul Penugasan Reviewer.
 *
 * @param {object} props
 * @param {Array} props.candidates - Daftar kandidat dosen pembimbing prodi
 * @param {object} [props.usulanPembimbing] - Info usulan pembimbing dari mahasiswa
 * @param {boolean} props.submitting - Status proses submit
 * @param {Function} props.onSubmit - Handler submit penetapan (dosenId)
 */
export default function AssignSupervisorForm({
  candidates = [],
  usulanPembimbing = null,
  submitting = false,
  onSubmit,
}) {
  const [selectedDosenId, setSelectedDosenId] = useState('');

  // Urutkan kandidat: usulan mahasiswa di paling atas, kemudian alfabetis nama
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (a.is_usulan && !b.is_usulan) return -1;
    if (!a.is_usulan && b.is_usulan) return 1;
    return a.nama_lengkap.localeCompare(b.nama_lengkap);
  });

  const options = sortedCandidates.map((c) => ({
    value: String(c.id),
    label: `${c.nama_lengkap} (Beban: ${c.jumlah_penugasan_pembimbing_aktif ?? 0} mhs)${
      c.is_usulan ? ' — ★ Usulan Mahasiswa' : ''
    }`,
  }));

  const handleSelectUsulan = () => {
    if (usulanPembimbing?.id) {
      setSelectedDosenId(String(usulanPembimbing.id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDosenId || submitting) return;
    onSubmit(Number(selectedDosenId));
  };

  const selectedCandidate = candidates.find((c) => String(c.id) === String(selectedDosenId));

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[18px] border border-slate-900/[0.08] bg-white p-4 space-y-3.5 shadow-none"
    >
      <div className="border-b border-slate-900/[0.06] pb-2.5">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
          Tetapkan Dosen Pembimbing Resmi
        </span>
        <p className="text-[11px] text-muted mt-0.5">
          Pilih dosen pembimbing aktif Program Studi. Usulan mahasiswa dapat dipilih langsung sebagai referensi.
        </p>
      </div>

      {/* Baris Pilihan Cepat Usulan Mahasiswa */}
      {usulanPembimbing?.nama_lengkap && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-900/[0.06] bg-slate-50/70 text-xs">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-muted block">
              Usulan Mahasiswa
            </span>
            <span className="font-semibold text-ink truncate block">
              {usulanPembimbing.nama_lengkap}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSelectUsulan}
            className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-900/10 bg-white hover:bg-slate-50 text-brand shadow-2xs transition-colors cursor-pointer"
          >
            Pilih Usulan Ini
          </button>
        </div>
      )}

      {/* Dropdown Kandidat */}
      <div>
        <label
          htmlFor="select-supervisor-candidate"
          className="block text-[11px] font-bold text-secondary mb-1"
        >
          Kandidat Dosen Pembimbing <span className="text-rose-600">*</span>
        </label>
        <CustomSelect
          id="select-supervisor-candidate"
          value={selectedDosenId}
          options={options}
          onChange={(val) => setSelectedDosenId(val)}
          placeholder="Pilih dosen pembimbing..."
          searchable={true}
          icon={IconUser}
        />
        {selectedCandidate && (
          <p className="mt-1 text-[11px] text-muted">
            Beban bimbingan aktif saat ini:{' '}
            <strong className="text-ink font-mono">
              {selectedCandidate.jumlah_penugasan_pembimbing_aktif ?? 0}
            </strong>{' '}
            mahasiswa.
            {selectedCandidate.is_usulan && (
              <span className="ml-1 text-amber-700 font-semibold">
                (Sesuai usulan mahasiswa)
              </span>
            )}
          </p>
        )}
      </div>

      {/* Tombol Aksi Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <span className="text-[10px] text-muted leading-relaxed">
          *Penetapan pembimbing mencatat penugasan resmi aktif dan memberi notifikasi ke mahasiswa.
        </span>
        <button
          type="submit"
          disabled={!selectedDosenId || submitting}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 self-end sm:self-auto"
        >
          {submitting ? (
            <>
              <IconSpinner className="size-3.5 animate-spin text-white shrink-0" />
              <span>Menyimpan…</span>
            </>
          ) : (
            <>
              <IconCheckCircle className="size-3.5 shrink-0" />
              <span>Tetapkan Pembimbing Resmi</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
