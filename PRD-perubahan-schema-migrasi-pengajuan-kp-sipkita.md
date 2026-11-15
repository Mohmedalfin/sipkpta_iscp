# PRD — Penyesuaian Schema & Draft Migration Pengajuan KP SIPKITA

**Tanggal:** 5 November 2026  
**Tahap pekerjaan:** Persiapan database sebelum implementasi REST API Pengajuan KP  
**Ruang lingkup:** `server/prisma/schema.prisma` dan **draft** SQL migration yang diperlukan  
**Status:** Siap dikerjakan bertahap; **dilarang menerapkan migration ke database tanpa persetujuan terpisah**

## 1. Tujuan

Menyesuaikan **schema yang sudah ada** agar dapat menyimpan status administrasi kategori Berkas, deklarasi kebenaran data, serta mencegah pengajuan KP reguler aktif ganda. Pertahankan relasi dan data yang sudah bekerja. Jangan menciptakan tabel baru jika kebutuhan cukup dipenuhi oleh atribut/constraint pada model lama.

Audit sebelumnya menyimpulkan `PERLU PERUBAHAN SCHEMA`: dua kebutuhan belum didukung (`Status Berkas` kategori dan pencegahan pengajuan aktif ganda), sementara sebagian besar kebutuhan Reviewer/Pembimbing telah didukung secara struktural.

**Prinsip:** perubahan minimal, aditif, aman untuk data existing, dapat ditinjau sebelum dijalankan.

## 2. Sumber dan cara bekerja

1. Baca `AGENTS.md`, skill proyek yang relevan (terutama `domain-modeling`, `prisma-schema-change`, `code-change-verification` bila tersedia), schema dan migrations aktual.
2. Gunakan laporan audit Pengajuan KP dan PRD audit terdahulu sebagai *context*, tetapi **keputusan bisnis final di Bagian 3 dokumen ini mengesampingkan aturan lama yang bertentangan khusus untuk KP**.
3. Audit nama field dan enum aktual sebelum mengedit. Nama kandidat di PRD ini **bukan** perintah untuk membuat duplikat field atau enum.
4. Jangan mengubah frontend, routes, controllers, services, dokumentasi Scalar/OpenAPI, seed, dependency, ataupun modul yang sudah selesai.
5. Jangan melakukan penghapusan tabel/kolom, rename destruktif, `db push`, database reset, atau backfill yang mengarang fakta historis.

## 3. Aturan bisnis final sebagai dasar schema

### 3.1 Aktor

- **Mahasiswa:** membuat/mengirim pengajuan KP, mengisi data, mengunggah berkas, mengusulkan Pembimbing, melakukan revisi.
- **Admin Prodi:** memeriksa **Status Berkas**, **Status Nilai**, dan memberi **Status Pengajuan = ACC/Tidak ACC** beserta catatan masing-masing kategori. Kaprodi **tidak** mengulang verifikasi administrasi.
- **Kaprodi:** menugaskan Dosen Reviewer dan menetapkan Dosen Pembimbing final.
- **Reviewer:** memberi hasil dan catatan terhadap **versi proposal** yang diperiksa.
- **Pembimbing:** mendampingi pelaksanaan KP setelah penetapan resmi Kaprodi.

### 3.2 Gate dan alur

