# AGENTS.md — SIPKITA

## Konteks proyek

SIPKITA adalah **Sistem Informasi Pengelolaan Kerja Praktik (KP), Information Systems Capstone Project (ISCP), dan Tugas Akhir (TA)** berbasis web untuk Program Studi Sistem Informasi. Sistem menangani akun, identitas mahasiswa, pengajuan tahap, persyaratan dan dokumen, reviewer, pembimbing, serta riwayat proses akademik.

Perlakukan SIPKITA sebagai **satu sistem dengan siklus KP → ISCP → TA**, bukan tiga aplikasi yang berdiri sendiri. Setiap fitur harus mengikuti keputusan bisnis dan skema database yang benar-benar tersedia.

## Teknologi dan organisasi repo

- Monorepo **npm workspaces**.
- `client/`: React, Vite, Tailwind CSS.
- `server/`: Node.js, Express REST API, Prisma ORM, PostgreSQL.
- `server/prisma/schema.prisma`: sumber struktur model dan relasi database aktual.
- `server/prisma/migrations/`: riwayat migrasi, jika sudah tersedia.
- `.agents/skills/`: prosedur kerja khusus yang dapat dipakai sesuai jenis tugas.
- `docs/`: pengetahuan domain, arsitektur, kebijakan, dan keputusan proyek, bila sudah dibuat.
- `postman/`: koleksi pengujian API, bila tersedia.

Konfigurasi Prisma terakhir memakai **Prisma 7** dan `prisma.config.ts` untuk koneksi database. Periksa versi, konfigurasi, lokasi file, serta script npm aktual sebelum menjalankan perintah; jangan mengandalkan asumsi dari dokumen yang belum sinkron.

## Prioritas implementasi

Fokus pengembangan semester ISCP saat ini:

1. Autentikasi, pengelolaan akun/role, master data, dan konfigurasi minimum yang diperlukan.
2. Pengisian data diri mahasiswa, unggah dokumen, dan verifikasi oleh pihak yang berwenang.
3. Pengajuan KP, ISCP, dan TA (jalur `BARU`/`LANJUT`), pemeriksaan persyaratan, penugasan reviewer, review/revisi proposal, persetujuan akhir pengajuan, serta penentuan pembimbing.
4. Bimbingan hanya bila diminta atau progres memungkinkan.

Perubahan judul, perpanjangan, serta modul pelaksanaan akademik lain direncanakan untuk pengembangan lanjutan. **Jangan mengimplementasikan seluruh roadmap** tanpa permintaan eksplisit. Fitur pendukung yang diperlukan untuk membuat modul prioritas berjalan tetap termasuk ruang lingkup.

## Rujukan dokumentasi

Baca **hanya dokumen yang berkaitan dengan tugas**, dan cek apakah berkasnya benar-benar tersedia:

| Dokumen | Baca saat membutuhkan |
| --- | --- |
| `docs/glossary.md` | Definisi istilah KP, ISCP, TA, status, aktor, dan dokumen. |
| `docs/academic-lifecycle.md` | Syarat, urutan tahap, transisi, dan riwayat per semester. |
| `docs/roles-permissions.md` | Hak akses dan kewenangan setiap peran. |
| `docs/business-rules/` | Ketentuan khusus pengajuan, review, dokumen, ACC, dan proses lainnya. |
| `docs/database.md` | Keputusan desain database di samping schema Prisma aktual. |
| `docs/architecture.md` | Batas lapisan aplikasi dan organisasi source code. |
| `docs/api-conventions.md` | Kontrak request/response, validasi, dan error API. |
| `docs/coding-standards.md` | Penamaan, format, dan praktik implementasi. |
| `docs/project-status.md` | Fitur yang sudah dibuat, batas kerja, dan pekerjaan berikutnya. |

Jika dokumentasi belum tersedia, gunakan kode/skema serta keputusan yang sudah dikonfirmasi; **laporkan kekurangan konteks**, jangan mengarang isi dokumen. Ketika aturan bisnis terbaru bertentangan dengan catatan lama, tandai konflik dan minta keputusan pengguna sebelum mengimplementasikan bagian yang terdampak.

## Routing skill

Gunakan skill yang **paling relevan dengan tujuan tugas**, bukan seluruh skill untuk setiap pekerjaan:

