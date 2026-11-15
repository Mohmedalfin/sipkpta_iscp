# SIPKITA

SIPKITA adalah Sistem Informasi Pengelolaan Kerja Praktik (KP), Information Systems Capstone Project (ISCP), dan Tugas Akhir (TA) untuk Program Studi Sistem Informasi. Repository ini berupa monorepo npm workspaces dengan React/Vite di sisi client dan Express/Prisma/PostgreSQL di sisi server.

## Status saat ini

Fondasi teknis telah tersedia, tetapi modul akademik belum selesai diimplementasikan.

- Backend autentikasi Fase 1 menyediakan `POST /api/auth/login` dan `GET /api/auth/me`; keduanya telah diuji melalui HTTP. Berkas route/controller health sedang terhapus di worktree ini, sehingga endpoint health tidak tersedia pada snapshot sekarang.
- Schema Prisma berisi 38 model dan lolos validasi dengan Prisma 7.10.0.
- Migrasi `20261029174916_init_sipkita` telah diterapkan pada database development.
- Audit read-only menemukan 38 tabel bisnis, 38 primary key, 82 foreign key, dan 4 indeks unik parsial.
- Source React/Vite tersedia, tetapi build dan alur browser belum diverifikasi pada audit terakhir.
- Backend autentikasi Fase 1–3 telah diuji melalui HTTP pada fixture development: login, `/me`, refresh rotation/reuse detection, logout, serta pemilihan dan pergantian role aktif. Forgot/reset password Fase 4 telah diuji otomatis memakai SMTP mock dan database terisolasi; pengiriman Gmail nyata belum diuji. Frontend auth dan modul akademik masih menunggu implementasi.
- Server menyediakan `npm test -w server`; script lint dan format otomatis belum tersedia.

`prisma migrate diff` masih melaporkan drop/add untuk `uq_pembimbing_aktif` dan `uq_seminar_terjadwal`, walaupun kedua indeks ada di database. Indikasinya merupakan perbedaan representasi predicate introspection. Jangan mengubah schema atau migrasi terapan hanya untuk menutup diff ini tanpa analisis dan persetujuan.

Status dan bukti audit lebih lengkap tersedia di [docs/project-status.md](docs/project-status.md).

## Aturan bisnis utama

- Siklus akademik adalah KP → ISCP → TA. ACC penyelesaian oleh Pembimbing membuka kelayakan, tetapi mahasiswa tetap membuat pengajuan tahap berikutnya.
- Seluruh pengajuan reguler KP/ISCP/TA, termasuk jalur `LANJUT`, wajib memakai proposal terbaru dan menjalani review.
- Jika beberapa Reviewer aktif ditugaskan, semuanya wajib memberi hasil `LAYAK` pada proposal terbaru. Kondisi itu tidak otomatis menjadi ACC; keputusan akhir tetap milik Kaprodi.
- Admin Prodi memeriksa data diri serta administrasi pengajuan reguler/awal. Pelaku pemeriksaan kelayakan akademik masih perlu ditetapkan. Pengajuan pada semester berikutnya menggunakan proses perpanjangan, tanpa pemeriksaan Admin Prodi.
- Setiap permohonan melanjutkan atau mengulang tahap pada semester berikutnya diproses sebagai perpanjangan; tidak ada pengajuan ulang terpisah. Sistem membuat `Pengajuan` baru dan mempertahankan riwayat lama. Perpanjangan pertama boleh memakai topik lama atau baru; perpanjangan kedua dan seterusnya wajib topik, judul, dan proposal baru.
- Perpanjangan diperiksa dan diputuskan langsung oleh Kaprodi tanpa Reviewer dan tanpa verifikasi Admin Prodi.

Detail aturan ada di [indeks business rules](docs/business-rules/index.md).

## Struktur repository

```text
client/                 React, Vite, Tailwind CSS
server/                 Express, Prisma Client, PostgreSQL
server/prisma/          Schema dan riwayat migrasi Prisma
docs/                   Domain, arsitektur, status, dan aturan bisnis
.agents/skills/         Instruksi kerja khusus proyek
```

## Menjalankan development

Persyaratan minimum: Node.js/npm dan PostgreSQL development yang aman.

1. Salin `server/.env.example` menjadi `server/.env` dan `client/.env.example` menjadi `client/.env`.
2. Isi konfigurasi lokal tanpa memasukkan secret ke Git.
   Untuk backend auth, isi `JWT_ACCESS_SECRET_BASE64` dengan Base64url dari
   sekurangnya 32 byte acak. `JWT_ACCESS_EXPIRES_IN_SECONDS` default 900 (15 menit).
   Untuk forgot/reset password, isi konfigurasi Gmail SMTP pada `SMTP_HOST`,
   `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_APP_PASSWORD`, dan `MAIL_FROM`.
   Gunakan Google App Password; `SMTP_USER` dan `MAIL_FROM` harus sama.
   `RESET_TOKEN_EXPIRES_MINUTES` default 15. `PASSWORD_RESET_URL` bersifat
   opsional sampai frontend tersedia; bila kosong, email menyertakan token untuk
   disalin ke Postman.