1. **Data Diri:** keenam dokumen tersedia (6/6) → mahasiswa boleh submit pengajuan KP. Data Diri harus `TERVERIFIKASI` sebelum Admin Prodi dapat memberikan **ACC** pengajuan KP. Verifikasi Data Diri dan verifikasi Berkas KP adalah **dua modul berbeda**.
2. **Administrasi KP:** Admin Prodi memeriksa Berkas, Nilai (SKS, IPK, D/E), serta Status Pengajuan dan menulis **catatan kategori**, bukan catatan verifikasi per file.
3. **Reviewer:** dapat ditetapkan Kaprodi sesaat setelah pengajuan terkirim beserta proposal; dapat berjalan **paralel** dengan proses Admin Prodi. Umumnya dua Reviewer, tetapi jumlah fleksibel.
4. **Review proposal bukan gate ACC KP:** hasil `TIDAK_LAYAK` tidak otomatis menolak Pengajuan KP. Review tetap tercatat per versi proposal; revisi tidak menghapus review/versi historis.
5. **Pembimbing:** mahasiswa hanya mengusulkan; Kaprodi secara eksplisit menetapkan Pembimbing **setelah ACC administrasi**. Jika usulan tidak diterima, pilih salah satu Reviewer aktif yang sudah ditugaskan. Penetapan tidak perlu menunggu Reviewer `LAYAK`.
6. **Pengajuan ganda:** satu mahasiswa tidak boleh memiliki dua Pengajuan KP **reguler aktif** pada periode yang sama; riwayat periode lain tetap dipertahankan. Jangan mencampur Pengajuan KP reguler dengan perpanjangan atau pengajuan ulang sebelum memeriksa representasi `jalur_pengajuan` aktual.
7. **Nilai akademik:** mahasiswa mengisi snapshot SKS, IPK, dan nilai D/E; Admin Prodi melakukan verifikasi manual berdasarkan sumber akademik resmi. Tidak perlu membuat integrasi SIKADU dalam tugas ini.

## 4. Target perubahan schema (minimal)

### P1 — Status Berkas pada model `Pengajuan` (wajib)

Audit membuktikan `DokumenPengajuan.status_dokumen` dan `catatan_admin` adalah **per file**. Itu tidak menggantikan satu status/catatan **kategori Berkas** pada tingkat pengajuan.

Tambahkan pada `Pengajuan` **jika belum ada ekuivalen**:

| Kandidat field logis | Tujuan | Strategi aman |
| --- | --- | --- |
| `status_pemeriksaan_berkas` | Status kategori Berkas (`Belum Diperiksa`, `Belum OK`, `OK Lengkap`) | Enum/tipe konsisten dengan status pemeriksaan akademik yang ada; default aman untuk record lama |
| `catatan_pemeriksaan_berkas` | Satu catatan kategori Berkas | Nullable |
| `diperiksa_berkas_oleh_user_id` | Identitas Admin Prodi pemeriksa terakhir | Nullable FK `User`, jika belum tercakup oleh model audit yang setara |
| `diperiksa_berkas_at` | Waktu pemeriksaan terakhir | Nullable |

**Jangan buat tabel baru khusus kategori Berkas.** `RiwayatStatusPengajuan` tetap menyimpan histori perubahan; periksa apakah enum `jenis_status` mendukung kategori `BERKAS`, tambahkan nilai enum hanya jika benar-benar diperlukan.

### P1 — Deklarasi kebenaran data (wajib)

Form lama mempunyai checkbox pernyataan kebenaran data. Simpan bukti persetujuan pada `Pengajuan` atau struktur audit yang sudah setara. Kandidat minimal: `pernyataan_kebenaran_disetujui_at DateTime?` (timestamp nullable pada draft, wajib terisi saat submit oleh service kelak).

- Jangan memberi persetujuan `true` secara otomatis pada record historis.
- Jangan membuat boolean **dan** timestamp yang redundan tanpa alasan.
- Tidak perlu menyimpan teks syarat secara berlebihan pada tahap ini; jika ada versi persyaratan resmi yang sudah tersedia, gunakan mekanisme eksisting.

### P0 — Constraint pencegahan pengajuan aktif ganda (wajib dirancang)

Identifikasi enum dan field aktual pada `Pengajuan`: mahasiswa, tahap, periode, jalur, status/lifecycle. Tentukan predikat **reguler aktif** dari status aktual, bukan nama yang diasumsikan.

Kandidat strategi: **partial unique index PostgreSQL** berdasarkan kombinasi `(mahasiswa_id, tahap_akademik_id, periode_akademik_id)` dengan filter jalur reguler dan status aktif yang tepat. Namun:

1. Jangan membuat index yang menghalangi perpanjangan, pengajuan ulang yang sah, atau riwayat lintas periode.
2. Jangan hardcode ID tahap KP dari seed yang bisa berubah; evaluasi jika constraint berlaku generik pada seluruh tahap reguler.
3. Periksa dukungan representasi partial index pada Prisma versi proyek dan migration SQL manual yang sudah ada.
4. **Preflight wajib:** tampilkan query **read-only** pendeteksi duplicate existing; jika duplikat ditemukan, **STOP** dan minta keputusan. Jangan menghapus, menggabungkan, atau menandai data lama secara otomatis.
5. Jika partial index tidak aman sebelum lifecycle jelas, sajikan alternatif transaksi + locking dengan analisis tradeoff, dan **jangan memasang constraint tebakan**.

### P1/P2 — Reviewer, Pembimbing, histori, dan persyaratan dokumen

Audit mengindikasikan model `PenugasanDosen`/penugasan terkait, `ReviewProposal`, `DokumenPengajuan`, `TopikPenelitian`, dan `VersiTopik` telah mendukung kebutuhan inti. **Verifikasi kembali nama aktual**, lalu:

- Jangan buat ulang model Reviewer/Pembimbing atau memisahkannya tanpa kebutuhan nyata.
- Reviewer dan Pembimbing boleh menunjuk **dosen yang sama** pada jenis penugasan berbeda.
- Pertimbangkan keunikan **Reviewer aktif pada pasangan pengajuan–dosen–jenis peran** hanya jika belum ada pengaman dan index tidak merusak histori penugasan.
- Integritas silang pengajuan/topik/versi proposal/penugasan/review utamakan validasi service dalam transaksi pada tahap API; jangan menambah FK komposit yang berlebihan di migration ini tanpa bukti kebutuhan.
- Dokumen alternatif (sertifikat sosialisasi **atau** surat pengganti) dan SPP variabel bersyarat: **cukup aturan validasi service untuk KP**, kecuali schema aktual benar-benar tidak bisa merepresentasikan dokumen tersebut. Jangan membuat grup persyaratan generik dulu.
- `status_pemeriksaan_akademik` dan catatannya yang sudah ada **dipakai sebagai Status Nilai** bila semantiknya cocok; jangan buat field `status_nilai` duplikat.
- Jangan menambahkan kolom baru untuk menyimpan gate Data Diri atau hasil review pada `Pengajuan`; baca dari model/sumber terkait pada service.

## 5. Tahapan eksekusi Codex — pisahkan draft dari penerapan

### Fase A — Inspeksi singkat dan perancangan

1. Baca `git status`, schema, enum, relasi, partial index yang ada, serta migrations terkait.
2. Buat daftar **exact** field/enum/index yang diperlukan berikut justifikasi dan risiko.
3. Identifikasi kebutuhan yang sudah ada agar tidak menduplikasi struktur.
4. Catat definisi status aktif sesuai schema. Bila definisi belum bisa diturunkan aman, **tunda pembuatan unique index** dan tandai keputusan yang diperlukan; jangan berasumsi.

### Fase B — Buat perubahan schema dan **draft** migration saja

Jika perubahan minimal sudah bisa dipastikan:

1. Edit `server/prisma/schema.prisma` hanya pada model/enum/relasi terkait.
2. Siapkan direktori migration baru dan `migration.sql` **sebagai draft**, menggunakan mekanisme offline/yang tidak menerapkan SQL pada database aktif.
3. Migration harus **aditif**, konsisten dengan nama tabel/kolom sebenarnya, dan menjaga seluruh data existing.
4. Jangan otomatis `NOT NULL` pada data historis tanpa default aman. Field deklarasi harus tetap nullable untuk data lama.
5. Jangan menambahkan index berisiko sebelum duplikasi lama dinilai. Jika perlu, pecah draft menjadi perubahan yang aman dan bagian constraint yang menunggu persetujuan.
6. Tidak ada perubahan aplikasi, dokumentasi OpenAPI, atau dependency pada fase ini.

### Fase C — Verifikasi read-only dan laporan

