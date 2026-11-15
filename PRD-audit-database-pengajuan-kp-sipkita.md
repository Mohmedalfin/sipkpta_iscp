# PRD — Audit Read-Only Database Modul Pengajuan KP SIPKITA

**Versi:** 1.0  
**Tanggal:** 5 November 2026  
**Jenis tugas:** Audit kebutuhan bisnis vs. schema Prisma dan kode backend  
**Status:** Siap diaudit; keputusan yang belum final wajib dilaporkan sebagai *open decision*  
**Cakupan:** Pengajuan Kerja Praktik (KP) reguler, bukan implementasi ISCP/TA atau perpanjangan

## 1. Tujuan dan batasan

Audit apakah **struktur database aktual** beserta constraint, relasi, dan mekanisme yang sudah ada mendukung proses Pengajuan KP terbaru. Identifikasi kebutuhan yang sudah terpenuhi, hanya perlu logika service, atau benar-benar memerlukan perubahan schema.

**WAJIB READ-ONLY:**

- Jangan menulis/mengubah `schema.prisma`, migration, source, dependency, konfigurasi, dokumen, atau data pada database mana pun.
- Jangan menjalankan `prisma migrate`, `db push`, seed, reset, atau tes yang melakukan write ke `sipkita_dev`.
- Boleh membaca schema, file migration, route/controller/service relevan, model, test, dan dokumentasi domain yang tersedia.
- Jangan mengimplementasikan solusi sebelum hasil audit dan keputusan terbuka disetujui.
- Jangan mengerjakan OpenAPI/Scalar ataupun frontend; keduanya di luar tugas audit ini.

Ikuti `AGENTS.md` repo dan skill lokal yang relevan (khususnya domain-modeling, prisma-schema-change, dan code-change-verification bila tersedia). Hindari eksplorasi ulang seluruh repo: gunakan pencarian terarah untuk model, relasi, dan komponen Pengajuan KP.

## 2. Konteks sistem yang sudah berjalan

- Backend Express REST API, Prisma ORM, PostgreSQL; pola `routes → controllers → services → Prisma`.
- Login, JWT/refresh session, active role, CRUD/Import Mahasiswa dan Dosen telah tersedia.
- Mahasiswa dapat melengkapi enam dokumen Data Diri (`IJAZAH`, `KK`, `KTP`, `AKTA`, `KTM`, `FORM_DATA_DIRI`) dengan riwayat versi.
- Admin Prodi telah memiliki modul verifikasi **Data Diri** per dokumen. **Modul ini terpisah dari verifikasi berkas Pengajuan KP**, yang hanya menggunakan status/catatan per kategori.
- Data historis dan perubahan oleh aktor penting harus dapat diaudit.

Jangan mengasumsikan nama model dari PRD sama persis dengan nama model di schema aktual. Gunakan hasil inspeksi langsung sebagai sumber kebenaran teknis.

## 3. Keputusan bisnis Pengajuan KP yang disepakati

### 3.1 Pengajuan oleh Mahasiswa

1. Mahasiswa yang login mengajukan KP pada periode akademik yang berlaku.
2. Isi formulir berdasarkan referensi sistem lama:
   - Tema KP.
   - **Usulan** Dosen Pembimbing (bukan penetapan final).
   - Judul KP.
   - Lokasi/instansi dan informasi studi kasus.
   - Jawaban apakah ada nilai `D`/`E`, serta daftar mata kuliah jika ada.
   - Jumlah SKS ditempuh dan IPK.
   - Dokumen wajib: bukti bayar proposal KP, proposal KP, dan bukti mengikuti sosialisasi KP **atau** surat pernyataan pengganti sesuai syarat; bukti SPP variabel hanya jika berlaku.
   - Pernyataan kebenaran data.
