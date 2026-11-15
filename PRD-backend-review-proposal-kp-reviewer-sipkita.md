# PRD — Fase G: Backend Review Proposal KP | SIPKITA

**Versi:** 1.0 — 5 November 2026\
**Status:** Aturan bisnis dikunci; dokumen acuan implementasi untuk Codex\
**Cakupan:** Backend `server/`, khusus **KP — REGULER — BARU**; belum mencakup frontend, Scalar/OpenAPI, atau migrasi database.

## 1. Tujuan dan baseline

Mengembangkan REST API agar **Dosen Reviewer** dapat melihat penugasan aktif miliknya, membuka PDF proposal, memberi catatan dan hasil review per **versi proposal**, meninjau revisi, menandai beberapa proposal **LAYAK** sekaligus, serta mengunduh proposal yang menjadi tanggung jawabnya dalam **ZIP**. Mahasiswa dapat membaca hasil review dan mengunggah revisi proposal pada pengajuan yang sama.

**Baseline dari laporan Fase D/E/F (tidak perlu diaudit ulang dari nol):**

- Fase D: pengajuan mahasiswa, dokumen PDF privat dengan versi, dan submit `DRAFT → DIAJUKAN` sudah dibuat.
- Fase E: Admin Prodi memeriksa kategori Berkas/Nilai, keputusan administratif `ACC`/`TIDAK_ACC`, ACC Semua, dan alur perbaikan `BELUM_OK` sudah dibuat.
- Fase F: Kaprodi menugaskan Reviewer secara individual/bulk, nonaktivasi/penggantian, dan mempertahankan riwayat. Kode resmi: `sumber_penugasan=KAPRODI`, status penugasan `AKTIF`/`NONAKTIF`.
- Master KP dan kolom deklarasi SPP telah diterapkan ke `sipkita_dev` pada fase terdahulu. **Fase G tidak memerlukan seed maupun migrasi secara default.** Fase D/E/F telah lulus tes PostgreSQL TEST; cukup tes regresi terarah.

## 2. Keputusan bisnis final yang wajib dijaga

| ID   | Aturan final                                                                                                                                                                    | Implikasi untuk server                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-01 | **Hanya Reviewer dengan penugasan `REVIEWER` berstatus `AKTIF`** atas sebuah pengajuan yang dapat membuka/mengulas proposal tersebut.                                           | Semua list, detail, PDF, hasil dan bulk wajib memvalidasi user login → profil Dosen → penugasan aktif, bukan sekadar role `REVIEWER`.                                                                                  |
| G-02 | Review adalah **hasil masing-masing Reviewer terhadap satu versi proposal tertentu**.                                                                                           | Hasil harus mengacu pada `dokumen_pengajuan_id` dan `versi_topik_id` aktual; tidak boleh dicampur dengan penilaian Reviewer lain.                                                                                      |
| G-03 | Reviewer memilih **`LAYAK`** atau **`TIDAK_LAYAK`**. `TIDAK_LAYAK` memerlukan catatan koreksi yang jelas; `LAYAK` boleh tanpa catatan.                                          | Catat reviewer, versi, waktu server, keputusan dan komentar dalam histori. Lembar review PDF **opsional**, bukan prasyarat `LAYAK`.                                                                                    |
| G-04 | `TIDAK_LAYAK` berarti proposal **perlu revisi**, bukan `Pengajuan.status_pengajuan=TIDAK_ACC`.                                                                                  | Jangan memodifikasi status Berkas/Nilai, status administratif, maupun keputusan Kaprodi hanya karena hasil review.                                                                                                     |
| G-05 | Jika mahasiswa mengunggah proposal versi baru, **seluruh Reviewer aktif perlu memeriksa ulang versi terbaru**, walaupun sebelumnya `LAYAK`.                                     | Hasil versi lama tetap di histori; `LAYAK` lama tidak sah untuk versi baru. Status terkini setiap Reviewer ditentukan dari versi proposal yang berlaku.                                                                |
| G-06 | Mahasiswa dapat merevisi proposal sesudah minimal satu Reviewer aktif memberi `TIDAK_LAYAK` pada versi yang saat itu berlaku, **meskipun Admin sudah `OK_LENGKAP` atau `ACC`**. | Revisi substansi Reviewer berbeda dari perbaikan administrasi `BELUM_OK`. Jangan membuka PATCH pengajuan umum atau otomatis membatalkan ACC Admin. Pengajuan `TIDAK_ACC` terminal tidak bisa direvisi lewat jalur ini. |
| G-07 | Pemeriksaan Reviewer **paralel** dengan administrasi Admin Prodi.                                                                                                               | Admin Prodi boleh memberi ACC administratif sebelum semua review `LAYAK`, bahkan saat ada `TIDAK_LAYAK`. Review tidak menjadi guard ACC administratif KP.                                                              |
| G-08 | Semua Reviewer **aktif** harus mempunyai hasil `LAYAK` pada **proposal versi terbaru** untuk dianggap *review selesai* pada fase keputusan lanjutan Kaprodi.                    | Sediakan rekap hasil yang dapat dipakai fase berikutnya; **jangan** menerbitkan ACC akhir atau menetapkan Pembimbing dari endpoint review.                                                                             |
| G-09 | Nonaktivasi/penggantian Reviewer tidak menghapus tugas maupun hasil lama.                                                                                                       | Setelah `NONAKTIF` ia tidak boleh mengakses/mereview lagi; histori tetap dipertahankan. Reviewer pengganti memulai penilaian sendiri.                                                                                  |

