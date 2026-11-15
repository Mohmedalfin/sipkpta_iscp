# Status Proyek SIPKITA — Handoff dan Roadmap Implementasi

> **Snapshot terakhir disusun:** **1 November 2026 (WIB)**. Dokumen ini adalah catatan status dan *handoff* untuk Codex, bukan bukti bahwa fitur sudah berjalan di server. **Perbarui setelah setiap tugas implementasi yang benar-benar diverifikasi.**

> **Batas observasi:** dokumen ini didasarkan pada keputusan percakapan, log development yang pernah dibagikan pengguna, dan salinan `schema.prisma` revisi 29 Oktober 2026. **Repository Windows pengguna, database yang sedang berjalan, dan endpoint aktual tidak diaudit langsung dalam penyusunan snapshot ini.** Jangan menyatakan fitur berhasil hanya karena tabel/diagram/dokumennya ada.

**Dokumen rujukan:** `AGENTS.md`, `docs/architecture.md`, `docs/database.md`, `docs/api-conventions.md`, `docs/coding-standards.md`, `docs/academic-lifecycle.md`, `docs/roles-permissions.md`, `docs/glossary.md`, serta `docs/business-rules/` yang terkait fitur.

## 1. Identitas dan ruang lingkup proyek

| Item | Status/keputusan saat ini |
| --- | --- |
| Nama | **SIPKITA — Sistem Informasi Pengelolaan Kerja Praktik, ISCP, dan Tugas Akhir**. |
| Konteks | Proyek ISCP mahasiswa Program Studi Sistem Informasi, dilanjutkan sebagai pengembangan TA. |
| Tujuan | Satu aplikasi web untuk mengelola proses akademik **KP → ISCP → TA**. |
| Pengguna | Mahasiswa, Dosen Reviewer, Dosen Pembimbing, Admin Prodi, Kaprodi, Admin Sistem. |
| Tahap saat ini | **Semester ISCP** — pembangunan fondasi dan modul pengajuan/review sebagai prioritas. |
| Integrasi eksternal | **Belum ada integrasi dengan SIKADU**; data mahasiswa/dosen melalui proses manual/impor sesuai kewenangan. |
| Model implementasi | **Monorepo npm workspaces**, React/Vite/Tailwind (`client/`) + Express/Prisma/PostgreSQL (`server/`). |
| Prinsip arsitektur | **route → controller → service → Prisma → PostgreSQL**, dengan React UI/API terpisah. |

**Penting:** tahap KP, ISCP, dan TA dapat berjalan **bersamaan pada periode akademik yang sama** untuk mahasiswa berbeda. Status tahap tidak ditentukan hanya dari semester mahasiswa, tetapi dari histori `Pengajuan`, periode, tahap, dan penyelesaian.

## 2. Cara membaca status pekerjaan

Gunakan label berikut **secara konsisten** agar Codex tidak mencampur rancangan dengan fitur yang sudah jadi.

| Label | Definisi dan bukti minimum |
| --- | --- |
| **TERKONFIRMASI-SEBELUMNYA** | Pernah ada output/log atau konfirmasi eksplisit pengguna pada tanggal tertentu, tetapi **belum diuji ulang sekarang**. |
| **RANCANGAN-SELESAI** | Diagram, dokumentasi, atau schema rujukan sudah dibuat/dibahas; **belum sama dengan implementasi**. |
| **IMPLEMENTED-UNVERIFIED** | Kode dinyatakan ada atau terlihat, tetapi perilaku belum diverifikasi dengan test/run aktual. |
| **IMPLEMENTED-VERIFIED** | Implementasi disertai bukti eksekusi/test relevan, tanggal, lingkungan, dan hasil yang jelas. |
| **PLANNED** | Masuk roadmap tetapi belum ada bukti implementasi yang dikonfirmasi. |
| **DECISION-PENDING** | Aturan bisnis/desain masih memerlukan keputusan sebelum implementasi bagian terkait. |
| **BLOCKED** | Ada hambatan konkret yang menghentikan pekerjaan, termasuk izin, akses, dependensi, atau keputusan yang wajib. |

**Tidak ada modul akademik lengkap yang diberi label `IMPLEMENTED-VERIFIED` pada snapshot ini**, karena bukti pengujian end-to-end modul belum tersedia. Jika pengguna telah mengerjakan modul setelah snapshot, cek repo/test dan **perbarui status**, jangan memaksa tetap `PLANNED`.

## 3. Kondisi teknis terakhir yang diketahui

