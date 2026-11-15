---
name: feature-implementation
description: Implement approved SIPKITA application features in React/Vite/Tailwind and Express/Prisma. Use when building or modifying routes, controllers, services, validation, authorization, UI, or complete KP/ISCP/TA workflows; not for domain-only analysis or schema-only migration requests.
---

# SIPKITA — Feature Implementation

## Kontrak kerja

- Implementasikan **fitur yang diminta pengguna**, bukan seluruh roadmap. Kerjakan perubahan kecil namun lengkap (*vertical slice*) agar satu alur dapat dipakai dan diverifikasi sebelum pindah ke alur berikutnya.
- Jadikan keputusan domain dan struktur database yang disepakati sebagai batasan. Jangan menyederhanakan kebutuhan bisnis dengan melewatkan otorisasi, status, persyaratan, atau riwayat.
- Pertahankan arsitektur dan gaya kode yang sudah ada. Gunakan DRY, KISS, SRP, YAGNI; hindari lapisan abstraksi, library, dan refaktor luas tanpa kebutuhan jelas.
- Jika permintaan hanya analisis, penjelasan, atau rancangan, **jangan mengubah kode**. Jika schema perlu berubah, lakukan handoff ke `prisma-schema-change` sesuai izin pengguna sebelum implementasi fitur bergantung pada schema tersebut.

## Bangun konteks secukupnya

1. Baca `AGENTS.md`, lalu dokumen yang **berhubungan langsung** dengan fitur: `docs/glossary.md`, `docs/academic-lifecycle.md`, `docs/roles-permissions.md`, `docs/business-rules/`, `docs/architecture.md`, `docs/api-conventions.md`, `docs/coding-standards.md`, dan `docs/project-status.md`, jika tersedia.
2. Periksa kode saat ini dengan `rg --files`/`rg`: package scripts, route, controller, service, middleware, schema Prisma, client pages/components, API client, dan tests yang relevan. Jangan mengarang path atau mengklaim folder sudah tersedia.
3. Teknologi yang disepakati: monorepo npm workspaces; `client/` menggunakan **React + Vite + Tailwind**; `server/` menggunakan **Express REST API + Prisma + PostgreSQL**. Sesuaikan dengan dependensi/versi yang benar-benar terpasang.
4. Gunakan `domain-modeling` bila aktor, alur status, atau aturan akademik belum jelas. Baca model/field **aktual** di `server/prisma/schema.prisma` sebelum menulis query Prisma.
5. Hormati perubahan file yang sudah ada; jangan menimpa pekerjaan pengguna atau merombak struktur proyek untuk mengikuti contoh generik.

## Pilih satu vertical slice

Sebelum mengedit, tetapkan secara ringkas:

- **Aktor dan tujuan:** siapa melakukan apa dan hasil yang diharapkan.
- **Prasyarat:** login, role, pemilik data, penugasan, periode, status, dan syarat dokumen/akademik.
- **Kontrak data:** request, response, validasi, tabel yang dibaca/diubah, serta status sebelum/sesudah.
- **Ruang lingkup:** backend saja, frontend saja, atau end-to-end; file yang terdampak dan yang sengaja tidak disentuh.
- **Kriteria selesai:** satu skenario berhasil, skenario penolakan/revisi sesuai aturan, dan kegagalan/akses tidak sah ditangani.

Jika ada keputusan yang bisa mengubah desain secara mendasar, tanyakan secara spesifik. Untuk detail implementasi rutin yang sudah jelas dari repo, lanjutkan tanpa meminta persetujuan tambahan.

## Backend — Express + Prisma