> **Koreksi prioritas dokumen lama:** apabila `docs/business-rules/review-proposal.md` masih menyatakan kode `TIDAK_LAYAK` atau aturan semua Reviewer belum final, ikuti keputusan dalam PRD ini. Aturan Admin Prodi untuk ACC administratif KP dan penugasan Kaprodi Fase F tidak boleh tertukar.

## 3. Alur proses → perilaku backend

1. **Reviewer membuka daftar tugas.** Server hanya menampilkan Pengajuan KP dengan penugasan aktif reviewer login; menyertakan NIM/nama, judul, tanggal submit, versi proposal terkini, status review **reviewer ini** pada versi terkini, serta ringkasan progres. Bisa dipakai tabel UI, pencarian, filter, pagination, dan checkbox multi-select.
2. **Reviewer melihat detail dan PDF.** Server memeriksa penugasan aktif, lalu mengambil proposal **terkini** dari `DokumenPengajuan`/`Dokumen` privat, metadata versi dan catatan review miliknya. File tidak boleh dibuka lewat path/storage key publik.
3. **Reviewer mengirim hasil.** `LAYAK` atau `TIDAK_LAYAK`, catatan, identitas versi yang benar-benar diperiksa. Service menolak snapshot usang (mahasiswa telah mengunggah versi baru), status terminal yang tidak diperbolehkan, atau penugasan tidak aktif. Simpan ringkasan `ReviewProposal` dan satu putaran `RiwayatReview` secara atomik.
4. **Mahasiswa membaca hasil.** Hanya pemilik Pengajuan dapat melihat keputusan/catatan semua Reviewer yang relevan beserta versi/riwayat, tanpa mengakses file reviewer atau mahasiswa lain yang tidak berwenang.
5. **Mahasiswa mengirim revisi.** Hanya setelah `TIDAK_LAYAK` versi terkini, mahasiswa mengunggah **proposal PDF baru** pada Pengajuan yang sama. Buat `Dokumen`/`DokumenPengajuan` versi berikutnya, tandai versi lama bukan terkini, **jangan menghapus histori review**. Semua reviewer aktif sekarang berstatus *belum menilai versi terbaru* secara logis; jangan mewarisi `LAYAK` versi sebelumnya. Isi Berkas, Nilai, dan keputusan administratif tetap.
6. **Reviewer menilai ulang.** Reviewer menerima versi terbaru di daftar tugas, dapat membaca review terdahulu, dan mencatat hasil putaran baru sampai semua reviewer aktif `LAYAK` pada versi yang sama.

**Pengelolaan dua jenis revisi:** Fase E mengizinkan perbaikan administratif saat kategori `BELUM_OK` dan wajib **Kirim Perbaikan**. Fase G mengizinkan **revisi substansi proposal** akibat `TIDAK_LAYAK` dan tidak mensyaratkan Admin membuat status `BELUM_OK` terlebih dahulu. Tetap ikuti otorisasi, jadwal/kebijakan yang relevan di service D/E; jika mekanisme jadwal revisi setelah submit belum dikontrak, jangan mengarang batas baru.

