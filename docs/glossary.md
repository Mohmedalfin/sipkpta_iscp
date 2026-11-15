# Glossary SIPKITA

Dokumen ini menjadi **kamus istilah bersama** bagi pemilik proyek, Codex, dokumentasi, database, dan implementasi SIPKITA. Gunakan istilah yang sama ketika membahas proses bisnis, membuat API, memberi nama variabel, dan menyusun antarmuka.

Glossary menjelaskan **arti istilah**, bukan seluruh alur bisnis atau daftar nilai status yang sudah final. Detail aturan ada di `docs/academic-lifecycle.md`, `docs/roles-permissions.md`, dan `docs/business-rules/` ketika dokumen tersebut tersedia. Nama model serta field harus selalu dicocokkan dengan `server/prisma/schema.prisma` aktual.

## 1. Sistem, tahap, dan periode akademik

| Istilah baku | Definisi | Model/atribut terkait |
| --- | --- | --- |
| **SIPKITA** | Sistem Informasi Pengelolaan Kerja Praktik, ISCP, dan Tugas Akhir berbasis web. | Keseluruhan sistem |
| **KP (Kerja Praktik)** | Tahap akademik awal, berfokus pada perancangan sistem sebagai bagian kurikulum. | `TahapAkademik` (`kode_tahap`) |
| **ISCP (Information Systems Capstone Project)** | Tahap lanjutan setelah KP, berfokus pada finalisasi rancangan dan prototipe. | `TahapAkademik` |
| **TA (Tugas Akhir)** | Tahap setelah ISCP, berfokus pada pengembangan dan penyelesaian sistem. | `TahapAkademik` |
| **Tahap akademik** | Jenis tahap KP, ISCP, atau TA dalam urutan **KP → ISCP → TA**. Bukan penanda tahun kuliah mahasiswa. | `TahapAkademik`, `Pengajuan.tahap_akademik_id` |
| **Periode akademik** | Penyelenggaraan akademik berdasarkan tahun ajaran dan semester, yang dapat memuat KP, ISCP, dan TA untuk mahasiswa berbeda secara bersamaan. | `PeriodeAkademik` (`tahun_ajaran`, `semester`) |
| **Semester mahasiswa** | Posisi semester studi seorang mahasiswa (misalnya semester 6/7/8); **bukan** pengganti verifikasi kelulusan tahap sebelumnya. | Konteks akademik, tidak otomatis identik dengan `PeriodeAkademik` |
| **Jadwal proses** | Rentang waktu resmi pembukaan/penutupan tindakan seperti pengajuan pada tahap dan periode tertentu. | `JadwalProses` |
| **Prasyarat tahap** | Kondisi yang harus dipenuhi sebelum mahasiswa dapat mengajukan tahap akademik berikutnya. | `Pengajuan.pengajuan_prasyarat_id`, `PenyelesaianTahap` |
| **Transisi tahap** | Perubahan **kelayakan** dari KP ke ISCP atau dari ISCP ke TA setelah penyelesaian tahap disetujui dan syarat dipenuhi. Ini **bukan** pembuatan pengajuan berikutnya secara otomatis. | `Pengajuan`, `PenyelesaianTahap` |
| **Riwayat akademik** | Jejak pengajuan, topik, penugasan, review, penyelesaian, dan periode yang pernah dijalani mahasiswa. | Beberapa model transaksi dan riwayat |

## 2. Pengguna, aktor, dan hak akses

