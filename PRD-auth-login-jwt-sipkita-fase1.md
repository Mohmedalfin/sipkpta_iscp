# PRD — Backend Autentikasi SIPKITA (Fase 1: Login dan JWT)

**Status:** Siap menjadi instruksi implementasi Codex; **belum dieksekusi**\
**Ruang lingkup:** `server/` saja — Express REST API, Prisma ORM, PostgreSQL\
**Tahap berikutnya (terpisah):** refresh token, logout yang mencabut sesi, pemilihan mode role, lupa/reset password, dan frontend

## 1. Tujuan dan keputusan desain

Bangun vertical slice autentikasi pertama menggunakan akun dummy dan hash Argon2id yang telah tersedia. Hasil akhir fase ini adalah login yang menghasilkan **JWT access token berumur pendek**, pembacaan identitas akun melalui `GET /api/auth/me`, serta middleware autentikasi/otorisasi dasar.

Keputusan untuk fase 1:

- Login menggunakan `User.login_id` dan password, **bukan** registrasi publik. Akun SIPKITA disediakan dari master data/admin, bukan self-registration.
- Verifikasi password wajib menggunakan modul bersama `server/src/security/password.js` yang sudah dibuat pada tahap Argon2id. Jangan mengimplementasikan hashing ulang.
- Untuk pengujian API backend melalui Postman/tes, access token dikirim sebagai `Authorization: Bearer <token>`.
- Token JWT fase ini menggunakan **HS256** dengan secret kuat dari environment, masa berlaku awal **15 menit** (dapat dikonfigurasi), dan hanya berisi klaim identitas minimum.
- **JWT access token bukan solusi logout/refresh dengan sendirinya**. Fase ini belum mengklaim logout yang langsung mencabut token. Tentukan desain session/refresh dan penyimpanan cookie HTTP-only sebelum membuat frontend atau merilis aplikasi.
- Jangan menyimpan token pada `localStorage`/`sessionStorage` React di kemudian hari; rancangan transport browser harus dievaluasi tersendiri (cookie HTTP-only, CSRF, CORS, HTTPS).
- Tidak perlu penambahan tabel atau migration pada fase ini. Bila kebutuhan baru mengharuskan perubahan schema, **berhenti dan ajukan usulan**, jangan menjalankan migration.

## 2. Baseline proyek yang perlu diverifikasi

Menurut laporan Codex terbaru, bukan hasil inspeksi langsung dokumen ini:

| Komponen                | Baseline dilaporkan                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Backend                 | Express + Prisma 7.x + PostgreSQL (`server/`)                                               |
| Data dummy              | 8 User, 6 Role, 9 UserRole, 2 Mahasiswa, 4 Dosen, 1 Prodi                                   |
| Hash password           | 8/8 sudah Argon2id, diverifikasi; `m=19456, t=2, p=1`                                       |
| Modul hash              | `server/src/security/password.js`                                                           |
| Testing                 | `npm test` server 4/4 pada tahap hashing                                                    |
| Schema/migration        | Valid dan up to date; representational diff dua partial index sebelumnya belum diselesaikan |
| API aktual sebelum auth | Endpoint health; login/role belum diimplementasikan                                         |
| Risiko dependensi       | Audit sebelumnya melaporkan 6 high + 2 moderate; belum dilakukan perbaikan otomatis         |

Sebelum membuat kode, Codex wajib memeriksa **status Git, struktur source, script npm, model `User`/`Role`/`UserRole`, enum status aktif, dan kontrak respons API aktual**. Periksa nama field yang sesungguhnya; jangan menebak dari PRD.

### Kebijakan pembacaan konteks yang hemat token

`AGENTS.md` adalah instruksi dasar repo. Mulailah dari PRD ini dan source terkait: route/handler Express, koneksi Prisma, `password.js`, schema untuk model autentikasi, serta tes yang sudah ada. Baca `docs/api-conventions.md`, `docs/architecture.md`, `docs/coding-standards.md`, dan `docs/roles-permissions.md` **hanya bagian yang diperlukan** jika tersedia dan relevan. Aktifkan `feature-implementation` dan `code-change-verification` hanya saat ruang kerjanya sesuai. **Jangan membaca seluruh `docs/` atau seluruh skill secara otomatis**; `prisma-schema-change` tidak dibutuhkan selama schema tidak berubah.

## 3. Endpoint yang dibuat

### 3.1 `POST /api/auth/login`

Request JSON:

```json
{
  "login_id": "522001001",
  "password": "<password development, jangan hard-code>"
}
```

Alur server:

