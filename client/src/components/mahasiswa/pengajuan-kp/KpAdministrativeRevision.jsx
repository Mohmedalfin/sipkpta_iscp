import { useState } from 'react';
import { useToast } from '../../../context/ToastContext.jsx';
import { pengajuanKpErrorMessage, reviseKpApplication, sendKpRevision } from '../../../services/pengajuanKp.js';
import KpDocumentUploader from './KpDocumentUploader.jsx';

const inputClass = 'mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20';
const buttonClass = 'rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50';

export default function KpAdministrativeRevision({ pengajuan, persyaratan, onRefresh }) {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [values, setValues] = useState({
    judul_penelitian: pengajuan.versi_topik?.judul_penelitian || '',
    objek_penelitian: pengajuan.versi_topik?.objek_penelitian || '',
    lokasi_penelitian: pengajuan.versi_topik?.lokasi_penelitian || '',
    ipk_saat_pengajuan: String(pengajuan.ipk_saat_pengajuan ?? ''),
    jumlah_sks_saat_pengajuan: String(pengajuan.jumlah_sks_saat_pengajuan ?? ''),
    memiliki_nilai_de: pengajuan.memiliki_nilai_de,
    daftar_mk_nilai_de: pengajuan.daftar_mk_nilai_de || '',
  });
  const berkasOpen = pengajuan.status_pemeriksaan_berkas === 'BELUM_OK';
  const nilaiOpen = pengajuan.status_pemeriksaan_akademik === 'BELUM_OK';
  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));

  const save = async (category) => {
    if (busy) return;
    let payload;
    if (category === 'BERKAS') {
      payload = Object.fromEntries(['judul_penelitian', 'objek_penelitian', 'lokasi_penelitian']
        .map((field) => [field, values[field].trim()])
        .filter(([field, value]) => value !== (pengajuan.versi_topik?.[field] || '')));
      if (['judul_penelitian', 'objek_penelitian', 'lokasi_penelitian']
        .some((field) => !values[field].trim())) {
        setError('Judul, objek, dan lokasi KP harus terisi.');
        return;
      }
    } else {
      const ipk = Number(values.ipk_saat_pengajuan);
      const sks = Number(values.jumlah_sks_saat_pengajuan);
      if (!values.ipk_saat_pengajuan || !Number.isFinite(ipk) || ipk < 0 || ipk > 4 ||
        !values.jumlah_sks_saat_pengajuan || !Number.isInteger(sks) || sks < 0 || sks > 32767 ||
        typeof values.memiliki_nilai_de !== 'boolean' ||
        (values.memiliki_nilai_de && !values.daftar_mk_nilai_de.trim())) {
        setError('Lengkapi IPK, jumlah SKS bulat, dan keterangan nilai D/E.');
        return;
      }
      const next = { ipk_saat_pengajuan: ipk, jumlah_sks_saat_pengajuan: sks,
        memiliki_nilai_de: values.memiliki_nilai_de,
        daftar_mk_nilai_de: values.memiliki_nilai_de ? values.daftar_mk_nilai_de.trim() : null };
      payload = Object.fromEntries(Object.entries(next).filter(([field, value]) =>
        value !== (pengajuan[field] ?? null)));
    }
    if (!Object.keys(payload).length) {
      setError('Belum ada perubahan data. Jika hanya berkas yang diperbaiki, unggah versi baru di bawah.');
      return;
    }
    setBusy(category);
    setError('');
    try {
      await reviseKpApplication(pengajuan.id, payload);
      toast.success('Perbaikan berhasil disimpan. Kirim kategori perbaikan setelah selesai.');
      await onRefresh();
    } catch (reason) {
      setError(pengajuanKpErrorMessage(reason, 'Perbaikan belum dapat disimpan.'));
    } finally { setBusy(''); }
  };

  const send = async (category) => {
    if (busy) return;
    setBusy(category);
    setError('');
    try {
      await sendKpRevision(pengajuan.id, [category]);
      toast.success(`Perbaikan ${category === 'BERKAS' ? 'berkas' : 'nilai'} berhasil dikirim.`);
      await onRefresh();
    } catch (reason) {
      setError(pengajuanKpErrorMessage(reason, 'Perbaikan belum dapat dikirim.'));
    } finally { setBusy(''); }
  };

  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-danger">{error}</p>}
    {berkasOpen && <section className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-2xs">
      <div className="border-b border-line pb-3"><h3 className="text-sm font-bold text-ink">Perbaikan Berkas</h3>
        {pengajuan.catatan_pemeriksaan_berkas && <p className="mt-1 text-xs text-secondary">{pengajuan.catatan_pemeriksaan_berkas}</p>}</div>
      {['judul_penelitian', 'objek_penelitian', 'lokasi_penelitian'].map((field) =>
        <label key={field} className="block text-xs font-semibold text-ink">
          {({ judul_penelitian: 'Judul KP', objek_penelitian: 'Instansi & Objek KP',
            lokasi_penelitian: 'Lokasi / Kota Pelaksanaan' })[field]}
          <input name={field} value={values[field]} onChange={change} maxLength={field === 'lokasi_penelitian' ? 5000 : 255} className={inputClass} />
        </label>)}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!busy} onClick={() => save('BERKAS')} className={buttonClass}>Simpan perubahan berkas</button>
        <button type="button" disabled={!!busy} onClick={() => send('BERKAS')} className={buttonClass}>Kirim perbaikan berkas</button>
      </div>
      <KpDocumentUploader pengajuanId={pengajuan.id} dokumenList={pengajuan.dokumen_pengajuan}
        persyaratan={persyaratan} sudahBayarSpp={pengajuan.sudah_bayar_spp_variabel === true}
        onDocumentUploaded={onRefresh} disabled={!!busy} />
    </section>}
    {nilaiOpen && <section className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-2xs">
      <div className="border-b border-line pb-3"><h3 className="text-sm font-bold text-ink">Perbaikan Nilai</h3>
        {pengajuan.catatan_pemeriksaan_akademik && <p className="mt-1 text-xs text-secondary">{pengajuan.catatan_pemeriksaan_akademik}</p>}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-ink">IPK
          <input type="number" name="ipk_saat_pengajuan" min="0" max="4" step="0.01" value={values.ipk_saat_pengajuan} onChange={change} className={inputClass} />
        </label>
        <label className="text-xs font-semibold text-ink">Jumlah SKS
          <input type="number" name="jumlah_sks_saat_pengajuan" min="0" step="1" value={values.jumlah_sks_saat_pengajuan} onChange={change} className={inputClass} />
        </label>
      </div>
      <fieldset className="text-xs text-ink"><legend className="font-semibold">Memiliki nilai D/E?</legend>
        <div className="mt-2 flex gap-5">
          <label className="flex items-center gap-2"><input type="radio" name="nilai_de" checked={values.memiliki_nilai_de === false}
            onChange={() => setValues((current) => ({ ...current, memiliki_nilai_de: false, daftar_mk_nilai_de: '' }))} />Tidak</label>
          <label className="flex items-center gap-2"><input type="radio" name="nilai_de" checked={values.memiliki_nilai_de === true}
            onChange={() => setValues((current) => ({ ...current, memiliki_nilai_de: true }))} />Ya</label>
        </div>
      </fieldset>
      {values.memiliki_nilai_de && <label className="block text-xs font-semibold text-ink">Daftar mata kuliah nilai D/E
        <input name="daftar_mk_nilai_de" value={values.daftar_mk_nilai_de} onChange={change} className={inputClass} />
      </label>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!busy} onClick={() => save('NILAI')} className={buttonClass}>Simpan perubahan nilai</button>
        <button type="button" disabled={!!busy} onClick={() => send('NILAI')} className={buttonClass}>Kirim perbaikan nilai</button>
      </div>
    </section>}
  </div>;
}