| Skill | Gunakan untuk |
| --- | --- |
| `domain-modeling` | Membedah proses bisnis, kewenangan, state transition, serta aliran data dan relasi sebelum coding. |
| `prisma-schema-change` | Mengubah/meninjau tabel, field, FK, indeks, constraint, dan migrasi Prisma. |
| `feature-implementation` | Mengimplementasikan fitur Express/Prisma, API, React, dan integrasinya. |
| `code-change-verification` | Memeriksa diff, menjalankan tes relevan, memvalidasi integrasi, dan melaporkan regresi. |

Skill repo berada di `.agents/skills/<nama-skill>/SKILL.md`. Ikuti instruksi spesifik skill ketika dipakai, dengan tetap mengutamakan permintaan pengguna saat ini.

## Aturan domain penting

- Urutan tahap adalah **KP → ISCP → TA**. Kelayakan tahap berikutnya terbuka setelah ACC penyelesaian oleh **Dosen Pembimbing** dan syarat terkait terpenuhi. Mahasiswa **tetap mengirim pengajuan** tahap berikutnya; jangan membuat pengajuan otomatis tanpa tindakan mahasiswa.
- **ACC pengajuan** oleh Kaprodi berbeda dari **ACC penyelesaian tahap** oleh Dosen Pembimbing. Reviewer memeriksa proposal, bukan meluluskan tahap.
- Admin Prodi memeriksa data diri serta administrasi pengajuan reguler/awal. Pelaku pemeriksaan kelayakan akademik masih perlu dikunci. Kaprodi menetapkan reviewer dan mengambil keputusan akhir pengajuan. Admin Prodi **tidak memverifikasi perpanjangan**.
- Satu akun dosen dapat mempunyai peran Reviewer dan Pembimbing; izin tindakan harus mengecek **role, penugasan aktif, kepemilikan data, dan status**.
- Satu pengajuan dapat memiliki beberapa reviewer, tetapi **hanya satu pembimbing aktif**. Seluruh reviewer aktif yang ditugaskan wajib memberi hasil `LAYAK` pada proposal terbaru sebelum prasyarat review dianggap terpenuhi; kondisi ini **tidak otomatis** menjadi ACC karena keputusan akhir tetap milik Kaprodi.
- Persyaratan dokumen dapat berbeda menurut **periode, tahap, jenis pengajuan, dan pilihan topik**. Gunakan konfigurasi `JenisDokumen` serta `PersyaratanPengajuan` yang ada, bukan hardcode berkas untuk setiap tahap.
- Jagalah riwayat `Pengajuan`, `TopikPenelitian`, `VersiTopik`, dokumen dan review. Revisi membuat riwayat/versi yang sesuai, bukan menimpa atau menghapus bukti lama.
- Pengajuan lintas semester tetap mempertahankan rekaman terdahulu. Perpanjangan berarti permohonan pada **semester berikutnya**, bukan tambahan waktu dalam semester sama.
- Seluruh pengajuan reguler KP/ISCP/TA, termasuk jalur `LANJUT`, wajib memakai proposal terbaru dan menjalani review. Jalur `LANJUT` boleh memakai data tahap sebelumnya sebagai isian awal, tetapi penyempurnaan judul harus tercatat sebagai versi baru.
- Setiap permohonan melanjutkan atau mengulang tahap pada semester berikutnya adalah **perpanjangan**; tidak ada proses pengajuan ulang terpisah. Perpanjangan membuat `Pengajuan` baru yang terhubung ke pengajuan sebelumnya dan tidak melibatkan Reviewer atau verifikasi Admin Prodi: Kaprodi memeriksa dan memutuskan. Perpanjangan pertama boleh memakai topik lama atau baru; perpanjangan kedua dan seterusnya wajib topik, judul, serta proposal baru sesuai batas kesempatan yang dikonfigurasi.
- Jangan menganggap status bertipe `String` di Prisma sudah mempunyai daftar transisi final. Periksa konstanta, service, dan dokumen aturan yang berlaku.
- SIPKITA **belum terintegrasi dengan SIKADU**; data mahasiswa/dosen dikelola melalui impor/manual sesuai kewenangan. Jangan menciptakan koneksi API eksternal tanpa permintaan.

**Keputusan yang masih perlu dikunci jika memengaruhi implementasi:** pelaku dan rincian pemeriksaan kelayakan akademik, state machine/kode status, kelayakan serta batas perpanjangan, syarat dokumen penyelesaian, mekanisme seminar, autentikasi/storage, serta cakupan lintas prodi dan impor master. Jangan memilih salah satu kemungkinan secara diam-diam.

