# PRD — Backend Pengaturan Akademik oleh Admin Prodi | SIPKITA

**Versi:** 1.0 — 6 November 2026  
**Status:** Acuan bisnis dan teknis untuk implementasi Codex  
**Aktor pengelola resmi:** **ADMIN_PRODI**, bukan `ADMIN_SISTEM`  
**Cakupan:** Backend konfigurasi Periode, Jadwal Proses, Kurikulum (master informasi), Tahap, dan Dokumen/Persyaratan untuk KP → ISCP → TA.

## 1. Tujuan dan batasan utama

Menyediakan REST API agar **Admin Prodi** dapat mengelola konfigurasi akademik dari UI tanpa mengedit source code atau seeder. Konfigurasi ini menjadi dasar pilihan dan ketersediaan Pengajuan KP, ISCP, TA, serta jadwal **Perpanjangan** masing-masing tahap. API harus menyediakan list/filter/detail, operasi penambahan/perubahan, aktivasi/nonaktivasi yang aman, serta respons siap pakai untuk frontend.

**Keputusan final pengguna:**

1. **Admin Prodi** memegang manajemen konfigurasi akademik pada modul ini. Admin Sistem **bukan** aktor pengelola fitur ini. Gunakan role aktif `ADMIN_PRODI` dan pembatasan Prodi yang sah.
2. Proses tersedia berdasarkan kombinasi **Periode Akademik + Tahap Akademik + Jadwal Proses**; bukan hardcode pembukaan KP/ISCP/TA di frontend.
3. **Pengajuan Reguler dan Perpanjangan mempunyai jadwal independen** per tahap/periode. Reguler dibuka tidak otomatis berarti Perpanjangan dibuka.
4. Kurikulum hanya **master informasi**, belum memengaruhi kelayakan Pengajuan, belum mengikat Angkatan, SKS, mata kuliah atau transisi KP→ISCP→TA.
5. Perubahan konfigurasi **tidak boleh mengubah/menghapus riwayat Pengajuan** atau melanggar aturan bisnis Fase D–H.
6. Tidak mengimplementasikan proses Pengajuan Perpanjangan, perubahan judul, maupun backend ISCP/TA dalam PRD ini; yang dibangun adalah **fondasi konfigurasinya**.

**Baseline yang sudah dilaporkan selesai:** master KP pada `sipkita_dev` berisi 1 tahap `KP`, 1 periode development `2026/2027 GANJIL` berstatus `AKTIF`, 1 jadwal `PENGAJUAN_REGULER`, 5 jenis dokumen dan 5 persyaratan KP. Backend Pengajuan KP Fase D–H telah lulus tes di PostgreSQL TEST. **Jangan menjalankan seed ulang, audit menyeluruh, atau menimpa master existing.**

## 2. Kontrak kewenangan dan batas multi-Prodi

| Pelaku | Hak pada modul ini |
| --- | --- |
| **Admin Prodi** | List/detail, membuat, mengubah, mengaktifkan/menonaktifkan konfigurasi sesuai kewenangannya. |
| Mahasiswa, Reviewer, Pembimbing, Kaprodi | **Baca** konfigurasi yang diperlukan proses/tampilannya melalui endpoint terotorisasi yang sesuai; **tidak boleh memutasi** master. |
| Admin Sistem | Tidak mendapat hak mutasi **melalui API konfigurasi Admin Prodi** hanya karena role `ADMIN_SISTEM`. Hak teknis internal yang sudah ada di luar scope tidak diubah. |

**Penting untuk agent:** dari audit sebelumnya `UserRole` tidak menyimpan `program_studi_id`; `PeriodeAkademik`, `TahapAkademik`, dan `JadwalProses` juga belum mempunyai FK Prodi. Karena itu, model existing **masih global**. MVP dapat menggunakan konteks **satu Prodi SI** yang sudah ada, dengan cek keterkaitan Admin Prodi yang **tidak ambigu** memakai pola auth/Data Diri yang sudah berlaku. Jangan mempercayai `program_studi_id` dari body untuk memperoleh wewenang. Bila tidak dapat membuktikan scope Admin Prodi atau database berkembang multi-Prodi, **fail closed** dan laporkan gap pemetaan scope/ownership; jangan membuka mutasi global lintas Prodi secara diam-diam. Perluasan multi-Prodi membutuhkan desain schema/otorisasi terpisah.

