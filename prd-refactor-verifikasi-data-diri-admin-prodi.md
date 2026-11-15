# PRD — Refactor Aman Modul Verifikasi Data Diri Admin Prodi

> **Versi:** 1.0 · **Status:** rancangan eksekusi bertahap, menunggu persetujuan per fase  
> **Target:** `client/` saja — modul Verifikasi Data Diri Admin Prodi  
> **Sumber:** laporan audit yang diberikan pengguna; temuan perlu dikonfirmasi pada kode aktual sebelum perubahan.  
> **Rujukan umum:** `.docs/frontend/prd-frontend-architecture-performance.md`, `visual-direction.md`, dan `design-system.md`.

## 1. Tujuan dan prinsip keselamatan

Rapikan dua komponen yang terlalu banyak memikul tanggung jawab:

- `pages/admin-prodi/VerifikasiDataDiriPage.jsx` (dilaporkan ±589 baris).
- `components/admin-prodi/ReviewWorkspaceModal.jsx` (dilaporkan ±756 baris).

**Hasil yang diinginkan:** kode lebih mudah dipelihara dan diuji, batas state/komponen lebih jelas, serta peluang optimasi render lebih terukur. **Ini adalah refactor internal, bukan redesign atau penambahan fitur.**

### Invarian mutlak

1. **UI final harus tetap sama:** struktur visual, urutan konten, teks, spacing, warna, ikon, kelas Tailwind, responsivitas, overlay, scroll, dan animasi yang berlaku dipertahankan.
2. **Perilaku bisnis harus tetap sama:** alur verifikasi per dokumen, status, catatan revisi, verifikasi massal, data akademik, riwayat versi, dan izin akses tidak berubah.
3. **Kontrak API tetap sama:** tidak mengubah routes, controller, service backend, schema Prisma, migrasi, maupun payload request/response. `services/adminDataDiri.js` yang dinilai baik dipertahankan.
4. **Tidak mengubah fitur lain:** Login, AuthContext, role switching, app shell, dan halaman mahasiswa harus tetap berjalan.
5. **Satu perubahan kecil per fase:** jangan sekaligus memecah dua file, mengganti pengelolaan state, dan mengoptimasi jaringan.
6. **Tidak mengejar target jumlah baris.** Ukuran file yang lebih pendek bukan bukti performa lebih baik; prioritaskan kejelasan tanggung jawab dan kesetaraan perilaku.

## 2. Temuan dan keputusan ruang lingkup

| Temuan audit | Tindakan PRD | Prioritas | Catatan risiko |
| --- | --- | --- | --- |
| JSX, state, dan handler menumpuk pada `VerifikasiDataDiriPage` | Ekstraksi toolbar dan tabel sebagai komponen UI | **Masuk refactor inti** | Rendah–menengah; pertahankan handler, filtering, dan pagination |
| Modal review mencampur UI, fetch, tindakan, PDF | Ekstraksi sub-tampilan presentasional terlebih dahulu | **Masuk refactor inti** | Menengah; modal/focus trap dan alur review sensitif |
| Logic data/timer kompleks di page/modal | Ekstraksi custom hook **jika masih jelas manfaatnya setelah tahap UI** | **Opsional fase lanjut** | Menengah–tinggi; custom hook sendiri tidak mengisolasi re-render |
| Re-render tabel saat `searchInput` berubah | Profiling dan pertimbangan state input lokal/memoization yang terukur | **Optimasi terpisah** | Tidak otomatis teratasi dengan memindah JSX ke file baru |
| Timer pencarian tidak dibersihkan saat unmount | Verifikasi cleanup; perbaikan sempit dengan tes bila terbukti | **Perbaikan terpisah** | Mengubah lifecycle; jangan digabung dengan ekstraksi besar |
| Potensi Blob PDF tertinggal setelah modal ditutup | Audit ownership, `createObjectURL`/`revokeObjectURL`, dan race condition | **Perbaikan terpisah** | Temuan masih hipotesis; perlu reproduksi/tes |
| `loadSummaryCounts()` fetch `limit: 100` | Catat sebagai gap akurasi/efisiensi data | **Di luar refactor UI** | Perlu kontrak data ringkasan yang andal; jangan mengarang endpoint |