| Istilah baku | Definisi | Model terkait |
| --- | --- | --- |
| **Akun pengguna** | Identitas autentikasi untuk masuk SIPKITA; tidak sama dengan profil akademik mahasiswa/dosen. | `User` |
| **Role / peran** | Kewenangan kerja yang diberikan kepada akun. Satu pengguna dapat memiliki lebih dari satu role. | `Role`, `UserRole` |
| **Mahasiswa** | Pengguna yang mengelola data diri, mengajukan tahap, mengunggah dokumen, dan menjalani proses akademik. | `Mahasiswa` → `User` |
| **Dosen** | Identitas tenaga pengajar yang dapat menjalankan tugas berbeda menurut role dan penugasan aktif. | `Dosen` → `User` |
| **Dosen Reviewer** | Dosen yang ditugaskan menilai proposal dan memberi hasil/catatan review; tidak memberikan ACC penyelesaian tahap. | `PenugasanDosen`, `ReviewProposal` |
| **Dosen Pembimbing (Dospem)** | Dosen yang membimbing mahasiswa, memvalidasi bimbingan, membuat jadwal seminar, dan memberi ACC penyelesaian tahap. | `PenugasanDosen`, `Bimbingan`, `PenyelesaianTahap` |
| **Mode kerja dosen** | Pilihan konteks Reviewer atau Pembimbing pada akun dosen yang memiliki kedua role; tidak mengubah hak akses dari server. | `UserRole`, `PenugasanDosen` |
| **Admin Prodi** | Petugas administrasi program studi yang memeriksa data diri serta administrasi pengajuan reguler/awal. Tidak memberi ACC akhir dan tidak memverifikasi perpanjangan. | `User`, `Role`, model verifikasi |
| **Kaprodi** | Ketua Program Studi yang memegang keputusan akhir pengajuan, menetapkan reviewer, dan kewenangan akademik lain sesuai proses. | `User`, `Role` dan field pemutus/penetap |
| **Admin Sistem** | Pengelola akun, peran, master data, periode, konfigurasi syarat, dan template sistem. | `User`, `Role`, model konfigurasi |
| **Program Studi (Prodi)** | Unit akademik; berbeda dari aktor **Admin Prodi**. Dalam istilah sistem lama, label pelaku “Prodi” untuk ACC tertentu mengacu ke **Kaprodi**, bukan otomatis Admin Prodi. | `ProgramStudi` |
| **Hak akses** | Izin melakukan tindakan berdasarkan role, penugasan, kepemilikan data, dan status proses. | Service/middleware; `UserRole`, `PenugasanDosen` |
| **Kepemilikan data (ownership)** | Hubungan antara akun yang meminta dan record yang berhak diakses/diperbarui. | ID akun/mahasiswa serta relasi terkait |

## 3. Pengajuan dan pilihan topik

| Istilah baku | Definisi | Model/atribut terkait |
| --- | --- | --- |
| **Pengajuan** | Satu permohonan mahasiswa untuk mengikuti tahap tertentu pada periode akademik tertentu. | `Pengajuan` |
| **Jenis pengajuan** | Kategori permohonan, yaitu pengajuan reguler/awal atau perpanjangan, yang **berbeda** dari pilihan melanjutkan topik atau membuat topik baru. Tidak ada jenis proses terpisah bernama pengajuan ulang. Nilai kode final mengikuti aturan aplikasi. | `Pengajuan.jenis_pengajuan` |
| **Pilihan topik `BARU`** | Mahasiswa menggunakan topik penelitian baru untuk pengajuan yang sedang dibuat. | `Pengajuan.pilihan_topik` |
| **Pilihan topik `LANJUT`** | Mahasiswa melanjutkan topik dari tahap sebelumnya; informasi dapat menjadi isian awal tanpa menghapus riwayat sebelumnya. Pada pengajuan reguler, jalur ini tetap wajib memakai proposal terbaru dan menjalani review. | `Pengajuan.pilihan_topik`, `topik_penelitian_id`, `versi_topik_id` |
| **Pengajuan awal** | Pengajuan untuk mengikuti suatu tahap pada kesempatan yang sedang dibuka, bukan perpanjangan dari pengajuan sebelumnya. | `Pengajuan` |
| **Perpanjangan** | Permohonan melanjutkan pengerjaan dalam **periode/semester berikutnya** dengan rekaman baru yang terhubung ke pengajuan lama; bukan tambahan 1–2 minggu pada semester sama. | `Pengajuan.pengajuan_sebelumnya_id` |
| **Pengajuan prasyarat** | Pengajuan dari **tahap sebelumnya** yang membuktikan riwayat kelayakan ke tahap sekarang. | `Pengajuan.pengajuan_prasyarat_id` |
| **Pengajuan sebelumnya** | Rekaman pengajuan terdahulu yang menjadi asal perpanjangan/pengulangan dalam konteks tahap. | `Pengajuan.pengajuan_sebelumnya_id` |
| **Pemeriksaan akademik** | Pemeriksaan data akademik yang relevan, seperti IPK, SKS, dan nilai DE, untuk menilai kelayakan pengajuan. | `Pengajuan.status_pemeriksaan_akademik` dan atribut snapshot akademik |
| **Snapshot akademik** | Nilai akademik yang dicatat pada saat pengajuan agar kondisi historis dapat ditelusuri. | `ipk_saat_pengajuan`, `jumlah_sks_saat_pengajuan`, `memiliki_nilai_de` |
| **Persetujuan akhir pengajuan (ACC pengajuan)** | Keputusan Kaprodi menerima/menolak permohonan setelah persyaratan serta review yang diwajibkan terpenuhi. **Bukan** pernyataan mahasiswa telah lulus tahap. | `Pengajuan.status_pengajuan`, `diputuskan_oleh_user_id` |