| Aspek | Status | Bukti atau batas kepastian |
| --- | --- | --- |
| **Bootstrap monorepo** | **TERVERIFIKASI-STRUKTUR** | Root memakai npm workspaces untuk `client` dan `server`; script aktual telah diinventaris. Tidak ada script lint/test/format pada snapshot audit. |
| **Express server** | **IMPLEMENTED-VERIFIED (health only)** | Runtime lokal diuji: `/api/health` dan `/api/health/db` memberi 200; 404, malformed JSON 400, serta CORS origin yang diizinkan juga diperiksa. Route akademik belum ada. |
| **Vite frontend** | **SOURCE-ONLY / BELUM TERVERIFIKASI** | Source React/Vite tersedia, tetapi build dan browser flow belum diuji pada audit ini. |
| **PostgreSQL dasar** | **TERVERIFIKASI READ-ONLY** | Koneksi development diperiksa tanpa menampilkan rahasia; database memuat 38 tabel bisnis, 38 primary key, 82 foreign key, dan 4 indeks unik parsial. |
| **Prisma schema** | **VALIDATED** | `server/prisma/schema.prisma` memuat **38 model** dan lolos `npx prisma validate` dengan Prisma 7.10.0. |
| **Migrasi database** | **APPLIED-VERIFIED** | Tiga migrasi sampai `20261102000000_auth_session_active_role` diterapkan pada `sipkita_dev`; `prisma migrate status` menyatakan database up to date. Migrasi Fase 3 menambah dua kolom, satu indeks, dan satu FK tanpa mengubah data existing. |
| **Prisma ORM/config** | **TERVERIFIKASI** | Prisma dan `@prisma/client` 7.10.0, PostgreSQL, `prisma.config.ts`, serta fitur `partialIndexes` tersedia. |
| **Health API/Postman** | **BUKTI HISTORIS; TIDAK TERSEDIA DI WORKTREE SAAT INI** | Endpoint health pernah diuji, tetapi route/controller health kini berstatus terhapus dari perubahan lokal sebelum implementasi auth ini. Jangan mengklaim health masih berjalan tanpa pemulihan dan uji ulang. |
| **Autentikasi dan modul akademik** | **AUTH BACKEND FASE 4 IMPLEMENTED-VERIFIED (SMTP/PRISMA MOCK)** | Login, refresh, logout, role aktif, serta forgot/reset password tersedia. Fase 4 lulus tes HTTP dengan SMTP mock dan Prisma fake terisolasi; pengiriman Gmail nyata serta integrasi PostgreSQL Fase 4 belum diuji. Frontend dan modul akademik belum terverifikasi. |

**Cara memulai sesi ngoding berikutnya:** cek `package.json` root/client/server, struktur `src/`, `.env` **tanpa mencetak nilainya**, konfigurasi Prisma, migrasi, daftar endpoint aktual, lalu lakukan pengecekan aman sesuai perintah npm yang benar-benar tersedia. Jalankan server/client hanya jika relevan dan lingkungan siap. Jangan langsung melakukan migrasi/reset/seed besar.

**Risiko audit Prisma:** `prisma migrate diff --from-config-datasource --to-schema --exit-code` masih mendeteksi perubahan drop/add pada `uq_pembimbing_aktif` dan `uq_seminar_terjadwal`, walaupun indeks kolom-kondisi yang sama terlihat pada database. Indikasinya adalah perbedaan representasi predicate introspection (`::text`), bukan bukti indeks hilang. Jangan mengedit schema atau migrasi terapan untuk menutup diff tanpa analisis dan persetujuan.

**Keputusan bisnis yang sudah final:** seluruh pengajuan reguler KP/ISCP/TA, termasuk `LANJUT`, wajib proposal terbaru dan review; seluruh Reviewer aktif yang ditugaskan wajib `LAYAK` pada proposal terbaru tanpa menghasilkan ACC otomatis. Setiap permohonan melanjutkan atau mengulang tahap pada semester berikutnya adalah perpanjangan—tidak ada proses pengajuan ulang terpisah. Perpanjangan pertama boleh topik lama/baru, perpanjangan kedua dan seterusnya wajib topik/judul/proposal baru, dan semua perpanjangan diperiksa langsung oleh Kaprodi tanpa Reviewer atau Admin Prodi. Riwayat pengajuan lama tetap dipertahankan.

## 4. Aset rancangan dan dokumentasi yang telah dibuat

### 4.1 Rancangan domain dan database

- **Use case** telah dibahas per aktor: Mahasiswa, Reviewer, Pembimbing, Admin Prodi, Kaprodi, Admin Sistem.
- **Activity diagram** telah dibahas untuk pengajuan KP/ISCP/TA, bimbingan offline/online, perubahan judul, perpanjangan, ACC tahap, serta melengkapi/verifikasi data diri.
- Aliran data proses utama telah dibedah dari login, data diri, pengajuan dan pemeriksaan, review, ACC pengajuan, penentuan Pembimbing, hingga penyelesaian/transisi tahap.
- Schema rujukan memiliki **38 model** (A–E), termasuk `Pengajuan`, konfigurasi persyaratan dokumen, versioning topik dan file, penugasan dosen, review, bimbingan, perubahan judul, seminar, dan notifikasi.

