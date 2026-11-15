# PRD — Fase H: Backend Finalisasi Pengajuan KP dan Penetapan Pembimbing | SIPKITA

**Versi:** 1.0 — 5 November 2026\
**Keputusan bisnis:** FINAL untuk Fase H berdasarkan pembahasan pengguna\
**Target:** Backend Express/Prisma, **KP — REGULER — BARU**. Dokumen ini tidak memerintahkan perubahan frontend atau database utama.

## 1. Tujuan dan keputusan yang dikunci

Menyediakan endpoint bagi **Kaprodi** untuk memantau kesiapan Pengajuan KP, melihat hasil pemeriksaan Admin Prodi dan Review Proposal, memilih kandidat Pembimbing, menetapkan Pembimbing secara individual atau massal, melihat daftar penugasan, serta **mengganti Pembimbing selama proses bimbingan belum dimulai**. Endpoint harus mendukung UI tabel, filter, checkbox, dan tindakan cepat tanpa mengendurkan validasi server.

**Kontrak bisnis Fase H — mengesampingkan dokumen lama yang bertentangan:**

1. **Opsi A final:** `ACC`/`TIDAK_ACC` administratif merupakan kewenangan **Admin Prodi** (Fase E). **Tidak ada ACC kedua oleh Kaprodi.** Setelah persyaratan terpenuhi, Kaprodi menuntaskan proses dengan **menetapkan Dosen Pembimbing**.
2. Pemeriksaan Admin Prodi (Berkas/Nilai/keputusan administratif) dan penilaian Reviewer adalah proses **berbeda dan paralel**. Hasil `LAYAK` bukan ACC administratif; `TIDAK_LAYAK` bukan `TIDAK_ACC` administratif.
3. Satu Pengajuan KP boleh mempunyai banyak Reviewer aktif, tetapi **maksimal satu Pembimbing aktif**. Seluruh Reviewer aktif wajib `LAYAK` **pada versi proposal terkini** sebelum penetapan Pembimbing.
4. Usulan Pembimbing mahasiswa hanyalah **rekomendasi**. Kaprodi memilih dosen final; tidak boleh otomatis menetapkan dosen usulan.
5. **Penggantian Pembimbing diperbolehkan hanya selama belum ada kegiatan bimbingan yang dimulai.** Penugasan lama dinonaktifkan, penugasan pengganti dibuat sebagai record baru, riwayat tidak dihapus.
6. **Setelah Pembimbing aktif ditetapkan, revisi proposal pengajuan awal dikunci.** Revisi/Review/penugasan Reviewer yang akan mengubah hasil finalisasi tidak boleh dibuka kembali secara diam-diam. Perubahan judul atau pembukaan kembali merupakan proses khusus di luar scope ini.
7. **ACC penyelesaian KP** oleh Pembimbing setelah proses bimbingan merupakan fase lain dan **bukan** penetapan Pembimbing atau ACC pengajuan.

## 2. Baseline dan referensi implementasi

Menurut laporan implementasi yang sudah diterima (tanpa audit ulang penuh):

- **Fase D:** Mahasiswa membuat/mengirim Pengajuan KP, proposal PDF berversi, serta daftar/detail Pengajuan.
- **Fase E:** Admin Prodi memeriksa kategori Berkas dan Nilai, mencatat `OK_LENGKAP`/`BELUM_OK`, memberikan ACC/TIDAK_ACC administratif serta perbaikan ulang.
- **Fase F:** Kaprodi menugaskan Reviewer; `sumber_penugasan=KAPRODI`, status `AKTIF`/`NONAKTIF`; beberapa Reviewer diperbolehkan.
- **Fase G:** Reviewer memberi `LAYAK`/`TIDAK_LAYAK` **per versi proposal**; mahasiswa merevisi setelah `TIDAK_LAYAK`; hasil versi lama dipertahankan namun tidak berlaku untuk versi baru.
- Fase D–G telah dilaporkan lulus tes integrasi di PostgreSQL **TEST**. Fase H **tidak perlu** melakukan seed, audit master, atau migrasi baru secara default.