## 4. Kontrak endpoint yang dibutuhkan UI

Ikuti format respons/error, middleware auth, dan prefiks routing aktual pada repo. Nama di bawah adalah **usulan kontrak stabil**; hindari menggandakan route existing.

| Method | Endpoint                                    | Fungsi dan hak akses                                                                                                                                                                             |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/reviewer/pengajuan`                   | List tugas Reviewer **aktif miliknya**: `page`, `limit`, `q`, `status_review`, `periode`; filter/status dihitung untuk **versi terkini**; sertakan metadata pagination dan jumlah eligible bulk. |
| `GET`  | `/api/reviewer/pengajuan/:id`               | Detail Pengajuan KP, versi proposal, status/catatan review dirinya, dan ringkasan penilaian relevan; periksa penugasan aktif.                                                                    |
| `GET`  | `/api/reviewer/pengajuan/:id/proposal/file` | Preview/download PDF proposal **terkini** secara terotorisasi; `Content-Type: application/pdf`.                                                                                                  |
| `POST` | `/api/reviewer/pengajuan/:id/review`        | Simpan keputusan satu Reviewer untuk **versi yang dikirim**: `LAYAK`/`TIDAK_LAYAK`, catatan, snapshot versi.                                                                                     |
| `GET`  | `/api/reviewer/pengajuan/:id/riwayat`       | Histori putaran review reviewer login (versi, hasil, catatan, waktu); detail boleh mengembalikan histori agar endpoint tambahan tidak perlu.                                                     |
| `POST` | `/api/reviewer/review/bulk-layak`           | Sekali klik **Layak Semua** untuk daftar `pengajuan_ids` **yang secara eksplisit dipilih**, dengan snapshot tiap versi dan konfirmasi. Transaksi seluruhnya atau batal seluruhnya.               |
| `POST` | `/api/reviewer/proposal/download-bulk`      | **Unduh banyak proposal dalam satu ZIP**: ID pilihan **atau** `scope=ALL_ASSIGNED` untuk seluruh penugasan aktif reviewer login, dengan batas aman.                                              |
| `GET`  | `/api/pengajuan/:id/review`                 | Mahasiswa pemilik melihat hasil/catatan semua Reviewer serta status terkini versus historis.                                                                                                     |
| `POST` | `/api/pengajuan/:id/revisi-proposal`        | Mahasiswa pemilik mengunggah PDF versi baru setelah `TIDAK_LAYAK`, tanpa menyentuh ACC Admin. Ikuti pola multipart/storage privasi Fase D.                                                       |

**DTO list untuk UI:** `pengajuan_id`, `mahasiswa`, `judul`, `versi_proposal` (angka/ID yang stabil), `proposal_updated_at`, `review_saya` (`BELUM_DIREVIEW`/`LAYAK`/`TIDAK_LAYAK` untuk versi terkini), `eligible_layak_bulk` dan alasan jika tidak eligible. `BELUM_DIREVIEW` di sini **status tampilan hasil kalkulasi**, bukan instruksi membuat enum/kolom baru.

### Contoh review individual

```json
POST /api/reviewer/pengajuan/101/review
{
  "hasil_review": "TIDAK_LAYAK",
  "catatan_reviewer": "Perjelas metode pengumpulan data pada Bab III.",
  "expected_dokumen_pengajuan_id": 508,
  "expected_versi_topik_id": 401
}
```

ID/field versi di atas hanya **contoh payload**, bukan asumsi nama atribut Prisma. Server memvalidasi versi terkini terhadap database dan mengikat hasil ke record yang tepat. Jangan terima `reviewer_id`, `dosen_id`, `direview_oleh_user_id`, atau waktu review dari body.

### Kontrak bulk LAYAK (shortcut UI)

```json
POST /api/reviewer/review/bulk-layak
{
  "items": [
    { "pengajuan_id": 101, "expected_dokumen_pengajuan_id": 508 },
    { "pengajuan_id": 102, "expected_dokumen_pengajuan_id": 527 }
  ],
  "konfirmasi": true
}
```

- Frontend dapat menyediakan **pilih beberapa** / **pilih semua hasil filter**, tetapi harus mengirim **ID dan versi nyata yang dipilih**. **Tidak ada mode tanpa pilihan yang otomatis menilai seluruh tugas.** Tampilkan modal konfirmasi bahwa Reviewer **telah memeriksa** semua proposal yang dipilih, termasuk bila pemeriksaan dilakukan secara offline.
- Validasi **setiap** item: tidak duplikat, assignment `REVIEWER AKTIF` milik pemanggil, KP reguler baru, file proposal sah, versi tidak berubah, status belum terminal, dan tidak sedang mempunyai `TIDAK_LAYAK` final **pada versi yang sama**. Perbaikan terhadap hasil `TIDAK_LAYAK` dilakukan melalui **versi proposal baru**, bukan menimpa hasil lama diam-diam.
- Satu transaksi Prisma (`Serializable` bila cocok dengan pola existing; retry terbatas untuk konflik) dengan semantik **all-or-nothing**. Bila ada satu item stale/tidak berizin, **tidak satu pun review ditulis**; kembalikan `409/403/422` yang relevan serta detail per-ID yang aman. Jangan bocorkan isi pengajuan tidak berizin dalam error.
- `LAYAK` yang sudah dicatat oleh Reviewer sama **pada versi sama** dianggap `already_layak`, tidak membuat riwayat ganda. Respons ringkas misalnya `{ "created": 1, "already_layak": 1, "total": 2 }`. Keputusan reviewer lain **tidak boleh berubah**.
- Batasi jumlah item per permintaan (misalnya konfigurasi awal 50) dan tangani duplikasi serta request paralel. Bulk `LAYAK` **tidak** mengubah Admin ACC, hasil Kaprodi, atau penetapan Pembimbing.

### Kontrak unduh ZIP massal

```json
POST /api/reviewer/proposal/download-bulk
{
  "scope": "SELECTED",
  "pengajuan_ids": [101, 102]
}
```

Atau `{ "scope": "ALL_ASSIGNED" }` untuk mengunduh proposal **terkini** dari seluruh penugasan Reviewer aktif miliknya, tanpa harus memilih satu per satu. Ini **boleh untuk download**, tidak berlaku untuk bulk `LAYAK`.

- Validasi seluruh izin objek **sebelum** mulai mengirim ZIP; ID di luar kewenangan → tolak keseluruhan, bukan kirim ZIP parsial. Untuk `ALL_ASSIGNED`, pemilihan ID berasal dari query penugasan aktif milik user di server, bukan input reviewer.
- Gunakan file PDF **versi terbaru** dari private storage, setiap proposal satu entri; nama aman dan unik, misalnya `Proposal_KP_NIM_V2.pdf`. Bersihkan karakter nama berbahaya dan cegah *path traversal/ZIP slip*; jangan masukkan path asli, storage key, atau metadata rahasia.
- Terapkan batas **jumlah file/total byte** dan pesan error yang membantu bila terlalu besar; jangan diam-diam menghilangkan proposal. ZIP di-stream atau memakai temporary file yang dibersihkan dalam segala kondisi. Header `Content-Type: application/zip`, `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.
- Gunakan utilitas ZIP/dependensi yang **sudah tersedia** bila ada; bila belum ada dan benar-benar perlu, tambahkan satu dependensi kecil yang sesuai standar repo (tidak membangun format ZIP manual).

