# PRD — Persiapan Database dan Seeder Akun Dummy SIPKITA

**Status:** Siap digunakan sebagai instruksi awal untuk Codex; implementasi belum dijalankan  
**Proyek:** SIPKITA — Sistem Informasi Pengelolaan KP, ISCP, dan TA  
**Fase:** Fondasi backend autentikasi (sebelum implementasi endpoint dan frontend)  
**Teknologi:** Node.js, Express, Prisma ORM 7.x, PostgreSQL, monorepo npm workspaces (`server/`, `client/`)

## 1. Tujuan

Menyiapkan **data dummy yang tersimpan di PostgreSQL development** untuk pengujian login, logout, otorisasi berbasis role, multi-role dosen, serta pengembangan lupa/reset password pada tahap berikutnya.

Pekerjaan saat ini dibatasi pada:

1. Audit kesesuaian model dan relasi autentikasi pada schema Prisma yang **sudah ada**.
2. Verifikasi kondisi migrasi secara aman.
3. Pembuatan/penyesuaian seeder akun dummy dan seluruh relasi wajibnya.
4. Verifikasi integritas, kelengkapan, dan idempotensi seeder.

**Belum termasuk:** route/controller/service login, UI/frontend, pengiriman email, data pengajuan akademik, maupun perubahan aturan bisnis.

## 2. Kondisi Awal dan Batas Keselamatan

- Schema utama: `server/prisma/schema.prisma`. Jangan menggunakan/membuat `schema.prisma` di root sebagai sumber baru.
- Audit terakhir melaporkan **38 model/tabel bisnis**, satu migrasi awal `20261029174916_init_sipkita` yang telah diterapkan, dan 82 foreign key. Angka ini merupakan **hasil audit sebelumnya**, bukan hasil pemeriksaan ulang dalam PRD ini.
- Audit juga mencatat *representational diff* pada indeks unik parsial `uq_pembimbing_aktif` dan `uq_seminar_terjadwal` meskipun indeks tersedia di database.
- Worktree Git sebelumnya memiliki perubahan yang belum di-commit. Seluruh perubahan pengguna wajib dipertahankan.
- Tidak ada integrasi dengan SIKADU. Data mahasiswa/dosen pada fase ini disediakan melalui seed development; impor CSV atau data riil menyusul.

### Aturan wajib untuk Codex

1. **Baca lebih dahulu** `AGENTS.md`, `docs/database.md`, `docs/architecture.md`, `docs/roles-permissions.md`, `docs/coding-standards.md`, `docs/project-status.md`, dan model terkait pada `server/prisma/schema.prisma`. Ikuti `.agents/skills/prisma-schema-change/SKILL.md` dan `.agents/skills/code-change-verification/SKILL.md` jika tersedia.
2. **Jangan mengarang nama model/kolom/enum.** Daftar tabel pada bagian berikut adalah **pemetaan konseptual**, bukan klaim nama tabel aktual. Cocokkan dengan schema sebelum menulis kode.
3. **Jangan membuat ulang** tabel `User`, `Role`, `Mahasiswa`, `Dosen`, tabel penghubung, atau tabel Prodi jika padanannya sudah ada.
4. Mulai dengan pemeriksaan **read-only**. Jalankan validasi dan pemeriksaan status migrasi; jangan langsung menjalankan `migrate dev`, `db push`, atau `migrate reset`.
5. **Jika schema dan migration sudah mencukupi, tidak perlu migration baru.** Jika perubahan schema benar-benar diperlukan, tulis rencana perubahan dan dampaknya, lalu **berhenti meminta persetujuan pengguna** sebelum mengubah schema atau menjalankan migration.
6. Bila anomali dua indeks parsial masih muncul, **jangan mencoba 'memperbaiki' dengan menghapus/membuat ulang indeks secara otomatis**. Laporkan hasil diff dan dampaknya; minta persetujuan untuk tindakan migrasi.
7. Seed **hanya database development yang sudah dipastikan targetnya**, bukan staging/production. Periksa lingkungan dan koneksi tanpa mencetak kredensial atau isi `.env`.
8. Jangan menjalankan perintah destruktif (`migrate reset`, `db push --force-reset`, `TRUNCATE`, `DELETE` massal, `DROP`, `git reset --hard`, `git clean`).
9. Jangan mengubah file di luar kebutuhan seeder dan konfigurasi minimum yang terbukti diperlukan. Jangan memasang dependensi baru tanpa alasan dan persetujuan jika berdampak pada lockfile.
10. Laporkan perubahan dan hasil tes secara jujur; jangan menyatakan berhasil bila belum dijalankan atau diverifikasi.