- Ikuti struktur aktual. Pola yang disepakati adalah **route → controller → service → Prisma → PostgreSQL**; tambahkan repository terpisah hanya bila pola itu memang ada atau dibutuhkan.
- **Route** menentukan URL, method, autentikasi, otorisasi awal, dan input validator. **Controller** menangani HTTP request/response. **Service** menangani keputusan bisnis, pemeriksaan status, ownership, dan transaksi. Prisma melakukan akses data.
- Validasi tipe, format, nilai, kelengkapan, dan batas input pada API. Jangan mempercayai nilai `user_id`, `mahasiswa_id`, role, atau status yang dikirim client sebagai bukti identitas/kewenangan.
- Gunakan middleware autentikasi dan pemeriksaan izin yang benar: **role + relasi/penugasan + ownership + status**. UI yang menyembunyikan tombol bukan pengganti otorisasi server.
- Pastikan satu akun dosen bisa mempunyai mode **Reviewer** dan **Pembimbing**, tetapi tindakan reviewer hanya berlaku untuk proposal yang ditugaskan; tindakan pembimbing hanya untuk pengajuan yang dibimbing.
- Gunakan pola error handling terpusat dan respons API yang konsisten dengan `docs/api-conventions.md`/implementasi saat ini. Jangan membocorkan stack trace, hash password, kredensial, atau data pribadi pengguna lain.
- Gunakan transaksi Prisma untuk beberapa penulisan yang harus konsisten, misalnya `Pengajuan` + `RiwayatStatusPengajuan`, versi `DokumenPengajuan` + penanda terkini, `ReviewProposal` + `RiwayatReview`, atau ACC pengajuan + `PenugasanDosen` pembimbing.
- Tangani konflik data/duplikasi secara sadar. Periksa constraint database dan gunakan operasi yang sesuai; jangan mengandalkan pengecekan `findFirst` saja jika dua request dapat berjalan bersamaan.
- Untuk status yang disimpan sebagai `String`, gunakan nilai/konstanta yang sudah disepakati aplikasi; **jangan mengarang enum atau status baru**. Terapkan validasi transisi di service.
- Bila fitur menerima file, validasi ukuran/tipe sesuai `JenisDokumen`, aturan `PersyaratanPengajuan`, dan konfigurasi storage. Simpan metadata/file sesuai pola `Dokumen`, jangan menempatkan isi berkas mentah ke field yang bukan peruntukannya atau mengekspos lokasi penyimpanan privat.
- Hash password dengan metode yang aman dan sudah dipakai proyek; jangan menyimpan password plaintext maupun mencatat token/kredensial dalam log.

## Frontend — React + Vite + Tailwind

- Ikuti pola folder, routing, state, komponen, dan pemanggilan API yang sudah ada. Pisahkan UI dari lapisan API; hindari fetch/query yang tersebar tanpa pola.
- Buat antarmuka yang jelas untuk peran aktif pengguna, termasuk pemilihan mode dosen bila memiliki beberapa role. Selaraskan menu dengan izin, tetapi validasi akhir tetap di server.
- Tampilkan field dan dokumen berdasarkan response konfigurasi tahap/periode/jenis pengajuan, **bukan hardcode daftar dokumen berbeda untuk KP, ISCP, dan TA**.
- Sediakan keadaan `loading`, data kosong, sukses, error, validasi form, status proses, dan perbaikan/revisi saat relevan. Cegah submit ganda dan berikan umpan balik yang bisa dipahami.
- Gunakan komponen kecil yang benar-benar dapat dipakai ulang. Pertahankan aksesibilitas dasar: label input, keyboard navigation, pesan error yang jelas, dan status tombol.
- Jangan memasukkan aturan kritis, keputusan ACC, atau pemeriksaan kewenangan hanya di React. Client boleh menampilkan status dan membatasi interaksi, bukan menjadi sumber kebenaran bisnis.

## Aturan domain SIPKITA yang tidak boleh dilanggar

