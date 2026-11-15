# PRD — Backend Penugasan Reviewer KP oleh Kaprodi (SIPKITA)

**Fase:** F | **Versi:** 1.0 — 5 November 2026\
**Status:** Rancangan implementasi backend, belum menjalankan coding atau migrasi\
**Scope:** Pengajuan **KP — REGULER — BARU**, peran **Kaprodi**, penugasan Dosen Reviewer

## 1. Tujuan

Membuat backend agar Kaprodi dapat menugaskan satu atau beberapa Reviewer pada satu Pengajuan KP, **serta menugaskan satu Reviewer ke banyak pengajuan sekaligus**. Penugasan juga dapat dipantau dan diganti tanpa menghapus riwayat. Semua operasi harus mendukung dua titik masuk UI kelak: **tindakan langsung di daftar/detail Pengajuan KP** dan **menu pengelolaan Penugasan Reviewer**. Jangan membuat dua engine/service hanya karena dua menu UI.

**Baseline menurut laporan Fase D–E:** endpoint Mahasiswa dan pemeriksaan/ACC Admin Prodi telah diimplementasikan dan diuji pada PostgreSQL TEST. Lima migrasi berada di `sipkita_dev`; master KP aktif sudah tersedia. Schema memiliki `Pengajuan`, `Dosen`, `UserRole`, `PenugasanDosen`, `ReviewProposal`, dan histori yang relevan. Implementasi Fase F **tidak mengulang audit, seed, atau modifikasi** modul yang sudah PASS.

## 2. Aturan bisnis yang final khusus KP

1. **Kaprodi** merupakan pihak yang memilih/menetapkan Reviewer. Mahasiswa hanya dapat melihat hasil penugasannya; **usulan Pembimbing** pada `Pengajuan` **bukan** penugasan Reviewer maupun Pembimbing.
2. Pengajuan harus sudah dikirim oleh mahasiswa: `status_pengajuan=DIAJUKAN` atau sudah `ACC` administratif. **DRAFT tidak dapat diberi Reviewer.** `TIDAK_ACC` terminal tidak menerima penugasan Reviewer baru. Penugasan lama tetap menjadi histori.
3. Penugasan dapat dilakukan **segera setelah submit**, paralel dengan pemeriksaan Berkas/Nilai oleh Admin Prodi. Tidak perlu menunggu kategori `OK_LENGKAP` atau ACC administratif.
4. Satu Pengajuan KP boleh mempunyai **beberapa Reviewer aktif** (minimal satu saat proses review benar-benar akan dikerjakan). Jumlah **tidak dipaksa tepat dua**. Satu dosen juga boleh menjadi Reviewer bagi banyak pengajuan.
5. Dosen kandidat harus aktif, mempunyai hak/role Reviewer, dan berada pada **lingkup Prodi yang benar**. Peran Reviewer adalah hak pada akun; **mode aktif sesi dosen tidak harus sedang Reviewer** ketika Kaprodi memilihnya.
6. Tidak boleh ada **dua penugasan Reviewer aktif untuk pasangan pengajuan–dosen yang sama**. Penugasan berulang yang identik diperlakukan idempotent, bukan membuat baris aktif baru.
7. Kaprodi boleh **menonaktifkan atau mengganti Reviewer** dengan alasan. Jangan menghapus record penugasan lama atau hasil review historis. Reviewer pengganti mendapat penugasan baru.
8. Penugasan menaut pada **Pengajuan**, bukan langsung mengunci satu versi proposal. Pada Fase G, setiap hasil review harus menunjuk **versi proposal yang benar-benar diperiksa**; revisi proposal tidak memindahkan hasil review lama ke versi baru.
9. Penugasan/review **tidak otomatis mengubah** Status Berkas, Nilai, atau `status_pengajuan`; hasil Reviewer `LAYAK/TIDAK_LAYAK` bukan gate otomatis **ACC administratif KP**. Kaprodi menetapkan Pembimbing final pada fase terpisah setelah ACC Admin Prodi.
10. Aturan ini **tidak mengubah** ISCP/TA, perpanjangan, keputusan Admin Prodi, atau penyelesaian akademik.