## 4. Tema, topik, proposal, dan versi

| Istilah baku | Definisi | Model terkait |
| --- | --- | --- |
| **Tema penelitian** | Kelompok atau klasifikasi bidang penelitian yang dapat dipilih mahasiswa. | `TemaPenelitian` |
| **Topik penelitian** | Identitas topik milik mahasiswa yang dapat dipakai dan dilanjutkan antar tahap sesuai aturan. | `TopikPenelitian` |
| **Versi topik** | Rekaman judul, objek, dan lokasi penelitian pada versi tertentu; menyimpan perubahan tanpa menghapus versi lama. | `VersiTopik` |
| **Judul penelitian** | Rumusan judul yang tercatat pada suatu versi topik; bukan identitas unik seluruh topik. | `VersiTopik.judul_penelitian` |
| **Objek penelitian** | Entitas, organisasi, atau masalah yang menjadi objek kajian/pengembangan. | `VersiTopik.objek_penelitian` |
| **Proposal** | Dokumen rencana penelitian/pengembangan yang diserahkan untuk proses pengajuan dan penilaian sesuai ketentuan tahap. | `Dokumen`, `DokumenPengajuan` |
| **Perubahan judul** | Permohonan resmi mengganti judul yang diputuskan melalui alur pembimbing dan Kaprodi; menghasilkan versi yang dapat ditelusuri. | `PerubahanJudul`, `KeputusanPerubahanJudul`, `VersiTopik` |
| **Revisi proposal** | Perbaikan berkas proposal berdasarkan catatan reviewer, tanpa menghilangkan berkas dan putaran review sebelumnya. | `DokumenPengajuan`, `RiwayatReview` |

## 5. Persyaratan dan dokumen

| Istilah baku | Definisi | Model terkait |
| --- | --- | --- |
| **Jenis dokumen** | Master kategori berkas yang dikenali SIPKITA, beserta format/ukuran yang diizinkan. **Bukan** penentu tunggal apakah berkas wajib pada suatu tahap. | `JenisDokumen` |
| **Persyaratan pengajuan** | Konfigurasi apakah suatu jenis dokumen wajib/opsional untuk kombinasi **periode + tahap + jenis pengajuan + pilihan topik**. | `PersyaratanPengajuan` |
| **Dokumen (file)** | Metadata berkas yang disimpan, termasuk nama, tipe MIME, ukuran, dan lokasi penyimpanan. | `Dokumen` |
| **Dokumen pengajuan** | Hubungan antara berkas, satu pengajuan, dan satu aturan persyaratan; memiliki status pemeriksaan serta versi. | `DokumenPengajuan` |
| **Dokumen data diri** | Berkas identitas milik proses verifikasi mahasiswa, **bukan** dokumen pengajuan akademik. | `DokumenDataDiri` |
| **Versi dokumen** | Nomor revisi berkas yang memungkinkan riwayat unggahan lama tetap dapat ditelusuri. | `DokumenPengajuan.nomor_versi`, `DokumenDataDiri.versi` |
| **Dokumen terkini** | Versi berkas yang berlaku saat ini; hanya satu versi terkini diizinkan untuk kombinasi tertentu berdasarkan indeks parsial. | `is_terkini` |
| **Penggunaan ulang dokumen** | Pemakaian berkas dari pengajuan terdahulu saat aturan memperbolehkan, dengan jejak sumber yang jelas. | `boleh_gunakan_dokumen_sebelumnya`, `sumber_dokumen_pengajuan_id` |
| **Verifikasi data diri** | Proses pemeriksaan kelengkapan dan kebenaran identitas mahasiswa beserta dokumen yang diperlukan. | `VerifikasiDataDiri`, `DokumenDataDiri` |
| **Catatan pemeriksaan** | Alasan koreksi, penolakan, atau informasi dari pihak pemeriksa yang perlu dipertahankan bersama status terkait. | Field catatan pada model proses/dokumen |

## 6. Penugasan, review, bimbingan, dan penyelesaian