**Status semuanya:** **RANCANGAN-SELESAI**. Belum berarti API, UI, transaksi, ataupun test-nya sudah dibuat.

### 4.2 Peta berkas konteks Codex

Daftar di bawah adalah **paket berkas `.md` yang sudah disusun dalam rangkaian dokumentasi kita**. **Periksa keberadaannya di repository pengguna; pembuatan file unduhan tidak otomatis menempatkannya di project Windows.**

| Lokasi target di repo | Fungsi | Kondisi dokumentasi |
| --- | --- | --- |
| `AGENTS.md` | Aturan umum agent, prioritas, teknologi, hak akses, dan scope. | Disusun. |
| `.agents/skills/domain-modeling/SKILL.md` | Membedah domain dan aliran data sebelum coding. | Disusun. |
| `.agents/skills/prisma-schema-change/SKILL.md` | Review/perubahan schema serta migration aman jika diminta. | Disusun. |
| `.agents/skills/feature-implementation/SKILL.md` | Menyelesaikan fitur sesuai vertical slice. | Disusun. |
| `.agents/skills/code-change-verification/SKILL.md` | Memeriksa diff, tes, dan regresi setelah coding. | Disusun. |
| `docs/glossary.md` | Definisi istilah domain. | Disusun. |
| `docs/academic-lifecycle.md` | KP → ISCP → TA, prasyarat dan histori semester. | Disusun. |
| `docs/roles-permissions.md` | Aktor dan batas kewenangan. | Disusun. |
| `docs/business-rules/index.md` | Indeks aturan lintas proses dan keputusan terbuka. | Disusun. |
| `docs/business-rules/pengajuan.md` | Form, syarat dinamis, pemeriksaan, jalur baru/lanjut. | Disusun. |
| `docs/business-rules/review-proposal.md` | Reviewer, putaran review, revisi dan hasil. | Disusun. |
| `docs/business-rules/bimbingan.md` | Offline/online, revisi, validasi, dan riwayat. | Disusun. |
| `docs/business-rules/penyelesaian-tahap.md` | ACC penyelesaian dan kelayakan lanjut. | Disusun. |
| `docs/business-rules/perpanjangan-pengajuan-ulang.md` | Proses perpanjangan semester berikutnya; nama file dipertahankan sebagai path historis, tetapi tidak ada proses pengajuan ulang terpisah. | Disusun. |
| `docs/business-rules/perubahan-judul.md` | Proposal wajib, ACC Pembimbing → Kaprodi. | Disusun. |
| `docs/business-rules/seminar.md` | Jadwal dan notifikasi minimal. | Disusun; **PROVISIONAL**. |
| `docs/database.md` | Peta 38 model, relasi, constraint, dan aliran data. | Disusun. |
| `docs/architecture.md` | Monorepo, lapisan aplikasi, keamanan dan transaksi. | Disusun. |
| `docs/api-conventions.md` | Konvensi REST, respons, validasi, error, upload. | Disusun sebagai konvensi endpoint baru. |
| `docs/coding-standards.md` | Naming, Prettier/ESLint, clean code, testing. | Disusun; detail formatter mengikuti config repo. |
| **`docs/project-status.md`** | **Snapshot status, prioritas, dan handoff**. | **Dokumen ini**. |

**Ringkasan:** 16 dokumen pada `docs/` (termasuk ini), ditambah **1 `AGENTS.md` dan 4 skill operasional**. Keberadaan folder `.agents/skills/` dan berkasnya di repo **harus dicek setelah penyalinan**.

## 5. Status fungsional menurut modul