## 5. Pemetaan teknis dan konsistensi data

| Kebutuhan           | Model/komponen yang perlu diperiksa pada schema/kode aktual | Aturan implementasi                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aktor Reviewer      | `User`, `UserRole`, `Dosen`, `PenugasanDosen`               | Dari **auth/active role** + relasi Dosen + assignment `REVIEWER/AKTIF`, dengan scope Prodi; tidak percaya ID actor dari body.                                        |
| Pengajuan dan topik | `Pengajuan`, `TopikPenelitian`, `VersiTopik`                | Khusus KP–REGULER–BARU, pengajuan terkirim, identitas proposal dan versi topik sesuai record aktual.                                                                 |
| PDF proposal        | `Dokumen`, `DokumenPengajuan`, `PersyaratanPengajuan`       | Ambil `PROPOSAL_KP` **terkini**, validasi ownership pengajuan, simpan file di private storage yang sudah ada.                                                        |
| Hasil Reviewer      | `ReviewProposal`, `RiwayatReview`                           | Setiap assignment independen; satu penilaian/putaran terikat **versi dokumen dan topik**; histori immutable.                                                         |
| Revisi mahasiswa    | Service Pengajuan KP Fase D/E                               | Buat file/versi baru secara konsisten dengan partial unique index `is_terkini`; perubahan status ringkasan review bila diperlukan **tidak boleh menghapus histori**. |
| File lembar review  | `RiwayatReview.lembar_review_dokumen_id` (jika tersedia)    | **Opsional**; boleh mendukung PDF review melalui pola penyimpanan D, tetapi tidak boleh menjadi blocker review teks/keputusan.                                       |

