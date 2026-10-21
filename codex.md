# PROJECT SETUP — SIPKITA

## 1. Konteks Proyek

Saya sedang mengembangkan **SIPKITA (Sistem Informasi Pengelolaan Kerja Praktik, ISCP, dan Tugas Akhir)**, sebuah aplikasi web untuk Prodi Sistem Informasi Universitas Teknologi Yogyakarta.

Proyek ini merupakan redesign sistem SIPKPTA sebelumnya.

Pada tahap sekarang, fokus pekerjaan **hanya persiapan lingkungan pengembangan (Project Initialization & Configuration)**.

Perancangan UML, ERD, database bisnis, dan implementasi fitur utama akan dilakukan pada tahap berikutnya.

## 2. Technology Stack

Gunakan teknologi berikut:

**Frontend**
- React.js + Vite
- JavaScript (JSX)
- Tailwind CSS
- React Router
- Axios

**Backend**
- Node.js
- Express.js
- JavaScript dengan ES Modules
- Prisma ORM
- PostgreSQL
- REST API

**Development Tools**
- npm
- Postman
- Git

Gunakan versi stabil yang saling kompatibel dengan lingkungan Node.js yang tersedia. Periksa dokumentasi resmi dan konfigurasi yang sesuai dengan versi yang terpasang, khususnya Prisma dan Tailwind CSS.

Arsitektur menggunakan pendekatan **Modular Monolith** dengan pemisahan frontend dan backend dalam satu repository.

## 3. Tujuan Pekerjaan

Siapkan fondasi proyek sehingga:

1. Struktur folder frontend dan backend tersedia.
2. Semua dependency dasar berhasil terpasang.
3. React dapat dijalankan di localhost.
4. Express dapat dijalankan di localhost.
5. Prisma terkonfigurasi untuk PostgreSQL.
6. Koneksi backend ke database dapat diverifikasi.
7. REST API percobaan dapat diakses melalui Postman.
8. Frontend dapat mengambil data dari backend.
9. Konfigurasi environment tersedia dan terdokumentasi.

Jangan membuat fitur bisnis SIPKITA pada tahap ini.

## 4. Struktur Proyek

Gunakan struktur dasar berikut:

```text
sipkita/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
│
├── server/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── services/
│   │   └── app.js
│   ├── .env.example
│   └── package.json
│
├── .gitignore
├── package.json
└── README.md
```

Struktur boleh disesuaikan jika terdapat kebutuhan teknis dari versi library yang digunakan, misalnya `prisma.config.ts` atau file konfigurasi Vite.

Tidak perlu membuat placeholder JavaScript kosong pada seluruh folder.

## 5. Tahapan Implementasi

### Tahap A — Inisialisasi Proyek

- Periksa kondisi repository sebelum melakukan perubahan.
- Inisialisasi React dengan Vite pada direktori `client`.
- Inisialisasi Express pada direktori `server`.
- Konfigurasi ES Modules untuk backend.
- Install dependency yang diperlukan.
- Siapkan scripts untuk development.
- Pastikan existing files tidak ditimpa tanpa alasan.

Gunakan port berikut sebagai default:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

### Tahap B — Backend Configuration

Konfigurasikan Express dengan kebutuhan dasar:

- JSON request parsing.
- CORS untuk frontend lokal.
- Environment variables.
- Centralized error handling sederhana.
- REST API routing.
- Health check endpoint.

Buat endpoint:

`GET /api/health`

Target response:

```json
{
  "status": "ok",
  "message": "SIPKITA API aktif"
}
```

Gunakan HTTP status 200 ketika backend berhasil berjalan.

### Tahap C — PostgreSQL & Prisma

- Siapkan konfigurasi koneksi PostgreSQL.
- Gunakan nama database development `sipkita_dev`.
- Konfigurasi Prisma sesuai versi yang terinstal.
- Siapkan Prisma Client dan mekanisme koneksi database yang kompatibel.
- Gunakan environment variable `DATABASE_URL`.
- Buat endpoint pengujian koneksi database.

Endpoint:

`GET /api/health/db`

Target response ketika koneksi berhasil:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Gunakan query sederhana seperti `SELECT 1` untuk menguji koneksi.

Jika database tidak terhubung, kembalikan status error yang sesuai tanpa mengekspos credential atau connection string.

**Penting:** Jangan membuat tabel bisnis, model mahasiswa, dosen, pengajuan, bimbingan, ataupun migrasi database bisnis.

