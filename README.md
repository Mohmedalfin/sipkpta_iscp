# SIPKITA

Fondasi modular monolith untuk Sistem Informasi Pengelolaan Kerja Praktik, ISCP, dan Tugas Akhir. Tahap ini hanya menyiapkan lingkungan pengembangan dan pemeriksaan koneksi; belum ada fitur atau tabel bisnis.

## Teknologi dan struktur

- `client/`: React 18, Vite 6, JavaScript/JSX, Tailwind CSS 4, React Router, Axios.
- `server/`: Node.js, Express 4, ES Modules, Prisma 7 dengan adapter PostgreSQL, REST API.
- Root `package.json` menggunakan npm workspaces untuk menjalankan kedua aplikasi.
- `client/src/pages`, `components`, `services`, `assets` memisahkan halaman, komponen, komunikasi API, dan aset.
- `server/src/controllers`, `routes`, `middlewares`, `config`, `services` memisahkan lapisan backend. `server/prisma/schema.prisma` berisi datasource PostgreSQL tanpa model bisnis; `server/prisma.config.ts` membaca `DATABASE_URL` untuk Prisma CLI.

## Prasyarat dan instalasi

Gunakan Node.js 20.19+ atau 22/24 yang kompatibel dengan Vite 6, npm, PostgreSQL, dan Postman untuk pemeriksaan manual. Pada mesin ini, Node 24 tersedia di `D:\laragon\bin\nodejs\node-v24`. Jika `npm.cmd` mengarah ke instalasi Node lain yang tidak dapat diakses, dahulukan folder tersebut di `PATH` PowerShell:

```powershell
$env:PATH='D:\laragon\bin\nodejs\node-v24;'+$env:PATH
```

Dari root proyek:

```sh
npm install
npm run prisma:generate
```

Pada PowerShell Windows yang membatasi skrip `.ps1`, gunakan `npm.cmd` sebagai pengganti `npm`. Jika beberapa versi Node tersedia, pastikan `node --version` dan `npm --version` mengarah ke instalasi yang sama.

## Environment dan database

Salin `client/.env.example` menjadi `client/.env` dan `server/.env.example` menjadi `server/.env`. Sesuaikan `VITE_API_URL` dengan URL server, `CLIENT_ORIGIN` dengan origin browser frontend, dan `DATABASE_URL` dengan akun PostgreSQL lokal. Jangan commit file `.env`.

Database `sipkita_dev` sudah dibuat melalui pgAdmin 4. Gunakan akun PostgreSQL lokal yang memiliki akses ke database itu dalam `server/.env`; tidak perlu membuat ulang database atau akun. Karakter khusus dalam password di URL harus di-URL-encode. Tidak perlu menjalankan migrasi pada tahap ini. `prisma:generate` memakai `--allow-no-models` karena model bisnis belum dirancang. Validasi skema dengan `npm run prisma:validate` setelah `.env` server diisi.

## Menjalankan

```sh
npm run dev
```

Atau jalankan terpisah dalam dua terminal dengan `npm run dev:server` dan `npm run dev:client`. Frontend: `http://localhost:5173`; API: `http://localhost:5000`. Perubahan file `.env` frontend memerlukan restart Vite. Backend dapat berjalan tanpa `DATABASE_URL`, tetapi endpoint database akan memberi status 503.

## Pengujian Postman

| Method | URL | Hasil yang diharapkan |
| --- | --- | --- |
| GET | `http://localhost:5000/api/health` | HTTP 200, `{"status":"ok","message":"SIPKITA API aktif"}` |
| GET | `http://localhost:5000/api/health/db` | HTTP 200, `{"status":"ok","database":"connected"}` bila PostgreSQL dan kredensial benar; HTTP 503, `{"status":"error","database":"disconnected"}` bila gagal |

Koleksi siap impor tersedia di `postman/SIPKITA Health.postman_collection.json`. Koleksi hanya menyimpan URL dan pemeriksaan respons; tidak berisi kredensial database.

Buka frontend untuk melihat status backend yang diambil Axios dari `/api/health`. Untuk memeriksa CORS, kirim request dengan header `Origin: http://localhost:5173` dan pastikan respons memuat `Access-Control-Allow-Origin: http://localhost:5173`. Path API yang tidak ada menghasilkan HTTP 404. JSON yang tidak valid menghasilkan HTTP 400 pada request dengan `Content-Type: application/json`.