| Modul/fitur | Status pada snapshot | Prioritas berikutnya |
| --- | --- | --- |
| Login/logout, forgot/reset password, identitas akun, role dan mode dosen | **Backend Fase 4 IMPLEMENTED-VERIFIED (SMTP/PRISMA MOCK):** role aktif per sesi, refresh/logout, token reset sekali pakai, reset atomik, serta pencabutan seluruh sesi telah diuji otomatis. Gmail nyata dan integrasi PostgreSQL Fase 4 belum diuji. | Uji satu email Gmail hanya ke penerima uji yang disetujui; integrasi frontend tetap task terpisah. |
| Master data mahasiswa/dosen/prodi, import/manual, semester, jadwal proses | **Master/seed minimum terverifikasi** (`IMPLEMENTED-VERIFIED` untuk fixture prodi, 6 role, 8 akun, mahasiswa, dosen); API/UI belum. | Pendukung wajib sesuai kebutuhan. |
| Form data diri dan upload dokumen identitas | **Schema/rancangan tersedia**, implementasi belum terverifikasi. | **Wajib**. |
| Verifikasi data diri per dokumen / per mahasiswa | **Aturan dan schema dirancang**, implementasi belum terverifikasi. | **Wajib**. |
| Konfigurasi `JenisDokumen` + `PersyaratanPengajuan` | **Schema/rancangan tersedia**, pengelolaan admin belum terverifikasi. | **Wajib** sebagai prasyarat pengajuan. |
| Pengajuan KP awal dan dokumen | **Aliran/diagram dirancang**, endpoint/form belum terverifikasi. | **Wajib** — dasar engine pengajuan bersama. |
| Pengajuan ISCP dan TA, `BARU`/`LANJUT` | **Aliran/diagram dirancang**, endpoint/form belum terverifikasi. | **Wajib** setelah pola KP stabil. |
| Pemeriksaan administrasi/akademik pengajuan | Administrasi pengajuan reguler/awal ditetapkan untuk Admin Prodi; ACC akhir Kaprodi; pemeriksa akademik masih terbuka. Perpanjangan diperiksa Kaprodi. Implementasi belum ada. | **Wajib**, kunci pemeriksa akademik sebelum coding bagian itu. |
| Penugasan satu/lebih Reviewer | **Schema mendukung**, API/UI belum terverifikasi. | **Wajib** untuk jalur yang memerlukan review. |
| Review, revisi, hasil/lembar review proposal | **Schema/rancangan tersedia**, belum terverifikasi end-to-end. | **Wajib** sesuai jalur yang disahkan. |
| ACC akhir pengajuan oleh Kaprodi | **Aturan dirancang**, endpoint/transaksi belum terverifikasi. | **Wajib**. |
| Penentuan/pewarisan Pembimbing | **Schema mendukung satu Pembimbing aktif**, API/UI belum terverifikasi. | **Wajib**. |
| Verifikasi massal dokumen / penugasan Pembimbing secara batch | **Ide UI/operasi sudah dibahas**, tidak terverifikasi di kode. | Opsional bila mempercepat proses inti dan scope disetujui. |
| Bimbingan offline/online | **Aturan/schema dirancang**, endpoint/UI belum terverifikasi. | **Opsional semester ini**, dapat dilanjutkan semester berikutnya. |
| ACC penyelesaian tahap dan syarat lulus tambahan | **Aturan/schema dasar tersedia**, bukti dokumen lulus tambahan belum terstruktur. | Semester berikutnya, kecuali diminta lebih awal. |
| Perubahan judul | **Aturan/schema dirancang**, belum terverifikasi. | Semester berikutnya. |
| Perpanjangan | **Aturan/schema dirancang**, belum terverifikasi. Proses ini juga mencakup kondisi mahasiswa harus mengulang tahap pada semester berikutnya. | Semester berikutnya. |
| Seminar/notifikasi/logbook lengkap | **Schema sebagian tersedia, konsep seminar PROVISIONAL**. | Tunggu mekanisme final semester berikutnya. |

**Perhatian:** modul CRUD/auth pada **proyek latihan Express/Prisma/MySQL terpisah** milik pengguna **tidak boleh dicatat sebagai implementasi SIPKITA**. Pastikan nama repo, database, dan script sebelum mengambil bukti kemajuan.

## 6. Prioritas implementasi semester ISCP — urutan kerja yang disarankan

Urutan dapat disesuaikan dengan hasil bimbingan, tetapi **fitur wajib semester ini tetap menjadi fokus**. Setiap langkah dipecah menjadi task kecil dengan tes, bukan satu prompt “bangun seluruh sistem”.

| Urutan | Vertical slice / deliverable | Syarat minimal selesai |
| --- | --- | --- |
| **0** | **Audit repo dan database aktual**: script, struktur source, env tanpa mencetak secret, koneksi, Prisma schema/migration, health. | Ada output pengecekan terkini dan daftar gap setup. |
| **1** | **Master/seed minimum**: role, prodi, tahap, periode, akun uji resmi, dosen/mahasiswa dan konfigurasi yang dibutuhkan. | Data uji valid/aman; seeding idempotent bila dibuat; tidak mencampur data nyata. |
| **2** | **Auth, akun, role, mode dosen**. | Login/izin dasar teruji termasuk user tanpa role yang benar dan dosen multi-role. |
| **3** | **Data diri + upload berkas + verifikasi admin**. | Mahasiswa submit; admin berwenang memeriksa; revisi satu berkas mempertahankan histori berkas lain. |
| **4** | **Konfigurasi pengajuan** per periode/tahap/jenis/jalur dan daftar syarat dinamis. | Form API dapat menentukan syarat berbeda KP/ISCP/TA tanpa hardcode. |
| **5** | **Pengajuan KP** dari draft → submit → pemeriksaan awal. | Request, validasi status, ownership, dokumen, dan histori berfungsi. |
| **6** | **Penugasan Reviewer + review/revisi proposal**. | Reviewer hanya melihat tugasnya, histori review per versi valid, hasil tersimpan. |
| **7** | **ACC akhir pengajuan + penetapan Pembimbing**. | Prasyarat review/admin dicek; Kaprodi berwenang; tepat satu Pembimbing aktif. |
| **8** | **Perluasan engine pengajuan ISCP/TA** untuk `BARU`/`LANJUT`. | Referensi KP/ISCP, prefill topik, dokumen khusus TA, pemeriksaan jalur sesuai keputusan. |
| **9** | **Penyempurnaan UI dan regression tests** antarrole/modul. | Satu alur end-to-end KP/ISCP/TA yang disepakati dapat didemokan lokal. |
| **10 — bila sempat** | **Bimbingan offline/online** atau efisiensi batch yang paling relevan. | Hanya jika pengguna menyatakan scope dan modul wajib cukup stabil. |