## Standar implementasi

- Ikuti arsitektur yang ada; pola backend yang disepakati adalah **route → controller → service → Prisma → database**. Letakkan keputusan bisnis dan transaksi pada service, bukan pada controller atau komponen UI.
- Pisahkan komponen UI React dari fungsi pemanggil API. Gunakan pola yang sudah ada sebelum membuat folder, library, atau abstraksi baru.
- Terapkan validasi input, pemeriksaan role/ownership/status di server, centralized error handling, dan keamanan unggahan file. Jangan mengandalkan tombol tersembunyi di UI sebagai otorisasi.
- Gunakan transaksi Prisma untuk perubahan beberapa tabel yang harus konsisten; pertahankan catatan perubahan status dan versi dokumen.
- Terapkan penamaan konsisten, Prettier/ESLint yang terkonfigurasi, DRY, KISS, SRP, dan YAGNI. Hindari refaktor besar yang tidak berkaitan dengan tugas.
- Jangan menambahkan dependensi, endpoint, tabel, atau konfigurasi hanya karena "mungkin nanti dibutuhkan".
- Jangan menyimpan password plaintext, menampilkan token/secret dalam log, atau membuka data mahasiswa lain tanpa izin.

## Cara mengerjakan tugas

1. Pahami tujuan dan ruang lingkup yang diminta; baca kode serta dokumen **yang relevan saja**.
2. Untuk tugas implementasi, pilih satu alur kecil yang dapat berfungsi ujung-ke-ujung. Nyatakan asumsi kritis dan kriteria selesai sebelum perubahan kompleks.
3. Gunakan perubahan minimal pada file yang diperlukan. Jaga perubahan pengguna yang sudah ada; jangan menghapus atau menimpa pekerjaan lain.
4. Jalankan pengecekan terarah sesuai script nyata di `package.json` (lint, test, build, `prisma validate`, dan lain-lain). Alur development yang pernah digunakan adalah `npm run dev` dari root, tetapi cek script aktual sebelum menjalankannya.
5. Tes kasus sukses dan gagal yang penting, terutama authorization, status, revisi, transaksi, dan riwayat; gunakan data uji terisolasi.
6. Perbaiki bug yang ditimbulkan oleh perubahan yang diminta jika termasuk ruang lingkup, lalu ulangi tes relevan. Jangan melonggarkan assertion agar tes terlihat lulus.
7. Lanjutkan sampai kriteria tugas terpenuhi atau ada pemblokir yang membutuhkan keputusan/otorisasi baru.

## Batasan keamanan data dan perubahan

- Jangan menjalankan `prisma migrate reset`, `prisma db push`, `DROP`, seed massal, atau menghapus riwayat migrasi sebagai jalan pintas.
- Edit schema, buat migrasi, dan terapkan migrasi adalah **tiga cakupan berbeda**. Terapkan migrasi hanya jika diminta dan target database dipastikan aman.
- Jangan melakukan operasi destruktif atau deployment ke production tanpa otorisasi yang jelas.
- Jangan mengakses atau mencetak kredensial, `.env`, token, maupun data pribadi yang tidak diperlukan.
- Untuk permintaan **analisis/diagnosis/review**, jangan langsung mengubah source code kecuali pengguna meminta perbaikan.

## Format laporan akhir

Berikan jawaban ringkas yang menyebutkan:

1. Apa yang selesai dan file/lapisan yang berubah.
2. Aturan bisnis/keputusan teknis penting yang diterapkan.
3. Pemeriksaan atau tes yang **benar-benar dijalankan** beserta hasilnya.
4. Keterbatasan, risiko tersisa, dan langkah berikutnya yang paling relevan.

Jangan mengklaim fitur atau integrasi sudah berfungsi jika belum diverifikasi. Jika tugas dibatasi pada pembuatan rancangan/dokumen, jelaskan bahwa implementasi dan migrasi belum dilakukan.

## Frontend Development

- Untuk tugas implementasi UI pada direktori `client/`,
  baca dokumentasi berikut sebelum mulai bekerja:
  - `.docs/frontend/visual-direction.md`
  - `.docs/frontend/design-system.md`

- Gunakan kedua dokumen sebagai acuan utama desain UI SIPKITA.
- Terapkan skill `frontend-design` saat mengerjakan desain frontend.
- Tidak perlu membaca dokumentasi frontend untuk tugas backend.
