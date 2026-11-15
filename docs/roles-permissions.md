# Roles & Permissions — SIPKITA

Dokumen ini menjadi **acuan kewenangan aktor dan kontrol akses** untuk pengembangan SIPKITA dengan Codex. Tujuannya memastikan setiap fitur diperiksa berdasarkan **peran pengguna, kepemilikan data, penugasan dosen yang aktif, dan kondisi proses bisnis**, bukan sekadar tombol yang terlihat pada antarmuka.

**Rujukan utama:** `AGENTS.md`, `docs/glossary.md`, `docs/academic-lifecycle.md`, dan `server/prisma/schema.prisma` aktual. Dokumen ini menggambarkan **aturan bisnis dan desain otorisasi**, bukan jaminan bahwa seluruh middleware, endpoint, atau status sudah diimplementasikan.

> **Penting:** Admin Prodi memeriksa administrasi pengajuan reguler/awal; Kaprodi memegang keputusan akhir. Pelaku serta rincian pemeriksaan kelayakan akademik masih perlu dikunci, sehingga baris **TBD** hanya berlaku pada pemeriksaan akademik. Permohonan semester berikutnya diproses sebagai perpanjangan, tanpa Admin Prodi dan Reviewer.

## 1. Prinsip kontrol akses

1. **Autentikasi ≠ otorisasi.** Login membuktikan identitas akun; tindakan tertentu baru diizinkan setelah pemeriksaan hak akses.
2. **Role saja tidak cukup.** Mahasiswa hanya boleh mengubah data dan pengajuan miliknya; Reviewer/Pembimbing hanya boleh memproses pengajuan yang ditugaskan kepadanya sesuai jenis penugasan.
3. **Keputusan dinilai di server.** Menyembunyikan tombol, memilih mode kerja dosen, atau mengubah parameter URL tidak boleh memperluas izin pengguna.
4. **Status menentukan tindakan.** Izin unggah, revisi, review, verifikasi, ACC, dan pembatalan harus memperhatikan status proses dan periode yang berlaku. Nama kode status yang belum final tidak boleh diada-adakan.
5. **Pemisahan kewenangan:** Reviewer menilai proposal; Kaprodi memberi ACC **pengajuan**; Dosen Pembimbing memberi ACC **penyelesaian tahap**. Ketiganya merupakan keputusan yang berbeda.
6. **Multi-role diperbolehkan.** Satu `User` dapat memiliki beberapa `Role` melalui `UserRole`, tetapi setiap aksi tetap harus memenuhi syarat kontekstualnya.
7. **Perubahan penting dapat ditelusuri.** Simpan identitas pemeriksa, penetap, atau pemutus pada field audit yang tersedia. Jangan memalsukan user penindak dari isi request.
8. **Cakupan program studi harus dibatasi.** Relasi `Mahasiswa.program_studi_id` dan `Dosen.program_studi_id` tersedia; batas lintas-prodi untuk Admin Prodi/Kaprodi harus dirumuskan jika nanti sistem dipakai beberapa prodi. Jangan mengizinkan akses global tanpa alasan dan pemeriksaan.

## 2. Enam aktor dan cakupan kewenangan

| Aktor | Tanggung jawab | Pembatas utama |
| --- | --- | --- |
| **Mahasiswa** | Kelola akun/data diri sendiri; ajukan KP/ISCP/TA; unggah atau revisi berkas; pantau keputusan; jalani proses tahap akademik. | Hanya data **milik sendiri**, dalam status/periode yang membolehkan. |
| **Dosen Reviewer** | Menelaah proposal, memberi catatan, merekam hasil review, dan opsional mengunggah lembar review. | Hanya `Pengajuan` dengan penugasan **REVIEWER aktif** kepada dosen terkait. |
| **Dosen Pembimbing** | Membimbing mahasiswa, memeriksa catatan bimbingan, menyusun jadwal seminar, menilai perubahan judul tahap awal, dan ACC penyelesaian. | Hanya `Pengajuan` dengan penugasan **PEMBIMBING aktif**. |
| **Admin Prodi** | Verifikasi identitas/dokumen data diri mahasiswa serta pemeriksaan administrasi pengajuan reguler/awal. | **Tidak** mengambil ACC pengajuan/tahap dan **tidak** memverifikasi perpanjangan. |
| **Kaprodi** | Menetapkan reviewer/pembimbing, memutuskan pengajuan, memeriksa serta memutuskan perpanjangan, memutuskan perubahan judul pada tahap akhir, dan memantau proses akademik. | Pengajuan reguler mengikuti prasyarat administrasi, akademik, dan review; perpanjangan mengikuti syarat khusus tanpa Reviewer; semua keputusan tetap memeriksa status dan kewenangan prodi. |
| **Admin Sistem** | Kelola akun/role, reset password administratif, master prodi/semester, periode/jadwal, persyaratan dan template. | Hak konfigurasi **tidak otomatis berarti** boleh mengesahkan review atau menyatakan mahasiswa lulus. |