| Istilah baku | Definisi | Model terkait |
| --- | --- | --- |
| **Penugasan dosen** | Rekaman dosen yang ditetapkan untuk tugas Reviewer atau Pembimbing pada sebuah pengajuan. | `PenugasanDosen` |
| **Reviewer aktif** | Dosen reviewer dengan penugasan yang masih berlaku; sebuah pengajuan dapat memiliki **lebih dari satu reviewer** dan seluruh reviewer aktif yang ditugaskan harus menyatakan `LAYAK` pada proposal terbaru agar prasyarat review terpenuhi. | `PenugasanDosen` |
| **Pembimbing aktif** | Dosen pembimbing yang saat ini berlaku untuk suatu pengajuan; maksimal **satu** per pengajuan dalam skema terakhir. | `PenugasanDosen`, indeks `uq_pembimbing_aktif` |
| **Asal penugasan** | Penugasan dosen terdahulu yang menjadi sumber penugasan berikutnya, misalnya saat pembimbing diteruskan ke tahap selanjutnya. | `PenugasanDosen.asal_penugasan_id` |
| **Review proposal** | Pemeriksaan isi proposal oleh dosen reviewer yang ditetapkan. Berbeda dari pemeriksaan kelengkapan administrasi. | `ReviewProposal` |
| **Hasil review** | Penilaian substantif reviewer atas versi proposal; detail kode hasil mengikuti keputusan bisnis. | `ReviewProposal.hasil_review`, `RiwayatReview.hasil_review` |
| **Putaran review** | Satu siklus pemeriksaan atau pemeriksaan ulang setelah revisi yang terkait dengan versi proposal dan topik tertentu. | `RiwayatReview.putaran_ke` |
| **Lembar review** | Dokumen hasil pemeriksaan yang **opsional**, terpisah dari kewajiban mencatat hasil review. | `RiwayatReview.lembar_review_dokumen_id` |
| **Bimbingan offline** | Pertemuan bimbingan langsung; mahasiswa mencatat tanggal dan ringkasan untuk divalidasi pembimbing. | `Bimbingan`, `RiwayatBimbingan` |
| **Bimbingan online** | Bimbingan melalui unggahan materi dan tanggapan/keputusan pembimbing. | `Bimbingan`, `LampiranBimbingan`, `RiwayatBimbingan` |
| **Bimbingan tervalidasi** | Catatan bimbingan yang diakui pembimbing untuk perhitungan syarat, sesuai status yang ditetapkan. | `Bimbingan.status_bimbingan` |
| **Aturan penyelesaian tahap** | Ketentuan kelulusan/pemenuhan syarat akhir tahap berdasarkan tahap dan periode, termasuk minimal bimbingan. | `AturanPenyelesaianTahap` |
| **ACC penyelesaian tahap** | Persetujuan **Dosen Pembimbing** bahwa mahasiswa menyelesaikan KP/ISCP/TA setelah syarat terpenuhi. Berbeda dari ACC pengajuan Kaprodi. | `PenyelesaianTahap` |
| **Syarat tambahan penyelesaian** | Ketentuan selain minimal bimbingan, misalnya sertifikat. Skema terakhir baru menyediakan keterangan teks; **belum** ada tabel unggahan/validasi khusus untuk berkas ini. | `AturanPenyelesaianTahap.keterangan_syarat_lain` |
| **Jadwal seminar** | Informasi seminar KP/ISCP/TA yang dibuat pembimbing dan dapat dilihat mahasiswa. | `JadwalSeminar`, `RiwayatJadwalSeminar` |

## 7. Status: bedakan makna proses dan nilai database

**Jangan memperlakukan semua kolom `status_*` sebagai satu status global.** Sebagian kolom masih bertipe `String` di Prisma; definisi dan daftar transisi yang diizinkan harus dipastikan dalam aturan bisnis/service.

### Nilai default yang benar-benar tampak pada schema Prisma rujukan