## 3. Pemetaan Tabel yang Diperlukan

| Kelompok data (konseptual) | Data seed minimal | Alasan | Catatan schema |
| --- | --- | --- | --- |
| Program Studi / Prodi | 1 record: Sistem Informasi | Referensi FK mahasiswa/dosen/akun bila diwajibkan | Seed hanya jika tabel ada atau relasi mewajibkannya |
| Role | 6 kode role | Hak akses pengguna | Bila role adalah **enum**, jangan membuat tabel master role baru |
| User / Akun | 8 akun dummy aktif | Kredensial login dan status akun | Pakai kolom credential aktual: email/username sesuai schema |
| Relasi User–Role | 9 pasangan user–role | Mendukung dosen dengan dua role | Gunakan tabel penghubung **jika ada**; jangan memaksakan field role tunggal |
| Mahasiswa | 2 profil, masing-masing terhubung ke User | Identitas mahasiswa dan isolasi kepemilikan | Isi atribut wajib sesuai schema |
| Dosen | 4 profil, masing-masing terhubung ke User | Reviewer, pembimbing, dan Kaprodi | Kaprodi dalam fixture ini merupakan dosen keempat |

**Tidak disemai pada tugas ini:** pengajuan KP/ISCP/TA, persyaratan pengajuan, dokumen, penugasan reviewer, hasil review, pembimbingan, bimbingan, perpanjangan, seminar, notifikasi, ataupun riwayat akademik.

**Session / refresh token / password-reset token:** bila modelnya sudah tersedia, tabel tetap boleh kosong. Token dan sesi dibuat oleh mekanisme autentikasi pada saat runtime; **jangan membuat token reset dummy permanen melalui seeder**.

## 4. Fixture Akun Dummy yang Harus Tersedia

Seluruh identitas di bawah **fiktif**. Gunakan alamat dengan domain `.test` untuk menandai akun development; jangan menggunakan alamat pribadi atau email dosen/mahasiswa sungguhan.

| Kode fixture | Nama tampilan | Email login dummy | Role | Profil terkait |
| --- | --- | --- | --- | --- |
| `DEV_SYS_ADMIN` | Admin Sistem Demo | `dev.admin-sistem@sipkita.test` | `ADMIN_SISTEM` | Sesuai kebutuhan schema |
| `DEV_PRODI_ADMIN` | Admin Prodi Demo | `dev.admin-prodi@sipkita.test` | `ADMIN_PRODI` | Prodi Sistem Informasi bila diwajibkan |
| `DEV_KAPRODI` | Kaprodi Demo | `dev.kaprodi@sipkita.test` | `KAPRODI` | Dosen D / profil Kaprodi |
| `DEV_MHS_A` | Ahmad Demo | `dev.mahasiswa-a@sipkita.test` | `MAHASISWA` | Mahasiswa A |
| `DEV_MHS_B` | Budi Demo | `dev.mahasiswa-b@sipkita.test` | `MAHASISWA` | Mahasiswa B |
| `DEV_DOSEN_A` | Dosen Reviewer Demo | `dev.reviewer@sipkita.test` | `REVIEWER` | Dosen A |
| `DEV_DOSEN_B` | Dosen Pembimbing Demo | `dev.pembimbing@sipkita.test` | `PEMBIMBING` | Dosen B |
| `DEV_DOSEN_C` | Dosen Multi-Role Demo | `dev.dosen-multi@sipkita.test` | `REVIEWER`, `PEMBIMBING` | Dosen C |

### Kode role target

- `ADMIN_SISTEM`
- `ADMIN_PRODI`
- `KAPRODI`
- `MAHASISWA`
- `REVIEWER`
- `PEMBIMBING`

**Penting:** Kode di atas adalah **istilah bisnis target**, bukan jaminan literal enum Prisma. Jika nama enum/role berbeda, gunakan representasi existing yang setara, lalu tampilkan tabel pemetaan nama aktual dalam laporan. Jangan mengubah enum demi menyamakan ejaan tanpa izin.

### Profil mahasiswa dummy

| Fixture | NIM dummy | Nama | Program Studi |
| --- | --- | --- | --- |
| Mahasiswa A | `522001001` | Ahmad Demo | Sistem Informasi |
| Mahasiswa B | `522001002` | Budi Demo | Sistem Informasi |

### Profil dosen dummy

| Fixture | NIDN dummy | Nama | Peran pengujian |
| --- | --- | --- | --- |
| Dosen A | `0000000001` | Dosen Reviewer Demo | Reviewer |
| Dosen B | `0000000002` | Dosen Pembimbing Demo | Pembimbing |
| Dosen C | `0000000003` | Dosen Multi-Role Demo | Reviewer + Pembimbing |
| Dosen D | `0000000004` | Kaprodi Demo | Kaprodi |