Dalam skema, penamaan `Role.kode_peran` merupakan data master; **periksa nilai kode yang benar-benar di-seed** sebelum menulis konstanta izin. Enam nama aktor di atas adalah istilah bisnis, bukan bukti bahwa keenam kode sudah tersedia di database.

## 3. Matriks izin — modul prioritas semester sekarang

Legenda: **✓** = pelaku berwenang dengan syarat konteks; **—** = bukan kewenangan; **TBD** = kebijakan belum final. Matriks tidak menggantikan pemeriksaan `status`, kepemilikan, atau penugasan pada service.

| Tindakan | Mhs | Reviewer | Pembimbing | Admin Prodi | Kaprodi | Admin Sistem |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Login dan ubah profil/password **akun sendiri** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lengkapi dan revisi **data diri sendiri** | ✓ | — | — | — | — | — |
| Verifikasi data diri dan dokumen identitas mahasiswa | — | — | — | ✓ | — | — |
| Kelola akun, role, periode, syarat dokumen, dan template | — | — | — | — | — | ✓ |
| Ajukan KP/ISCP/TA `BARU` atau `LANJUT` | ✓ | — | — | — | — | — |
| Unggah/revisi **dokumen pengajuan sendiri** | ✓ | — | — | — | — | — |
| Periksa kelengkapan **administrasi pengajuan reguler/awal** | — | — | — | ✓ | — | — |
| Periksa **kelayakan akademik** pengajuan | — | — | — | TBD | TBD | — |
| Tetapkan/ganti dosen Reviewer | — | — | — | — | ✓ | — |
| Baca dan nilai proposal yang **ditugaskan** | — | ✓ | — | — | — | — |
| Catat hasil review dan unggah lembar review opsional | — | ✓ | — | — | — | — |
| Beri ACC/tolak **akhir pengajuan** | — | — | — | — | ✓ | — |
| Tetapkan/ganti dosen Pembimbing | — | — | — | — | ✓ | — |
| Lihat status/riwayat pengajuan | ✓ (miliknya) | ✓ (ditugaskan) | ✓ (dibimbing) | ✓ (sesuai tugas) | ✓ (pengawasan) | — |

**Catatan tentang TBD:** hanya pelaku dan rincian pemeriksaan **kelayakan akademik** yang masih terbuka. Pemeriksaan administrasi pengajuan reguler/awal dilakukan Admin Prodi, sedangkan Kaprodi tetap memegang ACC pengajuan akhir. Perpanjangan tidak memakai pemeriksaan Admin Prodi.

## 4. Matriks izin — modul tahap lanjutan

Bagian ini mencatat **kewenangan domain**, tetapi sebagian fiturnya direncanakan menyusul pada semester berikutnya.

| Tindakan | Mhs | Reviewer | Pembimbing | Admin Prodi | Kaprodi | Admin Sistem |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Catat bimbingan offline/unggah materi online | ✓ | — | — | — | — | — |
| Validasi bimbingan dan beri catatan | — | — | ✓ | — | — | — |
| Buat/ubah jadwal seminar sesuai aturan | — | — | ✓ | — | — | — |
| Lihat jadwal seminar sendiri/yang dibimbing | ✓ | — | ✓ | — | ✓ (pantau) | — |
| ACC **penyelesaian tahap** setelah syarat terpenuhi | — | — | ✓ | — | — | — |
| Ajukan perubahan judul beserta proposal perubahan | ✓ | — | — | — | — | — |
| Keputusan perubahan judul tahap pertama | — | — | ✓ | — | — | — |
| Keputusan **akhir** perubahan judul | — | — | — | — | ✓ | — |
| Ajukan/revisi perpanjangan semester berikutnya | ✓ | — | — | — | — | — |
| Periksa dan ACC/tolak perpanjangan | — | — | — | — | ✓ | — |
| Verifikasi administrasi perpanjangan oleh Admin Prodi | — | — | — | — | — | — |
| Pantau kelayakan otomatis KP → ISCP → TA | ✓ (sendiri) | — | ✓ (dibimbing) | — | ✓ (pantau) | — |