## 3. K1 — Manajemen Periode Akademik

**Model existing:** `PeriodeAkademik`: `tahun_ajaran`, `semester`, `tanggal_mulai`, `tanggal_selesai`, `status_periode` dan audit timestamp; unique `(tahun_ajaran, semester)` menurut schema snapshot. **Periksa schema aktual** sebelum query.

**Fungsi Admin Prodi:**

- Daftar/detail dengan filter tahun, semester, status, pagination; membuat periode baru dan mengubah data yang masih aman diedit.
- Mengaktifkan/nonaktifkan periode dengan validasi konflik; memperlihatkan periode berjalan/berikutnya dan keterkaitan jumlah jadwal/pengajuan.
- Menjaga record lama: tidak ada hard delete untuk periode yang sudah ditautkan oleh Jadwal, Persyaratan, atau Pengajuan.

**Aturan wajib:**

1. `tahun_ajaran` format konsisten `YYYY/YYYY` (misalnya `2026/2027`), `semester` memakai kode resmi existing (`GANJIL`/`GENAP`); keunikan kombinasi ditegakkan server dan unique DB.
2. `tanggal_mulai` wajib **tidak melewati** `tanggal_selesai`; tipe data `DATE` mengikuti schema, bukan timestamp aplikasi.
3. Status persisted existing memuat `DRAFT` (default schema) dan `AKTIF` (seed). Untuk penonaktifan, **usulan kode `NONAKTIF`**; agent harus mengunci satu konstanta/allowlist dan tidak menciptakan kode lain sembarangan. Jangan menganggap `SELESAI` atau `DITUTUP` sebagai status persisted tanpa keputusan baru.
4. Tidak boleh ada **dua periode aktif dengan rentang tanggal saling tumpang tindih** yang membuat pemilihan periode submit ambigu pada MVP satu Prodi. Aktivasi harus memeriksa konflik **di dalam transaksi**; boleh ada periode aktif tidak saling tumpang tindih.
5. Jika periode sudah mempunyai Pengajuan, jangan mengubah `tahun_ajaran`/`semester` dan batas kalendernya dengan operasi biasa; tawarkan penonaktifan atau mekanisme koreksi khusus yang kelak dirancang. Pengajuan lama tetap terikat periode asalnya.
6. Nonaktivasi periode mencegah **pengajuan baru** yang membutuhkan periode aktif; tidak membatalkan Pengajuan atau penugasan yang sudah tercatat.

## 4. K2 — Manajemen Jadwal Proses (Reguler dan Perpanjangan)

**Model existing:** `JadwalProses` dengan `(periode_akademik_id, tahap_akademik_id, jenis_proses)` **unik**, `tanggal_buka`, `tanggal_tutup`, `is_aktif`, `keterangan`, `dibuat_oleh_user_id`. FK pembuat berasal dari **Admin Prodi login** pada endpoint baru (bukan fixture `DEV_SYS_ADMIN`).

**Kode jenis proses yang disepakati untuk modul konfigurasi:**

| Kode | Makna | Proses aplikasi |
| --- | --- | --- |
| `PENGAJUAN_REGULER` | Jadwal pengajuan baru/lanjut secara reguler | Backend KP Fase D sudah menggunakannya; ISCP/TA menyusul. |
| `PENGAJUAN_PERPANJANGAN` | Jadwal permohonan melanjutkan tahap yang belum selesai dari periode sebelumnya | Baru **konfigurasi jadwal**, endpoint Perpanjangan menyusul. |

**Pengajuan Ulang** mengikuti jadwal reguler terlebih dahulu karena jalur bisnisnya seperti pengajuan reguler. Jika kelak Prodi menentukan jendela khusus, tambahkan kode baru melalui keputusan bisnis; jangan mengarang `PENGAJUAN_ULANG` sekarang. Jadwal perubahan judul/seminar tidak otomatis menggunakan kode di atas.

**Operasi:** list/detail/filter periode, tahap, jenis proses, status; create, edit rentang, aktif/nonaktif, dan tampilkan status ketersediaan yang dihitung backend. Dalam satu periode, KP Reguler boleh aktif saat KP Perpanjangan nonaktif, atau sebaliknya; demikian pula ISCP/TA.

**Status turunan untuk UI, BUKAN field baru:**

