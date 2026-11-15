# PRD — Backend Pemeriksaan dan ACC Administratif Pengajuan KP (Admin Prodi)

**Proyek:** SIPKITA | **Fase:** E | **Tanggal:** 5 November 2026\
**Status:** Spesifikasi implementasi backend; belum mengubah source atau database\
**Scope:** Pengajuan **KP — REGULER — BARU**, layanan Admin Prodi serta ekstensi kecil revisi Mahasiswa

## 1. Tujuan dan landasan

Melengkapi proses setelah mahasiswa menekan **Kirim Pengajuan** (`Pengajuan.status_pengajuan = DIAJUKAN`) sampai Admin Prodi memeriksa Berkas/Nilai dan memberikan keputusan administratif `ACC` atau `TIDAK_ACC`. Sediakan dua pilihan kerja: **pemeriksaan kategori satu per satu** dan **ACC Semua** untuk satu pengajuan ketika seluruh kelengkapan benar-benar telah diperiksa.

**Kondisi awal menurut laporan Codex:** backend mahasiswa D2 selesai dan diuji pada PostgreSQL TEST; D3 menambahkan `Pengajuan.sudah_bayar_spp_variabel Boolean?` ke `sipkita_dev`; lima migrasi selesai, 13 master KP terpasang; API opsi-form/daftar/draft/edit/upload/download/kirim sudah ada. Modul Admin Prodi **Data Diri per dokumen** telah berjalan. Jangan membangun ulang modul-modul tersebut, mengulang audit Fase A–D, atau mengubah master tanpa kebutuhan terbukti.

**Prioritas aturan:** keputusan KP terbaru dalam PRD ini mengesampingkan bagian dokumen lama yang menyebut ACC akhir KP oleh Kaprodi. Dalam KP reguler, **Admin Prodi memberi ACC administratif**, sedangkan Kaprodi menugaskan Reviewer dan menetapkan Pembimbing final. Aturan ISCP, TA, dan perpanjangan tidak ikut berubah.

## 2. Perbedaan verifikasi Data Diri vs Pengajuan KP

| Aspek           | Data Diri (sudah ada)                                          | Pengajuan KP (Fase E)                                                                                |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Objek keputusan | **Per dokumen** identitas, 6 jenis                             | **Per kategori**: Berkas, Nilai, dan keputusan Pengajuan                                             |
| Catatan         | Dapat berbeda untuk setiap dokumen                             | Satu catatan kategori Berkas, satu Nilai, satu keputusan akhir                                       |
| Hasil           | Agregat `VerifikasiDataDiri.status_verifikasi = TERVERIFIKASI` | Berkas/Nilai: `BELUM_DIPERIKSA`, `BELUM_OK`, `OK_LENGKAP`; Pengajuan: `DIAJUKAN`, `ACC`, `TIDAK_ACC` |
| ACC instan      | Verifikasi enam dokumen Data Diri milik satu mahasiswa         | **ACC Semua** Berkas+Nilai+Pengajuan milik **satu pengajuan KP**                                     |

Admin boleh preview/unduh setiap PDF KP, tetapi **tidak memberi ACC/catatan per dokumen KP**. Jangan menyamakan `DokumenPengajuan.status_pemeriksaan` dengan keputusan kategori `Pengajuan.status_pemeriksaan_berkas`. Tidak perlu membuat tabel pemeriksaan per-file yang baru.

## 3. Kontrak status dan kewenangan

| Kategori  | Field logis existing                                                                         | Nilai dan transisi                                                                                                             |
| --------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Berkas    | `Pengajuan.status_pemeriksaan_berkas`, `catatan_pemeriksaan_berkas`, pemeriksa/waktu terkait | `BELUM_DIPERIKSA → BELUM_OK` (perlu revisi) **atau** `OK_LENGKAP` (lengkap); boleh diperiksa ulang setelah perbaikan terkirim. |
| Nilai     | `Pengajuan.status_pemeriksaan_akademik`, catatan/pemeriksa/waktu existing                    | Sama: `BELUM_DIPERIKSA`, `BELUM_OK`, `OK_LENGKAP`. Mewakili SKS, IPK, nilai D/E dan daftar mata kuliah.                        |
| Pengajuan | `Pengajuan.status_pengajuan`, catatan keputusan, pemutus/waktu                               | Tetap `DIAJUKAN` selama pemeriksaan/perbaikan; hanya keputusan akhir menjadi `ACC` atau `TIDAK_ACC`.                           |

