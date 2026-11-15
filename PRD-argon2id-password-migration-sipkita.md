# PRD Migrasi Hash Password Dummy ke Argon2id SIPKITA

**Status:** Selesai dieksekusi dan diverifikasi pada database development lokal (2026-11-01)\
**Tahap:** Finalisasi keamanan password pada backend sebelum implementasi login\
**Teknologi:** Node.js, Express, Prisma ORM 7.x, PostgreSQL, npm workspaces\
**Lingkungan target:** Database development SIPKITA saja

## 1. Tujuan dan Keputusan

SIPKITA akan menggunakan **Argon2id** untuk hashing dan verifikasi password akun baru. Delapan akun dummy yang sudah terlanjur menggunakan `scrypt` akan diberi **hash Argon2id baru** berdasarkan password development yang diketahui, tanpa membuat ulang akun atau mengubah relasi data.

Target implementasi:

1. Menggunakan satu mekanisme hashing dan verifikasi Argon2id yang dapat dipakai kembali oleh seeder dan service autentikasi di fase berikutnya.
2. Memperbarui **hanya** kolom `password_hash` pada tepat delapan akun fixture development yang diidentifikasi secara eksplisit.
3. Mempertahankan seluruh record, primary key, foreign key, role, dan profil pengguna.
4. Membuat proses *rehash* yang aman, dapat diuji, bersifat *dry-run* secara default, dan tidak mengubah data bila dijalankan ulang dengan konfigurasi yang sama.

**Tidak termasuk dalam PRD ini:** endpoint login/logout, sesi/JWT, lupa password, frontend, Cloudflare Turnstile, seeding ulang seluruh database, atau perubahan schema akademik.

## 2. Kondisi Awal yang Harus Diverifikasi Ulang

Berdasarkan laporan Codex setelah seeding, kondisi yang diharapkan adalah:

| Objek                           | Kondisi dilaporkan                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `User` / tabel `users`          | 8 akun dummy aktif                                                                           |
| `Role` / tabel `roles`          | 6 role                                                                                       |
| `UserRole` / tabel `user_roles` | 9 relasi, termasuk satu dosen dengan dua role                                                |
| `Mahasiswa`                     | 2 profil                                                                                     |
| `Dosen`                         | 4 profil, termasuk Kaprodi                                                                   |
| `ProgramStudi`                  | 1 record Sistem Informasi                                                                    |
| `User.password_hash`            | Prefix `$scrypt$ln=14,r=8,p=1$...`                                                           |
| Migration                       | `20261029174916_init_sipkita` diterapkan; tidak ada perubahan schema untuk tugas ini         |
| Anomali terdahulu               | Diff representasi indeks `uq_pembimbing_aktif` dan `uq_seminar_terjadwal` belum diselesaikan |

Angka-angka tersebut adalah **hasil laporan terdahulu**, bukan izin mengasumsikan bahwa database saat ini masih identik. Codex wajib membuktikannya kembali secara read-only sebelum menulis data.

### Sumber dan pedoman proyek

Baca sebelum bekerja:

- `AGENTS.md`
- `server/prisma/schema.prisma`
- `server/prisma.config.ts`
- `server/prisma/seed.js`
- `server/prisma/seed/config.js`
- `server/prisma/seed/hash.js`
- `server/prisma/seed/users.js`
- `server/prisma/seed/profiles.js`
- `server/package.json` dan `package.json`
- `docs/database.md`, `docs/architecture.md`, `docs/coding-standards.md`, `docs/project-status.md`
- `.agents/skills/prisma-schema-change/SKILL.md` dan `.agents/skills/code-change-verification/SKILL.md` jika tersedia

Jangan mengganti struktur proyek atau nama model karena contoh PRD. Struktur aktual di repository adalah sumber kebenaran teknis.

## 3. Cakupan Data yang Boleh Diperbarui

Target yang diizinkan adalah **tepat delapan fixture** berikut. Gunakan pasangan email dan `login_id` sebagai identitas untuk verifikasi target; ambil primary key sebenarnya dari database.

| Fixture            | `login_id` yang dilaporkan | Email                           |
| ------------------ | -------------------------- | ------------------------------- |
| Admin Sistem       | `admin.sistem`             | `dev.admin-sistem@sipkita.test` |
| Admin Prodi        | `admin.prodi`              | `dev.admin-prodi@sipkita.test`  |
| Kaprodi            | `0000000004`               | `dev.kaprodi@sipkita.test`      |
| Mahasiswa A        | `522001001`                | `dev.mahasiswa-a@sipkita.test`  |
| Mahasiswa B        | `522001002`                | `dev.mahasiswa-b@sipkita.test`  |
| Dosen Reviewer A   | `0000000001`               | `dev.reviewer@sipkita.test`     |
| Dosen Pembimbing B | `0000000002`               | `dev.pembimbing@sipkita.test`   |
| Dosen Multi-role C | `0000000003`               | `dev.dosen-multi@sipkita.test`  |

**Larangan:**