- `BELUM_DIKONFIGURASI`: belum ada row jadwal untuk kombinasi target.
- `NONAKTIF`: jadwal, periode atau tahap tidak aktif.
- `BELUM_DIBUKA`: konfigurasi aktif tetapi waktu server sebelum `tanggal_buka`.
- `DIBUKA`: semua aktif dan `tanggal_buka <= sekarang <= tanggal_tutup`.
- `DITUTUP`: konfigurasi aktif tetapi rentang waktu sudah berakhir.

**Validasi wajib saat create/edit/aktifkan:**

1. Periode dan tahap FK ada; jenis proses berasal dari allowlist resmi; kombinasi unik tidak boleh duplikat.
2. Waktu buka harus **lebih awal** dari waktu tutup; gunakan zona aplikasi **Asia/Jakarta** dan uji boundary. Pengujian Fase B pernah menemukan pergeseran 7 jam saat penyimpanan tanggal melalui Prisma adapter: **uji roundtrip jam 00:00 dan 23:59 WIB**, jangan menyalin konstruksi Date yang pernah salah.
3. `is_aktif=true` **tidak berarti langsung dibuka**: status efektif juga bergantung periode/tahap aktif dan waktu server. Jadwal aktif masa depan boleh tetap `BELUM_DIBUKA`.
4. Perubahan jadwal tidak boleh menghapus atau mengubah submit historis; backend submit melakukan pengecekan **pada waktu request diterima**, bukan mempercayai badge UI lama.
5. Jangan menerapkan pembatasan tanggal di dalam periode secara membabi buta jika ada kebijakan perpanjangan pendaftaran. Jika jadwal di luar rentang periode menimbulkan ambiguitas, beri validasi/penjelasan terarah sesuai kebijakan Prodi, jangan diam-diam mengubah waktu.

**Perbedaan krusial:** *jadwal dibuka* ≠ *mahasiswa berhak mengajukan*. Misalnya jadwal ISCP dibuka, mahasiswa yang belum menyelesaikan KP tetap ditolak oleh service Pengajuan. Perpanjangan terbuka hanya untuk mahasiswa yang memenuhi prasyarat perpanjangan. **Perpanjangan tetap diperiksa/ACC oleh Kaprodi tanpa Reviewer dan tanpa Admin Prodi pemeriksa Perpanjangan**; hak Admin Prodi pada PRD ini hanya **mengelola jadwalnya**.

## 5. K3 — Kurikulum sebagai master informasi

**Keputusan:** kurikulum **belum** menentukan persyaratan pengajuan, mata kuliah, SKS minimum, maupun pemetaan Angkatan. Jangan membangun KRS, mata kuliah kurikulum, atau validasi KP berdasarkan kurikulum.

**Data minimal yang diusulkan:** `kode_kurikulum`, `nama_kurikulum`, `tahun_mulai_berlaku`, `keterangan?`, `is_aktif`, timestamp; kaitkan ke `ProgramStudi` jika diputuskan sebagai master per-Prodi dan schema mendukung. Contoh `KUR-2022 / Kurikulum 2022` **hanya ilustrasi**, bukan ketetapan kurikulum resmi UTY.

**Fungsi:** list/filter, tambah, edit, aktif/nonaktif; kode tidak boleh duplikat sesuai lingkup yang ditentukan, tidak ada hard delete record yang dipakai. Data dapat ditampilkan untuk informasi pada UI nantinya tetapi **tidak menjadi gate submit**.

**Catatan schema:** snapshot `schema.prisma` yang tersedia belum menampilkan model `Kurikulum`. Agent harus memeriksa schema repository **aktual sekali secara terarah**. Bila memang belum ada, lakukan **draft schema + migration paling minimal** melalui `prisma-schema-change`, **tanpa menerapkan migrasi ke `sipkita_dev` tanpa persetujuan khusus**. K1/K2 dapat dikerjakan lebih dahulu bila K3 membutuhkan persetujuan. Uji migrasi pada PostgreSQL TEST setelah izin yang sesuai.

## 6. K4 — Tahap Akademik (pengelolaan terbatas)

**Model:** `TahapAkademik`. Tahap inti **KP → ISCP → TA** tidak boleh diubah menjadi alur akademik lain melalui CRUD umum.