3. Draft dan pengajuan terkirim harus dapat dibedakan. Hanya pengajuan yang **sudah dikirim** yang masuk daftar tugas Admin Prodi/Kaprodi.
4. Riwayat KP antarperiode dipertahankan. Cegah dua pengajuan KP reguler aktif pada mahasiswa dan periode akademik yang sama.
5. Dokumen persyaratan KP **bukan** enam dokumen Data Diri; jangan mencampur kepemilikan/statusnya.

### 3.2 Verifikasi Administrasi oleh Admin Prodi

1. Pemeriksaan formulir dan persyaratan KP menggunakan **tiga status**: `Status Berkas`, `Status Nilai`, dan `Status Pengajuan`.
2. Tiap kategori memiliki **satu catatan kategori** (`Catatan Berkas`, `Catatan Nilai`, `Catatan Pengajuan`), **bukan status dan catatan tersendiri untuk setiap file**.
3. Status Berkas/Nilai menggunakan konsep `Belum Diperiksa`, `Belum OK`, `OK Lengkap`; Status Pengajuan menggunakan konsep belum diputuskan, `ACC`/`Tidak ACC` (nama enum aktual harus diaudit).
4. Jika administrasi perlu perbaikan, mahasiswa memperbaiki data/berkas relevan. Perbaikan tidak menghapus versi dokumen atau jejak keputusan sebelumnya.
5. Admin Prodi adalah pemeriksa administrasi. **Siapa yang berhak mengubah keputusan akhir `Status Pengajuan` masih open decision** (lihat Bagian 5). Jangan menyimpulkan dari nama status saja.

### 3.3 Penugasan Dosen Reviewer oleh Kaprodi

1. Kaprodi boleh menunjuk Reviewer **sejak mahasiswa mengirim pengajuan KP beserta proposal**, tanpa menunggu verifikasi administrasi selesai.
2. Umumnya dua Reviewer; jumlah **fleksibel** dan tidak boleh dipaksa tepat dua tanpa aturan eksplisit.
3. Reviewer hanya dapat mengakses proposal dari penugasan yang masih berlaku.
4. Penugasan Reviewer melekat pada **pengajuan**, sedangkan hasil review melekat pada **versi proposal** yang diperiksa.
5. Revisi proposal mempertahankan penugasan yang masih aktif; jangan otomatis menjadikan hasil versi lama sebagai hasil versi terbaru.

### 3.4 Review Proposal — Jalur Independen

1. Reviewer memeriksa substansi proposal, memberi catatan, dan hasil misalnya `LAYAK`/`TIDAK_LAYAK` (cocokkan enum aktual).
2. Review proposal **tidak termasuk** salah satu dari tiga status verifikasi administrasi.
3. **Review tidak menjadi gerbang penerimaan pengajuan KP:** hasil `TIDAK_LAYAK` tidak otomatis mengubah pengajuan menjadi `Tidak ACC`, dan Admin Prodi tidak harus menunggu hasil review.
4. Reviewer dapat meminta perbaikan proposal dan memeriksa versi terbaru; histori review dan berkas lama tetap tersedia.

### 3.5 Penetapan Pembimbing Final oleh Kaprodi

1. Usulan Pembimbing dari mahasiswa **tidak otomatis menjadi pembimbing resmi**.
2. Setelah administrasi pengajuan memenuhi syarat, Kaprodi **secara eksplisit** menetapkan Pembimbing final.
3. Kaprodi dapat menerima usulan mahasiswa; jika tidak, pilih salah satu **Reviewer aktif yang telah ditugaskan** pada pengajuan tersebut.
4. Dosen boleh memegang peran Reviewer dan Pembimbing sekaligus, tetapi data kedua penugasan harus dibedakan.
5. Penetapan tidak harus menunggu Reviewer menyatakan `LAYAK`.
6. Bedakan `pengajuan diterima` dari `mahasiswa siap bimbingan`: proses bimbingan KP baru dapat dimulai setelah Pembimbing resmi ditetapkan.

## 4. Alur utama dan skenario perubahan