## 3. Pengalaman UI yang wajib didukung oleh API

| Titik masuk UI kelak         | Aksi Kaprodi                                                                               | Dukungan backend                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Daftar Pengajuan KP**      | Filter pengajuan belum punya Reviewer, mencari nama/NIM/judul, memilih checkbox satu/lebih | List terfilter + jumlah Reviewer aktif + pagination/sort; endpoint bulk |
| **Detail satu Pengajuan KP** | Baca judul/studi kasus, lihat PDF terbaru, pilih **satu atau beberapa Reviewer**           | Detail + file privat + daftar kandidat + endpoint assign individual     |
| **Shortcut dari daftar**     | Centang beberapa proposal → pilih satu dosen → **Tugaskan Reviewer**                       | Bulk: **banyak Pengajuan → satu Dosen** dalam satu transaksi            |
| **Menu Penugasan Reviewer**  | Pantau siapa mereview proposal mana, filter dosen/status/periode, nonaktifkan/ganti        | Daftar penugasan terfilter + endpoint perubahan status/penggantian      |

UI boleh memiliki menu Penugasan Reviewer terpisah untuk pengelolaan, **tetapi penugasan dari daftar/detail Pengajuan tetap tersedia**. Backend tidak boleh memaksa Kaprodi membuka tiap detail hanya untuk tugas massal. Beban tugas kandidat (`jumlah_penugasan_reviewer_aktif`) ditampilkan sebagai **informasi**, bukan dasar auto-assign.

## 4. Data dan relasi yang digunakan

Gunakan `Pengajuan` → `Mahasiswa`/Prodi/Topik; `Dosen` → `User`/role/Prodi; `PenugasanDosen` dengan jenis `REVIEWER`, status penugasan aktif/nonaktif, aktor Kaprodi dan waktu; metadata dokumen proposal versi terkini dari `DokumenPengajuan`/`Dokumen`; serta histori/audit existing jika relevan.

- Ikuti **nama field, relasi, unique key, dan kode status aktual** `server/prisma/schema.prisma`/seed; contoh di PRD bukan izin menambah atribut atau enum.
- Ambil `pengajuan_id`, `dosen_id`, dan `penugasan_id` dari record nyata; **jangan** samakan `User.id` dengan `Dosen.id` atau memakai ID seed hardcoded.
- Ubah penugasan lama menjadi status nonaktif sesuai konstanta yang sudah dipakai; **jangan menghapus** untuk mengganti dosen. Simpan siapa yang menetapkan/mengakhiri dan waktu bila struktur/audit existing memungkinkan. Jika histori penonaktifan tidak bisa direpresentasikan, laporkan gap minimal sebelum menambah schema.
- Jangan memodifikasi `ReviewProposal` atau `RiwayatReview` dalam Fase F. Nilai/hasil review menjadi tanggung jawab Fase G.

## 5. Endpoint REST API (kontrak usulan)

Selaraskan prefix dan response envelope dengan route aktual proyek. Gunakan **satu service inti penugasan** untuk endpoint individual, bulk, dan penggantian; hindari logika duplikat antar-controller.