Pola coding: `route → controller → service → Prisma`; middleware auth/role dan validator di route/controller, business rules/ownership/transaksi di service. Pilih nama file yang konsisten dengan modul D/E/F (misalnya `review-proposal-kp.routes.js`, `.controller.js`, `.service.js`); boleh menambah helper kecil bila dibutuhkan, tanpa refaktor besar. Konstanta `LAYAK`/`TIDAK_LAYAK`, status assignment dan penanda versi dipusatkan, bukan string tersebar.

**Konsistensi penting:**

1. Review terhadap `expected_dokumen_pengajuan_id` yang tidak lagi terkini → `409 Conflict`; jangan menyimpan keputusan ke versi terbaru secara diam-diam.
2. Review dari Reviewer yang sudah `NONAKTIF` → `403 Forbidden` meskipun pernah ditugaskan. Reviewer pengganti memakai assignment sendiri.
3. Perubahan `ReviewProposal` dan penambahan `RiwayatReview` harus atomik serta mencegah double-submit. Jangan overwrite putaran lama. Apabila sudah ada hasil final pada versi yang sama, ulang request identik bisa no-op; hasil bertentangan harus ditolak dan diarahkan ke proses revisi/keputusan terpisah.
4. Ketika proposal direvisi, `ReviewProposal` sebagai ringkasan harus konsisten dengan versi baru. Bila field ringkasan tidak memuat ID versi, hitung **status review versi terkini dari `RiwayatReview`**, bukan hanya `ReviewProposal.hasil_review` lama.
5. Wajib mempertahankan histori bila ada dua Reviewer, penggantian Reviewer, maupun perubahan versi berulang. Hasil semua Reviewer aktif pada satu versi dapat dihitung untuk **fase Kaprodi berikutnya**, tetapi Fase G hanya mengembalikan rekap, tidak mengeluarkan persetujuan akhir.
6. Izin atas PDF dan hasil review diperiksa pada service untuk setiap request, termasuk download massal dan akses dengan ID yang ditebak.

## 6. Acceptance test terarah (PostgreSQL TEST)

Tambahkan kasus ke suite integrasi yang sudah ada; hindari audit/pengujian keseluruhan berulang jika tidak berhubungan.

1. Reviewer A melihat proposal X yang ditugaskan; tidak dapat melihat/mengunduh/review Y yang tidak ditugaskan. Penugasan `NONAKTIF` langsung menolak request baru.
2. Dua Reviewer pada Pengajuan yang sama menghasilkan `LAYAK` dan `TIDAK_LAYAK` independen, tanpa mengubah status Admin/Kaprodi. `TIDAK_LAYAK` tanpa catatan ditolak.
3. Mahasiswa pemilik melihat catatan; mahasiswa lain mendapat penolakan. Mahasiswa dapat mengunggah versi revisi karena `TIDAK_LAYAK` meski Berkas `OK_LENGKAP`/Admin `ACC`; pengajuan `TIDAK_ACC` terminal tidak boleh direvisi lewat fitur ini.
4. Setelah versi 1 memiliki hasil `LAYAK`, revisi versi 2 membuat hasil versi 1 **stale** untuk semua Reviewer aktif; histori versi 1 tetap dan Reviewer menilai versi 2 secara baru.
5. Reviewer mengirim snapshot lama ketika revisi terjadi bersamaan → `409`, tidak ada `RiwayatReview` salah versi.
6. Bulk `LAYAK`: dua pilihan valid tercatat; ulang permintaan no-op; satu item invalid/stale menyebabkan rollback seluruh batch; penilaian milik Reviewer lain tetap; panggilan paralel tidak menggandakan hasil.
7. ZIP pilihan dua proposal menghasilkan dua PDF versi terkini dan nama aman; `ALL_ASSIGNED` hanya berisi penugasan aktif milik reviewer; ID asing tidak boleh terunduh; batas jumlah/ukuran ditangani tanpa bocor file.
8. Revisi reviewer **tidak mengubah** `status_pemeriksaan_berkas`, `status_pemeriksaan_nilai`, `status_pengajuan` administratif, maupun Data Diri.
9. Tes authorization HTTP 401/403, payload buruk 422/400, konflik versi 409, dan privasi storage; jalankan lint/syntax/test/prisma validate sesuai script yang memang ada.