NIM/NIDN di atas hanyalah fixture. Periksa constraint, panjang field, pola, dan keunikan aktual sebelum digunakan. Jika melanggar constraint schema, sesuaikan nilai fixture secara minimal dan **jelaskan penyesuaian** pada laporan.

### Master Prodi dummy

- Nama: `Sistem Informasi`
- Kode: gunakan kode Prodi yang konsisten dengan aturan existing, **jangan berasumsi** kode literal tertentu.
- Jika data Prodi Sistem Informasi sudah ada, **gunakan record tersebut**; jangan buat duplikat.

## 5. Kebijakan Password dan Identitas

1. Password dummy **tidak boleh disimpan sebagai plaintext** di database maupun source seeder; gunakan algoritma hashing password yang sesuai dengan standar keamanan proyek (pilihan baru yang direkomendasikan: Argon2id; periksa dependensi aktual).
2. Ambil password awal development dari **variabel lingkungan khusus development**, misalnya `SIPKITA_DEV_SEED_PASSWORD`; jangan menulis nilainya di repository, laporan, terminal output, atau test snapshot.
3. Jika variabel tersebut tidak tersedia, seeder **gagal dengan pesan aman** yang menyebut nama variabel, tanpa menghasilkan akun dengan password default lemah.
4. Sebelum hash, pastikan password memenuhi aturan panjang/kekuatan yang dipilih untuk autentikasi proyek.
5. Jangan mengubah hash/password akun lain. Untuk akun dummy yang sudah ada, jangan diam-diam mengganti password; perubahan kredensial fixture harus eksplisit dan terbatas pada akun ber-namespace development.
6. Email login dummy harus unik; bila username atau nomor induk digunakan oleh schema, tetapkan juga nilai unik yang dapat dipetakan ke fixture.
7. Seed hanya berjalan jika koneksi teridentifikasi sebagai **development** dan target database sesuai konfigurasi proyek; jangan mengandalkan nama file `.env` semata sebagai pengaman.

## 6. Alur Data Seed yang Diharapkan

1. **Preflight:** baca schema, relasi, enum, unique index, default value, dan daftar kolom wajib pada model yang berkaitan. Inventarisasi data eksisting hanya melalui query read-only.
2. **Konfirmasi target:** tampilkan nama database/host yang tidak sensitif dan indikator environment (tanpa URL berisi password). Hentikan jika identitas target meragukan.
3. **Validasi schema:** gunakan script Prisma yang tersedia; periksa status migrasi dan anomali partial index secara read-only.
4. **Pastikan Prodi:** gunakan record Sistem Informasi bila sudah ada; buat satu record hanya jika diperlukan.
5. **Pastikan Role:** buat/temukan 6 role jika role dimodelkan sebagai tabel; jika enum, gunakan enum existing.
6. **Pastikan User:** buat tepat 8 akun yang belum ada berdasarkan kunci unik fixture; gunakan hash password, tanpa mengubah akun non-fixture.
7. **Pastikan profil:** buat dua mahasiswa dan empat dosen, terhubung dengan akun yang benar dan Prodi bila relevan.
8. **Pastikan relasi role:** delapan akun memiliki role yang benar; Dosen C memiliki dua role dan **satu akun**, bukan dua akun.
9. **Verifikasi:** baca ulang hanya record fixture dan cek relasi, FK, dan duplikasi. Jalankan seed ulang untuk membuktikan idempotensi tanpa membuat record tambahan.

Gunakan transaksi Prisma untuk unit perubahan yang harus atomik, dengan mempertimbangkan constraint dan dependensi existing. Jangan menghapus relasi role pengguna yang tidak dikelola fixture.

## 7. Persyaratan Implementasi Seeder

- Ikuti struktur proyek, penamaan, dan script npm workspaces yang sudah ada. Periksa `package.json` dan `prisma.config.*` terlebih dahulu.
- Untuk Prisma 7, gunakan mekanisme `prisma db seed` yang dikonfigurasi di `prisma.config.*`; **jangan berasumsi migrasi menjalankan seed otomatis**.
- Pecah seeder hanya sejauh membantu keterbacaan (`roles`, `users`, `mahasiswa`, `dosen`) dan sediakan satu entry point. Hindari overengineering.
- Utamakan `upsert` / `connectOrCreate` **hanya bila aman bagi record existing**. Bila `update` berisiko mengubah data riil, gunakan pola *create-if-missing* dan verifikasi perbedaan tanpa overwrite.
- Hindari ID numerik hard-coded yang bisa bertabrakan. Gunakan nilai unik bisnis dan ID yang dikembalikan database.
- Pastikan tidak muncul password, token, connection string, atau data `.env` pada log.
- Seeder dapat dijalankan ulang secara sadar tanpa merusak data atau mengulang record.