- Jangan menggunakan query `UPDATE users SET password_hash = ...` tanpa `WHERE` yang membatasi tepat fixture ini.
- Jangan memilih seluruh akun hanya berdasarkan suffix domain `.test` atau status `AKTIF`.
- Jangan memperbarui user riil, akun tak dikenal, `UserRole`, `Mahasiswa`, `Dosen`, Prodi, atau data akademik.
- Jangan mengubah `login_id`, email, nama, status akun, primary key, atau foreign key.
- Jangan melakukan `delete`, `truncate`, `drop`, `migrate reset`, atau `db push --force-reset`.

Jika ada **kurang/lebih dari delapan pasangan yang cocok**, atau satu email terhubung dengan `login_id` yang tidak diharapkan, **STOP dan laporkan**. Jangan mengoreksi identitas secara otomatis.

## 4. Standar Argon2id

Gunakan library hashing yang dipelihara dan cocok dengan versi Node proyek. Untuk implementasi Node.js, kandidat utama adalah paket `argon2` (`node-argon2`). Periksa kebutuhan versi Node dan kompatibilitas modul ESM/CommonJS **sebelum instalasi**.

Parameter target minimum:

```js
{
  type: argon2.argon2id,
  memoryCost: 19456, // KiB (19 MiB)
  timeCost: 2,
  parallelism: 1
}
```

- Hash disimpan dalam format PHC bawaan library, misalnya diawali `$argon2id$`.
- Selalu gunakan salt acak yang dihasilkan library; jangan membuat salt tetap atau menggunakan hash yang sama untuk setiap akun.
- Proses hashing/verifikasi harus asinkron; gunakan `argon2.hash()` dan `argon2.verify()` dari library.
- Parameter dan waktu hashing perlu diuji pada lingkungan development; jangan memperbesar biaya tanpa mempertimbangkan kapasitas server.
- Jangan membuat fungsi kriptografi kustom atau implementasi Argon2id sendiri.
- Gunakan fungsi hash/verify yang sama pada seeder dan komponen autentikasi mendatang; tempatkan di modul bersama sesuai arsitektur proyek, tanpa menambah banyak lapisan yang belum diperlukan.

Rujukan teknis untuk Codex:

- OWASP Password Storage Cheat Sheet: [https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- `node-argon2`: [https://github.com/ranisalt/node-argon2](https://github.com/ranisalt/node-argon2)

## 5. Aturan Password Development dan Migrasi

1. Gunakan password dummy hanya dari variabel lingkungan development yang sudah digunakan proyek, yaitu `SIPKITA_DEV_SEED_PASSWORD`. **Jangan membaca atau menampilkan nilai secret** dalam laporan atau output.
2. Jangan membuat password default yang di-hard-code dalam source atau PRD. Jangan memasukkan password ke Git.
3. **Hash scrypt tidak dapat dikonversi langsung menjadi Argon2id.** Hash baru harus dihitung dari password plaintext yang diketahui.
4. Bila password development lama diketahui, **verifikasi dulu** bahwa nilai environment tersebut cocok dengan hash scrypt seluruh delapan fixture sebelum pembaruan. Jika satu akun tidak cocok, jangan ubah satu pun akun; laporkan blocker.
5. Bila password lama **tidak diketahui**, ajukan pilihan reset password dummy ke nilai development baru dan **minta persetujuan pengguna** sebelum penggantian. Jangan melakukan reset diam-diam.
6. Jangan mencetak password plaintext, nilai hash lengkap, URL koneksi, atau isi `.env` ke log.
7. Pertahankan pembatasan target `localhost`/`127.0.0.1`, namespace database development/test, dan `NODE_ENV=development`. Gunakan guard yang sudah ada, tingkatkan bila perlu.
8. Seeder normal harus **menghasilkan Argon2id untuk akun dummy yang baru dibuat**; jangan mengubah perilaku *create-if-missing* menjadi overwrite semua akun existing.

## 6. Dua Fase Eksekusi yang Dipisah

### Fase A — Inspeksi dan Persiapan (read-only terhadap database)

1. Catat `git status --short` dan file terkait yang sudah berubah. Pertahankan perubahan pengguna.
2. Baca model `User`, panjang/tipe kolom `password_hash`, constraint, dan seluruh relasi terkait.
3. Periksa versi Node dan paket yang cocok; jangan memaksakan upgrade Node atau dependensi lain.
4. Validasi schema dan `prisma migrate status` tanpa memodifikasi DB.
5. Lakukan query selektif untuk **identitas dan metadata algoritma hash** delapan fixture saja (bukan hash lengkap/password).
6. Pastikan tidak ada nama akun, identitas, atau relasi yang bertentangan dengan daftar target.
7. Susun rencana daftar file yang akan berubah, rencana update 8 record, dan bukti bahwa **tidak ada migration** yang dibutuhkan.

Jika syarat belum terpenuhi, **berhenti**. Jangan lanjut dengan asumsi.

### Fase B — Implementasi kode dan pembaruan terkontrol

1. Tambahkan dependensi `argon2` ke **workspace server saja**, bila kompatibel dan telah diizinkan dalam tugas ini. Perbarui lockfile secara normal; jangan mengubah dependensi lain yang tidak relevan.
2. Sediakan modul password `hashPassword` dan `verifyPassword` berbasis Argon2id dengan penanganan error yang aman.
3. Sesuaikan seeder akun dummy **baru** agar memakai Argon2id; jangan overwrite hash existing dari `prisma db seed` biasa.
4. Buat mekanisme khusus, bernama jelas (misal `rehash-dev-passwords`), yang berjalan **dry-run secara default**. Penulisan delapan hash hanya boleh terjadi dengan opsi eksplisit seperti `--apply` setelah daftar target tervalidasi dan pengguna menyetujui penerapannya.
5. Verifikasi password lama scrypt terhadap variabel environment sebelum penggantian jika password lama diketahui.
6. Lakukan update terkontrol untuk delapan fixture saja. Gunakan transaksi jika sesuai agar tidak ada kondisi *sebagian sukses* ketika satu pembaruan gagal.
7. Setelah pembaruan, verifikasi password developer terhadap semua hash Argon2id, dan pastikan password salah ditolak.
8. Jalankan ulang operasi dan pastikan **no-op** jika seluruh akun sudah Argon2id dan password cocok. Jangan menghasilkan salt/hash baru saat pengulangan yang tidak diperlukan.
9. Pastikan record, role, relasi, dan data non-fixture tidak berubah.

**Catatan kompatibilitas:** Jika ternyata ada akun non-fixture/riil dengan hash scrypt, **jangan menghapus dukungan verifikasi legacy** atau memutus aksesnya. Buat rencana migrasi bertahap yang harus disetujui sebelum mengubah alur login.

## 7. Stop Conditions

Codex wajib berhenti dan bertanya jika:

- Target bukan database development lokal yang terverifikasi.
- Delapan pasangan `login_id` dan email tidak cocok dengan fixture yang dilaporkan.
- Password development lama tidak dapat diverifikasi dan belum ada persetujuan reset.
- `password_hash` tidak cukup panjang untuk menampung PHC Argon2id.
- Library Argon2id yang tersedia tidak kompatibel dengan runtime Node proyek.
- Dibutuhkan perubahan schema/migration atau tindakan pada indeks parsial.
- Perubahan pada file pengguna yang belum di-commit berpotensi tertimpa.
- Query atau operasi menyentuh akun yang tidak termasuk daftar delapan fixture.
- Salah satu pengujian kredensial atau integritas gagal.

**Tidak boleh menggunakan** `prisma migrate dev`, `prisma db push`, `migrate reset`, `TRUNCATE`, `DELETE` massal, `DROP`, atau `git reset --hard` dalam tugas ini.

## 8. Verifikasi dan Acceptance Criteria

- [x] Schema valid dan migration status tetap sama; tidak ada migration baru.
- [x] Tepat delapan fixture dicocokkan berdasarkan `login_id` + email.
- [x] Jumlah dan hubungan `User`, `Role`, `UserRole`, `Mahasiswa`, `Dosen`, dan `ProgramStudi` tidak berubah.
- [x] Password hash kedelapan akun memakai format `$argon2id$` dengan parameter yang disepakati.
- [x] Password dummy yang benar terverifikasi untuk seluruh akun.
- [x] Password yang salah ditolak untuk seluruh akun.
- [x] Dua akun dengan password plaintext sama menghasilkan hash berbeda karena salt acak.
- [x] `prisma db seed` normal tetap idempotent dan tidak mengubah password existing.
- [x] Menjalankan prosedur rehash ulang tidak memodifikasi akun yang sudah cocok.
- [x] Tidak ada akun non-fixture yang berubah.
- [x] Tidak ada password plaintext, hash lengkap, atau secret terpapar di log, laporan, dan source.
- [x] Uji otomatis fungsi hash/verify ditambahkan atau dijalankan dengan mekanisme test minimal yang sesuai repo.
- [x] Tidak ada endpoint auth atau frontend yang dibuat pada tugas ini.

## 9. Laporan Akhir Codex

Tampilkan secara ringkas:

1. **Preflight:** status schema/migration, versi Node, dan hasil pencocokan fixture.
2. **Keputusan implementasi:** library, parameter Argon2id, dan kompatibilitas kolom.
3. **File berubah:** path dan alasan; identifikasi dependency/lockfile yang ditambahkan.
4. **Pembaharuan data:** jumlah akun target, jumlah yang benar-benar diubah, dan kondisi setelah pembaruan (tanpa nilai password/hash).
5. **Pengujian:** hasil hash/verify, password salah, idempotensi, integritas relasi.
6. **Keamanan:** guard lingkungan, hasil pemeriksaan secret/log, dan dampak pada akun non-fixture.
7. **Blocker:** jika ada, jelaskan titik berhenti dan persetujuan yang diperlukan.

Jangan menulis status `IMPLEMENTED-VERIFIED` bila belum ada pengujian dan query verifikasi aktual.
