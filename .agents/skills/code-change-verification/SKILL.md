---
name: code-change-verification
description: Verify changes to SIPKITA's Express/Prisma API, React UI, or PostgreSQL schema before handoff. Use after implementing or reviewing a code change to check diffs, run relevant validations/tests, assess regressions, and report evidence; not for creating an unrelated feature.
---

# SIPKITA — Code Change Verification

## Prinsip

- Verifikasi **perubahan yang benar-benar dilakukan**, bukan seluruh SIPKITA tanpa alasan. Prioritaskan pengujian relevan, kemudian perluas hanya bila perubahan menyentuh komponen bersama atau berisiko tinggi.
- Gunakan bukti dari kode, diff, log, dan output pengujian. **Jangan menyebut fitur "berhasil" hanya karena kode terlihat benar atau server dapat dijalankan.**
- Pisahkan pemeriksaan statis, perilaku API, UI, database, dan aturan domain. Hasil `lint`/`build` bukan pengganti pengujian proses bisnis.
- Bila pengguna meminta **review/diagnosis saja**, jangan mengubah kode. Bila skill digunakan dalam tugas implementasi, perbaiki regresi yang jelas berasal dari perubahan tersebut selama masih dalam cakupan; jangan mengubah hal tak terkait agar tes tampak hijau.
- Jangan menguji dengan cara yang dapat merusak data nyata, mengubah konfigurasi produksi, atau membocorkan kredensial.

## Orientasi dan batas verifikasi

1. Baca `AGENTS.md`, skrip di `package.json`, dan dokumen terkait saja: `docs/project-status.md`, `docs/architecture.md`, `docs/coding-standards.md`, `docs/api-conventions.md`, `docs/roles-permissions.md`, serta aturan domain fitur yang diperiksa, jika tersedia.
2. Identifikasi pekerjaan pengguna dan kriteria selesai. Periksa file yang berubah dengan `git status --short`, `git diff --stat`, dan `git diff` **jika repo Git tersedia**. Jangan menganggap perubahan lain milik tugas ini.
3. Petakan dampak: `client/` (React/Vite/Tailwind), `server/` (Express/Prisma), `server/prisma/schema.prisma`, folder migrasi, seeder, test, dan koleksi Postman bila ada.
4. Gunakan hasil analisis `domain-modeling` untuk aturan bisnis, `prisma-schema-change` untuk pemeriksaan perubahan schema/migrasi, dan `feature-implementation` untuk cakupan fitur. Jangan menduplikasi pekerjaannya atau mengarang dokumen yang belum dibuat.
5. Tentukan apakah pekerjaan hanya menyentuh backend, frontend, schema, atau seluruh alur. Uji setiap lapisan yang terdampak, termasuk integrasi di antaranya.

## Jalur verifikasi bertahap

### 1. Pemeriksaan perubahan kode

- Bandingkan diff dengan permintaan: tidak ada endpoint, tabel, field, dependensi, konfigurasi, atau file lain yang berubah tanpa alasan.
- Tinjau penamaan, struktur route → controller → service → Prisma, pemisahan API/UI React, keterbacaan, validasi input, konsistensi error, dan pengulangan logic.
- Cari hardcoded credential, token, secret, konfigurasi environment pribadi, data dummy sensitif, dan log berlebihan. Jangan mencetak atau mengutip nilainya.
- Pastikan seluruh kasus baru memiliki penanganan error dan status yang masuk akal. Periksa apakah fitur lama yang memakai modul bersama ikut terdampak.

### 2. Pemeriksaan statis dan build

- Temukan perintah yang tersedia dari `package.json` untuk root npm workspaces, `client`, dan `server`; jangan mengarang script.
- Jalankan pemeriksaan dengan cakupan paling kecil yang memadai: lint, format check, test, build, atau validasi Prisma sesuai perubahan.
- Untuk perubahan schema, gunakan pemeriksaan yang tidak mengubah data (`prisma validate`; `prisma migrate status` hanya saat target koneksi terkonfirmasi). Jika ada migrasi baru, inspeksi `migration.sql` dan konsistensi dengan schema.
- `prisma generate` dapat mengubah artefak hasil generate; jalankan hanya bila relevan dan sesuai izin tugas, lalu periksa diff yang ditimbulkan.
- Jika ada kegagalan, catat command dan error inti. Pisahkan kegagalan yang disebabkan perubahan ini dari kegagalan awal/lingkungan yang memang sudah ada.