**Aktor dan izin:**

- **Admin Prodi** ber-role aktif `ADMIN_PRODI`, akun aktif, berwenang pada Prodi mahasiswa: dapat baca daftar/detail/file KP, memeriksa kategori, dan memutuskan ACC/TIDAK_ACC. Identitas pemeriksa/pemutus berasal dari sesi, bukan request body.
- **Mahasiswa** hanya bisa membaca catatan miliknya, memperbaiki kategori berstatus `BELUM_OK`, lalu menekan **Kirim Perbaikan**. Tidak dapat mengubah status/kewenangan pemeriksa.
- **Kaprodi** dapat menugaskan Reviewer sejak `DIAJUKAN` secara **paralel** dengan Admin; penetapan Pembimbing dilakukan setelah ACC Admin. **Hasil review bukan gate ACC administratif KP**. Endpoint Kaprodi/Reviewer **bukan bagian Fase E**.
- Bila pemetaan kewenangan Admin Prodi lintas Prodi belum tersedia, **ikuti scope satu-Prodi yang benar-benar ditegakkan modul Admin Prodi existing**; jangan memberikan akses global karena `UserRole` tidak menyimpan ID Prodi. Bila muncul multi-Prodi yang tidak bisa dipetakan aman, tolak akses dan laporkan blocker terfokus.

## 4. Alur pemeriksaan manual

1. Mahasiswa telah submit: `status_pengajuan=DIAJUKAN`, status Berkas/Nilai awal `BELUM_DIPERIKSA`.
2. Admin melihat daftar dan membuka detail: biodata ringkas, Data Diri agregat, form KP, SKS/IPK/D-E, deklarasi SPP, lima persyaratan beserta file/versi terkini, dan catatan/histori.
3. **Pemeriksaan Berkas:** Admin memilih `BELUM_OK` (**catatan wajib**) atau `OK_LENGKAP` (catatan opsional), lalu menyimpan status kategori + pemeriksa/waktu + riwayat. Pemeriksaan dilakukan untuk keseluruhan Berkas, bukan per file.
4. **Pemeriksaan Nilai:** dilakukan secara independen dengan nilai status yang sama dan catatan sendiri. Data akademik dari mahasiswa merupakan snapshot yang **diverifikasi manual Admin**, bukan pengesahan otomatis dari angka input. Jangan membuat batas kelulusan SKS/IPK baru tanpa aturan resmi.
5. **Keputusan administratif:**
   - `ACC` hanya jika Berkas=`OK_LENGKAP`, Nilai=`OK_LENGKAP`, dan **Data Diri agregat=`TERVERIFIKASI`** pada saat transaksi keputusan. Reviewer `LAYAK/TIDAK_LAYAK` **tidak** menjadi gate.
   - `TIDAK_ACC` merupakan penolakan administratif final dengan **alasan wajib**; jangan menggunakannya untuk perbaikan sementara.
   - Ketika salah satu kategori `BELUM_OK`, status Pengajuan tetap `DIAJUKAN`, sambil mahasiswa memperbaiki kategori tersebut.
6. Keputusan terminal (`ACC`/`TIDAK_ACC`) tidak boleh ditimpa lewat endpoint pemeriksaan biasa. Pembukaan ulang membutuhkan proses/otorisasi berbeda di luar PRD ini.

**Catatan wajib:** `BELUM_OK` dan `TIDAK_ACC`. **Catatan opsional:** `OK_LENGKAP` dan `ACC`. Jangan menghapus catatan lama/histori ketika suatu kategori dinilai ulang.

## 5. ACC Semua — satu pengajuan, satu tindakan atomik

Admin Prodi memeriksa berkas dan informasi akademik pada detail, lalu memilih **ACC Semua** dengan satu konfirmasi eksplisit: *“Saya telah memeriksa Berkas dan Nilai mahasiswa ini dan menyatakan persyaratan administratif KP memenuhi ketentuan.”*

Service wajib:

1. Memeriksa role, akun, Prodi, kepemilikan lingkup, jenis KP–REGULER–BARU, dan status `DIAJUKAN`.
2. Memeriksa Data Diri agregat `TERVERIFIKASI`, kelengkapan dokumen sesuai master dan aturan SPP/sosialisasi, kelengkapan data akademik, serta **tidak ada `BELUM_OK` yang masih menunggu Kirim Perbaikan**.
3. Membandingkan **versi/snapshot dokumen dan nilai akademik yang telah dilihat Admin** pada detail GET dengan kondisi saat keputusan. Jika berubah, kembalikan konflik (`409` sesuai konvensi proyek) dan minta muat ulang; jangan menyetujui PDF/angka yang belum ditinjau. Gunakan `expected_*` token/versi atau mekanisme concurrency existing yang paling sederhana dan tepat.
4. Dalam **satu transaksi**: set Berkas=`OK_LENGKAP`, Nilai=`OK_LENGKAP`, Pengajuan=`ACC`; catat pemeriksa/pemutus dan waktu server yang relevan; rekam **perubahan masing-masing kategori** pada histori/audit. Jika salah satu langkah gagal, semuanya rollback.
5. Jika kategori sudah `OK_LENGKAP`, pertahankan metadata/catatan pemeriksaan valid yang telah tercatat; hindari event/riwayat duplikat. Ulangi request sama dengan hasil idempotent atau respons konflik yang konsisten, **jangan membuat keputusan kedua**.

**ACC Semua bukan ACC otomatis dari kelengkapan digital**: Admin tetap bertanggung jawab memeriksa kebenaran isi berkas dan data. Fitur ini berlaku hanya untuk **satu pengajuan**, bukan bulk seluruh mahasiswa. Tidak memodifikasi hasil Review Proposal atau penugasan dosen.

## 6. Alur revisi mahasiswa setelah BELUM_OK

Backend D2 sebelumnya mengunci edit dan upload pada `DRAFT`. Fase E perlu **ekstensi minimal**, tanpa merusak perilaku D2:

1. Jika **Berkas=`BELUM_OK`**, mahasiswa boleh mengganti PDF yang relevan dan, bila diperlukan sesuai catatan, memperbaiki judul/objek/lokasi melalui pembatasan field. Dokumen yang diganti menjadi versi baru, versi lama/histori tetap ada.
2. Jika **Nilai=`BELUM_OK`**, mahasiswa boleh memperbaiki snapshot IPK/SKS/nilai D-E dan daftar mata kuliah; tidak otomatis membuka akses edit dokumen kategori lain.
3. Mahasiswa menekan **Kirim Perbaikan** dan menyebut kategori yang telah diperbaiki. Backend hanya menerima kategori `BELUM_OK` dengan perubahan aktual yang sah, lalu mengubah **kategori itu saja** kembali menjadi `BELUM_DIPERIKSA` dan mencatat riwayat/waktu server. `status_pengajuan` tetap `DIAJUKAN`.
4. Kategori yang sebelumnya `OK_LENGKAP` **tetap OK** jika tidak berubah. Tidak perlu upload ulang semua file. Admin melakukan pemeriksaan ulang pada kategori yang dikirim kembali.
5. Selama revisi belum dikirim, status kategori tetap `BELUM_OK`; Admin tidak boleh memberi ACC pada data revisi yang belum resmi dikirim. Pengajuan `ACC/TIDAK_ACC` tidak boleh diedit mahasiswa lewat mekanisme ini.
6. Apabila **proposal KP** direvisi, Review Proposal yang terkait versi lama tidak dipindahkan/dipalsukan menjadi review versi terbaru. Integrasi re-review dilakukan oleh modul Reviewer berikutnya.

Jangan membuat pengajuan baru ketika mahasiswa melakukan revisi. Pertahankan ID pengajuan serta keterkaitan riwayat topik/dokumen.

## 7. Rancangan endpoint backend

Nama path berikut merupakan kontrak **usulan**. Selaraskan dengan pola router, middleware, validasi, response envelope, dan controller yang benar-benar digunakan; **jangan membuat alias ganda**. Semua endpoint mengharuskan auth dan izin sesuai aktor.

### Admin Prodi