- Jalankan `prisma validate`, pemeriksaan SQL/diff/sintaks yang aman, dan `git diff --check`.
- Tinjau semua perubahan terhadap worktree awal. **Jangan menimpa perubahan pengguna** yang sudah ada.
- Tunjukkan apakah migration berisi `DROP`, `TRUNCATE`, perubahan tipe berisiko, rebuild indeks, atau backfill; target idealnya **tidak ada operasi destruktif**.
- Boleh berikan query pemeriksaan duplikasi read-only, tetapi **jangan mengeksekusi SQL write** ke development.
- **STOP setelah draft.** Jangan menjalankan `prisma migrate dev`, `migrate deploy`, `db push`, seed, atau tes yang memodifikasi `sipkita_dev`.

### Fase D — Penerapan (tugas terpisah, hanya setelah persetujuan pengguna)

Setelah draft ditinjau dan disetujui, barulah rencanakan: backup database, pemeriksaan data existing, apply di database pengujian terisolasi, integration test, lalu apply ke development dengan otorisasi eksplisit. **Fase D tidak termasuk instruksi pengerjaan PRD ini.**

## 6. Output wajib dari agent

Berikan laporan ringkas dengan bagian:

1. **Ringkasan perubahan:** tabel `existing → perubahan`, alasan bisnis, dan tingkat risiko.
2. **Daftar file yang berubah:** hanya schema dan draft migration (jika memang diperlukan).
3. **Detail atribut/enum/constraint:** nama aktual, jenis, default/nullability, relasi, indeks, potensi efek pada data lama.
4. **Audit keunikan:** definisi aktif dan hasil/SQL preflight duplicate read-only; jika belum aman, tulis `DITUNDA` dengan alasan.
5. **Hasil verifikasi:** `prisma validate`, `git diff --check`, serta pemeriksaan draft SQL.
6. **Keputusan tertunda / blocker:** jelaskan yang perlu diputuskan, jangan menebak.
7. **Pernyataan keamanan:** database yang disentuh atau **tidak disentuh**, serta konfirmasi tidak ada migration diterapkan.

Setiap temuan teknis penting harus merujuk ke `path:line` aktual. Bila suatu rekomendasi ternyata cukup ditangani service, tulis pada bagian **Nanti di API**, bukan memaksanya masuk migration.

## 7. Kriteria penerimaan

- [ ] Status dan catatan kategori **Berkas** tersimpan di level `Pengajuan`, terpisah dari status per file.
- [ ] Status Nilai dan keputusan Pengajuan memakai atribut eksisting yang setara, tanpa duplikasi.
- [ ] Deklarasi kebenaran data dapat tersimpan secara dapat diaudit tanpa menciptakan persetujuan palsu untuk record lama.
- [ ] Mekanisme pencegahan pengajuan aktif ganda dirancang aman, dan constraint hanya dibuat bila predikatnya jelas serta tidak merusak riwayat.
- [ ] Relasi Reviewer, proposal versi, usulan Pembimbing, dan Pembimbing final dipertahankan.
- [ ] Model Data Diri tetap terpisah; tidak ada perubahan pada modul yang sudah lulus tes.
- [ ] Schema dan draft migration lolos validasi yang tersedia.
- [ ] **Tidak ada migration dijalankan; `sipkita_dev` dan database lain tidak diubah.**

## 8. Prompt singkat pemanggilan di Codex CLI

> Kerjakan **Fase A–C saja** dari `PRD-perubahan-schema-migrasi-pengajuan-kp-sipkita.md`. Ikuti `AGENTS.md` dan skill repo terkait. Buat perubahan **minimal** pada `schema.prisma` serta **draft** `migration.sql` bila dibutuhkan, tanpa membuat model redundant, mengubah modul existing, atau menerapkan SQL ke database. Hati-hati dengan partial unique index: inspeksi enum/status aktual dan jangan menebak definisi aktif. Validasi hasil, tampilkan ringkasan diff dan risiko, lalu **berhenti menunggu persetujuan** sebelum apply migration.