| Field Prisma | Default | Makna awal pada konteksnya |
| --- | --- | --- |
| `User.status_akun` | `AKTIF` | Akun berstatus aktif. |
| `VerifikasiDataDiri.status_verifikasi` | `BELUM_DIVERIFIKASI` | Verifikasi identitas belum selesai. |
| `DokumenDataDiri.status_dokumen` | `BELUM_DIPERIKSA` | Berkas identitas belum diperiksa. |
| `PeriodeAkademik.status_periode` | `DRAFT` | Konfigurasi periode masih draf. |
| `Pengajuan.status_pengajuan` | `DRAFT` | Pengajuan belum final/dikirim sesuai alur aplikasi. |
| `Pengajuan.status_pemeriksaan_akademik` | `BELUM_DIPERIKSA` | Pemeriksaan akademik belum dilakukan. |
| `DokumenPengajuan.status_pemeriksaan` | `BELUM_DIPERIKSA` | Berkas pengajuan belum diperiksa. |
| `PenugasanDosen.status_penugasan` | `AKTIF` | Penugasan berlaku. |
| `ReviewProposal.status_review` | `BELUM_DIPERIKSA` | Pemeriksaan proposal belum dimulai/selesai. |
| `Bimbingan.status_bimbingan` | `DRAFT` | Catatan bimbingan masih draf. |
| `JadwalSeminar.status_jadwal` | `TERJADWAL` | Jadwal seminar tercatat sebagai terjadwal. |

Nilai lain yang dibicarakan dalam analisis—misalnya **Dalam Pemeriksaan**, **Perlu Perbaikan**, **Terverifikasi**, **Layak**, **ACC**, dan **Tolak**—adalah **istilah keputusan proses**, belum boleh diasumsikan sebagai satu daftar kode status final untuk semua model. Tetapkan ejaan kode, transisi, aktor pengubah, dan dampaknya di dokumen aturan bisnis sebelum coding.

## 8. Riwayat, notifikasi, dan konfigurasi pendukung

| Istilah baku | Definisi | Model terkait |
| --- | --- | --- |
| **Riwayat status** | Jejak perubahan status pengajuan, status sebelum/sesudah, pelaku, waktu, dan catatan. | `RiwayatStatusPengajuan` |
| **Audit log** | Catatan aktivitas penting sistem untuk penelusuran tindakan pengguna. | `AuditLog` |
| **Notifikasi** | Informasi sistem tentang pengajuan, revisi, keputusan, jadwal, atau penyelesaian. | `Notifikasi`, `NotifikasiPenerima` |
| **Template dokumen** | Berkas/pola dokumen resmi yang disediakan sistem, misalnya format yang dapat diunduh. | `TemplateDokumen` |
| **Impor master data** | Pemasukan data mahasiswa/dosen melalui berkas atau mekanisme admin; bukan sinkronisasi langsung dengan SIKADU. | `ImportBatch`, `Mahasiswa`, `Dosen` |
| **SIKADU** | Sistem akademik eksternal kampus yang **belum diintegrasikan** dengan SIPKITA. | Batas integrasi, bukan model SIPKITA |

## 9. Keputusan yang harus dipastikan sebelum implementasi terkait

Berikut **bukan** definisi final yang boleh diputuskan Codex sendiri:

1. **Pemeriksa kelayakan akademik:** Admin Prodi sudah ditetapkan sebagai pemeriksa administrasi pengajuan reguler/awal dan Kaprodi sebagai pemutus akhir, tetapi pelaku serta rincian pemeriksaan akademik masih perlu dikunci.
2. **Kelayakan dan batas perpanjangan:** tentukan kondisi formal dan jumlah kesempatan per tahap tanpa membuat jalur pengajuan ulang terpisah.
3. **Daftar status:** tentukan nilai kode, transisi, dan pihak yang berwenang untuk masing-masing proses; jangan menyalin satu status ke seluruh entitas.
4. **Berkas wajib penyelesaian:** jika butuh upload dan verifikasi sertifikasi/bukti lain sebelum ACC, lakukan analisis model database terpisah; jangan menganggap tabelnya sudah ada.

## Aturan pemakaian glossary oleh Codex

- Gunakan **istilah baku** di atas secara konsisten pada penjelasan, komentar, nama konsep, UI, dan API sesuai standar penamaan tiap lapisan.
- Gunakan **nama model/field Prisma yang aktual** dalam kode. Glossary tidak mengizinkan penambahan field, status, atau relasi yang belum ada.
- Saat kata yang sama punya makna berbeda—misalnya `BARU` pada pilihan topik vs jenis pengajuan, atau ACC pengajuan vs ACC penyelesaian—sebutkan konteksnya secara eksplisit.
- Jika kebutuhan baru memperkenalkan istilah lain, ajukan definisinya dan hubungkan ke model yang relevan; jangan membuat sinonim yang mengaburkan proses lama.
- Perbarui glossary setelah keputusan bisnis berubah. Detail langkah, otorisasi, dan transisi status tetap ditempatkan pada dokumen bisnis khusus, bukan dipindah seluruhnya ke sini.