**Klarifikasi teknis:** memindahkan logic dari komponen ke custom hook dapat meningkatkan keterbacaan, tetapi **tidak otomatis mengurangi re-render komponen pemanggil**. Optimasi render perlu pengukuran dan batas state/props yang tepat. Demikian pula, dari potongan audit yang ditampilkan, guard `if (!active) return` sebelum `createObjectURL` telah melindungi satu jalur; jangan langsung menyimpulkan ada kebocoran tanpa memeriksa seluruh lifecycle objek URL.

## 3. Peta komponen yang ditargetkan

Pertahankan struktur proyek yang ada selama masih masuk akal. **Jangan membuat ulang** komponen berikut yang dilaporkan sudah tersedia: `QueueSummaryCards`, `StatusBadge`, `RevisionNoteModal`.

```text
client/src/
├── pages/admin-prodi/
│   └── VerifikasiDataDiriPage.jsx          # Tetap sebagai page composer
├── components/admin-prodi/
│   ├── QueueSummaryCards.jsx              # Existing — pertahankan
│   ├── StatusBadge.jsx                    # Existing — pertahankan
│   ├── RevisionNoteModal.jsx              # Existing — pertahankan
│   ├── VerificationToolbar.jsx            # Baru jika ekstraksi disetujui
│   ├── VerificationTable.jsx              # Baru jika ekstraksi disetujui
│   ├── ReviewWorkspaceModal.jsx           # Existing — dikurangi bertahap
│   └── workspace/
│       ├── StudentAcademicCard.jsx         # Baru: presentasi data akademik
│       ├── DocumentChecklistItem.jsx      # Baru: satu kartu dokumen
│       └── WorkspacePdfViewer.jsx         # Baru: tampilan preview/toolbar
└── hooks/ atau features/admin-prodi/...   # Ikuti konvensi existing
    ├── useAdminVerificationList.js        # Opsional fase lanjut
    └── useWorkspaceReview.js              # Opsional fase lanjut
```

**Batas komponen:**

- `VerifikasiDataDiriPage`: menghubungkan sumber data, filter terapan, daftar, dan modal.
- `VerificationToolbar`: input pencarian, tab filter, refresh; terima props dan panggil callback existing. Pemindahan ownership state pencarian **bukan bagian ekstraksi pertama**.
- `VerificationTable`: tabel, skeleton, empty state, rows, pagination sesuai tampilan existing; jangan mengubah urutan kolom atau perilaku klik.
- `ReviewWorkspaceModal`: tetap memiliki koordinasi detail, tindakan review, focus trap, dan penutupan sampai pemisahan logic disetujui.
- `StudentAcademicCard`, `DocumentChecklistItem`, `WorkspacePdfViewer`: ekstrak JSX dan props yang jelas, tanpa mengubah API call/action handler.
- Custom hooks (jika diperlukan): mengelompokkan *logic React* yang koheren, bukan membuat wrapper wajib demi mengejar arsitektur ideal.

## 4. Alur pengerjaan aman — satu fase per persetujuan

### Fase 0 — Baseline dan audit aktual (**READ-ONLY**, wajib)

1. Periksa file target, import, state, effect, callback, service API, dan tests; cocokkan dengan laporan audit. Periksa `git status` untuk menghormati perubahan pengguna yang sudah ada.
2. Jalankan build/lint/tes existing yang relevan **tanpa mengubah data produksi**. Catat baseline dan keterbatasan tes.
3. Rekam pembanding tampilan desktop/mobile (screenshot manual atau tes visual jika tersedia): tabel, filter, empty state, modal, PDF, catatan revisi, loading/error, dan konfirmasi.
4. Petakan alur verifikasi aktual termasuk status `PERLU_PERBAIKAN`/`TERVERIFIKASI` dan *history* dokumen. Jangan membuat status atau fixture baru tanpa kebutuhan.
5. Laporkan file yang akan tersentuh, perubahan per fase, risiko, serta rollback paling aman. **Berhenti menunggu persetujuan.**

