---
name: prisma-schema-change
description: Safely change SIPKITA's Prisma/PostgreSQL schema and migration SQL. Use when adding, modifying, or reviewing models, fields, relations, constraints, indexes, or migrations; not for routine service logic or queries that do not change the database structure.
---

# SIPKITA — Prisma Schema Change

## Prinsip kerja

- Kerjakan **perubahan terkecil** yang menyelesaikan kebutuhan domain. Jangan membuat tabel/kolom baru apabila aturan cukup ditangani oleh konfigurasi yang ada atau validasi service.
- Jaga kompatibilitas data, relasi, dan kode SIPKITA. Pertahankan riwayat akademik; jangan menghapus atau menimpa data lama demi menyederhanakan skema.
- Pisahkan **analisis**, **edit `schema.prisma`**, **pembuatan draf migrasi**, dan **penerapan migrasi**. Lakukan hanya tahap yang diotorisasi pengguna.
- Utamakan ketepatan dan keamanan migrasi. Jika perubahan berpotensi merusak data atau keputusan bisnis belum jelas, berhenti pada analisis dan minta keputusan spesifik.

## Orientasi proyek

- Cari dan baca instruksi repo (`AGENTS.md`) serta dokumen yang berkaitan: `docs/database.md`, `docs/academic-lifecycle.md`, `docs/business-rules/`, dan hasil `domain-modeling` jika tersedia. Jangan mewajibkan pembacaan seluruh dokumentasi untuk perubahan kecil.
- Periksa skema **aktual** di `server/prisma/schema.prisma`, konfigurasi CLI `prisma.config.ts`, migrasi di `server/prisma/migrations/`, serta versi Prisma di `package.json`/lockfile. Jika berkas tidak ada, laporkan; jangan mengarang isinya.
- Konteks skema terakhir SIPKITA: **PostgreSQL + Prisma ORM 7**, model PascalCase, kolom `snake_case`, pemetaan tabel dengan `@@map`, `datasource` tanpa URL langsung, dan generator `prisma-client-js` untuk `@prisma/client`. **Verifikasi kembali terhadap repo** sebelum mengandalkan rincian ini.
- Skema memakai fitur `partialIndexes` untuk indeks unik bersyarat. Jangan menonaktifkan fitur, mengganti generator, mengubah `@@map`, atau mengganti pola ID tanpa alasan yang disetujui.
- Gunakan `rg` untuk menemukan semua penggunaan model/field di schema, kode Express, seeder, dan pengujian sebelum melakukan perubahan yang berpotensi breaking.

## Invariant domain dan database

Pertahankan aturan ini ketika model terkait berubah:

1. **KP → ISCP → TA:** `Pengajuan` menyimpan mahasiswa, periode, dan tahap; pengajuan pada tahap/semester berikutnya merupakan **record baru**. Jangan membuat constraint yang melarang beberapa mahasiswa menjalankan tahap berbeda pada periode sama.
2. **Dua jenis keterkaitan pengajuan:** `pengajuan_prasyarat_id` merujuk tahap sebelumnya; `pengajuan_sebelumnya_id` merujuk pengajuan historis dalam alur perpanjangan/pengulangan. Jangan menyatukan atau menghapus salah satunya.
3. **Topik versi:** `TopikPenelitian` dan `VersiTopik` menjaga jejak judul/objek. Jangan membuat perubahan yang menghilangkan versi terdahulu.
4. **Dokumen configurable:** `JenisDokumen` dan `PersyaratanPengajuan` mendukung syarat berbeda per periode, tahap, jenis pengajuan, serta pilihan topik. Jangan membuat satu kolom khusus untuk setiap nama dokumen tanpa justifikasi.
5. **Riwayat dokumen:** `DokumenDataDiri` dan `DokumenPengajuan` memakai versi serta partial unique index agar hanya satu berkas terkini untuk kombinasi terkait. Tinjau predikat `where`, `is_terkini`, dan nama indeksnya sebelum mengubah model.
6. **Penugasan:** satu pengajuan boleh memiliki beberapa reviewer; partial unique index `uq_pembimbing_aktif` membatasi satu pembimbing aktif per pengajuan. Pertahankan riwayat pergantian pembimbing.
7. **Review dan ACC:** `ReviewProposal`, `RiwayatReview`, `PenyelesaianTahap`, dan `RiwayatStatusPengajuan` adalah jejak keputusan. Jangan menggunakan cascade delete yang menghilangkan bukti akademik.
8. **Kebutuhan yang belum dimodelkan:** lampiran sertifikat/bukti lain untuk ACC penyelesaian belum boleh dianggap memiliki tabel khusus. Model seperti `PersyaratanPenyelesaianTahap` atau `DokumenPenyelesaianTahap` adalah **usulan**, baru dibuat setelah kebutuhan disetujui.

Jika skema aktual atau keputusan terbaru berbeda, utamakan bukti yang lebih baru dan jelaskan konflik sebelum mengubah struktur.

## Workflow

### 1. Tentukan kebutuhan dan batas tugas

- Rumuskan **masalah bisnis**, model yang terlibat, dan alasan kenapa perubahan database diperlukan.
- Periksa apakah solusi bisa memakai tabel/relasi yang sudah ada. Untuk pertanyaan alur bisnis yang belum disepakati, gunakan `domain-modeling` sebelum merancang DDL.
- Nyatakan dengan jelas cakupan pengguna: `analisis saja`, `edit schema`, `buat migration.sql`, atau `terapkan ke database development`. Jangan menganggap instruksi mengedit schema sebagai izin menjalankan migrasi.

### 2. Inspeksi kondisi awal