3. Pasang dependensi dengan `npm install` bila belum tersedia.
4. Jalankan client dan server:

  ```bash
  npm run dev
  ```

  Jika `JWT_ACCESS_SECRET_BASE64` belum tersedia, Anda dapat membuat secret sementara
  untuk sesi PowerShell saat ini lalu menjalankan development dari terminal yang sama:

  ```powershell
  $env:JWT_ACCESS_SECRET_BASE64 = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
  npm run dev
  ```

  Jalankan kedua baris di terminal PowerShell yang sama. Jika `npm run dev` sudah
  berjalan, hentikan dahulu dengan Ctrl+C lalu jalankan kembali. Secret sementara
  ini tidak disimpan ke `.env` dan hilang saat sesi terminal ditutup.

Alamat development yang dikonfigurasi saat ini:

- Client: `http://127.0.0.1:5173`
- API: `http://localhost:5000`

Perintah yang tersedia:

```bash
npm run dev
npm run dev:client
npm run dev:server
npm run build
npm run prisma:validate
npm run prisma:generate
npm test -w server
```

Backend auth menyediakan `POST /api/auth/login` dengan `login_id` dan
`password`, `POST /api/auth/refresh` dengan body `{ "refreshToken": "..." }`,
`POST /api/auth/active-role` dengan body `{ "role": "KODE_PERAN" }`,
`POST /api/auth/logout` dan `GET /api/auth/me` dengan header `Authorization: Bearer <token>`.
Forgot/reset password tersedia tanpa autentikasi melalui
`POST /api/auth/forgot-password` dengan body `{ "email": "..." }` dan
`POST /api/auth/reset-password` dengan body `{ "token": "...", "newPassword": "...", "confirmPassword": "..." }`.
Endpoint forgot selalu memberi respons generik untuk email terdaftar maupun tidak
terdaftar. Token reset hanya disimpan sebagai hash, berlaku satu kali, dan reset
yang berhasil mencabut seluruh sesi aktif pemilik akun.
Respons memakai envelope `success/data` atau `success/error`. Login dan endpoint
reset dibatasi dengan penyimpanan rate-limit in-memory; untuk deployment
multi-instance diperlukan store bersama dan konfigurasi proxy yang sesuai.
Refresh token berlaku tujuh hari, berotasi saat dipakai, dan hanya hash-nya yang
disimpan. Logout mencabut sesi sehingga access token dari sesi yang sama ditolak.
Endpoint Fase 2 telah diuji pada database development lokal; database lain tetap
memerlukan migrasi yang sama sebelum backend baru dijalankan.

Role aktif Fase 3 disimpan per sesi. Pengguna satu role mendapat role aktif secara
otomatis; pengguna multi-role memilihnya melalui endpoint `active-role`.
`role_version` membuat seluruh access token generasi lama tetap ditolak setelah
pergantian role, termasuk pola A → B → A.

Import CSV Master Mahasiswa dan Dosen tersedia untuk role aktif `ADMIN_PRODI`:
`POST /api/master/{mahasiswa|dosen}/import/preview` menerima `multipart/form-data`
dengan field `file` (`.csv` UTF-8); `POST /api/master/{mahasiswa|dosen}/import`
menerima `{ "previewId": "...", "confirmValidOnly": true }`; dan
`GET /api/master/{mahasiswa|dosen}/import/:previewId/errors.xlsx` mengunduh
hanya baris gagal. Header wajib Mahasiswa adalah
`nim,nama,tanggal_lahir,email,angkatan`; header wajib Dosen adalah
`kode_dosen,nidn,nama,tanggal_lahir,email`. Kolom opsional yang dikenali mengikuti
field profil CRUD. Preview tidak menyimpan data master; batas default adalah 5 MB
dan 1.000 baris (opsional diatur lewat `CSV_IMPORT_MAX_BYTES` dan
`CSV_IMPORT_MAX_ROWS`). Preview disimpan hanya dalam memori server selama 30 menit,
terikat ke admin dan Prodi; setelah server restart, file harus diunggah ulang.
Import per baris memakai transaksi CRUD existing dan tidak mengubah akun lama.

Jangan menjalankan `prisma db push`, `prisma migrate reset`, atau operasi destruktif sebagai jalan pintas. Pastikan target database development sebelum menjalankan perintah Prisma yang dapat menulis data/struktur.

## Dokumentasi penting

- [AGENTS.md](AGENTS.md) — konteks dan batas kerja agent.
- [docs/project-status.md](docs/project-status.md) — status implementasi dan bukti audit.
- [docs/academic-lifecycle.md](docs/academic-lifecycle.md) — lifecycle KP/ISCP/TA.
- [docs/roles-permissions.md](docs/roles-permissions.md) — kewenangan aktor.
- [docs/business-rules/index.md](docs/business-rules/index.md) — indeks aturan bisnis.
- [docs/database.md](docs/database.md) — struktur data dan constraint.
- [docs/architecture.md](docs/architecture.md) — batas lapisan aplikasi.
- [docs/api-conventions.md](docs/api-conventions.md) — konvensi endpoint baru.

Keberadaan schema atau dokumentasi tidak membuktikan sebuah fitur selesai. Status fitur hanya boleh dinaikkan setelah kode terintegrasi dan skenario berhasil/gagal yang relevan benar-benar diuji.