## 8. Ketentuan Migration

| Hasil inspeksi | Tindakan Codex |
| --- | --- |
| Model, enum, dan relasi autentikasi sudah memadai | **Jangan membuat migration.** Lanjut hanya ke seeder setelah preflight aman. |
| Kolom/relasi wajib auth tidak tersedia | Susun usulan perubahan schema + dampak FK, indeks, seeder, API; **minta persetujuan dulu**. |
| Perbedaan partial index muncul lagi | Dokumentasikan perbandingan predicate SQL vs Prisma; jangan otomatis menjalankan migration yang churn indeks. |
| Migration status tidak sesuai / database bukan development | **STOP**. Tampilkan blocker dan langkah investigasi aman. |

**Dilarang** menjadikan `prisma db push` sebagai jalan pintas untuk drift indeks atau menghapus database development agar migrasi tampak bersih.

## 9. Kriteria Penerimaan (Acceptance Criteria)

- [ ] Schema dan relasi aktual untuk User, Role, UserRole/enum, Mahasiswa, Dosen, serta Prodi telah dipetakan dan dilaporkan.
- [ ] Preflight Prisma validasi/status migration tercatat; anomali partial index tidak diabaikan.
- [ ] Tidak ada migration baru jika schema tidak berubah.
- [ ] Seeder membuat/menggunakan tepat satu Prodi Sistem Informasi jika dibutuhkan.
- [ ] Keenam role bisnis terwakili sesuai enum/tabel aktual.
- [ ] Tepat delapan akun fixture aktif tersedia, unik, dan hanya di database development.
- [ ] Tepat dua profil mahasiswa dan empat dosen fixture terhubung ke akun yang sesuai.
- [ ] Sembilan relasi role fixture benar, termasuk satu akun Dosen C yang mempunyai dua role.
- [ ] Password fixture disimpan sebagai hash, tidak dicetak dan tidak hard-coded.
- [ ] Menjalankan seeder dua kali tidak menciptakan duplikasi atau mengubah record non-fixture.
- [ ] Tidak ada data pengajuan akademik atau token reset dummy yang ikut dibuat.
- [ ] Tidak ada reset database, drop table/index, mass delete, atau overwrite `.env`.
- [ ] Hasil verifikasi, file berubah, perintah yang dijalankan, serta kendala dijelaskan di laporan akhir.

## 10. Format Laporan Wajib dari Codex

Setelah pekerjaan selesai, berikan laporan ringkas dengan urutan:

1. **Pemetaan schema aktual:** model dan field yang digunakan; tabel konseptual ↔ model Prisma.
2. **Status migrasi:** validasi, riwayat migrasi, temuan diff indeks, keputusan perlu/tidaknya migrasi baru.
3. **Perubahan file:** path lengkap dan fungsi setiap perubahan.
4. **Ringkasan hasil seed:** jumlah Prodi, Role, User, User–Role, Mahasiswa, dan Dosen fixture (tanpa password).
5. **Verifikasi:** hasil run pertama, run kedua, dan pemeriksaan relasi/duplikasi.
6. **Blocker/keputusan yang memerlukan persetujuan:** sebutkan secara eksplisit; jangan menebak.

## 11. Instruksi Eksekusi untuk Codex (Bisa Disalin)

> Baca PRD `PRD-auth-database-seeder-sipkita.md` secara menyeluruh serta `AGENTS.md` dan dokumentasi yang dirujuk. Fokus hanya pada pemeriksaan migration dan implementasi seeder akun dummy untuk fondasi autentikasi backend SIPKITA. Mulai dengan audit read-only terhadap `server/prisma/schema.prisma`, konfigurasi Prisma, migration, dan data development yang relevan. Petakan tabel/model sebenarnya sebelum mengubah apa pun. Jika schema mencukupi, jangan membuat atau menjalankan migration baru. Jika perlu perubahan schema, target database tidak aman, atau partial-index drift berisiko, berhenti dan minta persetujuan. Setelah preflight aman, implementasikan seeder yang idempotent dan hanya menambahkan fixture yang ditentukan PRD tanpa menimpa data lain; jalankan verifikasi dua kali secara aman. Jangan membuat endpoint auth atau frontend pada tugas ini. Laporkan semua hasil sesuai format PRD.