**Pilihan urutan implementasi:** tim dapat mengerjakan konfigurasi, auth, dan pengajuan secara bertahap/iteratif; tabel ini **bukan ketergantungan teknis kaku untuk semua task**. Jika ada fitur minimum yang dibutuhkan untuk menyelesaikan alur sebelumnya, kerjakan sebagai bagian slice terkait.

## 7. Modul semester berikutnya — dipertahankan, tidak dibangun otomatis

1. Penyempurnaan seluruh alur bimbingan dan validasi Pembimbing.
2. ACC penyelesaian KP/ISCP/TA, syarat tambahan yang mungkin melibatkan sertifikat/berkas kelulusan, serta kelayakan lanjut tahap.
3. Perubahan judul melalui **Mahasiswa → Dosen Pembimbing ACC/Tolak → Kaprodi ACC/Tolak**, dengan proposal baru wajib dan histori `VersiTopik`.
4. Perpanjangan pada **semester berikutnya**, termasuk kondisi mengulang tahap, dengan histori percobaan sebelumnya tetap dipertahankan dan keputusan berada pada Kaprodi.
5. Mekanisme seminar lengkap (jadwal, kemungkinan penguji/peserta/hasil/ruangan) **setelah keputusan final**; `seminar.md` masih provisional.
6. Penyempurnaan template/logbook, notifikasi, laporan, operasional, serta fitur tambahan lain yang disetujui.

**Jangan mengembangkan modul semester berikutnya hanya karena schema sudah mempunyai modelnya.** Model DB menyimpan potensi alur; belum menjamin workflow dan business rule final.

## 8. Keputusan dan risiko yang masih perlu dikunci

| ID | Topik | Kondisi saat ini | Langkah saat fitur terkait dikerjakan |
| --- | --- | --- | --- |
| **OPEN-02** | Pemeriksaan kelayakan akademik | Admin Prodi memeriksa administrasi pengajuan reguler/awal; Kaprodi menetapkan Reviewer dan memberi keputusan akhir. Perpanjangan diperiksa Kaprodi. | Tentukan pelaku, data, bukti audit, dan transisi pemeriksaan akademik pengajuan reguler. |
| **OPEN-04** | Kode status dan transisi | Banyak field Prisma `String` dan default tidak mencakup state machine final. | Tetapkan konstanta dan transisi legal sebelum aksi perubahan status. |
| **OPEN-05** | Kelayakan dan batas perpanjangan | Pengajuan ulang bukan proses terpisah; semua permohonan mengulang tahap pada semester berikutnya diproses sebagai perpanjangan. Kebutuhan topik/proposal dan ketiadaan Reviewer sudah final. | Tetapkan kondisi formal serta nilai batas per tahap sebelum implementasi. |
| **OPEN-06** | Persyaratan dokumen kelulusan tambahan | `AturanPenyelesaianTahap.keterangan_syarat_lain` hanya teks; bukti sertifikat dan verifikasinya belum terstruktur. | Analisis kebutuhan tabel/relasi baru dan migrasi saat diminta. |
| **OPEN-07** | Mekanisme seminar | Hanya jadwal/informasi minimal yang disepakati; mungkin berubah signifikan. | Tunda desain penguji, penilaian, dan hasil hingga konsep final. |
| **OPEN-08** | Session/token, file storage dan notifikasi eksternal | Konfigurasi detail final belum dibuktikan dari repo. | Ikuti implementasi aktual atau minta pilihan pengguna sebelum integrasi baru. |
| **OPEN-09** | Hak akses lintas prodi dan master import | `UserRole` tidak otomatis membatasi cakupan prodi; master import/manual perlu pembagian kewenangan yang sah. | Kunci scope Admin/Kaprodi dan gunakan cek server-side. |
| **OPEN-10** | Representasi indeks parsial Prisma | Database memiliki empat indeks parsial, tetapi `prisma migrate diff` masih melaporkan drop/add untuk dua indeks dengan predicate yang terintrospeksi memakai cast `::text`. | Jangan ubah schema/migrasi terapan; telusuri kompatibilitas Prisma/representasi SQL sebelum perubahan database berikutnya. |