**Batas penting:** Kaprodi **tidak melakukan ACC transisi manual** KP→ISCP atau ISCP→TA. Setelah Dosen Pembimbing melakukan ACC penyelesaian tahap dan syarat berlaku terpenuhi, sistem membuka **kelayakan** mengajukan tahap selanjutnya; mahasiswa tetap membuat `Pengajuan` baru.

## 5. Aturan otorisasi berdasarkan record database

| Skenario | Pemeriksaan wajib di service | Model/field rujukan |
| --- | --- | --- |
| Mahasiswa membaca/mengedit data diri | `User` yang login terhubung ke `Mahasiswa` pemilik; status mengizinkan perubahan. | `User.id`, `Mahasiswa.user_id`, `VerifikasiDataDiri.mahasiswa_id` |
| Mahasiswa mengunggah/revisi berkas pengajuan | `Pengajuan.mahasiswa_id` miliknya; dokumen termasuk persyaratan pengajuan saat itu; status/periode mengizinkan; versi terbaru dipertahankan. | `Pengajuan`, `PersyaratanPengajuan`, `DokumenPengajuan` |
| Admin memverifikasi data diri | User punya role Admin Prodi yang sah; berkas dan versi terbaru diperiksa; reviewer bukan pelaku verifikasi. | `VerifikasiDataDiri`, `DokumenDataDiri`, field `diperiksa_oleh_user_id` |
| Reviewer membaca/menilai proposal | User punya role Reviewer **dan** `Dosen.user_id` terkait dengan `PenugasanDosen` bertipe `REVIEWER` berstatus `AKTIF` untuk pengajuan tersebut. | `Dosen`, `PenugasanDosen`, `ReviewProposal`, `RiwayatReview` |
| Kaprodi menunjuk dosen | Role Kaprodi; pengajuan pada kondisi boleh ditugaskan; dosen target valid; cek konflik pembimbing aktif. | `Pengajuan`, `Dosen`, `PenugasanDosen.ditetapkan_oleh_user_id` |
| Kaprodi memberi keputusan akhir pengajuan | Role Kaprodi; hasil pemeriksaan dan review yang **diwajibkan** sudah memenuhi aturan; pengajuan belum diputuskan final. | `Pengajuan.status_pengajuan`, `Pengajuan.diputuskan_oleh_user_id`, `RiwayatStatusPengajuan` |
| Pembimbing memvalidasi bimbingan/seminar | Role Pembimbing dan penugasan `PEMBIMBING` **aktif** pada pengajuan; status proses sesuai. | `PenugasanDosen`, `Bimbingan`, `JadwalSeminar` |
| Pembimbing ACC penyelesaian | Penugasan Pembimbing aktif; pengajuan pada tahap benar; jumlah bimbingan diakui dan seluruh persyaratan selesai; belum ada ACC untuk pengajuan itu. | `AturanPenyelesaianTahap`, `PenyelesaianTahap` |
| Kaprodi ACC perpanjangan | Role Kaprodi; pengajuan perpanjangan sesuai semester/status/jumlah kesempatan; bukan pemeriksaan oleh Admin Prodi. | `Pengajuan`, `RiwayatStatusPengajuan`, konfigurasi terkait |

Gunakan **otorisasi tingkat objek**: `GET /pengajuan/:id`, unduhan dokumen, dan perubahan status harus memverifikasi hak terhadap pengajuan **yang ditunjuk oleh `:id`**, bukan hanya memeriksa apakah user sudah login. Berlakukan juga pada operasi batch dan pencarian daftar.

### Contoh logika pemeriksaan (pseudocode, bukan endpoint aktual)

```text
izinkanReview(user, pengajuanId):
  require user.status_akun == 'AKTIF'
  require user memiliki role Reviewer
  require ada Dosen dengan Dosen.user_id == user.id
  require ada PenugasanDosen:
    pengajuan_id == pengajuanId
    dosen_id == dosen.id
    jenis_penugasan == 'REVIEWER'
    status_penugasan == 'AKTIF'
  require status pengajuan dan review mengizinkan aksi yang diminta
  baru izinkan baca/tulis bagian review sesuai haknya
```

Kode status `REVIEWER`, `PEMBIMBING`, dan `AKTIF` ditampilkan mengikuti nilai yang dipakai dalam konsep/skema penugasan; **samakan dengan data master aktual** saat implementasi. Jangan menyamakan `User.id` dengan `Dosen.id`.

## 6. Dosen multi-role dan beberapa penugasan

Contoh **data ilustrasi**, bukan isi database:

**Akun, role, dan profil dosen**