Jika PostgreSQL belum tersedia, tetap siapkan konfigurasinya, jelaskan langkah yang dibutuhkan, dan jangan mengklaim database sudah terkoneksi.

### Tahap D — Frontend Configuration

- Konfigurasikan React + Vite.
- Konfigurasikan Tailwind CSS.
- Siapkan struktur routing sederhana.
- Konfigurasikan Axios untuk komunikasi API.
- Gunakan `VITE_API_URL` sebagai base URL API.
- Buat halaman awal sederhana dengan judul SIPKITA.
- Tampilkan status koneksi backend berdasarkan hasil request ke `/api/health`.

Tidak perlu membuat halaman login, dashboard, atau desain antarmuka bisnis.

### Tahap E — Environment & Development Scripts

Siapkan file `.env.example` yang berisi contoh variabel konfigurasi tanpa credential asli.

Pastikan `.gitignore` mengabaikan:

- `node_modules`
- `.env`
- file build
- file sensitif dan output sementara

Siapkan command development yang sederhana agar frontend dan backend bisa dijalankan secara terpisah maupun bersamaan dari root repository.

Gunakan dependency seminimal mungkin.

### Tahap F — Verification & Testing

Lakukan pemeriksaan terhadap:

1. Dependency frontend dan backend.
2. Proses startup Express.
3. Proses startup Vite.
4. Endpoint `/api/health`.
5. Endpoint `/api/health/db`.
6. Request Axios dari frontend ke backend.
7. Error handling dasar.
8. Konfigurasi CORS.

Siapkan instruksi pengujian API menggunakan Postman, termasuk method, URL, expected response, dan HTTP status.

Lakukan pengujian yang benar-benar dimungkinkan pada lingkungan kerja saat ini.

Jangan menyatakan pengujian berhasil apabila belum dieksekusi.

## 6. Dokumentasi

Buat `README.md` yang ringkas tetapi mencakup:

- Gambaran singkat proyek.
- Teknologi yang digunakan.
- Struktur folder.
- Prasyarat software.
- Cara instalasi dependency.
- Cara konfigurasi `.env`.
- Cara menjalankan frontend dan backend.
- Cara menyiapkan database PostgreSQL.
- Cara menguji endpoint menggunakan Postman.
- Troubleshooting dasar.

## 7. Batasan Pekerjaan

Untuk tahap setup ini, **jangan mengimplementasikan**:

- Authentication dan authorization.
- Role-Based Access Control (RBAC).
- Model dan relasi database bisnis.
- Modul pengajuan KP, ISCP, dan TA.
- Modul bimbingan.
- Monitoring progres.
- Modul seminar.
- Dashboard berdasarkan role.
- Seed data mahasiswa/dosen.
- Migrasi database bisnis.
- Deployment production.
- Docker atau microservices.

Semua hal tersebut akan dikerjakan setelah perancangan sistem selesai.

## 8. Prinsip Implementasi

- Gunakan clean code dan konsistensi penamaan.
- Hindari overengineering.
- Jangan membuat abstraksi yang belum diperlukan.
- Pertahankan struktur yang mudah dipahami developer individu.
- Terapkan konfigurasi dan keamanan dasar yang wajar.
- Gunakan JavaScript, bukan TypeScript, untuk kode aplikasi.
- Boleh menggunakan file konfigurasi TypeScript apabila diwajibkan atau direkomendasikan oleh tooling resmi.
- Jangan menghapus data, database, atau file yang sudah ada tanpa izin.
- Jika membutuhkan langkah manual dari pengguna, jelaskan secara eksplisit.

## 9. Output Akhir

Setelah implementasi selesai, tampilkan:

1. Ringkasan pekerjaan yang telah dilakukan.
2. Struktur folder aktual.
3. Daftar dependency utama.
4. Perintah menjalankan proyek.
5. Hasil pengujian aktual frontend, backend, dan database.
6. Panduan singkat pengujian melalui Postman.
7. Kendala atau pekerjaan yang belum dapat diverifikasi.

**Kriteria selesai:** Fondasi proyek siap digunakan untuk pengembangan SIPKITA, tanpa implementasi fitur bisnis terlebih dahulu.

Kerjakan setup secara berurutan dari Tahap A hingga F, lakukan validasi setiap bagian, dan laporkan hasil akhirnya secara transparan.
