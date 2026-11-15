# PRD — Verifikasi Data Diri Mahasiswa oleh Admin Prodi

**Proyek:** SIPKITA | **Cakupan:** Backend Express/Prisma saja  
**Status:** Rancangan implementasi berdasarkan keputusan bimbingan 4 November 2026  
**Prioritas:** Setelah modul Pelengkapan Data Diri Mahasiswa yang sudah diimplementasikan dan lulus pengujian.

## 1. Tujuan dan keputusan bisnis

Enam PDF identitas yang diunggah mahasiswa **wajib diperiksa oleh Admin Prodi**. Penyelesaian upload **6/6 berarti lengkap secara administratif untuk mulai mengajukan**, **bukan** otomatis `TERVERIFIKASI`. Hanya Admin Prodi yang boleh menyetujui dokumen atau meminta perbaikan. Status keseluruhan menjadi `TERVERIFIKASI` jika keenam **versi terkini** telah disetujui.

Dalam roadmap berikutnya, mahasiswa boleh memulai pengajuan akademik setelah 6/6 terunggah, tetapi ACC akhir memerlukan verifikasi data diri. **Jangan implementasikan atau mengubah alur pengajuan/ACC dalam tugas ini**; aturan tersebut hanya dicatat sebagai kontrak integrasi mendatang.

**Enam jenis wajib:** `IJAZAH`, `KK`, `KTP`, `AKTA`, `KTM`, `FORM_DATA_DIRI` (`JenisDokumen.kategori_dokumen = DATA_DIRI`, PDF maksimal 5 MiB; data master telah tersedia pada `sipkita_dev`).

## 2. Aktor, hak akses, dan alur

- **Mahasiswa:** sudah mempunyai empat endpoint `GET /me/data-diri`, `PATCH /me/profil`, `PUT /me/data-diri/dokumen/:kodeJenis`, dan `GET /me/data-diri/dokumen/:kodeJenis/file` yang bekerja di bawah prefix route mahasiswa. Mahasiswa dapat melihat hasil pemeriksaan/catatan dan mengganti **hanya dokumen yang memang diizinkan untuk diperbaiki**.
- **Admin Prodi (`ADMIN_PRODI`, role aktif):** melihat daftar mahasiswa, detail enam berkas, mengunduh PDF privat, memverifikasi satu berkas, meminta revisi dengan catatan, atau memverifikasi semua berkas **milik satu mahasiswa** dalam satu tindakan.
- **Sistem:** menyimpan pemeriksa, waktu, catatan, versi historis, audit perubahan, dan status agregat. Otorisasi server-side wajib; menu UI bukan sumber izin.
- Pertahankan pembatasan cakupan satu Prodi pada implementasi Master Admin Prodi existing. Jika lebih dari satu Prodi dan belum ada pemetaan admin→prodi yang aman, **tolak akses**, jangan tampilkan seluruh mahasiswa.

### Alur normal

1. Mahasiswa melengkapi enam dokumen bertahap memakai endpoint existing. Dokumen terkini awalnya `BELUM_DIPERIKSA`.
2. Admin Prodi melihat daftar, mencari/filter mahasiswa, lalu membuka detail dan keenam berkas via endpoint berotorisasi. Mahasiswa dengan kurang dari 6/6 boleh tampil di daftar sebagai `BELUM_LENGKAP`, tetapi **belum dapat diputuskan verifikasi keseluruhannya**.
3. Admin memilih salah satu cara:
   - **Individual:** `TERVERIFIKASI` (catatan opsional) atau `PERLU_PERBAIKAN` (catatan **wajib dan tidak boleh kosong**) pada berkas terkini tertentu.
   - **Verifikasi Semua:** menyetujui enam berkas milik satu mahasiswa setelah pemeriksaan, hanya jika keenam berkas terkini ada **dan tidak ada status `PERLU_PERBAIKAN` yang belum diselesaikan**. Berkas yang telah disetujui sebelumnya tidak perlu kehilangan identitas/waktu pemeriksa aslinya.