- Endpoint list/detail; metadata kode, nama, urutan, status, batas perpanjangan jika ada.
- Jika disediakan toggle `is_aktif`, wajib memberi peringatan dampak pada **semua jadwal dan opsi pengajuan** tahap itu; tolak tindakan yang dapat membuat pengajuan berjalan tidak konsisten.
- **Tidak boleh** membuat/menghapus tahap akademik baru atau mengubah `kode_tahap`/`urutan` melalui API MVP.
- Jangan mengisi `maks_perpanjangan` dengan angka asumsi; biarkan `null` sampai ada kebijakan resmi.

## 7. K5 — Jenis Dokumen dan Persyaratan Pengajuan

**Model:** `JenisDokumen` (`kode_jenis` unik, `kategori_dokumen`, `format_diizinkan`, `maks_ukuran_mb`, `is_aktif`) dan `PersyaratanPengajuan` (unik periode–tahap–jenis pengajuan–pilihan topik–jenis dokumen, wajib/opsional, penggunaan ulang, urutan, aktif).

**Operasi:** list/filter jenis dokumen kategori **`PENGAJUAN`**, create/edit/aktif, list dan konfigurasi persyaratan berdasarkan periode/tahap/jalur, serta informasi dokumen apa saja yang akan ditampilkan pada form mahasiswa. Jangan menggunakan endpoint ini untuk sembarang mengubah **enam dokumen `DATA_DIRI`** yang memiliki workflow verifikasi terpisah.

**Aturan pengaman:**

1. Lima dokumen KP yang telah dikonfigurasi tidak dibuat ulang. Proposal KP PDF maksimal **10 MB**, empat jenis dokumen KP lainnya **5 MB** sesuai master yang sudah ada; jangan hardcode aturan ukuran dalam UI.
2. `REGULER` + `BARU` KP sudah memiliki konfigurasi; untuk ISCP/TA atau `LANJUT`, buat konfigurasi hanya setelah jenis persyaratan dan data resmi disetujui.
3. SPP variabel KP `YA` mewajibkan bukti; `TIDAK` tidak. Sertifikat sosialisasi **ATAU** surat pengganti minimal satu. Schema persyaratan per-item **belum menyatakan grup alternatif/aturan kondisional secara deklaratif**; tetap tegakkan melalui service Pengajuan KP saat ini. **Jangan menawarkan editor kondisional generik seolah sudah didukung schema.**
4. Mengubah `is_wajib`, `is_aktif`, jenis dokumen atau kunci persyaratan **yang sudah digunakan dalam pengajuan** dapat mengubah validitas historis. Pada MVP **tolak perubahan substansial pada konfigurasi yang sudah dipakai**, dan arahkan pembuatan persyaratan periode baru. Perubahan petunjuk non-substansial dapat dipertimbangkan jika tidak mengubah sejarah.
5. Tidak ada hard delete jika sudah direferensikan. Pastikan satu kombinasi persyaratan unik dan kode jenis dokumen tidak berbenturan.

## 8. Rancangan endpoint REST — mendukung UI Admin Prodi

**Prefiks yang disarankan:** `/api/admin-prodi/konfigurasi`. Ikuti pola middleware/auth, respons, validasi, dan nama route aktual; **reuse endpoint yang sudah ada** bila ekuivalen, jangan menduplikasi kontrak lama.