**Prinsip blocker:** jika pilihan yang belum final memengaruhi struktur tabel, hak keputusan, validasi wajib, atau makna ACC, **berhenti di bagian terkait dan minta keputusan**. Pekerjaan lain yang independen boleh dilanjutkan.

## 9. Aturan untuk memulai task Codex berikutnya

### Urutan membaca dokumentasi (progressive disclosure)

1. Baca `AGENTS.md` dan **`docs/project-status.md`** untuk memahami scope/status terakhir.
2. Baca `docs/business-rules/index.md`, lalu **satu atau dua business rule** yang benar-benar relevan dengan task.
3. Jika memakai data: baca `docs/database.md` dan **schema Prisma aktual**; jika membuat endpoint: `docs/architecture.md` serta `docs/api-conventions.md`.
4. Baca `docs/roles-permissions.md` untuk fitur yang memproses role/ownership/penugasan, serta `docs/coding-standards.md` ketika menulis kode.
5. Gunakan **skill spesifik** sesuai tujuan: `domain-modeling` untuk membedah alur, `prisma-schema-change` untuk permintaan schema/migration, `feature-implementation` untuk coding, dan `code-change-verification` untuk pengujian.
6. Jangan memuat seluruh dokumen besar tanpa kebutuhan; pastikan keputusan dan kode terbaru tidak bertentangan.

### Kontrak kerja setiap permintaan implementasi

Sebelum edit: nyatakan **aktor, use case, scope, prasyarat, output, tabel, status, dan test minimum**. Setelah edit: berikan **hasil nyata**, bukan hanya rencana.

- Pilih **satu vertical slice** yang bisa diverifikasi.
- Ikuti file/lapisan aktual; jangan membuat folder atau abstraction generik hanya karena ada contoh di dokumen.
- Jaga input validation, authorization **role + ownership + assignment + status**, dan transaksi untuk multirecord.
- Gunakan `JenisDokumen`/`PersyaratanPengajuan` untuk persyaratan dinamis, bukan if-else permanen per tahap.
- Simpan versi dokumen/topik dan histori keputusan; jangan menghapus bukti lama.
- Jangan edit schema, apply migration, reset database, seed massal, atau deployment **tanpa permintaan dan pemeriksaan target**.
- Jika perlu klarifikasi aturan yang berdampak besar, tanyakan sebelum menyimpulkan.
- Jalankan lint/test/build/Prisma validate **hanya berdasarkan script yang ada** dan lingkungan yang aman.
- Laporkan kegagalan tes/lingkungan secara jujur; jangan mengklaim `IMPLEMENTED-VERIFIED` tanpa bukti.

## 10. Syarat mengubah status modul menjadi selesai

Sebuah modul hanya boleh diberi **`IMPLEMENTED-VERIFIED`** ketika seluruh kriteria relevan berikut terpenuhi:

- [ ] **Kode benar-benar ada** pada repository SIPKITA (bukan pada dokumen atau proyek latihan).
- [ ] Route/controller/service dan/atau UI terkait sudah terintegrasi menurut scope fitur.
- [ ] Schema Prisma dan koneksi database yang digunakan sesuai dengan kode (jika fitur memakai database).
- [ ] Skenario **berhasil** dicoba dengan hasil yang dapat diperiksa.
- [ ] Skenario **gagal penting** diuji: belum login, role salah, bukan pemilik, status tidak sah, syarat kurang, atau konflik data.
- [ ] Riwayat, transaksi, dan versi data tidak rusak untuk operasi yang mengubah beberapa record.
- [ ] Lint/build/test relevan dijalankan bila script tersedia; hasilnya dicatat, termasuk error yang masih ada.
- [ ] Pengguna menerima batasan atau keputusan terbuka yang masih memengaruhi modul.

**Lulus build ≠ fitur lulus business flow.** Menjalankan Vite/Express saja menunjukkan server mulai hidup; tidak membuktikan review, ACC, atau upload aman secara end-to-end.

## 11. Format pembaruan file status setelah task

Setelah setiap fitur berhasil dieksekusi dan diperiksa, **edit hanya bagian status yang relevan** serta tambahkan satu entri log berikut. Jangan menghapus sejarah keputusan atau mengganti fakta lama dengan klaim tanpa bukti.

### Template log kemajuan