4. Ketika satu dokumen `PERLU_PERBAIKAN`, mahasiswa melihat catatan pada GET data diri. Upload revisi menambahkan **versi baru**, menjadikan versi lama `is_terkini=false`; versi baru `BELUM_DIPERIKSA`; lima dokumen lain tetap seperti semula.
5. Service menghitung ulang status agregat setiap kali ada keputusan atau revisi. Hanya 6/6 dokumen versi terkini `TERVERIFIKASI` menghasilkan `VerifikasiDataDiri.status_verifikasi = TERVERIFIKASI`.
6. Dokumen `TERVERIFIKASI` dikunci dari penggantian bebas. Untuk membuka perbaikan setelah ACC, Admin Prodi dapat secara eksplisit mengubah dokumen terkini menjadi `PERLU_PERBAIKAN` **dengan catatan**, yang sekaligus membatalkan status verifikasi keseluruhan. Tidak perlu endpoint buka-kunci tambahan.

## 3. Tabel, atribut, dan relasi yang digunakan

Gunakan **schema aktual** di `server/prisma/schema.prisma`, bukan mengasumsikan snapshot lebih lama selalu identik.

| Model / Tabel | Peran dan kolom penting |
| --- | --- |
| `Mahasiswa` / `mahasiswa` | `id`, `user_id`, `nim`, `nama_lengkap`, `program_studi_id`; identitas pemilik enam berkas. |
| `VerifikasiDataDiri` / `verifikasi_data_diri` | Satu per mahasiswa: `mahasiswa_id` unik, `status_verifikasi`, `catatan_admin`, `diajukan_at`, `diperiksa_oleh_user_id`, `diperiksa_at`, `diverifikasi_at`. Status agregat, bukan status tiap berkas. |
| `DokumenDataDiri` / `dokumen_data_diri` | `verifikasi_data_diri_id`, `jenis_dokumen_id`, `dokumen_id`, `versi`, `is_terkini`, `status_dokumen`, `catatan_admin`, `diperiksa_oleh_user_id`, `diperiksa_at`. **Sumber utama keputusan per berkas/per versi.** |
| `JenisDokumen` / `jenis_dokumen` | Enam kode aktif dengan kategori `DATA_DIRI` dan kebijakan format/ukuran. Jangan mengubah master dalam tugas ini. |
| `Dokumen` / `dokumen` | Metadata file privat (`storage_key`, `nama_file_asli`, `mime_type`, `ukuran_bytes`, `diunggah_oleh_user_id`); tidak perlu salinan file baru pada verifikasi. |
| `User`, `Role`, `UserRole`, `AuthSession` | Akun pemeriksa, role aktif, status akun, dan otorisasi. Ambil ID pemeriksa dari JWT/session tervalidasi, bukan body. |
| `ProgramStudi` | Batas cakupan Admin Prodi sesuai aturan satu-Prodi saat ini. |
| `AuditLog` / `audit_logs` | Catat keputusan individual/massal, perubahan status sebelum/sesudah, ID berkas/mahasiswa, aktor, waktu. Jangan masukkan isi PDF atau informasi sensitif yang tidak diperlukan. |

Gunakan indeks/constraint existing untuk versi dan **maksimum satu** `is_terkini=true` per mahasiswa+jenis (`uq_dokumen_diri_terkini`). `DokumenDataDiri` menyimpan status **terakhir per versi**; keputusan berulang atas versi yang sama dilacak di `AuditLog`.

## 4. Aturan status dan validasi transisi

**Status dokumen individual (versi terkini):**