| Area | Aturan implementasi |
| --- | --- |
| Tahap | Urutan **KP → ISCP → TA**; kelayakan tahap berikutnya dibuka setelah ACC penyelesaian pembimbing dan syarat terpenuhi. Mahasiswa **tetap mengajukan** tahap berikutnya. |
| Pengajuan | KP/ISCP/TA berbagi pola pengajuan, tetapi persyaratan dapat berbeda menurut konfigurasi. Jangan menimpa record pengajuan semester lama. |
| Jalur `LANJUT` | Prefill topik/judul/objek dari tahap sebelumnya, jaga `TopikPenelitian`/`VersiTopik`, dan wajibkan proposal terbaru serta review pada pengajuan reguler. |
| Pemeriksaan dan ACC | Verifikasi data diri serta administrasi pengajuan reguler/awal oleh Admin Prodi; penugasan Reviewer dan keputusan akhir pengajuan oleh Kaprodi. Pelaku pemeriksaan akademik masih terbuka. Pengajuan semester berikutnya adalah perpanjangan dan diperiksa/diputuskan langsung oleh Kaprodi. |
| Reviewer | Satu pengajuan bisa memiliki beberapa Reviewer. Catat tiap review/revisi; seluruh Reviewer aktif harus `LAYAK` pada proposal terbaru sebelum prasyarat review terpenuhi, tetapi ACC tetap keputusan Kaprodi. Lembar review bersifat opsional. Perpanjangan tidak melibatkan Reviewer. |
| Pembimbing | Hanya satu pembimbing aktif per pengajuan; bisa ditetapkan saat ACC KP. Pada ISCP/TA pembimbing biasanya mewarisi tahap sebelumnya kecuali diganti Kaprodi. |
| Dokumen | `JenisDokumen` + `PersyaratanPengajuan` menentukan jenis berkas wajib/opsional per konteks. Revisi satu berkas tidak me-reset berkas lain yang sudah valid; histori versi tetap ada. |
| Penyelesaian | ACC penyelesaian diberikan pembimbing setelah aturan terpenuhi; jangan samakan dengan ACC pengajuan atau membuat transisi manual Kaprodi. |

Sistem **tidak terintegrasi SIKADU**; jangan membuat panggilan ke API akademik eksternal tanpa permintaan dan sumber integrasi yang valid.

## Prioritas pengerjaan SIPKITA

Utamakan kebutuhan semester berjalan jika pengguna belum menentukan prioritas lain:

1. Autentikasi, akun, role, master/konfigurasi yang diperlukan.
2. Melengkapi dan verifikasi data diri mahasiswa.
3. Pengajuan KP, ISCP, dan TA (`BARU`/`LANJUT`), pemeriksaan, persyaratan/dokumen, reviewer, review/revisi, keputusan akhir, serta penentuan pembimbing.
4. Bimbingan hanya bila diminta atau waktu memungkinkan. Perubahan judul, perpanjangan, serta pelaksanaan lengkap tahap lain ditunda sesuai keputusan proyek.

Jangan membuat semua fitur sekaligus karena melihat daftar roadmap. Buat satu slice yang bisa ditinjau sebelum melanjutkan.

## Verifikasi sebelum menyerahkan hasil

- Periksa diff: tidak ada edit di luar cakupan, secret, file pribadi, atau perubahan schema/migrasi yang tidak diizinkan.
- Jalankan pengecekan sesuai script yang **benar-benar tersedia** (mis. lint, unit/API tests, build) dengan cakupan terkecil yang relevan. Jangan mengaku sudah menjalankan tes yang tidak dijalankan.
- Uji jalur normal dan minimal satu kasus gagal: belum login, role salah, bukan pemilik/penugasan, status tidak sesuai, input tidak valid, atau upload wajib kurang.
- Untuk penulisan berganda, verifikasi perilaku transaksi/rollback dan tidak ada duplikasi riwayat atau pembimbing aktif.
- Hindari `prisma migrate reset`, penghapusan data, seed massal, atau operasi ke production demi menjalankan tes. Gunakan test fixtures/database yang aman bila tersedia.
- Bila ada kegagalan atau lingkungan tidak lengkap, laporkan secara jelas. Gunakan `code-change-verification` untuk pengujian lebih luas dan regresi bila diperlukan.

## Ringkasan saat selesai

Sampaikan hasil dalam format ringkas:

1. **Fitur yang sudah berjalan** dan aktor yang dapat mengaksesnya.
2. **File/lapisan yang berubah** serta alur data utama.
3. **Aturan penting** yang diterapkan: validasi, otorisasi, status, transaksi, dan riwayat.
4. **Hasil pemeriksaan** yang benar-benar dijalankan.
5. **Batasan atau pekerjaan lanjutan** yang belum tercakup.

## Contoh permintaan yang sesuai

- "Implementasi login SIPKITA dan pilihan mode dosen setelah login."
- "Bangun API dan form pengajuan KP berdasarkan tabel PersyaratanPengajuan."
- "Implementasikan review/revisi proposal oleh dosen reviewer yang ditugaskan."
- "Buat menu Kaprodi untuk menetapkan beberapa mahasiswa ke satu pembimbing."