**Prioritas sumber:** PRD ini dan keputusan Fase D–G adalah acuan **aturan bisnis terbaru**. `docs/business-rules/pengajuan.md`, `docs/academic-lifecycle.md`, dan skill lama mungkin masih menyebut ACC akhir Kaprodi atau kebijakan konsensus Reviewer yang belum final; bagian itu **tidak berlaku untuk Fase H KP**. Untuk field/relasi, ikuti `server/prisma/schema.prisma` dan service **aktual**, bukan contoh nama dalam PRD.

## 3. Prasyarat penetapan dan status turunan UI

Sebelum menetapkan Pembimbing, **service** wajib memvalidasi secara konsisten di database:

| Pemeriksaan           | Kondisi wajib                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Pengajuan             | KP, `REGULER`, `BARU`, sudah dikirim dan tidak ditolak/terminal administratif                                  |
| Berkas                | `status_pemeriksaan_berkas=OK_LENGKAP`                                                                         |
| Nilai                 | `status_pemeriksaan_nilai=OK_LENGKAP`                                                                          |
| Keputusan Admin Prodi | `status_pengajuan=ACC` administratif                                                                           |
| Data Diri             | Agregat `TERVERIFIKASI` (pengamanan ulang; Fase E seharusnya sudah menegakkan)                                 |
| Reviewer              | **Minimal 1** penugasan `REVIEWER/AKTIF`                                                                       |
| Konsensus review      | **Setiap** Reviewer aktif mempunyai hasil `LAYAK` yang mengacu ke **dokumen proposal dan versi topik terkini** |
| Pembimbing            | Belum ada penugasan `PEMBIMBING/AKTIF` pada Pengajuan tersebut                                                 |
| Dosen kandidat        | Akun/profil dosen aktif, berhak menjadi Pembimbing KP dan sesuai lingkup Prodi                                 |

**Jadwal `PENGAJUAN_REGULER` adalah jendela untuk membuat/mengirim pengajuan**, bukan otomatis batas waktu Kaprodi menetapkan Pembimbing. Jangan menolak penetapan hanya karena jadwal submit sudah ditutup, kecuali terdapat konfigurasi khusus yang sah untuk proses ini.

Backend mengembalikan status **turunan**, bukan membuat kode status persistensi baru:

- `BELUM_SIAP`: ada syarat di atas yang belum terpenuhi.
- `SIAP_DITETAPKAN`: seluruh persyaratan terpenuhi dan belum ada Pembimbing aktif.
- `SUDAH_DITETAPKAN`: sudah ada Pembimbing aktif.

Sertakan `is_eligible`, `alasan[]` yang jelas namun aman, `jumlah_reviewer_aktif`, `jumlah_layak_versi_terkini`, metadata proposal terkini, serta informasi Pembimbing bila sudah ditetapkan. Status `ACC` administratif **tetap** di `Pengajuan`; penetapan dicerminkan oleh keberadaan penugasan Pembimbing aktif, bukan mengganti `ACC` dengan status UI.

## 4. Proses bisnis → tindakan backend

### H1 — Monitoring dan pemeriksaan kesiapan

1. Kaprodi melihat tabel Pengajuan KP menurut Prodi dan periode kewenangannya, dengan pencarian, pagination, dan filter `BELUM_SIAP`/`SIAP_DITETAPKAN`/`SUDAH_DITETAPKAN`.
2. Untuk setiap baris, service menghitung kelayakan dari **status Admin terkini**, penugasan Reviewer aktif, dan **review per versi proposal terbaru** (gunakan helper/pola Fase G). Jangan menghitung `LAYAK` versi lama sebagai kelayakan saat ini.
3. Detail menampilkan identitas mahasiswa, judul, usulan Pembimbing, status Berkas/Nilai/ACC Admin, daftar dan hasil masing-masing Reviewer, versi proposal, serta alasan belum siap. **Tidak ada tombol ACC Kaprodi.**
4. Bila sudah ditetapkan, tabel dapat difilter berdasarkan Pembimbing serta menampilkan tanggal/aktor penetapan dan status bimbingan belum/sudah dimulai (jika tersedia dalam model).