### Fase 1 — Ekstraksi UI antrean (risiko relatif rendah)

1. Ekstrak `VerificationToolbar` tanpa memindah logic filter/debounce/API terlebih dahulu.
2. Verifikasi tampilan dan interaksi, lalu ekstrak `VerificationTable` dalam langkah terpisah.
3. Pertahankan state, debounce 300 ms, pagination, filter, refresh, sorting (jika ada), error/loading, dan semua handler sebagaimana semula.
4. **Gate:** build/lint, tes perilaku pencarian/filter/pagination, snapshot UI desktop/mobile, dan diff hanya pada bagian terkait. Berhenti jika ada regresi.

### Fase 2 — Ekstraksi UI workspace modal (risiko menengah)

Ekstrak satu per satu: `StudentAcademicCard` → `DocumentChecklistItem` → `WorkspacePdfViewer`. Pada setiap langkah:

1. Pindahkan **presentasi** dari modal ke child, teruskan data/handler sebagai props, jangan ubah aksi review dan fetch.
2. Pertahankan 6 kartu berkas, dokumen terkini, status/catatan, tab, PDF preview/download, tombol footer, urutan dan layout final.
3. Pastikan modal tetap mempunyai perilaku fokus, Escape, close overlay/tombol, scroll lock, dan navigasi antar mahasiswa yang sama.
4. **Gate:** tes semua aksi verifikasi termasuk `verifyAll`, buka/tutup/ubah dokumen saat loading, dan pemeriksaan visual. Hentikan jika fokus/modal/PDF berubah.

### Fase 3 — Ekstraksi logic ke hooks (**opsional**, perlu persetujuan baru)

Lakukan **hanya setelah** Fase 1–2 stabil dan masih ada logic yang sulit dipelihara:

- `useAdminVerificationList`: grup logic daftar/pagination/filter/debounce/refetch bila ekstraksi memberi manfaat nyata.
- `useWorkspaceReview`: grup lifecycle detail, preview, aksi review bila tetap terjaga satu sumber state dan ownership resource.
- Tidak boleh membuat dua sumber state dengan sinkronisasi `useEffect` tambahan.
- Jangan memindahkan context auth/role atau mengubah format service HTTP.
- **Gate:** pengujian workflow lengkap, cek race condition dan perubahan jumlah request, verifikasi visual. Hindari mengekstrak kedua hook sekaligus.

### Fase 4 — Optimasi terukur (**task terpisah**, bukan syarat selesai refactor)

1. **Pencarian:** ukur render saat mengetik menggunakan React DevTools Profiler; bila memang mahal, evaluasi local state di toolbar, stable props, atau `memo` seperlunya. Jangan mengubah hasil filter, debounce, atau UX yang disepakati.
2. **Timer:** audit cleanup saat unmount; tambahkan cleanup terisolasi dan tes navigasi cepat bila diperlukan.
3. **Blob PDF:** uji fetch in-flight → close, ganti mahasiswa, ganti dokumen, reopen, download, error; pastikan setiap URL yang dibuat memiliki owner dan direvoke saat tidak digunakan. Gunakan `AbortController` **hanya jika service/fetch mendukungnya**; jika belum, minta persetujuan perubahan sempit pada client service.
4. **Counter antrean:** jangan memperbaiki dengan mengambil seluruh data atau mengarang hasil. Audit apakah backend sudah mempunyai metadata count yang akurat. Jika belum, buat rekomendasi **task backend terpisah** untuk endpoint agregasi; tidak ada perubahan backend pada PRD ini.
5. Optimasi diterima hanya jika pengukuran menunjukkan manfaat **tanpa mengubah perilaku**.