| Method  | Endpoint                                                 | Kegunaan                                                                                                                                        |
| ------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/admin-prodi/pengajuan`                             | Daftar KP yang sesuai Prodi; filter status Berkas/Nilai/Pengajuan, pencarian, dan pagination.                                                   |
| `GET`   | `/api/admin-prodi/pengajuan/:id`                         | Detail ringkas identitas + formulir akademik + berkas/versi terkini + Data Diri agregat + histori/catatan; sertakan token/snapshot concurrency. |
| `GET`   | `/api/admin-prodi/pengajuan/:id/dokumen/:dokumenId/file` | Preview/unduh PDF privat, aman berdasarkan role dan Prodi; reuse private storage/validator existing.                                            |
| `PATCH` | `/api/admin-prodi/pengajuan/:id/pemeriksaan-berkas`      | Simpan status kategori Berkas `BELUM_OK`/`OK_LENGKAP` dan catatan, actor/waktu, histori.                                                        |
| `PATCH` | `/api/admin-prodi/pengajuan/:id/pemeriksaan-nilai`       | Simpan status kategori Nilai `BELUM_OK`/`OK_LENGKAP` dan catatan, actor/waktu, histori.                                                         |
| `POST`  | `/api/admin-prodi/pengajuan/:id/keputusan`               | Keputusan `ACC`/`TIDAK_ACC` dengan guard dan catatan/alasan.                                                                                    |
| `POST`  | `/api/admin-prodi/pengajuan/:id/acc-lengkap`             | **ACC Semua:** konfirmasi + snapshot → tiga kategori diputus dalam satu transaksi.                                                              |

### Ekstensi Mahasiswa (gunakan modul Pengajuan D2)

| Method  | Endpoint                                  | Kegunaan                                                                                                                            |
| ------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PATCH` | `/api/pengajuan/:id/perbaikan`            | Edit terbatas pada kategori `BELUM_OK` milik mahasiswa; tidak membuka `PATCH` bebas pada semua status.                              |
| `POST`  | `/api/pengajuan/:id/dokumen` **existing** | Perluas upload/replace versi **hanya** jika Berkas `BELUM_OK`, selain kondisi DRAFT yang sudah ada.                                 |
| `POST`  | `/api/pengajuan/:id/kirim-perbaikan`      | Kirim kategori yang telah benar-benar diperbaiki untuk diperiksa ulang; reset status kategori ke `BELUM_DIPERIKSA` secara selektif. |

Daftar/detail Pengajuan Mahasiswa yang sudah ada harus menampilkan status dan catatan kategori yang terbaru; utamakan reuse response/serializer existing. **Tidak perlu endpoint khusus untuk ACC per dokumen KP.**

## 8. Implementasi teknis dan integritas

- Pola: **route → controller → service → Prisma**. Di service, letakkan guard status, scope Prodi, rule ACC, transaksi, serta perhitungan kategori. Reuse middleware auth/role, pagination, centralized error handler, util PDF privat, dan pola Admin Prodi Data Diri; jangan menyalin verifikasi per-file Data Diri ke KP.
- Tinjau model/kolom aktual: `Pengajuan`, `VerifikasiDataDiri`, `DokumenPengajuan`, `Dokumen`, `PersyaratanPengajuan`, `RiwayatStatusPengajuan`, `User`, `Mahasiswa`. Model `RiwayatStatusPengajuan.jenis_status` sudah dipakai dengan `PENGAJUAN` saat submit D2; untuk Berkas/Nilai gunakan kode kategori yang **cocok dengan schema/konstanta aktual** (usulan `BERKAS`, `NILAI`) tanpa membuat enum/migration spekulatif. Bila tidak dapat mewakili kedua kategori, laporkan blocker terkecil sebelum perubahan schema.
- Pada setiap aksi kategori/keputusan, simpan identitas/waktu server dan perubahan status secara atomik. Jika ada histori atau audit util existing, pakai; jangan buat event kedua untuk no-op/idempotent retry.
- Terapkan validasi request allowlist, status yang diizinkan, panjang dan kewajiban catatan; jangan menerima ID Prodi/mahasiswa, actor, timestamp, dan status tersembunyi dari client.
- Cegah race antara mahasiswa mengganti dokumen, dua Admin memutus, dan ACC Semua berbasis snapshot kedaluwarsa. Gunakan pendekatan transaksi/optimistic concurrency yang sudah tersedia; tes request paralel dan rollback. Jangan mengubah partial indexes lama.
- **Scope penulisan:** source server dan test yang relevan. Jangan mengubah frontend, dokumentasi Scalar/OpenAPI, modul Reviewer/Pembimbing, master data, atau migrasi existing. **Database TEST terisolasi** untuk semua integration test yang menulis; jangan menguji POST/PATCH pada `sipkita_dev` tanpa izin tersendiri. Tidak ada kebutuhan migrasi baru yang diketahui dari rancangan ini.