1. Mahasiswa membuat draft, mengisi data, mengunggah berkas, kemudian **submit**.
2. Setelah submit, **dua jalur dapat berjalan paralel**:
   - **Administrasi:** Admin Prodi memeriksa Berkas, Nilai, dan status proses Pengajuan; mengembalikan untuk perbaikan jika diperlukan.
   - **Proposal:** Kaprodi menetapkan Reviewer; Reviewer menilai proposal versi tertentu dan dapat meminta revisi.
3. Penyelesaian administrasi **tidak menunggu** semua Reviewer `LAYAK`.
4. Kaprodi menentukan Pembimbing final berdasarkan usulan mahasiswa atau Reviewer aktif.
5. Setelah pengajuan administrasi diterima **dan** Pembimbing final tercatat, mahasiswa dapat memulai bimbingan KP.

**Skenario audit wajib:**

| ID | Skenario | Perilaku yang harus didukung |
| --- | --- | --- |
| KP-01 | Submit pengajuan KP dengan persyaratan lengkap | Tersimpan bersama pengaju, periode, form, dan dokumen |
| KP-02 | Admin menandai Berkas `Belum OK` | Catatan kategori tersimpan; dapat direvisi tanpa menghapus riwayat |
| KP-03 | Admin menandai Nilai `Belum OK` | Terpisah dari Status Berkas dan review proposal |
| KP-04 | Kaprodi menetapkan Reviewer sebelum verifikasi Admin selesai | Multi-Reviewer dan status penugasan didukung |
| KP-05 | Reviewer menyatakan `TIDAK_LAYAK` | Tidak otomatis menolak pengajuan KP |
| KP-06 | Mahasiswa mengunggah proposal versi baru | Review versi terdahulu tetap historis; penugasan tetap ada |
| KP-07 | Kaprodi menerima dosen usulan | Pembimbing final tercatat, berbeda dari kolom usulan |
| KP-08 | Kaprodi menolak dosen usulan | Pembimbing final dipilih dari Reviewer aktif yang ditugaskan |
| KP-09 | Dua pengajuan aktif dalam periode sama | Dicegah secara aman oleh aturan/constraint atau service |
| KP-10 | KP diajukan kembali pada periode berikutnya | Riwayat pengajuan periode sebelumnya tetap tersedia |
| KP-11 | Reviewer juga menjadi Pembimbing | Kedua peran dan audit penugasan dapat dibedakan |
| KP-12 | Mahasiswa/Admin/Kaprodi/Reviewer mengakses pengajuan pihak lain | Hak akses disaring berdasarkan aktor, kepemilikan, Prodi, dan penugasan |

## 5. Open decision — jangan diputuskan oleh agent

### OD-01 — Pemilik `Status Pengajuan = ACC/Tidak ACC`

Hasil bimbingan mengindikasikan Admin Prodi menangani tiga kategori status. Namun, belum dikonfirmasi secara eksplisit apakah Admin Prodi **juga memberi ACC akhir** atau hanya Berkas/Nilai dan keputusan akhirnya tetap milik Kaprodi.

**Arahan audit:** laporkan dua kemungkinan, dampaknya terhadap atribut pemeriksa/otorisasi/alur, dan rekomendasi minimal. **Jangan mengunci salah satu opsi.**

### OD-02 — Hubungan Verifikasi Data Diri dengan penerimaan KP

Keputusan lebih awal: 6/6 dokumen Data Diri memungkinkan mahasiswa submit KP, sedangkan `TERVERIFIKASI` diperlukan sebelum penerimaan final. Hasil bimbingan terbaru mengubah kriteria penerimaan KP dan belum secara eksplisit menegaskan ulang gate ini.

**Arahan audit:** periksa bagaimana model yang ada dapat membaca progres/status Data Diri, tetapi **jangan menambah atau menghapus gate otomatis** sebelum konfirmasi.

### OD-03 — Syarat sumber nilai akademik