| Modul | Method dan endpoint usulan | Perilaku |
| --- | --- | --- |
| K1 Periode | `GET /periode-akademik`, `GET /periode-akademik/:id` | Daftar/filter/pagination/detail. |
| K1 Periode | `POST /periode-akademik`, `PATCH /periode-akademik/:id` | Create/edit aman dengan unique/conflict guard. |
| K1 Periode | `POST /periode-akademik/:id/aktivasi`, `POST /periode-akademik/:id/nonaktivasi` | Status dengan pengecekan overlap dan keterkaitan Pengajuan. |
| K2 Jadwal | `GET /jadwal-proses`, `GET /jadwal-proses/:id` | Filter periode, tahap, jenis proses, status dan waktu WIB. |
| K2 Jadwal | `POST /jadwal-proses`, `PATCH /jadwal-proses/:id` | Create/edit konfigurasi Reguler/Perpanjangan. |
| K2 Jadwal | `POST /jadwal-proses/:id/aktivasi`, `POST /jadwal-proses/:id/nonaktivasi` | Toggle independen tiap jadwal. |
| K3 Kurikulum | `GET /kurikulum`, `GET /kurikulum/:id`, `POST /kurikulum`, `PATCH /kurikulum/:id` | CRUD tanpa hard delete, jika model tersedia/migrasi disetujui. |
| K3 Kurikulum | `POST /kurikulum/:id/aktivasi`, `POST /kurikulum/:id/nonaktivasi` | Status master informasi. |
| K4 Tahap | `GET /tahap-akademik`, `GET /tahap-akademik/:id` | Master inti read-only dan status. |
| K4 Tahap | `PATCH /tahap-akademik/:id/status` | **Opsional** toggle terbatas; jangan izinkan edit kode/urutan. |
| K5 Dokumen | `GET /jenis-dokumen`, `POST /jenis-dokumen`, `PATCH /jenis-dokumen/:id` | Kelola kategori PENGAJUAN dengan guard historis. |
| K5 Persyaratan | `GET /persyaratan-pengajuan`, `POST /persyaratan-pengajuan`, `PATCH /persyaratan-pengajuan/:id` | Konfigurasi per periode/tahap/jalur dan guard referensi. |

**Endpoint baca ketersediaan untuk client:** sediakan/extend satu kontrak GET seperti `/api/konfigurasi/akademik/ketersediaan?tahap=KP&jenis_proses=PENGAJUAN_REGULER` yang mengembalikan periode/jadwal relevan, `is_open`, `status_jadwal`, `tanggal_buka/tutup` dan pesan alasan. **Periksa dan manfaatkan endpoint opsi-form Pengajuan KP Fase D yang sudah ada**; jangan membuat dua sumber kebenaran. Endpoint baca dapat dipakai mahasiswa/Kaprodi sesuai role, tidak memberi izin mutasi. API submit harus tetap melakukan validasi sendiri.

### Contoh payload konfigurasi jadwal

```json
POST /api/admin-prodi/konfigurasi/jadwal-proses
{
  "periode_akademik_id": 1,
  "tahap_akademik_id": 1,
  "jenis_proses": "PENGAJUAN_PERPANJANGAN",
  "tanggal_buka": "2026-11-10T00:00:00+07:00",
  "tanggal_tutup": "2026-11-30T23:59:00+07:00",
  "is_aktif": false,
  "keterangan": "Contoh jadwal; tanggal resmi harus ditentukan Prodi"
}
```

Payload hanya **ilustrasi**, bukan instruksi langsung memasukkan tanggal perpanjangan tersebut ke database. `dibuat_oleh_user_id` diperoleh dari sesi dan **tidak** diterima dari body. Konstruksi waktu yang disimpan/ditampilkan harus diuji roundtrip Prisma/PostgreSQL (`Asia/Jakarta`).

### Contoh respons ketersediaan untuk UI

```json
{
  "tahap": "KP",
  "jenis_proses": "PENGAJUAN_PERPANJANGAN",
  "status_jadwal": "NONAKTIF",
  "is_open": false,
  "reason_code": "JADWAL_NONAKTIF",
  "message": "Pengajuan Perpanjangan KP belum dibuka."
}
```

Status di atas **status tampilan hasil kalkulasi**, bukan enum/kolom baru. Penolakan karena jadwal berbeda dari penolakan **kelayakan mahasiswa** yang ditentukan service proses pengajuan.

## 9. Struktur teknis, transaksi, dan integrasi existing

Gunakan **route → controller → service → Prisma → PostgreSQL** sesuai modul D–H. Route/middleware: auth dan role `ADMIN_PRODI`; controller: parsing, allowlist, pagination dan respons; service: scope Prodi, guard histori, validasi waktu/overlap, pemilihan aktif, transaksi serta audit.

**Komponen logis yang dianjurkan:** satu modul `konfigurasi-akademik` dengan service/helper terpisah **hanya bila perlu**, seperti `periode-akademik`, `jadwal-proses`, `kurikulum`, `persyaratan`. Gunakan konstanta bersama `JENIS_PROSES` dan `STATUS_PERIODE` di server; jangan menyebarkan kode `String` dalam banyak controller. Jangan membuat model baru untuk periode/jadwal yang sudah tersedia.

**Integrasi yang wajib konsisten:**