1. Validasi tipe, panjang, kelengkapan, dan format kedua input. Perlakukan `login_id` sebagai **string** dan pertahankan nol di awal (contoh NIDN `0000000004`); jangan konversi ke angka. Tolak payload tak valid dengan respons aman.
2. Temukan akun menggunakan `login_id` yang unik menurut schema aktual. Jangan memproses email sebagai login identifier bila tidak disepakati.
3. Cek status akun sesuai enum/field nyata; akun tidak aktif **tidak boleh** memperoleh token.
4. Verifikasi password dengan `verifyPassword` Argon2id yang ada. Akun tidak ditemukan, tidak aktif, atau password salah mendapatkan **pesan kegagalan generik yang sama**. Pertimbangkan perbedaan waktu respons untuk mencegah enumerasi.
5. Ambil role yang benar-benar tercatat pada `UserRole`; jangan percaya input `role` dari request. Jika pengguna tidak memiliki role sah, jangan berikan otorisasi apa pun; tetapkan perilaku login yang aman dan uji kasusnya.
6. Buat access token bertanda tangan dengan kunci dari environment. Set `sub` ke primary key User (berdasarkan schema), `iss`, `aud`, `iat`, `exp`, dan `jti` acak bila library mendukung. Jangan memasukkan password hash, NIM/NIDN, data pribadi, atau seluruh objek User ke payload.
7. Berikan respons sukses menggunakan konvensi `docs/api-conventions.md` jika sudah diputuskan, dengan access token, tipe `Bearer`, expiry, dan profil minimum (tanpa `password_hash`). Jangan mengubah respons endpoint health hanya demi menyamakan envelope.

Contoh bentuk sukses **ilustratif** (ikuti konvensi aktual jika berbeda):

```json
{
  "success": true,
  "data": {
    "accessToken": "<JWT>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": { "id": "<user-id>", "login_id": "522001001", "roles": ["MAHASISWA"] }
  }
}
```

Respons error: gunakan `400` untuk payload invalid, `401` untuk kegagalan login generik, `429` saat batas percobaan terlampaui, dan `500` untuk kegagalan tak terduga yang ditangani tanpa kebocoran data sensitif. Sesuaikan envelope persis dengan konvensi API repo yang berlaku.

### 3.2 `GET /api/auth/me`

- Wajib memakai `Authorization: Bearer <JWT>` yang valid.
- Memverifikasi JWT dan mengambil **kondisi akun terkini** dari database (termasuk status aktif dan role aktual), sehingga penonaktifan akun atau pencabutan role tidak mengandalkan klaim token yang kedaluwarsa.
- Mengembalikan profil minimum pengguna saat ini beserta semua role aktif yang dimilikinya, bukan data mahasiswa/dosen lain.
- Tidak boleh mengembalikan `password_hash`, secret, token mentah, atau atribut internal sensitif.
- Token tidak ada, malformed, signature tidak valid, expired, atau akun nonaktif → `401` dengan error aman.

### 3.3 Middleware

- `authenticate`: parsing header Bearer secara ketat; verifikasi signature, algoritma yang diizinkan secara eksplisit, `iss`, `aud`, `exp`, dan klaim wajib; muat User aktual dan tolak jika tidak aktif.
- `authorizeRoles(...allowedRoles)`: **deny by default**, memeriksa role sah dari data server; tidak percaya role yang dikirim lewat body/header atau token tanpa verifikasi ulang.
- Siapkan middleware agar dapat dipakai modul berikutnya, tanpa membuat endpoint pengajuan/admin yang belum diminta.
- Pada fase ini dosen multi-role boleh memperoleh daftar Reviewer dan Pembimbing; **pemilihan mode aktif** dan endpoint `select-role` ditunda ke tahap berikutnya. Jangan menganggap satu dosen hanya memiliki satu role.

## 4. Keamanan wajib

1. JWT signing secret **wajib berasal dari environment**, acak dan kuat (untuk HS256 minimal 32 byte entropi). Jangan membuat secret default atau mencetak nilainya. Cek kompatibilitas pustaka JWT dengan Node 20 sebelum menambah dependensi; gunakan library terpelihara, bukan fungsi kriptografi buatan sendiri.
2. Tetapkan *allowlist* algoritma JWT pada verifikasi, bukan mengikuti header token; verifikasi `iss`, `aud`, `exp`, dan klaim lain yang wajib. Token kedaluwarsa dan token yang dimodifikasi harus ditolak.
3. Tambahkan perlindungan percobaan login berlebihan (*rate limiting/throttling*) yang relevan untuk backend saat ini. Jika implementasinya hanya in-memory untuk development, dokumentasikan bahwa itu **belum cukup untuk deployment multi-instance**.
4. Sanitasi logger/error handler pada jalur auth agar password, token, isi body, header Authorization, hash, stack trace sensitif, dan connection string tidak tercetak. Perubahan logger dibatasi pada kebutuhan keamanan ini.
5. Jangan mengaktifkan CORS wildcard dengan credentials. Pengaturan cookie/CSRF dan HTTPS production akan dirancang pada fase session/browser berikutnya.
6. Periksa laporan `npm audit` sebagai **audit read-only** dan laporkan dependensi runtime yang memengaruhi auth. Jangan menjalankan `npm audit fix`, upgrade mayor, atau menambah penggantian dependensi tak terkait tanpa izin.
7. Jangan mengubah password delapan fixture, menjalankan seeder, mengubah `.env`, menambah akun, atau menampilkan kredensial pada laporan.