**Kriteria selesai:** endpoint individual, bulk `LAYAK`, ZIP, baca hasil mahasiswa, dan upload revisi aktif bekerja di PostgreSQL TEST; histori benar; tidak ada perubahan ke `sipkita_dev`. Laporan akhir cukup: endpoint yang dibuat, file berubah, hasil tes PASS/FAIL dan gap yang benar-benar memblokir.

## 7. Batas pekerjaan dan kebijakan eksekusi

- **Dalam scope:** seluruh endpoint di §4, utilitas/validator minimal, pengamanan transaksi, tes integrasi terarah, reuse pola route/controller/service/model Prisma dan file storage dari fase terdahulu.
- **Di luar scope:** frontend, desain UI, Scalar/OpenAPI, persetujuan akhir Kaprodi, penetapan Pembimbing, modul ISCP/TA, perpanjangan, seminar, notifikasi, job queue, perubahan massal arsitektur, serta audit ulang semua master/migrasi.
- **Tidak boleh:** `db push`, `migrate reset`, seed global, migrasi ke `sipkita_dev`, menghapus dokumen/riwayat, membuka storage publik, atau menulis database pengguna nyata tanpa otorisasi baru.
- Jika ada gap **yang benar-benar tidak bisa diselesaikan oleh model saat ini**, jelaskan bukti field/constraint serta **draft perubahan paling kecil**; **jangan otomatis migrasi schema**. Lanjutkan bagian implementasi yang aman dan tidak tergantung gap tersebut.
- Worktree lokal mungkin sudah dirty. Pertahankan perubahan yang ada. Target tes pakai database PostgreSQL TEST terisolasi, bukan `sipkita_dev`. Gunakan test fixture yang bersih dan hindari dump/restore berulang bila test database yang ada sudah memenuhi kebutuhan.

## 8. Skill dan sumber acuan untuk agent (baca selektif)

**Wajib periksa bila ada dalam repo:**

1. `AGENTS.md` — aturan kerja utama SIPKITA.
2. `.agents/skills/feature-implementation/SKILL.md` — panduan implementasi satu fitur vertikal/backend.
3. `.agents/skills/code-change-verification/SKILL.md` — cara verifikasi perubahan secara proporsional.
4. `docs/business-rules/review-proposal.md` — konsep model review, **dengan koreksi keputusan final pada §2 PRD ini**.
5. `docs/business-rules/pengajuan.md`, `docs/roles-permissions.md` — transisi pengajuan dan cakupan peran yang berkaitan.
6. `docs/api-conventions.md`, `docs/architecture.md` — format endpoint dan pembagian route/controller/service.
7. `server/prisma/schema.prisma` **aktual** serta kode/tes Fase D/E/F: `pengajuan-kp.*`, `admin-pengajuan-kp.*`, `penugasan-reviewer-kp.*`, `server/test/pengajuan-kp.postgres.test.js` — sumber implementasi nyata. Cocokkan nama field, route, dan pola auth/storage sebelum menulis kode.

**Hanya jika perlu schema baru:** `.agents/skills/prisma-schema-change/SKILL.md` dan berhenti sebelum migrasi sesuai izin. Jangan memanggil seluruh skill atau membaca semua docs tanpa relevansi. Sumber bisnis utama adalah **keputusan dalam PRD ini**; file lama yang belum sinkron bukan alasan mengubah keputusan.