1. **Pengajuan KP D:** saat membuka formulir dan submit tetap mengecek periode aktif, tahap aktif dan jadwal `PENGAJUAN_REGULER` terhadap waktu server. Perubahan konfigurasi dari Admin Prodi berlaku untuk **pengajuan baru**, bukan menulis ulang record Pengajuan historis.
2. **Perpanjangan masa depan:** memeriksa jadwal **`PENGAJUAN_PERPANJANGAN`** secara independen dan setelah itu validasi prasyarat mahasiswa; tidak melalui Reviewer, ACC Kaprodi. Tidak perlu membangun endpoint transaksi Perpanjangan sekarang.
3. **Dokumen/persyaratan:** form berasal dari konfigurasi aktif tetapi riwayat dokumen/hasil validasi yang sudah terjadi tidak boleh berubah diam-diam akibat edit master. Lindungi record konfigurasi yang sedang dipakai.
4. **Kurikulum:** tidak memodifikasi `Mahasiswa`, `Pengajuan`, `PeriodeAkademik`, maupun rule akademik untuk saat ini.
5. **Otorisasi dan audit:** gunakan user login untuk pembuat/pengubah, sesuai field yang benar-benar tersedia; jika model tak punya kolom `updated_by`, jangan mengarang. Manfaatkan `AuditLog` existing hanya bila polanya sudah diimplementasikan.
6. **Concurrency:** aktivasi periode dan pembuatan jadwal harus aman dari dua request paralel. Gunakan transaksi/unique constraint yang ada, penolakan `409` saat konflik; tidak cukup memeriksa `findFirst` di luar transaksi.

**Keamanan operasional:** ID Prodi tidak boleh diambil mentah dari payload. Jika role Admin Prodi tidak terikat ke Prodi dalam model existing, gunakan pola scope yang terbukti dari kode Data Diri untuk MVP satu Prodi, atau laporkan blocker yang spesifik. Validasi `is_aktif`/tanggal di server selalu, meskipun UI sudah menyembunyikan tombol.

## 10. Tahapan pengerjaan yang efisien untuk Codex

Satu PRD, satu sesi pengerjaan bertahap, **tanpa rangkaian audit berulang**:

1. **Orientasi singkat read-only:** cek versi schema/route aktual **hanya model terkait**, `ADMIN_PRODI` scope, status periode, dan keberadaan model Kurikulum. Jangan audit ulang D–H atau seeder.
2. **K1 Periode**: implementasi endpoint + guard + tes terarah.
3. **K2 Jadwal**: implementasi Reguler/Perpanjangan, status turunan, roundtrip WIB, dan reuse availability logic Pengajuan KP tanpa breaking change.
4. **K3 Kurikulum**: jika model sudah ada, implementasi CRUD; jika **belum ada**, siapkan rancangan schema/migration minimal, **berhenti sebelum migrasi tanpa izin**. K1/K2 tetap bisa selesai lebih dahulu.
5. **K4 Tahap**: read-only/guard toggle; tidak mengubah kode atau urutan tahap.
6. **K5 Dokumen/Persyaratan**: pengelolaan aman dan lock konfigurasi yang sudah digunakan; tidak membuat editor syarat kondisional generik.
7. **Tes integrasi/validasi** yang relevan; perbaiki error yang timbul dalam scope, laporan ringkas.

Prioritaskan **K1/K2** untuk membuka jalan frontend Pengajuan KP; **K3** master informasi; **K4/K5** pengelolaan terbatas. Jika gap schema kurikulum perlu keputusan terpisah, jangan menahan perbaikan/tes modul lain.

## 11. Acceptance criteria dan kasus uji