| Tanggal (WIB) | Modul/task | Perubahan konkret | Bukti verifikasi | Status / next |
| --- | --- | --- | --- | --- |
| `YYYY-MM-DD` | `Nama fitur` | `Path kode/route/schema yang berubah` | `Perintah/test + hasil ringkas` | `IMPLEMENTED-VERIFIED / BLOCKED / ...` |

### Log awal dokumen

| Tanggal (WIB) | Modul/task | Perubahan konkret | Bukti verifikasi | Status / next |
| --- | --- | --- | --- | --- |
| **2026-11-01** | Penyusunan dokumentasi SIPKITA untuk Codex | Menyelesaikan rangkaian `AGENTS.md`, 4 skill, dan 16 dokumen `docs/` pada tahap perancangan. | Inventaris berkas `.md` yang disusun; **tidak ada eksekusi ulang endpoint/migration**. | **RANCANGAN-SELESAI**; audit repo dan mulai implementasi bertahap. |
| **2026-11-01** | Audit awal read-only dan sinkronisasi keputusan bisnis | Menginventaris repo/source, schema/migration/database, menguji health, dan menyelaraskan dokumentasi/skill terhadap keputusan final. Tidak mengubah source, database, dependensi, `gpt.md`, schema, atau migration. | Prisma 7.10 validate/status; pemeriksaan DB read-only 38 tabel/38 PK/82 FK/4 indeks parsial; health runtime; `node --check` pada 6 file backend. Frontend dan modul akademik tidak diuji end-to-end. | Fondasi teknis terverifikasi; modul akademik tetap **PLANNED**. Tindak lanjut: selesaikan keputusan terbuka dan mulai vertical slice. |
| **2026-11-01** | Koreksi domain perpanjangan | Menyatukan seluruh kondisi melanjutkan/mengulang tahap pada semester berikutnya ke proses perpanjangan; menghapus konsep pengajuan ulang sebagai proses terpisah pada dokumentasi dan skill. | Pencarian lintas Markdown/skill dan `git diff --check`; tidak ada perubahan source/schema/database. | **KEPUTUSAN-DOMAIN-FINAL**; kelayakan dan batas kesempatan per tahap masih perlu ditetapkan. |
| **2026-11-01** | Database seeder akun dummy & fondasi auth | Menambahkan seeder akun dummy modular (`server/prisma/seed.js`, `server/prisma/seed/*`), konfigurasi seed pada `server/prisma.config.ts`, dan script `db:seed`. Tidak membuat migration baru karena schema existing sudah memadai. | Preflight Prisma 7 validate & status (up-to-date); seed dijalankan 2x terbukti idempotent; verifikasi DB: 1 Prodi, 6 Role, 8 User aktif, 9 UserRole, 2 Mahasiswa, 4 Dosen, password tersimpan scrypt hash tanpa plaintext/leak, 0 data akademik/token. | **IMPLEMENTED-VERIFIED** |
| **2026-11-01** | Migrasi password fixture development ke Argon2id | Menambahkan modul password bersama, dependency `argon2` 0.44.0, seeder Argon2id create-if-missing, dan prosedur rehash dry-run/apply dengan guard development. Setelah persetujuan reset, hanya `password_hash` delapan fixture yang diperbarui dalam transaksi; tidak ada schema/migration atau endpoint auth baru. | Unit test 4/4; Prisma validate/status; dry-run 8 target; apply 8 target; pengulangan 0 update/8 no-op; seed normal 0 create dan hash existing tidak berubah; audit DB menunjukkan 8 Argon2id berparameter `m=19456,t=2,p=1`, 8 salt/hash berbeda, password benar diterima dan password salah ditolak 8/8, jumlah relasi tetap 1/6/8/9/2/4. | **IMPLEMENTED-VERIFIED** untuk hashing fixture; login/auth tetap **PLANNED**. |
| **2026-11-01** | Backend auth Fase 1 | Menambahkan login `login_id` + Argon2id, JWT HS256 15 menit dari secret environment, `GET /api/auth/me`, middleware auth/role, rate limit login, dan respons error aman. Secret JWT lokal perlu diisi sebelum server dijalankan. | `npm test` 11/11 termasuk 4 login fixture development melalui HTTP read-only; token salah/expired/iss/aud/alg tidak sah, role terkini, status nonaktif, no-role, rate limit, dan kebocoran error diuji; Prisma validate/status bersih. | **IMPLEMENTED-VERIFIED** untuk backend Fase 1; refresh/logout/mode role/browser tetap fase lanjut. |
| **2026-11-01** | Backend auth Fase 2 (draf sebelum persetujuan apply) | Menambah `AuthSession`/`RefreshToken`, draf SQL aditif, refresh rotation/reuse detection, logout dan pemeriksaan sesi access token. | `npm test` 12 lulus/1 skip dengan Prisma mock; `prisma validate` dan `prisma generate` lulus. SQL draf ditinjau statis: hanya tabel/indeks/FK baru. Belum ada tes integrasi PostgreSQL pada tahap ini. | **IMPLEMENTED-UNVERIFIED** saat draf; kemudian disetujui untuk apply. |
| **2026-11-01** | Apply migrasi dan integrasi backend auth Fase 2 | `prisma migrate deploy` menerapkan hanya `20261101000000_auth_sessions_refresh_tokens` ke `sipkita_dev`; tes fixture membuat dan membersihkan sesi/token uji. | `prisma migrate status` up-to-date; `npm test` dengan `SIPKITA_AUTH_REAL_DB=1`: 13 lulus/0 gagal; jumlah User tetap 8, AuthSession/RefreshToken kembali 0, indeks `uq_pembimbing_aktif` dan `uq_seminar_terjadwal` tetap ada. | **IMPLEMENTED-VERIFIED** untuk login/refresh/logout backend pada development; concurrency reuse PostgreSQL dan frontend belum diuji. |
| **2026-11-02** | Backend auth Fase 3 (draf, belum diterapkan) | Menambah `AuthSession.active_role_id`, snapshot role pada access token, `POST /api/auth/active-role`, respons `/me` dengan daftar/role aktif, serta authorization berdasarkan role aktif. | 13 tes lulus/1 integrasi DB skip; `prisma validate` lulus. SQL draf ditinjau: hanya kolom nullable, indeks, dan FK baru; tidak ada perubahan partial index lama. | **IMPLEMENTED-UNVERIFIED**; tunggu persetujuan sebelum apply migrasi dan tes PostgreSQL. |
| **2026-11-02** | Penguatan dan integrasi backend auth Fase 3 | Menambah `AuthSession.role_version`, increment atomik, klaim versi JWT, validasi sesi, serta skenario A → B → A. Backup tervalidasi dibuat sebelum migrasi; migrasi Fase 3 diterapkan ke `sipkita_dev`. | `npm test` dengan `SIPKITA_AUTH_REAL_DB=1`: 14/14 lulus. Baseline data tetap 8 User/6 Role/9 UserRole/2 sesi/3 refresh token; 41 tabel tetap, indeks menjadi 149 karena satu indeks baru; partial index lama tetap ada. | **IMPLEMENTED-VERIFIED** untuk backend auth Fase 3; frontend belum dikerjakan. |
| **2026-11-02** | Backend auth Fase 4 forgot/reset password | Menambah dua endpoint publik, token acak 32 byte dengan hash SHA-256, Gmail SMTP via Nodemailer, cooldown/rate limit, reset Argon2id atomik, invalidasi token lain, dan pencabutan seluruh sesi user. Model `PasswordResetToken` existing dipakai tanpa perubahan schema/migrasi/data. | `npm test -w server`: 20 lulus/0 gagal/1 integrasi fixture lama skip; FP-01–FP-10 diuji dengan SMTP mock dan Prisma fake terisolasi. Pengiriman Gmail nyata tidak dijalankan karena penerima uji belum ditentukan; integrasi PostgreSQL Fase 4 belum dijalankan. | **IMPLEMENTED-VERIFIED (SMTP/PRISMA MOCK)**; frontend, PostgreSQL integration test, dan uji Gmail nyata tetap terpisah. |