| Dari | Aksi Admin/Mahasiswa | Ke | Syarat |
| --- | --- | --- | --- |
| `BELUM_DIPERIKSA` | Admin menyetujui | `TERVERIFIKASI` | File terkini ada, role dan cakupan benar. |
| `BELUM_DIPERIKSA` | Admin meminta perbaikan | `PERLU_PERBAIKAN` | Catatan perbaikan wajib. |
| `TERVERIFIKASI` | Admin membuka perbaikan | `PERLU_PERBAIKAN` | Alasan wajib; status agregat dihitung ulang. |
| `PERLU_PERBAIKAN` | Mahasiswa mengunggah revisi | Versi **baru** `BELUM_DIPERIKSA` | Versi lama tidak dihapus; hanya berkas bermasalah diganti. |
| `PERLU_PERBAIKAN` | Admin mengoreksi keputusan keliru atas versi sama | `TERVERIFIKASI` | Keputusan eksplisit, jejak audit wajib. |
| `TERVERIFIKASI` | Mahasiswa mengganti tanpa permintaan revisi | **Ditolak** | Tidak boleh bypass persetujuan yang sudah diberikan. |

**Status keseluruhan:** hitung dari enam dokumen terkini, **bukan** jumlah baris historis.

1. Kurang dari enam jenis tersedia → tampilkan `BELUM_LENGKAP` sebagai **status kelengkapan turunan**, bukan wajib menambah enum DB.
2. Ada dokumen terkini `PERLU_PERBAIKAN` → agregat `PERLU_PERBAIKAN`.
3. Enam tersedia tetapi ada yang `BELUM_DIPERIKSA` → agregat `BELUM_DIVERIFIKASI` (atau konstanta pending existing yang ekuivalen).
4. Keenam dokumen terkini `TERVERIFIKASI` → agregat `TERVERIFIKASI`, isi `diverifikasi_at` dan pemeriksa keputusan final.
5. Saat status agregat turun dari `TERVERIFIKASI` karena revisi/pembukaan koreksi, **bersihkan atau perbarui penanda `diverifikasi_at` aktif secara konsisten**, tanpa menghapus histori keputusan di `AuditLog`.

Jangan mengarang enum baru: status di skema Prisma bertipe `String`. Periksa konstanta/service aktual lalu gunakan **satu vocabulary** secara konsisten. `catatan_admin` per berkas tidak disamakan dengan `catatan_admin` umum pada header verifikasi.

## 5. Kontrak endpoint — hanya Admin Prodi

Prefix usulan: `/api/admin-prodi/verifikasi-data-diri`. Cocokkan konvensi route aktual sebelum mendaftarkan.

| Method | Path tambahan | Fungsi |
| --- | --- | --- |
| `GET` | `/` | Daftar paginasi mahasiswa, pencarian `nim`/nama, filter status dan progres 6/6. Jangan ungkap path file. |
| `GET` | `/:mahasiswaId` | Detail mahasiswa, enam jenis wajib, metadata versi terkini, status, catatan, waktu/pemeriksa, serta ringkasan histori versi. |
| `GET` | `/:mahasiswaId/dokumen/:kodeJenis/file` | Stream PDF terkini dari penyimpanan privat melalui autentikasi dan scope Admin Prodi. |
| `PATCH` | `/:mahasiswaId/dokumen/:kodeJenis` | Set status `TERVERIFIKASI` atau `PERLU_PERBAIKAN` untuk **versi terkini**. |
| `POST` | `/:mahasiswaId/verifikasi-semua` | Verifikasi sekaligus seluruh dokumen **satu mahasiswa** bila seluruh prasyarat terpenuhi. |

Contoh payload individual (`expectedVersion` wajib, berasal dari GET detail sehingga keputusan tidak diterapkan ke versi baru yang belum dilihat admin):

```json
{ "status": "PERLU_PERBAIKAN", "catatan": "Foto KTP tidak terbaca jelas.", "expectedVersion": 1 }
```

```json
{ "status": "TERVERIFIKASI", "catatan": null, "expectedVersion": 2 }
```

Verifikasi-semua juga wajib menerima peta `expectedVersions` untuk **keenam kode**, misalnya `{ "IJAZAH": 1, "KK": 1, "KTP": 2, "AKTA": 1, "KTM": 1, "FORM_DATA_DIRI": 1 }` agar enam versi yang disetujui adalah versi yang benar-benar dilihat admin. Jika versi/penanda terkini berubah, balas konflik tanpa mengubah keputusan apa pun.