| Tabel | Record contoh | Makna |
| --- | --- | --- |
| `User` | `id=9`, `login_id='dsn009'` | Satu identitas login. |
| `Role` | `id=2`, `kode_peran='REVIEWER'` | Contoh kode role; bukan ketetapan seed. |
| `Role` | `id=3`, `kode_peran='PEMBIMBING'` | Contoh kode role; bukan ketetapan seed. |
| `UserRole` | `(user_id=9, role_id=2)` dan `(user_id=9, role_id=3)` | Satu akun punya dua role. |
| `Dosen` | `id=4`, `user_id=9` | Profil dosen yang sama dipakai kedua jenis tugas. |

**Penugasan pada pengajuan berbeda**

| `PenugasanDosen.id` | `pengajuan_id` | `dosen_id` | `jenis_penugasan` | `status_penugasan` |
| --- | --- | --- | --- | --- |
| 70 | 101 | 4 | `REVIEWER` | `AKTIF` |
| 71 | 205 | 4 | `PEMBIMBING` | `AKTIF` |

Ketika dosen masuk **mode Reviewer**, antarmuka menampilkan tugas review pada pengajuan **101**. Ketika masuk **mode Pembimbing**, antarmuka menampilkan tugas bimbingan pada pengajuan **205**. Mengubah mode **tidak membuat** penugasan baru dan **tidak mengizinkan** dosen menilai pengajuan lain.

### Penugasan massal oleh Kaprodi

Kaprodi boleh menugaskan **satu dosen untuk banyak pengajuan** melalui UI massal (*multi-select*/drag-and-drop), selama service memvalidasi setiap record. Satu pengajuan boleh memiliki **beberapa Reviewer** aktif. Namun satu pengajuan hanya boleh memiliki **satu Pembimbing aktif**; skema mencantumkan indeks unik parsial untuk pasangan kondisi `jenis_penugasan='PEMBIMBING'` dan `status_penugasan='AKTIF'` pada `PenugasanDosen.pengajuan_id`.

- Penugasan ulang pembimbing harus mengakhiri penugasan lama lalu mencatat penugasan baru secara aman dan atomik.
- Saat pembimbing diteruskan dari KP ke ISCP atau dari ISCP ke TA, tetap buat penugasan untuk `Pengajuan` baru; gunakan `asal_penugasan_id` untuk jejak pewarisan bila sesuai aturan.
- Seluruh Reviewer aktif yang ditugaskan harus memberi hasil `LAYAK` pada proposal terbaru sebelum prasyarat review terpenuhi. Hasil lengkap tersebut **tidak otomatis** menjadi ACC; Kaprodi tetap memutuskan pengajuan.

## 7. Audit, pembatasan data, dan keamanan

Beberapa kolom audit yang **benar-benar tersedia dalam skema rujukan**:

| Kejadian | Bukti yang disimpan |
| --- | --- |
| Penambahan role akun | `UserRole.assigned_by_user_id`, `assigned_at` |
| Verifikasi identitas mahasiswa | `VerifikasiDataDiri.diperiksa_oleh_user_id`, `diperiksa_at` |
| Pemeriksaan dokumen data diri | `DokumenDataDiri.diperiksa_oleh_user_id`, `diperiksa_at` |
| Pemeriksaan akademik pengajuan | `Pengajuan.akademik_diperiksa_oleh_user_id`, `akademik_diperiksa_at` |
| Pemeriksaan dokumen pengajuan | `DokumenPengajuan.diperiksa_oleh_user_id`, `diperiksa_at` |
| Penetapan dosen | `PenugasanDosen.ditetapkan_oleh_user_id` |
| Putaran review | `RiwayatReview.direview_oleh_user_id`, `reviewed_at` |
| ACC/tolak akhir pengajuan | `Pengajuan.diputuskan_oleh_user_id`, `diputuskan_at` |
| ACC penyelesaian tahap | `PenyelesaianTahap.disetujui_oleh_user_id`, `disetujui_at` |

- Nilai `*_oleh_user_id` harus berasal dari **user terautentikasi pada server**, bukan dikirim bebas dari browser.
- Lindungi akses unduhan file fisik sebagaimana akses metadata `Dokumen`; memiliki URL berkas **bukan** bukti otorisasi.
- Penyimpanan review, verifikasi, penugasan, dan perubahan status yang berkaitan harus mempertahankan **konsistensi transaksi** serta riwayat versi; jangan menghapus review/dokumen lama untuk mengganti status.
- Ketika pengguna tak berhak, service harus **menolak operasi** dengan respons yang tepat dan tanpa membocorkan data pengguna lain. Implementasi status HTTP (misalnya 403 atau 404 untuk mencegah enumerasi objek) harus konsisten dengan kebijakan keamanan API proyek.
- Jangan memberikan Admin Sistem izin bypass untuk menulis keputusan akademik hanya karena ia mampu mengelola akun/role.