Form lama meminta SKS, IPK, serta nilai D/E. Belum dipastikan apakah data diverifikasi manual terhadap dokumen akademik, SIKADU, atau sumber resmi lainnya.

**Arahan audit:** cek kemampuan menyimpan deklarasi mahasiswa dan keputusan pemeriksa tanpa mengasumsikan integrasi SIKADU.

## 6. Matriks kebutuhan entitas dan relasi yang harus diperiksa

**Semua nama di bawah adalah nama logis; petakan ke model/kolom aktual, jangan otomatis membuat model baru.**

| Area | Kebutuhan relasi / atribut | Fokus pemeriksaan |
| --- | --- | --- |
| Pengaju | Mahasiswa → Pengajuan KP (1:N) | Identitas, kepemilikan, scope Prodi, status aktif |
| Periode | Periode Akademik → Pengajuan KP (1:N) | Konsistensi periode, duplicate guard |
| Form KP | Pengajuan menyimpan tema, judul, lokasi, nilai D/E, daftar MK, SKS, IPK, deklarasi | Tipe data, nullability, batasan input |
| Usulan Pembimbing | Pengajuan → Dosen usulan (0/1) | Tidak tercampur dengan dosen final |
| Administrasi | Status dan catatan **Berkas**, **Nilai**, **Pengajuan** | Audit pemeriksa/waktu; tidak membuat review per file jika tidak perlu |
| Jenis persyaratan | Jenis Dokumen / Persyaratan per tahap dan periode | KP berbeda dari Data Diri dan ISCP/TA |
| File | Pengajuan → Dokumen → metadata file privat | Otorisasi, jenis file, persistensi histori |
| Versi | Jenis dokumen/proposal → banyak versi | Hanya versi terkini untuk proses aktif; versi lama tetap ada |
| Reviewer | Pengajuan ↔ Dosen melalui penugasan (1:N) | Jumlah fleksibel, status aktif, penugasan ulang/cabut |
| Review | Penugasan Reviewer + **versi proposal** → hasil review (1:N) | Isolasi keputusan versi lama/baru |
| Pembimbing | Pengajuan → Dosen final (0/1 aktif) | Disetujui eksplisit Kaprodi; histori perubahan jika ada |
| Audit | Keputusan pemeriksaan, penugasan, revisi → aktor/waktu | Audit trail dan pencegahan perubahan diam-diam |
| Data Diri | Mahasiswa → Verifikasi Data Diri | Modul terpisah; cek kesiapan integrasi di masa depan |

Khusus relasi Reviewer dan Pembimbing: dosen yang sama **boleh** berada dalam keduanya tanpa memaksa satu relasi menggantikan yang lain.

## 7. Audit teknis yang wajib dilakukan

1. **Inventaris schema:** temukan model, enum, field, foreign key, `@@map`, constraint, indeks unik, dan relasi untuk kebutuhan Bagian 6.
2. **Audit histori:** bukti dukungan versi dokumen/proposal dan review terkait versi spesifik; periksa apakah revisi menimpa data lama.
3. **Audit status:** tiga status administrasi berikut catatan dan pelaku/waktu; hindari mencampur status review dengan status administrasi.
4. **Audit lifecycle:** draft, submit, perbaikan, penerimaan administratif, penetapan Pembimbing, dan kemungkinan riwayat pengajuan lintas periode.
5. **Audit concurrency:** cek kemungkinan submit ganda, keputusan stale, penugasan Reviewer ganda, dan pergantian proposal saat review berjalan.
6. **Audit akses:** Mahasiswa hanya pengajuan sendiri; Admin Prodi sesuai scope; Kaprodi sesuai kewenangan; Reviewer hanya proposal yang ditugaskan; Pembimbing hanya yang resmi ditetapkan.
7. **Audit integrasi:** apakah existing service/auth/document storage bisa dipakai ulang tanpa mengubah modul yang sudah lulus tes.
8. **Audit migration:** hanya baca file migration relevan untuk memastikan constraint database sesungguhnya; jangan menjalankan migration.