### 3. Pemeriksaan backend dan API

- Uji input valid, input tidak lengkap/salah format, autentikasi gagal, role tidak berhak, kepemilikan data salah, status proses tidak sah, dan request berulang.
- Pastikan route tidak hanya mengandalkan frontend untuk otorisasi. Validasi juga **role aktif + penugasan + ownership + status** sesuai tindakan.
- Periksa response sukses/gagal sesuai konvensi API saat ini, tanpa kebocoran hash password, token, stack trace, atau informasi pribadi pengguna lain.
- Untuk operasi beberapa tabel, uji konsistensi `prisma.$transaction`: tidak ada status berubah tanpa catatan histori atau penugasan/dokumen terkait saat langkah lain gagal.
- Gunakan automated tests yang sudah ada atau koleksi Postman jika relevan; cek setup, data uji, environment, variabel dinamis, dan cleanup aman sebelum menjalankan collection runner.

### 4. Pemeriksaan frontend dan integrasi

- Verifikasi form, field wajib, pilihan tahap/jenis pengajuan, validasi dokumen, pesan error, loading, empty state, dan feedback setelah submit.
- Pastikan data yang ditampilkan berasal dari API sebenarnya sesuai kebutuhan; jangan menerima dummy/hardcoded sebagai bukti integrasi berhasil.
- Periksa tampilan dan tindakan sesuai role/mode dosen. Menyembunyikan menu di UI tidak menggantikan pengujian pembatasan endpoint.
- Pastikan perubahan status dari backend tercermin di UI, terutama saat revisi dokumen/proposal dan keputusan pengajuan.
- Jika pratinjau browser atau automated UI testing tersedia dan aman, uji alur nyata; jika tidak, sebutkan bahwa verifikasi UI manual belum dilakukan.

## Skenario domain prioritas SIPKITA

Pilih **hanya yang relevan dengan kode yang diubah**; gunakan data contoh/fixture terisolasi yang tidak mengubah data akademik nyata.

| Area berubah | Skenario yang harus dipertimbangkan |
| --- | --- |
| Auth dan akun | Login benar/salah, akun tidak aktif, user dengan beberapa role, pemilihan mode Reviewer/Pembimbing, proteksi endpoint, perubahan password tanpa mengekspos hash. |
| Data diri | Mahasiswa mengisi/merevisi identitas; Admin Prodi memberi catatan/ACC; revisi satu dokumen tidak mengulang verifikasi berkas lain yang tetap valid; verifikasi massal bila fitur tersedia. |
| Pengajuan KP/ISCP/TA | Jalur `BARU`/`LANJUT`, persyaratan berbeda per tahap dan periode, dokumen wajib/opsional, tahap prasyarat belum selesai, pengajuan beda semester tetap memiliki histori. |
| Review proposal | Reviewer hanya melihat penugasan sendiri; pengajuan reguler `BARU`/`LANJUT` memakai proposal terbaru; setiap Reviewer aktif harus `LAYAK` pada versi terbaru; lembar review opsional; hasil lengkap tidak otomatis menjadi ACC Kaprodi. |
| Persetujuan Kaprodi | ACC pengajuan setelah pemeriksaan dan review layak; status/riwayat tercatat; penetapan pembimbing dapat menjadi bagian transaksi yang sama jika alur yang dipilih mengharuskannya. |
| Penugasan dosen | Beberapa mahasiswa ke satu dosen; tidak boleh ada dua pembimbing **aktif** untuk pengajuan sama; beberapa reviewer tetap diizinkan; pembimbing lanjutan mewarisi tahap sebelumnya jika sesuai aturan. |
| Perpanjangan | Record `Pengajuan` baru terhubung ke histori; pertama boleh topik lama/baru, kedua+ wajib topik/judul/proposal baru; Admin Prodi dan Reviewer ditolak; Kaprodi memeriksa/memutuskan. |
| Bimbingan dan penyelesaian | Jika modul berubah: status bimbingan, revisi hanya saat diizinkan, minimal bimbingan tervalidasi, ACC oleh pembimbing, dan kelayakan transisi otomatis tanpa mengajukan tahap berikutnya secara diam-diam. |
| Audit dan histori | Versi file/tema/judul lama tidak hilang, `is_terkini` konsisten, perubahan status tercatat, dan tidak ada data milik mahasiswa lain yang terbuka. |