Gunakan response schema, error code, batas pencarian/paginasi, dan validasi `mahasiswaId` dari konvensi API existing. Semantik invalid `400/422`, tanpa login `401`, role/scope salah `403`, data tidak ditemukan `404`, serta race/stale-version `409` mengikuti konvensi proyek (jangan mengubah error handler global).

**Pengamanan request:** body status dibatasi allowlist; catatan revisi wajib, dipangkas spasi, dibatasi panjang; `diperiksa_oleh_user_id`, `diperiksa_at`, `is_terkini`, dan ID mahasiswa tidak boleh dikontrol klien. Verifikasi ulang identik sebaiknya idempotent/tidak menambah audit keputusan ganda, kecuali ada perubahan nyata.

## 6. Konsistensi transaksi dan skenario paralel

- **PATCH individual:** dalam satu transaksi validasi ulang versi terkini & scope → update keputusan hanya jika versi masih sama/terkini → hitung status enam dokumen terkini → update `VerifikasiDataDiri` → buat `AuditLog` perubahan.
- **POST verifikasi-semua:** dalam satu transaksi validasi 6/6 dan tidak ada revisi tertunda → set hanya dokumen pending yang layak menjadi terverifikasi → hitung status agregat → catat keputusan/audit. Jika salah satu langkah gagal, **semua rollback**.
- Tolak verifikasi berdasarkan snapshot UI yang sudah usang. Jika mahasiswa mengganti dokumen di antara GET dan PATCH, jangan sampai admin tanpa sengaja memverifikasi versi baru yang belum dilihatnya: gunakan identitas/nomor versi yang diharapkan dari detail GET dan validasi pada saat transaksi; jika beda, balas `409` dan minta refresh.
- Tangani dua admin memverifikasi bersamaan melalui transaksi/optimistic concurrency. Jangan menggunakan `findFirst` lalu `update` tanpa proteksi race. Jangan menghapus file atau versi historis.
- File viewer tidak boleh mengekspos `storage_key`/path; gunakan mekanisme storage privat existing. Tidak perlu implementasi ulang PDF parser—file telah divalidasi saat upload.

## 7. Simulasi satu mahasiswa (data **contoh**, bukan DB nyata)

Awal: `Mahasiswa.id=10`, `VerifikasiDataDiri.id=50`, enam dokumen versi 1 terkini status `BELUM_DIPERIKSA` → agregat `BELUM_DIVERIFIKASI`.

1. Admin user 5 memberi ACC pada lima dokumen. KTP (`DokumenDataDiri.id=203`, `versi=1`) menjadi `PERLU_PERBAIKAN`, catatan `Foto KTP buram`; `VerifikasiDataDiri.id=50` → `PERLU_PERBAIKAN`.
2. Mahasiswa mengunggah KTP baru lewat PUT existing. Record 203 berubah `is_terkini=false` tanpa menghapus status/catatan; record baru 209 (`versi=2`, `is_terkini=true`) → `BELUM_DIPERIKSA`.
3. Lima dokumen lain tetap `TERVERIFIKASI`. Admin memeriksa KTP versi 2, memberi `TERVERIFIKASI`; keenam versi terkini kini valid → `VerifikasiDataDiri.id=50.status_verifikasi=TERVERIFIKASI`.
4. `AuditLog` mencatat pemeriksaan dan koreksi. Tidak ada pembuatan ulang enam dokumen atau penghapusan versi 1.

## 8. Acceptance criteria dan pengujian wajib