## 8. Skenario pengujian otorisasi minimum

| Kasus | Ekspektasi |
| --- | --- |
| Mahasiswa A membuka/mengubah pengajuan Mahasiswa B dengan mengganti ID URL | **Ditolak**. |
| Reviewer A mereview pengajuan tanpa penugasan `REVIEWER` aktif | **Ditolak**, meski ia punya role Reviewer. |
| Dosen punya dua role tetapi hanya ditugaskan sebagai Pembimbing pada pengajuan X | Tidak boleh memberi hasil **review proposal** pada X tanpa penugasan Reviewer yang sah. |
| Reviewer yang ditugaskan mencoba memberi ACC akhir pengajuan | **Ditolak**; keputusan Kaprodi. |
| Admin Prodi mencoba memberi ACC perpanjangan | **Ditolak**; keputusan Kaprodi. |
| Kaprodi menetapkan pembimbing kedua yang aktif pada satu pengajuan | **Ditolak** oleh aturan service/keunikan database. |
| Pembimbing pengajuan lain mencoba ACC penyelesaian tahap | **Ditolak**. |
| Pembimbing sah memberi ACC tetapi syarat penyelesaian belum lengkap | **Ditolak**, dengan alasan validasi yang aman. |
| User nonaktif atau tanpa role yang diperlukan mengakses aksi administratif | **Ditolak**. |
| Dokumen lama/sudah diganti versinya dipakai untuk melewati pemeriksaan dokumen terkini | **Ditolak** kecuali ada aturan penggunaan ulang yang sah. |

## 9. Keputusan yang harus dikonfirmasi sebelum coding terkait

1. **Pemeriksaan kelayakan akademik:** tentukan pelaku, data yang diperiksa, dan bukti auditnya tanpa mencampurnya dengan pemeriksaan administrasi Admin Prodi, review proposal, atau ACC akhir Kaprodi.
2. **Impor dan koreksi master mahasiswa/dosen:** tentukan batas tugas Admin Prodi dibanding Admin Sistem. Tidak ada integrasi langsung SIKADU.
3. **Cakupan lintas program studi:** jika lebih dari satu prodi aktif, tentukan siapa boleh melihat serta memproses data antarprodi, termasuk Kaprodi dengan cakupan tertentu.
4. **State machine dan hak revisi:** kunci kode status per model beserta transisi yang legal dan aktor pelakunya; field status bertipe `String` tidak otomatis melindungi transisi.

Keputusan yang belum final tidak boleh diisi dengan asumsi Codex. Tunjukkan konflik singkat, minta keputusan pengguna bila memblokir perubahan, kemudian perbarui dokumen aturan bisnis sebelum implementasi.

## 10. Panduan penggunaan dokumen oleh Codex

Saat mengerjakan fitur otorisasi, urutkan langkah:

1. Baca `AGENTS.md`, `docs/glossary.md`, `docs/academic-lifecycle.md`, **dokumen ini**, dan **skema Prisma aktual**.
2. Identifikasi pelaku, objek target, operasi, status, serta hubungan kepemilikan atau penugasannya.
3. Tempatkan pemeriksaan autentikasi dan role pada lapisan yang sesuai; tempatkan **kepemilikan, penugasan aktif, dan aturan status** pada service/API sebelum query atau mutasi sensitif.
4. Pastikan query daftar/detail, operasi batch, perubahan status, dan akses dokumen memakai aturan yang konsisten.
5. Tambahkan uji **positif dan negatif** untuk peran sah/tidak sah, pengguna lain, dosen tanpa penugasan, user nonaktif, status tak sesuai, dan persaingan penetapan dosen.
6. Laporkan kebijakan yang belum diputuskan dan jangan mengubah skema atau menetapkan kebijakan tanpa permintaan.

**Prioritas semester sekarang:** akun/autentikasi, data diri dan verifikasi, pengajuan KP/ISCP/TA, pemeriksaan persyaratan, penugasan Reviewer, review/revisi proposal, persetujuan akhir pengajuan, dan pembimbing. Bimbingan dapat dicicil jika waktu memungkinkan; perubahan judul, perpanjangan, dan penyelesaian lengkap direncanakan menyusul.