Status aplikasi yang bertipe `String` dalam skema bukan bukti daftar status final. Cocokkan dengan konstanta/service dan keputusan terbaru sebelum membuat assertion.

## Risiko data dan keamanan

- Jangan menjalankan `prisma migrate reset`, `prisma db push`, penghapusan massal, seed ke database non-test, atau migrasi baru hanya untuk keperluan verifikasi.
- Sebelum API test yang membuat/mengubah data, pastikan menggunakan database **test/disposable** atau fixture yang secara eksplisit aman. Jika hanya ada koneksi ke database pengguna yang berisi data penting, hentikan tes mutatif dan laporkan pembatasannya.
- Jangan otomatis menghapus record untuk cleanup jika tidak dapat membedakan data uji dari data asli. Gunakan ID dan sumber data uji yang pasti; utamakan transaksi rollback atau lingkungan terisolasi.
- Perlakukan perubahan constraint unik, foreign key, dan migrasi historis sebagai risiko tinggi. Tidak ada persetujuan implisit untuk reset, drop, deploy, atau akses production.
- Jangan menurunkan kualitas assertion, menghapus test, atau mengubah expected result menjadi tidak bermakna hanya agar suite lolos. Jika ekspektasi test salah, jelaskan bukti kontrak API yang sebenarnya lalu perbaiki test bila berada dalam cakupan.

## Saat menemukan masalah

1. Reproduksi dengan input, role, status, dan data awal yang dapat dijelaskan.
2. Tentukan sumber kegagalan: perubahan saat ini, kode lama, aturan bisnis yang belum jelas, fixture, environment, atau migrasi.
3. Jika tugas memberi izin implementasi dan penyebabnya ada dalam perubahan sekarang, lakukan perbaikan **sekecil mungkin**, lalu ulangi pemeriksaan terkait.
4. Bila butuh keputusan domain atau perubahan schema tambahan, laporkan dan gunakan skill yang sesuai sebelum memperluas pekerjaan.
5. Jika perintah meminta reset database, kredensial baru, atau akses production, **berhenti dan minta arahan**. Jangan mencari jalan pintas melalui perintah destruktif.

## Format laporan verifikasi

Berikan hasil singkat tetapi dapat diaudit:

1. **Cakupan:** fitur dan file/lapisan yang benar-benar diperiksa.
2. **Hasil:** tabel atau daftar `LULUS`, `GAGAL`, `BELUM DIUJI`, atau `TERBLOKIR` untuk setiap pemeriksaan penting.
3. **Bukti:** command/test case yang dijalankan, hasil output inti, serta jumlah pass/fail bila tersedia.
4. **Temuan:** bug dan risiko, tingkat dampak, perbaikan yang telah dilakukan, dan hasil retest jika ada.
5. **Batas keyakinan:** aspek yang tidak bisa diuji dan alasan konkret; jangan menyimpulkan end-to-end sudah benar jika yang lolos hanya validasi schema atau build.

Jangan mengklaim semua pengujian lulus tanpa bukti. Bila ada blocker, serahkan langkah berikutnya yang paling aman dan relevan.

## Contoh permintaan

- "Cek hasil implementasi login SIPKITA, terutama authorization tiap role."
- "Verifikasi endpoint dan UI pengajuan KP setelah selesai coding."
- "Review regression setelah mengubah schema dan migration dokumen pengajuan."
- "Uji agar ACC Kaprodi tidak bisa dilakukan sebelum review proposal selesai."