## 12. Rekomendasi task pertama setelah dokumentasi siap

**Jangan langsung meminta Codex “buat semua SIPKITA”.** Mulailah dengan task diagnostik aman untuk menyiapkan fondasi implementasi:

> **Tugas untuk Codex (analisis saja):** Baca `AGENTS.md` dan `docs/project-status.md`. Periksa struktur monorepo SIPKITA yang benar-benar ada (`package.json`, `client/`, `server/`, route, controller, service, `server/prisma/schema.prisma`, folder migrations, dan script test). Jelaskan apa yang sudah tersedia dan apa yang belum, bandingkan dengan prioritas semester ISCP, serta buat urutan vertical slice implementasi pertama. Lakukan hanya pemeriksaan read-only dan perintah pengecekan aman; **jangan ubah kode, schema, database, atau instal dependensi dulu**. Tanyakan keputusan bisnis yang memblokir sebelum implementasi.

Setelah laporan audit dikonfirmasi pengguna, pilih satu modul pertama (biasanya **auth/akun/role** atau kebutuhan fondasi lain yang ternyata belum ada) dan eksekusi melalui skill `feature-implementation` dengan batas scope jelas.

**Penutup:** `project-status.md` adalah *snapshot hidup*. Bukti runtime terbaru harus mengalahkan perkiraan snapshot ini; dokumen tidak boleh dipakai sebagai alasan untuk menganggap sistem sudah lengkap atau memulai perubahan destruktif.