- Lihat perubahan yang sudah ada (`git status --short` jika tersedia), potongan schema terkait, migration history, konfigurasi Prisma, serta skrip npm package `server`.
- Cocokkan versi Prisma sebelum memilih syntax, terutama `partialIndexes` dan konfigurasi datasource Prisma 7.
- Jika DB perlu diakses, pastikan database **development** dan koneksinya benar; jangan mencetak `DATABASE_URL` atau kredensial ke output.
- Periksa bentuk serta jumlah data terdampak sebelum menambah `NOT NULL`, `@unique`, FK, atau mengubah tipe. Bila data tidak dapat diperiksa, laporkan ketidakpastian itu.

### 3. Rancang perubahan

Jelaskan diff **sebelum → sesudah** sebelum mengedit:

- Model/field yang ditambahkan, diubah, atau dihapus; nama SQL hasil `@map`/`@@map`.
- Tipe Prisma/PostgreSQL, nullable/default, relasi dua arah, `fields`/`references`, cardinality, serta `onDelete`.
- Unique, composite/partial index, pencarian yang perlu dioptimalkan, dan kemungkinan duplikasi data historis.
- Dampak terhadap Prisma Client, service, input validation, seed, dan data lama.

Gunakan strategi aman: **expand → backfill → enforce** untuk kolom wajib pada tabel berisi data. Perlakukan rename kolom/tabel sebagai rename yang mempertahankan data, bukan drop-and-add. Jangan mengubah field status `String` menjadi enum atau `onDelete: Restrict` menjadi cascade tanpa persetujuan dan analisis data.

### 4. Ubah schema dengan diff minimal

- Edit hanya entitas, atribut, dan relasi yang berhubungan langsung. Pertahankan bagian lain serta perubahan pengguna yang belum di-commit.
- Ikuti penamaan yang berlaku dan buat kedua sisi relasi Prisma secara konsisten.
- Jalankan validasi schema menggunakan perintah yang ada di workspace; periksa diff setelah pemformatan untuk menghindari perubahan seluruh file yang tidak relevan.
- Jika hanya diminta edit schema, **berhenti setelah validasi dan laporan**, tanpa membuat atau menerapkan migrasi.

### 5. Rancang dan periksa migration.sql (hanya jika diminta)

Contoh perintah dari paket `server/` pada **development**, setelah target dan histori migrasi diverifikasi:

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate dev --name nama_perubahan --create-only
```

`--create-only` **bukan operasi read-only murni**: Prisma tetap memeriksa histori/shadow database dan dapat menawarkan reset saat terdeteksi drift. Jangan menjalankannya tanpa izin atau menyetujui reset otomatis.

Sebelum menerapkan, baca seluruh SQL migrasi yang baru dibuat. Periksa:

- `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, konversi tipe, atau perubahan `NOT NULL` yang berisiko kehilangan data.
- FK dan `ON DELETE`, constraint unik, indeks parsial, dan pemetaan nama tabel/kolom.
- Rename yang digenerasikan sebagai drop+add; sesuaikan SQL migrasi **yang belum diterapkan** bila diperlukan untuk menjaga data.
- Backfill dan data existing yang dapat melanggar constraint baru.

Jangan mengedit migrasi yang sudah diterapkan. Jika SQL tidak aman, jelaskan risikonya dan revisi draf sebelum melanjutkan.

### 6. Terapkan dan verifikasi (hanya jika diminta)

- Sebelum `prisma migrate dev`, verifikasi ulang database development, hasil review SQL, dampak data, dan kebutuhan backup. **Jangan jalankan migrate dev di production.**
- Bila aplikasi migrasi disetujui, terapkan sesuai prosedur proyek; setelahnya jalankan `prisma generate` secara eksplisit agar Client sesuai schema (Prisma 7 tidak selalu memicu generate otomatis).
- Verifikasi status migrasi, kolom/relasi/indeks yang berubah, preservasi record lama, dan perilaku constraint penting. Jalankan pemeriksaan aplikasi terkait bila tersedia dan aman.
- Deployment ke staging/production memakai workflow terpisah (misalnya `prisma migrate deploy` melalui pipeline) dan memerlukan otorisasi lingkungan serta backup yang sesuai.

## Stop conditions

**Hentikan operasi dan laporkan sebelum melanjutkan** jika:

- Prisma meminta `migrate reset`, mendeteksi drift, atau migration history tidak sinkron.
- Target database tidak pasti, data historis belum aman, atau ada perubahan destruktif yang belum diotorisasi.
- User meminta mempertahankan tabel/relasi tetapi diff justru menghapus atau mengubahnya.
- Perubahan melanggar aturan pengajuan lintas tahap, versi dokumen, multi-reviewer, atau satu pembimbing aktif.

Jangan memakai `prisma migrate reset`, `prisma db push`, penghapusan migrasi, `DROP` manual, atau modifikasi `_prisma_migrations` sebagai jalan pintas. Jangan menciptakan data seed/backfill massal tanpa izin. Tawarkan opsi perbaikan dengan risiko dan dampak yang jelas.

## Hasil yang harus dilaporkan

1. **Kebutuhan:** alasan bisnis dan batas perubahan.
2. **Perubahan:** nama model, field, relasi, atau constraint serta ringkasan diff.
3. **Keamanan:** dampak pada data/riwayat, potensi data loss, dan kompatibilitas.
4. **Status migrasi:** `belum dibuat`, `draf dibuat`, `SQL ditinjau`, atau `diterapkan` — sebutkan hanya yang benar terjadi.
5. **Verifikasi:** perintah yang dijalankan, hasilnya, dan tindakan lanjut.

Setelah schema siap, serahkan implementasi service/API/UI ke `feature-implementation` dan verifikasi perilaku/regresi ke `code-change-verification`. Jangan memperluas tugas ke kode aplikasi tanpa diminta.