## 9. Pekerjaan Codex yang efisien

1. Baca hanya `AGENTS.md`, bagian schema model terkait, route/controller/service D2, Admin Prodi Data Diri, auth/Prodi scope, private PDF storage, dan test terkait. **Hindari audit seluruh repo** serta jangan mengulang Fase A–D yang sudah PASS.
2. Skill proyek yang relevan **jika file benar-benar tersedia**: `.agents/skills/feature-implementation/SKILL.md` untuk coding dan `.agents/skills/code-change-verification/SKILL.md` untuk tes. **Tidak perlu** `prisma-schema-change` bila tidak ada perubahan schema. Ikuti `docs/api-conventions.md` sebatas pola HTTP, `docs/architecture.md` sebatas layering. Peraturan KP terbaru dari PRD ini lebih tinggi daripada catatan Kaprodi ACC yang sudah usang.
3. Implementasikan per bagian fungsional: (a) daftar/detail/file Admin, (b) pemeriksaan kategori + keputusan, (c) ACC Semua, (d) revisi/kirim-perbaikan Mahasiswa. Sesudah masing-masing bagian, jalankan tes terarah; jangan berhenti hanya untuk laporan audit jika kendala teknis kecil dapat diperbaiki aman.
4. Jalankan regresi D2 dan Data Diri, lint/syntax, serta `git diff --check`. Jaga perubahan/untracked file lain milik pengguna. Laporkan ringkas endpoint, file berubah, tes nyata PASS/FAIL, database yang disentuh, dan blocker tersisa.

## 10. Acceptance criteria — backend Fase E

| Skenario                                         | Hasil wajib                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Admin Prodi sah membuka daftar/detail/file       | Berhasil hanya untuk lingkup Prodi yang diizinkan                                 |
| Mahasiswa/role lain/Admin lintas Prodi           | Tidak boleh mengakses endpoint Admin dan berkas privat                            |
| Berkas `BELUM_OK` tanpa catatan                  | Ditolak; dengan catatan dan actor/waktu tersimpan                                 |
| Nilai `BELUM_OK`                                 | Berkas yang sudah OK tidak berubah, catatan Nilai terpisah                        |
| Kirim perbaikan Berkas saja                      | Hanya Berkas → `BELUM_DIPERIKSA`, dokumen versi lama utuh; Nilai tetap            |
| Kirim perbaikan Nilai saja                       | Hanya Nilai → `BELUM_DIPERIKSA`, snapshot historis/status kategori lain konsisten |
| Data Diri belum `TERVERIFIKASI`                  | Admin masih boleh memeriksa Berkas/Nilai; `ACC` dan `ACC Semua` **ditolak**       |
| Berkas/Nilai `BELUM_OK` belum diperbaiki         | `ACC Semua` ditolak; tidak ada perubahan parsial                                  |
| Data Diri verified + Berkas/Nilai OK             | `ACC` biasa berhasil; histori dan pemeriksa tercatat                              |
| Seluruh syarat sah + konfirmasi ACC Semua        | Berkas=OK, Nilai=OK, Pengajuan=ACC dalam satu transaksi dengan histori kategori   |
| Bukti/angka berubah setelah Admin membuka detail | Keputusan dari snapshot lama ditolak (konflik), minta refresh                     |
| Keputusan `TIDAK_ACC`                            | Alasan wajib; bersifat terminal pada alur ini                                     |
| Reviewer `TIDAK_LAYAK` atau belum selesai        | **Tidak otomatis memblokir** ACC administratif KP                                 |
| Request identik berulang/paralel                 | Tidak membuat riwayat duplikat, dua keputusan, atau state setengah jadi           |
| Regresi D2 & Data Diri                           | Draft/submit, private upload, verifikasi per-file Data Diri tetap PASS            |

**Definition of Done:** Admin Prodi dapat menyelesaikan pemeriksaan/ACC KP manual maupun **ACC Semua** per pengajuan; mahasiswa dapat mengirim perbaikan kategori yang `BELUM_OK` tanpa mengulang pengajuan; seluruh perubahan, otorisasi, dan histori konsisten. Fase Reviewer/Kaprodi berikutnya tetap terpisah.