Setiap temuan harus membedakan:

- **Sudah didukung:** model/kolom/constraint sudah ada dan memadai.
- **Sebagian:** struktur ada, tetapi validasi/service/otorisasi belum ada atau belum lengkap.
- **Belum didukung:** kebutuhan informasi/relasi/constraint tidak dapat direpresentasikan aman oleh schema saat ini.
- **Butuh keputusan bisnis:** masalah belum bisa diputuskan dari sumber yang ada.

**Jangan menyimpulkan migration diperlukan** hanya karena endpoint/service belum dibuat. Sebaliknya, jangan menganggap validasi service cukup untuk kebutuhan integritas yang semestinya dilindungi constraint database.

## 8. Format laporan audit yang diminta

Laporan cukup ringkas tetapi berbukti, disusun sebagai berikut:

### A. Ringkasan eksekutif

- Kesimpulan: `SIAP`, `SIAP DENGAN PENYESUAIAN SERVICE`, atau `PERLU PERUBAHAN SCHEMA`.
- Jumlah kebutuhan: didukung / sebagian / belum didukung / menunggu keputusan.
- Maksimal lima risiko paling penting.

### B. Tabel model aktual

`Model/tabel aktual | Atribut penting | Relasi/FK | Fungsi pada KP | Bukti path:line`

### C. Matriks gap per kebutuhan

`ID kebutuhan | Status | Bukti schema/migration/service | Gap | Jenis perbaikan (schema/service/keputusan)`

Gunakan ID `KP-01` sampai `KP-12` dari Bagian 4, ditambah kebutuhan entitas/relasi Bagian 6 bila relevan.

### D. Gap dan rekomendasi terurut

- **P0:** kehilangan data/riwayat, penugasan yang salah, konflik status, atau kebocoran akses.
- **P1:** kebutuhan alur bisnis yang belum terwakili.
- **P2:** optimasi/ergonomi yang aman ditunda.

Untuk setiap rekomendasi, tulis **perubahan minimal yang diperlukan** dan apakah membutuhkan migrasi atau cukup service, **tanpa menulis kodenya**.

### E. Pertanyaan bisnis yang terbuka

Minimal bahas OD-01, OD-02, OD-03. Jika menemukan ketidakjelasan lain, laporkan saja dan jangan mengarang aturan baru.

## 9. Kriteria selesai

Audit dinyatakan selesai jika:

- [ ] Seluruh kebutuhan KP-01 sampai KP-12 dipetakan ke bukti schema/kode yang aktual.
- [ ] Relasi usulan Pembimbing, penugasan Reviewer, dan Pembimbing final dibedakan secara eksplisit.
- [ ] Dua jalur paralel (Administrasi vs Review Proposal) dapat dinilai kelayakannya.
- [ ] Histori berkas dan review per versi sudah dievaluasi.
- [ ] Status/catatan tiga kategori sudah dievaluasi.
- [ ] Konflik bisnis OD-01 sampai OD-03 dilaporkan tanpa asumsi tersembunyi.
- [ ] Ada kesimpulan apakah cukup service atau memerlukan perubahan schema/migration.
- [ ] **Tidak ada file, database, migration, maupun source yang diubah.**

## 10. Instruksi singkat eksekusi untuk Codex CLI

> Lakukan **audit READ-ONLY** modul Pengajuan KP SIPKITA berdasarkan `PRD-audit-database-pengajuan-kp-sipkita.md`. Baca `AGENTS.md` dan skill repo yang relevan. Cocokkan setiap aturan bisnis dengan `schema.prisma`, migration, serta service yang sudah ada. Keluarkan laporan mengikuti Bagian 8 dan checklist Bagian 9, dengan bukti `path:line`. Jangan mengubah source, schema, migration, dependency, dokumentasi API, atau database; jangan membuat perbaikan. Tandai OD-01–OD-03 sebagai keputusan terbuka, jangan mengasumsikan jawabannya.

