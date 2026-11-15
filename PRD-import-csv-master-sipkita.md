# PRD — Import CSV Master Mahasiswa & Dosen SIPKITA

**Status:** Rancangan implementasi backend.  
**Prioritas:** Setelah CRUD Master Mahasiswa dan Dosen teruji PostgreSQL.  
**Prinsip:** Scope ketat, reuse kode, tanpa frontend dan tanpa perubahan schema jika tidak diperlukan.

## 1. Tujuan

Admin Prodi bisa menambah banyak mahasiswa/dosen melalui CSV, melihat kesalahan **sebelum** data disimpan, menyetujui impor baris yang valid, dan mengunduh laporan Excel berisi **hanya baris bermasalah** beserta alasannya.

Gunakan arsitektur Express route → controller → service → Prisma yang sudah ada. **Reuse logika pembuatan akun/profil serta Argon2id dari CRUD Master existing**. Jangan membuat mekanisme pembuatan akun kedua.

## 2. Batas scope

**Termasuk:** impor CSV Mahasiswa dan Dosen, preview/validasi per baris, konfirmasi impor valid, laporan kesalahan `.xlsx`, transaksi per baris, rate/ukuran file yang wajar, audit/pengujian.

**Tidak termasuk:** React, import `.xlsx` sebagai input, sinkronisasi SIKADU, edit massal akun existing, ekspor seluruh master, role assignment dosen, notifikasi email massal, pengajuan akademik, dan perubahan skema/DB tanpa persetujuan.

Hanya **active role `ADMIN_PRODI`** yang diizinkan; pertahankan guard satu Prodi existing. Prodi untuk data hasil impor diturunkan dari kewenangan admin, **tidak dipercayakan ke nilai bebas dalam CSV**. Jika ternyata perlu pemetaan multi-Prodi, laporkan sebagai kebutuhan terpisah.

## 3. Dua jalur, satu mesin impor

| Entitas | Header CSV wajib (rancangan API) | Pembuatan akun |
| --- | --- | --- |
| Mahasiswa | `nim,nama,tanggal_lahir,email,angkatan` | `User`, `UserRole(MAHASISWA)`, profil Mahasiswa |
| Dosen | `nidn,nama,tanggal_lahir,email` | `User` dan profil Dosen; **jangan otomatis beri REVIEWER/PEMBIMBING** |

Sesuaikan pemetaan atribut dengan `schema.prisma` **aktual**, termasuk identitas login dosen bila schema menggunakan identitas selain `nidn`. Jangan mengarang field wajib atau membuat migrasi hanya untuk mengikuti nama header contoh.

- `tanggal_lahir` dalam CSV: `YYYY-MM-DD` (ISO), divalidasi sebagai tanggal kalender nyata.
- Password awal akun baru: `DDMMYYYY` dari tanggal lahir, **disimpan hanya sebagai hash Argon2id**. Jangan keluarkan password/hash dalam respons, log, atau laporan.
- `login_id` mahasiswa = NIM; login dosen mengikuti identitas unik yang dipakai CRUD existing.
- Email dinormalisasi konsisten dengan service existing; NIM/NIDN harus diperlakukan sebagai **teks** (pertahankan angka nol di depan).
- Akun existing, termasuk yang nonaktif, **tidak diubah/diaktifkan otomatis** dan dilaporkan sebagai duplikat.

## 4. Alur dan aturan bisnis final

1. Admin Prodi unggah file CSV.
2. **Preview (tanpa write DB):** validasi seluruh baris; tampilkan total, valid, invalid, nomor baris, dan alasan rinci.
3. Jika struktur file/header rusak atau melebihi batas, **tolak seluruh file** (HTTP 400).
4. Jika hanya sebagian baris bermasalah, tampilkan pilihan **perbaiki file** atau **import data valid**. **Tidak ada impor otomatis setelah preview.**
5. Setelah admin mengonfirmasi, backend **validasi ulang ke DB** (antisipasi data berubah sejak preview), lalu impor hanya baris valid. Baris gagal dilaporkan, tidak memblokir baris lain.
6. Setiap satu baris baru (User + role bila Mahasiswa + profil) adalah **satu transaksi atomik**. Jika salah satu insert gagal, rollback hanya baris tersebut.
7. Hasil final memuat jumlah `total`, `imported`, `failed`, dan rincian kesalahan. Pengulangan konfirmasi job yang sama tidak boleh membuat duplikat.
8. Admin bisa mengunduh file Excel baris bermasalah setelah preview **dan** setelah hasil impor; baris yang sukses saat import tidak boleh salah ditandai gagal dalam laporan final.

**Contoh:** CSV 200 baris, 195 valid, 5 bermasalah. Preview menunjukkan 195/5 tanpa perubahan DB. Jika admin setuju, maksimal 195 diproses; 5 dilewati. Jika saat commit muncul konflik baru, jumlah berhasil disesuaikan dan konflik tambahan masuk laporan final.

## 5. Kontrak API usulan (backend only)

Gunakan path konsisten dengan CRUD Master existing; urutkan routing spesifik agar tidak tertangkap route `/:id`.

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | `/api/master/mahasiswa/import/preview` | Upload CSV, validasi, buat preview |
| POST | `/api/master/mahasiswa/import` | Konfirmasi dan proses baris valid |
| GET | `/api/master/mahasiswa/import/:previewId/errors.xlsx` | Unduh laporan kesalahan |
| POST | `/api/master/dosen/import/preview` | Sama untuk dosen |
| POST | `/api/master/dosen/import` | Sama untuk dosen |
| GET | `/api/master/dosen/import/:previewId/errors.xlsx` | Unduh laporan kesalahan |