## 5. Checklist regresi wajib pada setiap gate

| Area | Skenario pembanding |
| --- | --- |
| Antrean | Load daftar, status counts tetap tampil seperti baseline, search + debounce, filter tab, refresh, pagination, loading/empty/error |
| Modal | Buka/tutup dari baris, Escape, focus trap, scrolling, pindah mahasiswa, close ketika request berlangsung |
| Dokumen | Tampilkan 6 dokumen, pilih dokumen, lihat preview PDF, unduh, ganti tab, error file, close/reopen |
| Verifikasi | Setujui satu berkas, beri `PERLU_PERBAIKAN` + catatan, `verifyAll`, lihat agregat status dan penyegaran antrean |
| Riwayat | Revisi satu dokumen tidak mereset keputusan 5 dokumen lain; versi lama tetap historis sesuai backend |
| Akses | Role Admin Prodi sesuai route/protected guard existing; tidak mengekspos informasi di luar izin |
| Visual | Desktop dan mobile: spacing, warna, teks, card, tabel, header, modal, footer, tombol, responsive scroll dan fokus sama dengan baseline |

**Tidak cukup hanya `npm run build` PASS.** Lulus build tidak menjamin alur review, memori PDF, ataupun kesetaraan visual sudah benar. Jika automation UI belum tersedia, tulis hasil pemeriksaan manual secara jujur. Jangan mengklaim tes tidak dijalankan sebagai PASS.

## 6. Kriteria selesai dan stop condition

### Definition of Done untuk refactor inti (Fase 1–2)

- [ ] Kode UI sudah terbagi menurut tanggung jawab yang jelas dan komponennya dapat dibaca/diuji mandiri.
- [ ] Komponen/service existing yang baik tidak dibuat ulang.
- [ ] Tidak ada perubahan backend, API contract, status bisnis, auth, dan data model.
- [ ] Alur verifikasi per berkas, revisi, verifikasi massal, histori, refresh list, dan PDF tetap berfungsi.
- [ ] Tampilan desktop/mobile dan aksesibilitas interaksi sama seperti baseline, tanpa redesign.
- [ ] Build/lint/tes yang tersedia lulus; pekerjaan yang belum diuji dilaporkan.
- [ ] Perubahan hanya menyentuh file terkait; diff dapat direview dan dipulihkan per fase.

### Wajib berhenti dan meminta arahan jika:

- UI berubah, ada status/action yang bergeser, atau request backend berubah tanpa alasan.
- Perubahan membutuhkan endpoint agregat baru atau perubahan kontrak `adminDataDiri.js` yang memengaruhi modul lain.
- Perlu mengubah logic approval, ownership token, permission, historis dokumen, atau data persisten.
- Tes kritis gagal atau penyebabnya belum diketahui.
- Ada perubahan pengguna di file target yang tidak dapat dipisahkan secara aman.

**Jangan memakai `git reset --hard` atau memaksa overwrite.** Jika harus membatalkan fase, identifikasi diff spesifik dan pulihkan hanya perubahan yang dibuat dalam fase tersebut setelah memastikan tidak menimpa pekerjaan pengguna.

## 7. Format laporan singkat untuk agent

Setelah **setiap fase**, laporkan:

1. **Fase:** nomor + status `PASS / BLOCKED / NEEDS REVIEW`.
2. **Perubahan:** file yang diekstrak/diubah, alasan, dan apa yang tetap tidak berubah.
3. **Verifikasi:** build/lint/tes/manual UI yang benar-benar dijalankan.
4. **Performa:** temuan sebelum/sesudah **bila diukur**, atau tulis *belum diukur*.
5. **Risiko tersisa:** termasuk counter agregat dan Blob PDF jika belum ditangani.
6. **Gate:** minta persetujuan sebelum melanjutkan fase berikutnya.