- `ADMIN_PRODI` yang sah dapat CRUD/toggle sesuai modul; Mahasiswa/Reviewer/Kaprodi/Admin Sistem **tidak** dapat mengubah melalui endpoint ini; multi-Prodi ambigu ditolak.
- Periode: kombinasi tahun+semester unik, rentang valid, aktivasi tumpang tindih ditolak, edit kunci periode yang sudah dipakai tidak merusak pengajuan.
- Jadwal: KP Reguler bisa `DIBUKA` ketika KP Perpanjangan `NONAKTIF` dalam periode sama; ISCP/TA independen.
- Periode/tahap/jadwal nonaktif serta waktu sebelum/sesudah jadwal menghasilkan status ketersediaan dan `is_open=false` yang benar.
- Perbandingan batas `tanggal_buka`/`tanggal_tutup` dan penyimpanan/tampilan `Asia/Jakarta` tidak bergeser 7 jam.
- Jadwal yang diubah setelah ada Pengajuan tidak menghapus atau mengubah `Pengajuan`/versi dokumen/hasil review lama.
- Dua request paralel tidak menghasilkan periode aktif bertabrakan atau duplikasi jadwal untuk unique key sama.
- Kurikulum (jika sudah dapat diterapkan aman) hanya sebagai informasi; perubahan kurikulum tidak memblokir/menyetujui Pengajuan.
- Tahap: kode dan urutan KP→ISCP→TA tidak dapat diubah sembarangan melalui API.
- Dokumen: 5 jenis dan 5 persyaratan KP existing tetap, 6 Data Diri tidak tersentuh, pengaturan kondisional/alternatif tetap ditegakkan oleh service Pengajuan KP; edit persyaratan terpakai ditolak.
- Regresi minimal: buka opsi-form Pengajuan KP dan validasi submit berdasarkan jadwal **tetap benar** setelah endpoint konfigurasi ditambahkan.
- Test mutatif hanya pada **PostgreSQL TEST terisolasi**; suite server/Prisma validation/diff check sesuai script aktual. Laporkan `PASS/FAIL/SKIP`, bukan klaim tanpa bukti.

## 12. Batas perubahan dan prioritas referensi

**Dalam scope:** konfigurasi backend K1–K5 dengan batas di atas, migrasi **draft** Kurikulum jika dibutuhkan, endpoint baca untuk UI, tes terarah.

**Di luar scope:** frontend, Scalar/OpenAPI, dashboard statistik kompleks, KRS/mata kuliah/aturan angkatan kurikulum, implementasi transaksi Perpanjangan, bimbingan, modul ISCP/TA, perubahan judul, revisi aturan E–H, migrasi otomatis pada `sipkita_dev`, penghapusan data, refaktor global.

**Otorisasi database:** tidak menjalankan `prisma db push`, `migrate reset`, drop, seed global, ataupun menerapkan migrasi pada `sipkita_dev` tanpa persetujuan khusus. Preserve dirty worktree, arsip migrasi existing dan master 13 record. Tidak perlu dump/restore berkali-kali jika PostgreSQL TEST yang sah sudah tersedia.

**Prioritas keputusan:** (1) PRD ini untuk **aturan bisnis baru**, (2) `AGENTS.md` untuk instruksi repo, (3) `schema.prisma` **aktual** untuk field/relasi, (4) modul D–H existing sebagai kontrak yang tidak boleh rusak, (5) dokumen bisnis lama hanya pendukung. Jika `docs/roles-permissions.md` masih menyatakan Admin Sistem mengelola master atau Admin Prodi tidak mengelola konfigurasi, **keputusan terbaru pengguna dalam PRD ini yang berlaku**. Jika gap teknis tidak dapat diselesaikan tanpa perubahan struktur, sebutkan bukti dan berhenti hanya pada bagian yang membutuhkan izin baru.

## 13. Skill dan file acuan untuk agent

**Baca yang relevan saja (cek path aktual dengan `rg --files`):**

1. `AGENTS.md` dan `.agents/skills/domain-modeling/SKILL.md` — aktor, aturan jadwal, proses, status dan dampak histori.
2. `.agents/skills/feature-implementation/SKILL.md` — vertikal backend route/controller/service; `.agents/skills/code-change-verification/SKILL.md` — tes terarah/regresi.
3. `.agents/skills/prisma-schema-change/SKILL.md` **hanya bila model Kurikulum benar-benar belum ada dan dibutuhkan**, dengan izin migrasi terpisah.
4. `docs/database.md`, `docs/roles-permissions.md`, `docs/api-conventions.md`, `docs/architecture.md`; dokumen bisnis Perpanjangan **hanya** untuk arti proses dan aktor, bukan mengimplementasikan endpoint Perpanjangan.
5. `server/prisma/schema.prisma` dan service/route existing Pengajuan KP Fase D–H, terutama pengecekan ketersediaan periode/jadwal serta pola otorisasi Admin Prodi di Data Diri. Jangan membaca ulang seluruh repo.