| Method     | Endpoint                                             | Fungsi / kontrak minimum                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`      | `/api/kaprodi/pengajuan`                             | Daftar KP scope Prodi, filter `periode`, `status_pengajuan`, `status_penugasan_reviewer` (`BELUM_ADA`/`SUDAH_ADA`), `q`, `page`, `limit`, `sort`. Kembalikan `jumlah_reviewer_aktif` untuk checkbox dan badge. |
| `GET`      | `/api/kaprodi/pengajuan/:id`                         | Detail pengajuan, judul/tema/objek, status Admin, usulan Pembimbing **sekadar informasi**, versi proposal terkini, Reviewer aktif dan histori ringkas.                                                         |
| `GET`      | `/api/kaprodi/pengajuan/:id/dokumen/:dokumenId/file` | Preview/unduh dokumen privat yang benar-benar terkait pengajuan; otorisasi Kaprodi + Prodi. Utamakan proposal terbaru.                                                                                         |
| `GET`      | `/api/kaprodi/kandidat-reviewer`                     | Pencarian dosen Reviewer aktif sesuai Prodi dengan `q`/pagination; nama dan jumlah tugas Reviewer aktif; beri petunjuk sudah ditugaskan pada pengajuan yang relevan bila diminta.                              |
| `GET`      | `/api/kaprodi/pengajuan/:id/reviewer`                | Reviewer aktif dan riwayat penugasan pada satu pengajuan.                                                                                                                                                      |
| `GET`      | `/api/kaprodi/penugasan-reviewer`                    | Daftar untuk menu pengelolaan: filter Reviewer, periode, status, nama/NIM, pagination.                                                                                                                         |
| `POST`     | `/api/kaprodi/pengajuan/:id/reviewer`                | Menugaskan **satu/lebih dosen** ke **satu pengajuan** dalam satu tindakan.                                                                                                                                     |
| **`POST`** | **`/api/kaprodi/penugasan-reviewer/bulk`**           | **Shortcut:** menugaskan **satu dosen ke beberapa pengajuan terpilih** secara atomik.                                                                                                                          |
| `PATCH`    | `/api/kaprodi/penugasan-reviewer/:id`                | Menonaktifkan penugasan dengan alasan; status nonaktif yang valid dari schema/konstanta.                                                                                                                       |
| `POST`     | `/api/kaprodi/penugasan-reviewer/:id/ganti`          | Ganti Reviewer **secara atomik**: nonaktifkan lama, validasi dan tugaskan dosen pengganti, simpan alasan/histori.                                                                                              |

**Contoh payload — hanya ilustrasi (ID bukan data aktual):**

```http
POST /api/kaprodi/pengajuan/101/reviewer
```

```json
{ "dosen_ids": [17, 18] }
```

```http
POST /api/kaprodi/penugasan-reviewer/bulk
```

```json
{ "pengajuan_ids": [101, 102, 103], "dosen_id": 17 }
```

```http
POST /api/kaprodi/penugasan-reviewer/501/ganti
```

```json
{ "dosen_id_baru": 19, "alasan": "Reviewer sebelumnya berhalangan" }
```

**Respons batch minimum:** jumlah `created`, `already_assigned`, dan daftar ID yang sukses; jika validasi gagal, respons memuat **ID pengajuan yang bermasalah beserta alasannya**, tanpa membocorkan data mahasiswa di luar Prodi. Jangan mengembalikan nomor ID seed sebagai fakta tetap.

## 6. Aturan penugasan individual, bulk, dan penggantian

### Individual: satu Pengajuan → satu/beberapa Reviewer

1. Kaprodi membuka detail, memeriksa proposal jika diperlukan, memilih `dosen_ids` unik.
2. Server memeriksa seluruh kandidat, scope Prodi, status akun/dosen, hak Reviewer, status pengajuan bukan `DRAFT/TIDAK_ACC`, serta pasangan aktif yang sudah ada.
3. Buat hanya pasangan yang belum aktif; pasangan aktif identik dihitung `already_assigned` (no-op) tanpa histori ganda. Pencatatan di satu transaksi.

### Bulk: beberapa Pengajuan → satu Reviewer

1. Kaprodi mencentang proposal yang terlihat pada daftar, lalu memilih satu dosen. **Frontend mengirim daftar ID eksplisit**, bukan hanya filter UI atau kata “pilih semua” yang diproses samar oleh server.
2. Server mengecek ulang **setiap** ID Pengajuan (Prodi, tahap KP, jenis/jalur, status, validitas) dan satu dosen kandidat. Gunakan batas ukuran batch wajar mengikuti pola API proyek; hindari transaksi ribuan record tanpa batas.
3. **All-or-nothing:** jika satu pengajuan tidak sah, **tidak ada satu penugasan baru pun disimpan**. Kembalikan rincian error per pengajuan untuk memungkinkan UI memperbaiki seleksi. Pengajuan yang sudah memiliki pasangan aktif identik adalah **no-op yang valid**, bukan error.
4. Jika semua valid, transaksi membuat pasangan baru, mencatat aktor/waktu, dan mengembalikan total `created` serta `already_assigned`. Pengulangan request yang sama menghasilkan `created=0` tanpa rekaman duplikat.

### Nonaktivasi dan penggantian

- Nonaktivasi memerlukan alasan serta hak Kaprodi, mengganti status penugasan, dan mempertahankan histori/review yang sudah terjadi. Jangan `DELETE` fisik.
- Penggantian merupakan **satu tindakan atomik**, sehingga tidak ada kondisi setengah jadi: lama nonaktif tetapi Reviewer baru gagal. Reviewer baru tidak boleh identik dengan Reviewer aktif yang sudah ada pada pengajuan itu.
- Reviewer pengganti tetap berwenang hanya setelah penugasan baru aktif; reviewer lama kehilangan akses ke tugas aktif yang dicabut, tetapi histori review lama tetap disimpan.
- Jika Pengajuan sudah `TIDAK_ACC`, tidak boleh menambah/mengganti Reviewer baru. Data historis boleh dibaca oleh pihak berwenang.

## 7. Otorisasi, keamanan, dan konsistensi

- **Wajib** autentikasi dan **role aktif Kaprodi** pada seluruh endpoint. Kaprodi hanya boleh melihat dan menugaskan pengajuan/dosen dalam lingkup Prodi sesuai mekanisme scope aktual; jangan mempercayai `prodi_id`, `ditetapkan_oleh_user_id`, `status_penugasan`, atau timestamp dari body.
- Jika hubungan Kaprodi–Prodi tidak tersedia secara aman untuk multi-Prodi, ikuti kebijakan single-Prodi existing; tolak scope tidak jelas daripada membuka seluruh mahasiswa/dosen.
- Untuk akses PDF, reuse storage privat/validasi ownership dari D2/E, tetapi cek hak Kaprodi dan keterkaitan dokumen–pengajuan. Jangan membocorkan file URL atau storage key.
- Penugasan individual, bulk, dan penggantian memakai transaksi yang aman untuk request bersamaan (contoh `Serializable` + retry bounded atau lock yang sudah sesuai pola repo). **Dua Kaprodi paralel tidak boleh membuat dua pasangan Reviewer aktif identik**. Gunakan validasi + mekanisme DB/concurrency yang tersedia, jangan memasang unique index baru tanpa persetujuan.
- Endpoint list harus mendukung filter/sort/pagination stabil, jumlah Reviewer aktif dan beban tugas aktif hasil hitung. Jangan melakukan perhitungan/fitur auto-distribusi dosen sebagai bagian Fase F.
- Jangan menafsirkan ACC administratif sebagai syarat penugasan Reviewer. Status Berkas/Nilai `BELUM_OK` tidak menghapus penugasan; pergantian versi proposal tidak menghapus Reviewer aktif. Catatan hasil review tetap terikat versi pada fase berikutnya.
- Tidak ada operasi write ke `sipkita_dev` untuk pengujian. Gunakan PostgreSQL **TEST terisolasi** dengan fixture sendiri, atau pengujian unit terarah; jangan menjalankan seed/migration berulang di development.

## 8. Tahapan coding hemat token

1. **Persiapan singkat:** baca `AGENTS.md`, `PenugasanDosen` dan model terkait pada `server/prisma/schema.prisma`, route/controller/service D2 & E, auth/role/scope Kaprodi, util file privat dan tes yang sudah ada. Jangan scan seluruh repo/audit ulang Fase A–E.
2. **Skill yang benar-benar relevan**, jika tersedia di repo: `.agents/skills/feature-implementation/SKILL.md` (implementasi) dan `.agents/skills/code-change-verification/SKILL.md` (tes). Gunakan `prisma-schema-change` **hanya jika gap schema terbukti**, dan berhenti sebelum migrasi tanpa izin. Sumber aturan bisnis: **PRD ini**, bukan ketentuan lama yang menempatkan Kaprodi sebagai pemberi ACC administratif KP.
3. Implementasikan bertahap: (a) daftar/detail/kandidat/file; (b) penugasan individual; (c) bulk; (d) daftar manajemen serta nonaktif/ganti. **Reuse satu fungsi service inti** untuk validasi kandidat, status, scope, transaksi dan hasil.
4. Jalankan tes terarah dan regresi D2/E, `prisma validate`, lint/syntax sesuai script, serta `git diff --check`. Perbaiki langsung bug teknis kecil dalam scope, tanpa audit/laporan berulang.
5. Laporan akhir **ringkas:** endpoint selesai, file berubah, hasil tes nyata, database yang disentuh/tidak, blocker tersisa. Jangan mengklaim kebutuhan Fase G/H sudah dibangun.

## 9. Acceptance criteria dan skenario test

| Skenario                                                      | Hasil diharapkan                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Kaprodi membuka daftar dan detail                             | Hanya KP sesuai Prodi; badge jumlah Reviewer aktif dan pencarian/filter bekerja                                    |
| Mahasiswa/Admin Prodi/Reviewer membuka endpoint Kaprodi       | Ditolak meski mengetahui ID pengajuan                                                                              |
| Kaprodi mencoba lintas Prodi                                  | Ditolak pada list, detail, file, dan mutasi                                                                        |
| Dosen nonaktif/tidak punya hak Reviewer/beda Prodi            | Tidak dapat ditugaskan                                                                                             |
| Pengajuan `DRAFT` / final `TIDAK_ACC`                         | Tidak menerima Reviewer baru                                                                                       |
| Pengajuan `DIAJUKAN`, Berkas/Nilai belum diperiksa/`BELUM_OK` | Tetap boleh ditugaskan Reviewer                                                                                    |
| Satu pengajuan + dua dosen                                    | Menghasilkan dua penugasan Reviewer aktif berbeda                                                                  |
| Beberapa pengajuan + satu dosen (bulk)                        | Penugasan berhasil serentak; status Admin tidak berubah                                                            |
| Bulk berisi pengajuan salah Prodi/tidak sah                   | Seluruh batch rollback; kesalahan per ID terlihat                                                                  |
| Bulk dengan sebagian pasangan sudah aktif                     | Hanya pasangan baru dibuat; retry menghasilkan `created=0`                                                         |
| Dua request paralel menugaskan pasangan sama                  | Tidak ada dua penugasan aktif identik                                                                              |
| Nonaktivasi/ganti Reviewer                                    | Record lama dan review historis utuh; pengganti aktif; alasan/audit terjaga                                        |
| Proposal diubah menjadi versi baru                            | Penugasan tetap ada; hasil review lama tidak dipindahkan ke versi baru                                             |
| Reviewer baru belum ditugaskan                                | Tidak mendapatkan akses ke proposal hanya karena role Reviewer; akses detail Reviewer akan diuji penuh pada Fase G |
| Regresi D2/E                                                  | Submit Pengajuan, Berkas/Nilai, ACC Semua, dan revisi mahasiswa tetap berjalan                                     |

**Definition of Done:** Kaprodi dapat mengelola Reviewer dari detail, dari checkbox daftar, dan dari menu penugasan; dua UI tersebut berbagi backend aman, dengan histori serta uji idempotensi/concurrency. **Fase G (hasil Review Proposal) dan Fase H (Pembimbing final) tetap di luar scope**.