**Preview input:** `multipart/form-data`, field `file` berisi `.csv`.  
**Preview output (JSON envelope proyek):**

```json
{
  "previewId": "opaque-id",
  "total": 200,
  "valid": 195,
  "invalid": 5,
  "errors": [{"row": 12, "field": "nim", "message": "NIM sudah terdaftar"}]
}
```

**Import input:** `{ "previewId": "opaque-id", "confirmValidOnly": true }`. Tanpa flag konfirmasi yang tepat, **jangan melakukan write**.  
**Import output:** jumlah aktual berhasil/gagal dan `reportUrl` milik job tersebut, tanpa password/hash.

**Implementasi preview sementara:** Gunakan penyimpanan sementara yang aman, terbatas waktu (mis. 30 menit), terikat ke ID Admin Prodi/Prodi dan ID acak tidak mudah ditebak. Simpan input dan hasil seperlunya, hapus setelah kedaluwarsa. **Tidak perlu membuat tabel `ImportJob` baru untuk MVP.** Kehilangan preview setelah restart berarti admin harus unggah ulang; dokumentasikan batasan ini. Validasi ulang semua baris sebelum commit. Report final harus merefleksikan hasil commit, bukan hasil preview lama.

## 6. Aturan validasi

- File harus CSV valid, UTF-8 (BOM boleh), header wajib sesuai, ukuran/batas baris dibatasi dan dapat dikonfigurasi (usulan awal maksimum 5 MB / 1.000 baris).
- Gunakan parser CSV yang mendukung quoted values; jangan memecah baris menggunakan `split(',')` atau membangun SQL mentah.
- Data wajib tidak kosong; validasi NIM/NIDN, email, tanggal lahir, angkatan, dan Prodi sesuai ketentuan CRUD yang ada.
- Periksa duplikat **di dalam file** dan **di database**; tangani pula konflik unik saat commit akibat request bersamaan.
- Setiap baris boleh mempunyai **beberapa catatan kesalahan**.
- Gagal per baris tidak boleh membuat akun/profil yatim. Kegagalan struktural file tidak boleh membuat satu pun perubahan DB.
- Semua endpoint memeriksa role aktif dan kewenangan Prodi; jangan mempercayai ID atau jenis entitas yang dikirim klien tanpa verifikasi.

## 7. Laporan kesalahan Excel

Download `.xlsx` berisi **hanya baris gagal**, baik pada tahap preview maupun hasil final. Pertahankan seluruh kolom asli, lalu tambahkan di paling kanan:

| Kolom tambahan | Contoh |
| --- | --- |
| `Nomor Baris CSV` | `12` (sesuai file asli; header dihitung) |
| `Status` | `GAGAL` |
| `Catatan Kesalahan` | `NIM sudah terdaftar; Email tidak valid` |

Satu sheet `Data Bermasalah` sudah cukup; header jelas, wrapping catatan, baris gagal ditandai lembut. NIM/NIDN wajib bertipe teks agar nol depan utuh. Lindungi sel teks dari risiko formula injection Excel (nilai CSV berawalan `=`, `+`, `-`, `@` diperlakukan sebagai teks, bukan rumus). Kolom laporan **bukan** input impor; untuk unggah ulang admin hanya memakai kolom template CSV asli.

## 8. Verifikasi wajib

1. Preview 200 baris dengan 195 valid/5 salah: **0 write DB** dan alasan tiap baris tepat.
2. Import valid-only: hanya 195 tersimpan, hasil per baris konsisten.
3. Password DDMMYYYY bisa dipakai login sesuai perilaku akun/role; hash berbeda antar akun dan tidak pernah bocor.
4. Duplikat NIM/NIDN/email (di CSV/DB), tanggal lahir kosong/tidak valid, header rusak, file terlalu besar ditangani benar.
5. Kesalahan insert profil me-rollback User/role untuk baris itu; baris lain tetap diproses.
6. Job berulang, preview kedaluwarsa, perubahan DB setelah preview, dan upload tanpa konfirmasi ditangani aman.
7. Role non-ADMIN_PRODI ditolak; guard satu Prodi tetap berlaku.
8. Laporan preview/final `.xlsx` hanya berisi baris gagal, nomor baris/catatan benar, nol awal terjaga.
9. Test PostgreSQL dilakukan pada **database terpisah**, dengan cleanup hanya fixture yang dibuat test. Jangan melakukan write pada `sipkita_dev` selama tes.

Jalankan tes server, tes integrasi terfokus, syntax check, `git diff --check`, dan `prisma validate` bila schema tersentuh.

## 9. Aturan kerja agent

- Baca `AGENTS.md`, service CRUD master, model Prisma relevan, dan **skill implementasi/verifikasi yang relevan saja**. Jangan audit seluruh repo/ulang semua dokumentasi.
- Reuse validator, service pembuatan akun, otorisasi, dan error envelope existing; hindari overengineering, dependency besar, endpoint di luar scope, atau dokumentasi duplikat.
- Implementasikan perubahan kode aman tanpa konfirmasi setiap file. **Minta persetujuan hanya** untuk schema/migration, operasi destruktif, atau keputusan yang belum dapat disimpulkan dari kode.
- Jangan menjalankan `prisma db push`, reset DB, reseed, atau pengiriman email massal.
- Output akhir singkat: daftar file, endpoint, tes, status DB, keputusan/batasan.