server/
├── src/
│   ├── routes/
│   │   └── auth.routes.js
│   │
│   ├── controllers/
│   │   └── auth.controller.js
│   │
│   ├── services/
│   │   └── auth.service.js
│   │
│   ├── middlewares/
│   │   ├── authenticate.js
│   │   └── authorizeRoles.js
│   │
│   └── security/
│       ├── password.js       # Sudah tersedia
│       └── jwt.js            # Jika diperlukan
│
└── test/
    └── auth.test.js

## 5. Batasan fase ini

**Tidak termasuk:** frontend React, halaman login, `register`, `forgot-password`, `reset-password`, refresh token, logout dengan revocation, `select-role`, master data, notifikasi, CAPTCHA/Turnstile, business rules akademik, schema/migration Prisma.

**Penting:** Karena access token JWT fase 1 bersifat pendek dan belum memiliki denylist/session revocation, pengujian tahap ini **tidak boleh diberi label sebagai autentikasi lengkap untuk production**. Alur logout/refresh dan pemilihan role harus diselesaikan pada fase lanjutan sebelum rollout publik.

## 6. Pengujian minimum dan kriteria selesai

- [ ] `POST /api/auth/login` sukses untuk minimal Mahasiswa, Admin Sistem, Kaprodi, serta Dosen multi-role dari delapan fixture (gunakan password dari environment tanpa mencetaknya).
- [ ] Kredensial salah, `login_id` tak dikenal, akun nonaktif, dan input invalid ditolak dengan kode/pesan sesuai kontrak; tidak membocorkan akun yang terdaftar.
- [ ] Percobaan login berlebihan mendapat perlindungan/rate limit yang diuji.
- [ ] JWT valid diterima; tanpa token, token rusak, signature salah, token expired, issuer/audience salah, dan algoritma tidak diizinkan ditolak.
- [ ] `GET /api/auth/me` mengembalikan hanya identitas sendiri dan daftar role aktual.
- [ ] Unit test `authorizeRoles` membuktikan satu user multi-role diizinkan pada kedua role yang dimilikinya, tetapi role lain ditolak; akses tanpa autentikasi juga ditolak.
- [ ] Penonaktifan User atau pencabutan UserRole setelah token dibuat tercermin pada request berikutnya.
- [ ] Respons dan log tidak mengandung `password_hash`, password plaintext, JWT lengkap, atau secret.
- [ ] Tes awal hashing tetap lulus; `prisma validate` dan `prisma migrate status` tetap bersih (catat anomali indeks representasional jika relevan, jangan memperbaikinya dalam task ini).
- [ ] Tidak ada migration, perubahan schema, seeding ulang, modifikasi frontend, atau perubahan database development yang tidak diminta.
- [ ] File berubah dan pemeriksaan aktual dilaporkan; jangan mengklaim test telah lulus jika belum dijalankan.

## 7. Stop conditions

Hentikan pekerjaan yang terdampak dan minta keputusan bila:

- Struktur aktual `User`, status aktif, atau relasi `UserRole` berbeda secara substantif dari baseline.
- Modul `password.js` tidak menyediakan kontrak verifikasi yang aman sehingga perlu perubahan luas di luar task.
- Implementasi memerlukan schema baru untuk token/session, migration, atau database reset.
- Runtime/dependency yang dipilih tidak kompatibel dengan proyek, atau kerentanan runtime yang relevan membuat implementasi tidak aman tanpa solusi.
- Terdapat perubahan lokal pengguna yang akan tertimpa.
- Strategi token yang dipilih bertentangan dengan konfigurasi autentikasi aktual yang sudah ada.

Jangan menjalankan perintah destruktif, `prisma migrate dev`, `prisma db push`, `migrate reset`, `npm audit fix`, atau deployment sebagai bagian PRD ini.