1. Role aktif `ADMIN_PRODI` bisa mengakses daftar/detail/file milik Prodi berwenang; mahasiswa, role lain, tanpa JWT, dan akun nonaktif ditolak sesuai middleware existing.
2. Daftar GET dapat memfilter `BELUM_LENGKAP`, `BELUM_DIVERIFIKASI`, `PERLU_PERBAIKAN`, `TERVERIFIKASI`; paginasi dan jumlah 0–6 benar tanpa menghitung versi lama.
3. Admin dapat memverifikasi satu dokumen dan memberikan catatan. `PERLU_PERBAIKAN` **tanpa catatan** ditolak.
4. Verifikasi-semua berhasil hanya pada enam jenis terkini tanpa revisi tertunda; pada 5/6 atau ada `PERLU_PERBAIKAN` operasi gagal **tanpa perubahan parsial**.
5. Revisi KTP versi 1 → 2 mempertahankan lima keputusan lain, catatan versi 1, dan penanda `is_terkini` konsisten; versi baru wajib diperiksa ulang.
6. Setelah enam dokumen terbaru disetujui, agregat `TERVERIFIKASI` beserta aktor/waktu tercatat; membuka revisi membatalkan agregat tersebut secara konsisten.
7. Request stale version atau dua admin bersamaan tidak dapat memberi ACC pada versi yang belum dibaca atau membuat status agregat keliru.
8. Unduh berkas hanya melalui endpoint berotorisasi; tidak ada path internal/PII berlebihan dalam response atau audit.
9. Error/rollback tidak meninggalkan status tanpa audit. Pengulangan keputusan identik tidak membuat side effect ganda.
10. Unit tests terarah dan integrasi HTTP/PostgreSQL di **database uji terpisah** lulus; data fixture dibersihkan hanya berdasarkan ID milik tes; `sipkita_dev` tidak dimutasi.
11. Suite backend existing, `prisma validate`, syntax/lint sesuai script aktual, serta `git diff --check` tetap lulus. Laporkan skip dan keterbatasan secara eksplisit.

## 9. Ruang lingkup dan instruksi Codex hemat token

**Termasuk:** route/controller/service/validator verifikasi Admin Prodi, audit, perubahan status, pengambilan file privat, pengujian. Integrasi terbatas ke PUT mahasiswa **hanya bila diperlukan** untuk menegakkan aturan revisi/lock status; jangan menulis ulang endpoint/logic upload yang sudah lulus tes.

**Tidak termasuk:** UI/frontend, pengajuan KP/ISCP/TA, proposal/reviewer, ACC Kaprodi, bimbingan, notifikasi, bulk lintas mahasiswa, perubahan master `JenisDokumen`, perubahan auth/global error, migrasi/deploy. Tidak perlu model/tabel baru jika skema existing memadai.

**Langkah kerja agent:**

1. Baca `AGENTS.md`, PRD ini, dan **skill yang relevan saja**: `.agents/skills/domain-modeling`, `feature-implementation`, `code-change-verification`; gunakan `prisma-schema-change` **hanya jika** ada perubahan skema yang terbukti wajib.
2. Periksa **file aktual terkait** (`server/prisma/schema.prisma`, route/data-diri service mahasiswa, middleware role aktif, Master Admin Prodi scope satu-Prodi, storage private, audit utils, tests). Jangan scan/refactor seluruh repo tanpa kebutuhan.
3. Implementasikan vertical slice backend memakai `route → controller → service → Prisma`. Reuse util existing. Status dan role dari server, bukan input klien; pemanggilan API student tetap bekerja.
4. Perbaiki regresi yang timbul dari tugas ini, jalankan pengujian aman dan laporan singkat. **Jangan** menjalankan `prisma migrate reset`, `prisma db push`, `DROP`, seed massal, atau menulis ke database `sipkita_dev` untuk tes.
5. Jika ternyata perubahan schema/data development diperlukan, **siapkan draf dan minta izin sebelum menerapkannya**. Konfirmasi lain hanya untuk konflik aturan bisnis yang benar-benar menghambat pengerjaan.

**Definition of Done:** Admin Prodi dapat memeriksa dan memberi catatan per berkas, memverifikasi enam dokumen sekaligus secara aman, menangani revisi satu dokumen tanpa mengulang lima lainnya, dan status agregat serta audit selalu konsisten. Backend pengajuan akademik tetap tidak tersentuh.