### H2 — Kandidat dan penetapan individual

1. Endpoint kandidat menampilkan dosen aktif yang memenuhi eligibility per Prodi; **tandai usulan mahasiswa sebagai `is_usulan`** tetapi jangan memaksakan pilihan tersebut.
2. Untuk membantu Kaprodi, sertakan jumlah penugasan Pembimbing aktif (bila murah/tersedia) sebagai **informasi**, bukan aturan kuota tanpa dasar kebijakan.
3. Saat Kaprodi menyimpan, baca ulang syarat di §3 **dalam transaksi**. Buat `PenugasanDosen` jenis `PEMBIMBING`, status `AKTIF`, sumber `KAPRODI`, pengajuan, dosen, aktor/waktu dari server sesuai schema.
4. Penetapan **tidak** mengubah nilai `ACC` Admin, hasil Review Proposal, atau mencatat ACC penyelesaian KP.
5. Request identik yang diulang tidak menambah penugasan; request penetapan **dosen berbeda** ketika sudah ada Pembimbing aktif ditolak dengan `409 Conflict` dan diarahkan ke endpoint **penggantian**.

### H3 — Penetapan massal / shortcut UI

Kaprodi dapat (a) memilih beberapa Pengajuan untuk **satu dosen yang sama**, atau (b) memilih dosen berbeda per baris, lalu **simpan sekali**. Gunakan satu endpoint bulk berbentuk array mapping `pengajuan_id → dosen_id`.

- Validasi semua item: tidak duplikat, otorisasi Prodi, kesiapan saat commit, kandidat valid, belum memiliki Pembimbing aktif, serta snapshot proposal/review yang masih sesuai.
- **Atomik all-or-nothing**: bila satu Pengajuan tidak valid/stale, **tidak satu pun** penugasan baru tersimpan. Kembalikan kode konflik/validasi dan penjelasan per-ID tanpa bocor data di luar Prodi.
- Idempotent untuk pemanggilan identik dan aman pada request paralel. Jika bulk berisi kombinasi item *already assigned identik* dan item baru yang valid, boleh menerima sebagai no-op + insert sesuai kontrak, selama tidak menyembunyikan konflik dosen yang berbeda.
- Batasi jumlah item per request (misalnya 50, dapat disesuaikan) untuk menjaga transaksi cepat. Jangan otomatis menetapkan **seluruh hasil filter** tanpa mengirim ID pilihan eksplisit dari UI.

### H4 — Daftar dan penggantian Pembimbing

1. Kaprodi dapat melihat penugasan aktif dan histori penetapan; penugasan lama **tidak dihapus**.
2. Penggantian hanya oleh Kaprodi berwenang, dengan `alasan_penggantian` wajib dan kandidat baru yang valid. Dosen baru harus berbeda dari Pembimbing aktif saat ini.
3. Service wajib menentukan **apakah bimbingan sudah dimulai**, berdasarkan model/aktivitas bimbingan aktual (offline maupun online jika ada), bukan hanya menghitung hari setelah penetapan. Jika sudah ada aktivitas bimbingan, **tolak penggantian** untuk scope Fase H. Jika schema belum memungkinkan pendeteksian yang andal, *fail closed* dan laporkan gap, jangan menganggap otomatis belum mulai.
4. Dalam **satu transaksi**: penugasan lama → `NONAKTIF`, buat penugasan Pembimbing baru `AKTIF`, simpan alasan dan aktor/waktu **pada field histori yang sudah ada** bila tersedia. Bila schema belum punya tempat menyimpan alasan secara permanen, laporkan gap minimal; jangan membuat kolom/migrasi diam-diam.
5. Pastikan tidak pernah ada dua Pembimbing aktif pada satu Pengajuan, termasuk saat dua Kaprodi/request paralel mencoba mengganti.

### H5 — Penguncian proses setelah penetapan

Setelah penugasan `PEMBIMBING/AKTIF` terbentuk:

- Endpoint **revisi proposal awal** oleh mahasiswa pada Fase G harus menolak upload versi baru untuk Pengajuan tersebut, sekalipun ada riwayat `TIDAK_LAYAK` lama.
- Mutasi hasil review proposal dan perubahan penugasan Reviewer yang dapat membatalkan konsensus **tidak boleh diam-diam berjalan** pada pengajuan yang sudah ditetapkan Pembimbing. Tambahkan guard minimal pada service F/G yang terkait; pembacaan histori tetap boleh.
- Penutupan review awal **tidak menutup** modul bimbingan maupun ACC penyelesaian tahap yang akan dikembangkan tersendiri.
- Jika kelak perlu perubahan judul, koreksi formal, atau pembukaan kembali, gunakan **proses khusus** dengan keputusan bisnis terpisah; jangan membuka PATCH umum.

## 5. Rancangan endpoint REST untuk mendukung UI

Prefiks dan nama ini adalah **kontrak usulan**. Agent wajib memeriksa route Fase F yang sudah ada dan *reuse/extend* bila sesuai agar tidak menciptakan endpoint duplikat. Jangan merombak URL lama secara breaking.

| Method | Endpoint usulan                                  | Konsumen/UI dan kewenangan                                                                                             |
| ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/kaprodi/pengajuan-kp/finalisasi`           | Tabel monitoring; `q`, `page`, `limit`, `periode`, `status_finalisasi`, `pembimbing_id`, sort; Kaprodi scoped Prodi.   |
| `GET`  | `/api/kaprodi/pengajuan-kp/:id/finalisasi`       | Detail semua gate, hasil Reviewer versi terbaru, usulan/kandidat Pembimbing, alasan belum siap.                        |
| `GET`  | `/api/kaprodi/pembimbing-kp/kandidat`            | Daftar dosen layak jadi Pembimbing, search, beban penugasan aktif; bisa menerima `pengajuan_id` untuk menandai usulan. |
| `POST` | `/api/kaprodi/pengajuan-kp/:id/pembimbing`       | Penetapan individual; cek readiness dan kandidat saat transaksi.                                                       |
| `POST` | `/api/kaprodi/pembimbing-kp/bulk`                | Penetapan banyak pengajuan ke satu atau beberapa dosen, atomik dan idempotent.                                         |
| `GET`  | `/api/kaprodi/pembimbing-kp/penugasan`           | List penugasan aktif/riwayat, filter dosen/periode, untuk manajemen.                                                   |
| `POST` | `/api/kaprodi/pengajuan-kp/:id/pembimbing/ganti` | Penggantian sebelum bimbingan dimulai; alasan wajib, histori terjaga.                                                  |

**Mahasiswa:** tambahkan metadata Pembimbing yang sudah ditetapkan ke **endpoint detail Pengajuan miliknya yang sudah tersedia** (read-only), alih-alih membuat route baru hanya untuk satu field. Jangan membuka data mahasiswa lain.

### Contoh payload penetapan individual

```json
POST /api/kaprodi/pengajuan-kp/101/pembimbing
{
  "dosen_id": 5,
  "expected_dokumen_pengajuan_id": 508
}
```

### Contoh payload penetapan massal

```json
POST /api/kaprodi/pembimbing-kp/bulk
{
  "assignments": [
    { "pengajuan_id": 101, "dosen_id": 5, "expected_dokumen_pengajuan_id": 508 },
    { "pengajuan_id": 102, "dosen_id": 5, "expected_dokumen_pengajuan_id": 527 },
    { "pengajuan_id": 103, "dosen_id": 7, "expected_dokumen_pengajuan_id": 531 }
  ],
  "konfirmasi": true
}
```

### Contoh payload penggantian

```json
POST /api/kaprodi/pengajuan-kp/101/pembimbing/ganti
{
  "dosen_baru_id": 7,
  "alasan_penggantian": "Koreksi penetapan sebelum bimbingan dimulai"
}
```

ID/field snapshot di atas **kontrak logis**, bukan bukti atribut Prisma. Ambil identitas Kaprodi, aktor, Prodi, serta timestamp dari **sesi/server**, bukan body request. Gunakan respons sukses/error sesuai gaya modul D–G (`401`, `403`, `404`, `409`, `422` sebagaimana relevan).

## 6. Pemetaan teknis, keamanan, dan transaksi

| Bagian teknis | Sumber/model logis                                                                   | Kewajiban service                                                                                          |
| ------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Otorisasi     | Auth mode `KAPRODI`, User/Prodi                                                      | Buktikan kewenangan atas **Prodi Pengajuan** dan kandidat Dosen, tidak hanya punya role Kaprodi.           |
| Administrasi  | `Pengajuan`, verifikasi Data Diri                                                    | Baca status Berkas, Nilai, ACC Admin, dan Data Diri **terkini**.                                           |
| Review        | `PenugasanDosen`, `ReviewProposal`, `RiwayatReview`, `DokumenPengajuan`/`VersiTopik` | Hitung seluruh Reviewer `AKTIF` dan hasil `LAYAK` **pada versi terbaru**, memakai pola Fase G.             |
| Kandidat      | `Dosen`, `User`, `Role`, `Prodi` sesuai schema                                       | Dosen aktif, valid untuk Pembimbing KP, scoped Prodi; tampilkan usulan mahasiswa sebagai petunjuk.         |
| Penetapan     | `PenugasanDosen`                                                                     | Buat `PEMBIMBING/AKTIF` sumber `KAPRODI`; satu Pembimbing aktif per Pengajuan; histori tidak hilang.       |
| Penggantian   | Penugasan Pembimbing lama/baru + model aktivitas bimbingan                           | Deteksi mulai bimbingan; nonaktifkan lama dan buat baru **atomik**; histori/alasan terjaga semampu schema. |

Ikuti **route → controller → service → Prisma** existing. Routing/auth/validasi bentuk input pada route/controller; eligibility, Prodi scope, concurrency, histori di service. Sebaiknya satu helper `getKelayakanPenetapan` yang dipakai daftar/detail **dan** direvalidasi saat commit; jangan menduplikasi rule dalam banyak controller. Query list perlu **batch/agregasi** untuk status Reviewer dan pembimbing agar tidak terjadi N+1 query besar; optimalkan seperlunya, bukan refaktor keseluruhan.

Penetapan individual, bulk dan penggantian menggunakan transaksi Prisma dan pengamanan concurrency sesuai pola yang telah lulus tes di fase terdahulu (misalnya `Serializable` + retry terbatas). Kuncinya bukan sekadar `findFirst`: request paralel **tidak boleh menghasilkan dua Pembimbing aktif**. Pertahankan partial unique constraint existing jika ada; jangan menambah indeks/migrasi secara spekulatif.

**Snapshot stale:** jika ada perubahan proposal/hasil review/penugasan Reviewer antara UI membuka daftar dan Kaprodi menekan Simpan, service harus menghitung ulang. Penetapan tidak boleh dilakukan berdasarkan badge `SIAP_DITETAPKAN` lama dari UI. Laporkan `409 Conflict` dengan alasan aman.

## 7. Acceptance criteria — tes terarah pada PostgreSQL TEST

1. ACC Admin + Berkas/Nilai `OK_LENGKAP`, Data Diri verified, minimal satu Reviewer aktif, dan **semua LAYAK versi terbaru** → `SIAP_DITETAPKAN`, lalu penetapan berhasil.
2. Satu syarat tidak terpenuhi (termasuk Reviewer `NONAKTIF`, `TIDAK_LAYAK`, belum review, atau `LAYAK` versi lama) → ditolak; alasan yang sesuai ditampilkan, tidak ada penugasan Pembimbing tercipta.
3. Akses tanpa login, bukan Kaprodi, atau Kaprodi dari Prodi lain → ditolak pada list/detail/penetapan/penggantian.
4. Usulan Pembimbing bukan kewajiban: Kaprodi boleh memilih kandidat valid yang berbeda; usulan lama tetap tersimpan.
5. Penetapan individual berulang ke dosen sama → no-op/idempotent; dosen berbeda → `409` dan butuh jalur penggantian. Dua request paralel tidak menghasilkan dua Pembimbing aktif.
6. Bulk tiga Pengajuan ke dosen yang sama atau berbeda → semua berhasil secara atomik. Satu item invalid/stale → **rollback seluruh batch**; pemanggilan ulang tidak menggandakan record.
7. Setelah penetapan, upload revisi proposal awal dan mutasi Reviewer yang mengubah konsensus ditolak, namun histori tetap bisa dibaca. Bimbingan/ACC penyelesaian tidak disentuh.
8. Penggantian **sebelum** aktivitas bimbingan → penugasan lama `NONAKTIF`, baru `AKTIF`, histori/aktor terjaga. Jika aktivitas bimbingan sudah ada → ditolak tanpa perubahan record.
9. Pencarian, filter status turunan, pagination, kandidat, data Pembimbing di detail Mahasiswa, dan scope Prodi memberi respons siap pakai untuk UI.
10. Penetapan setelah **jadwal submit ditutup** tetap boleh bila syarat Fase H terpenuhi; `status_pengajuan=ACC` administratif tetap, tidak membuat ACC Kaprodi tambahan.

Periksa regression relevan D/E/F/G, terutama revisi setelah Admin ACC **sebelum** Pembimbing ditetapkan yang tetap diperbolehkan. Jalankan test suite terkait, pemeriksaan sintaks, dan `prisma validate` sesuai script repo; laporan singkat **PASS/FAIL/SKIP**, file berubah dan blocker riil.

## 8. Scope dan batas eksekusi

- **Termasuk:** endpoint Fase H, helper readiness, penguncian minimal mutasi F/G setelah pembimbing aktif, metadata Pembimbing pada detail Mahasiswa, test PostgreSQL TEST, serta perubahan kecil lintas service yang diperlukan.
- **Tidak termasuk:** frontend, Scalar/OpenAPI, notifikasi, bimbingan offline/online, ACC penyelesaian KP, perubahan judul, ISCP/TA, pengajuan ulang/perpanjangan, refaktor besar, audit semua master, seed global.
- **Dilarang tanpa izin baru:** migrasi/schema edit yang tidak disetujui, `prisma db push`, `migrate reset`, drop/reset, seed/write pada `sipkita_dev`, menghapus penugasan/histori, atau menjalankan pengujian mutatif di database pengguna nyata.
- Jika schema **tidak mampu** menyimpan alasan penggantian atau mendeteksi aktivitas bimbingan, berikan laporan gap spesifik serta draft paling kecil; jangan membuat status/kolom baru tanpa kesepakatan. Implementasikan bagian yang aman terlebih dahulu.
- Pertahankan seluruh perubahan worktree pengguna. Hindari audit berulang Fase D–G yang sudah lulus, dan jangan menunda implementasi karena perbedaan dokumentasi lama yang **sudah diputuskan** dalam PRD ini.

## 9. Skill dan referensi wajib (selektif)

Agent Codex perlu membaca **yang relevan** dari repository lokalnya:

1. `AGENTS.md` — aturan proyek.
2. `.agents/skills/feature-implementation/SKILL.md` — implementasi vertical slice sesuai pola repo (bila lokasinya berbeda, temukan dengan `rg --files`).
3. `.agents/skills/code-change-verification/SKILL.md` — pemeriksaan diff, transaksi, authorization, regresi terarah.
4. `docs/business-rules/pengajuan.md`, `docs/business-rules/review-proposal.md`, `docs/roles-permissions.md`, `docs/academic-lifecycle.md` **hanya bagian relevan**; keputusan yang bertentangan dengan §1–§4 PRD ini sudah diganti oleh aturan final Fase H.
5. `docs/api-conventions.md`, `docs/architecture.md` — pola route/controller/service dan respons HTTP.
6. `server/prisma/schema.prisma`, service/route Fase E/F/G (`admin-pengajuan-kp.*`, `penugasan-reviewer-kp.*`, `review-proposal-kp.*`, `pengajuan-kp.*`) dan `server/test/pengajuan-kp.postgres.test.js` **aktual** — acuan field, auth, histori, dan tes existing.

`prisma-schema-change/SKILL.md` **hanya** bila gap schema benar-benar terbukti dan akan didraf; perubahan/migrasi memerlukan persetujuan khusus. Tidak perlu membuka skill lain atau semua docs secara massal.
