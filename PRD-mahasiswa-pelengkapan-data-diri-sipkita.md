# PRD — Pelengkapan Data Diri Mahasiswa SIPKITA (Backend)

**Status:** Keputusan bisnis dikunci; dokumen untuk implementasi Codex CLI.  
**Tahap:** Pelengkapan data diri saja. Verifikasi oleh Admin Prodi merupakan modul berikutnya.  
**Basis:** `AGENTS.md`, skema Prisma proyek, dan keputusan diskusi 3 November 2026.

## 1. Tujuan dan batas fitur

Mahasiswa dapat melihat profil yang sudah dibuat Admin Prodi, mengubah **sebagian data profil opsional**, serta melengkapi **enam dokumen identitas wajib**. Dokumen dapat dikirim satu per satu, ditampilkan progresnya, dan diganti secara independen dengan menyimpan riwayat versi.

**Di luar cakupan:** frontend; pemeriksaan/ACC dokumen oleh Admin Prodi; verifikasi massal; notifikasi; pengajuan KP/ISCP/TA; perubahan password; perubahan data master mahasiswa; penghapusan dokumen dan riwayat.

## 2. Aktor dan kewenangan

- **MAHASISWA (role aktif):** hanya melihat/memperbarui profil opsional miliknya serta mengunggah, mengganti, dan mengunduh dokumen data diri miliknya.
- **ADMIN_PRODI:** sudah mengelola master mahasiswa melalui endpoint master existing. PRD ini **tidak** mengubah endpoint atau kewenangan tersebut.
- Identitas mahasiswa ditentukan dari **akun JWT yang terautentikasi**, bukan dari `mahasiswa_id` yang dikirim klien. Semua tindakan memeriksa keaktifan akun dan `activeRole` dengan middleware existing.
- Akun mahasiswa tanpa relasi profil atau nonaktif ditolak secara aman; tidak boleh membuka data milik akun lain.

## 3. Aturan data profil

| Kelompok | Field aktual pada skema | Kebijakan |
| --- | --- | --- |
| Identitas/login inti | `User.login_id`, `User.email`, `Mahasiswa.nim`, `nama_lengkap`, `tanggal_lahir` | Hanya Admin Prodi yang boleh mengubah. Mahasiswa **read-only**. |
| Akademik/administratif | `program_studi_id`, `tahun_angkatan`, `status_data`, `User.status_akun`, role | Hanya pihak admin berwenang. Mahasiswa **read-only**. |
| Profil opsional *self-service* | `Mahasiswa.no_telepon`, `alamat` | Mahasiswa boleh mengubah, mengosongkan, atau membiarkan kosong. Tidak memengaruhi kelengkapan enam dokumen. |
| Identitas tambahan | `nik_kependudukan`, `tempat_lahir` | **Belum** masuk allowlist edit mahasiswa; tetap read-only sampai aturan kepemilikannya diputuskan secara eksplisit. |

Perubahan tanggal lahir oleh admin **tidak** mengubah password awal yang pernah ditetapkan. Mahasiswa hanya dapat menyunting `no_telepon` dan `alamat` melalui allowlist backend, meskipun mencoba mengirim field lain dalam body.

Validasi: `no_telepon` opsional, normalisasi dan cek format/panjang sesuai kolom aktual (`VARCHAR(20)`); `alamat` opsional dengan batas panjang wajar dan sanitasi output. PATCH kosong atau field di luar allowlist ditolak dengan respons validasi yang konsisten.

## 4. Enam dokumen wajib

| Kode bisnis (sesuaikan kode `JenisDokumen` existing) | Nama berkas | Kewajiban |
| --- | --- | --- |
| `IJAZAH` | Ijazah | Wajib |
| `KK` | Kartu Keluarga | Wajib |
| `KTP` | Kartu Tanda Penduduk | Wajib |
| `AKTA` | Akta Kelahiran | Wajib |
| `KTM` | Kartu Tanda Mahasiswa | Wajib |
| `FORM_DATA_DIRI` | Formulir Data Diri | Wajib |

1. Format awal: **PDF saja**; batas ukuran default **5 MiB per file**, dapat dibatasi lebih ketat oleh konfigurasi `JenisDokumen`.
2. Mahasiswa boleh mengunggah **bertahap/satu per satu**; tidak perlu menunggu enam file terkumpul untuk memulai upload. Keenam dokumen adalah syarat **status lengkap**, bukan syarat untuk menekan tombol upload.
3. Progres dihitung berdasarkan **enam jenis berbeda yang masing-masing mempunyai dokumen terkini valid secara teknis**, bukan jumlah file/versi. Contoh: 4/6 = belum lengkap; 6/6 = **lengkap diunggah tetapi belum terverifikasi**.
4. Mengganti KTP hanya menambah versi KTP; lima dokumen lain tidak ditimpa, tidak dihapus, dan tidak perlu diunggah ulang.
5. Versi terdahulu tetap disimpan untuk audit. Setiap jenis memiliki **tepat maksimal satu** dokumen `is_terkini = true`; versi naik monotonik dan harus aman dari permintaan paralel.
6. Upload baru menggunakan `status_dokumen = BELUM_DIPERIKSA` sesuai default skema. **Jangan** menetapkan `TERVERIFIKASI` otomatis saat 6/6.
7. Bila suatu dokumen telah **terverifikasi** pada modul berikutnya, pergantian sepihak tidak diizinkan kecuali ada mekanisme pembukaan revisi oleh admin; status `PERLU_PERBAIKAN` nantinya mengizinkan penggantian hanya dokumen bermasalah. Belum perlu membangun aksi admin pada tahap ini.

## 5. Kontrak API yang ditargetkan

Ikuti konvensi respons/error dan prefix route aktual. Hindari membuat endpoint duplikat jika *self-service* yang ekuivalen sudah ada.

| Method | Rute usulan | Fungsi |
| --- | --- | --- |
| `GET` | `/api/mahasiswa/me/data-diri` | Profil inti read-only, profil opsional, enam jenis dokumen beserta status/progres, dan ringkasan kelengkapan. |
| `PATCH` | `/api/mahasiswa/me/profil` | Ubah hanya `no_telepon`, `alamat` pada profil sendiri. |
| `PUT` | `/api/mahasiswa/me/data-diri/dokumen/:kodeJenis` | Multipart file PDF: unggah pertama atau ganti **satu** jenis dokumen milik sendiri; buat versi baru. |
| `GET` | `/api/mahasiswa/me/data-diri/dokumen/:kodeJenis/file` | Unduh/lihat berkas terkini melalui otorisasi backend; jangan berikan path fisik atau storage key. |

Payload PATCH contoh: `{ "no_telepon": "081234567890", "alamat": "Alamat domisili mahasiswa" }`.

Respons GET minimal: `profil` (data inti dan opsional yang aman), `dokumen` (keenam kategori, `is_uploaded`, `versi_terkini`, `status_dokumen`, `catatan_admin` bila ada), dan `kelengkapan` dengan `jumlah_wajib: 6`, `jumlah_terunggah: 0..6`, `lengkap: boolean`, `sudah_diverifikasi: false` selama belum diputuskan admin. Hindari mengembalikan path internal, hash password, NIK penuh jika tidak diperlukan, atau metadata milik mahasiswa lain.

**Tidak dibuat:** endpoint kirim semua enam sekaligus, `POST submit-verification`, `PATCH approve/reject`, `DELETE` dokumen, atau URL file statis publik.

## 6. Pemetaan database — gunakan yang sudah ada

Skema yang tersedia sebagai referensi telah memiliki:

- `Mahasiswa` dan `User` untuk profil dan akun.
- `VerifikasiDataDiri` sebagai induk kepemilikan data diri (status awal `BELUM_DIVERIFIKASI`).
- `JenisDokumen` dengan `kode_jenis`, `kategori_dokumen`, `format_diizinkan`, `maks_ukuran_mb`, `is_aktif`.
- `Dokumen` untuk metadata file (`storage_key`, MIME, ukuran, checksum, pengunggah).
- `DokumenDataDiri` untuk penghubung mahasiswa–jenis–file, versi, penanda terkini, serta status/catatan pemeriksaan. Ada constraint unik per `(verifikasi_data_diri_id, jenis_dokumen_id, versi)` dan partial unique untuk dokumen terkini.

Saat upload pertama, buat `VerifikasiDataDiri` bila belum ada; selanjutnya gunakan relasi yang sama. Ambil keenam jenis dari `JenisDokumen` dengan kategori data diri; **periksa seed/kode aktual** sebelum menambah konfigurasi. Jangan menyamakan keenam berkas identitas dengan `PersyaratanPengajuan` KP/ISCP/TA.

**Catatan snapshot:** skema lampiran bisa lebih tua daripada repository yang sudah melalui Fase 2–4. Codex wajib mencocokkan `server/prisma/schema.prisma` dan service/seed terkini. Bila diperlukan perubahan schema/migrasi atau pengisian master `JenisDokumen` di database development, buat rancangan dan **hentikan sebelum menerapkan perubahan data/migrasi** untuk meminta otorisasi. Jangan memakai `db push`, `migrate reset`, atau mereset data.

## 7. Keamanan dan integritas upload

- Semua endpoint menggunakan middleware autentikasi, role aktif `MAHASISWA`, dan pengecekan kepemilikan. Jangan menerima `user_id`/`mahasiswa_id` dari body/query.
- File harus punya ekstensi `.pdf`, Content-Type yang sesuai, **serta signature/isi PDF yang diperiksa server-side**; jangan percaya MIME dari browser. Tolak file kosong, terlalu besar, tidak valid, atau tipe samaran.
- Simpan berkas di **storage privat di luar webroot**; kunci/nama berkas acak, bukan dari nama/NIM/email asli. Akses file melalui endpoint berotorisasi, header aman (`nosniff`, `Cache-Control: private, no-store`).
- Jangan log isi/berkas identitas atau expose nama path storage. Validasi `kodeJenis` terhadap whitelist enam dokumen aktif.
- Simpan metadata dan pergantian `is_terkini` secara konsisten memakai transaksi serta constraint existing; tangani benturan paralel. Kelola file sementara/kompensasi kegagalan agar tidak ada metadata yatim atau file yatim.
- Hindari penghapusan permanen versi yang pernah diunggah, termasuk ketika suatu versi diganti.

Rujukan keamanan upload: [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## 8. Acceptance criteria dan pengujian

1. Mahasiswa aktif login dengan role `MAHASISWA` dapat GET data dirinya; tidak dapat mengakses data mahasiswa lain melalui manipulasi parameter/token.
2. PATCH `no_telepon`/`alamat` sukses; kolom inti tetap tidak berubah walaupun body menyertakan `nim`, `tanggal_lahir`, `email`, `program_studi_id`, `status_data`, atau role.
3. Perubahan profil opsional tidak mengubah status kelengkapan enam dokumen dan tidak memicu verifikasi ulang.
4. Unggah PDF Ijazah saja menghasilkan progres 1/6; setelah enam jenis berbeda tersedia progres 6/6, **belum terverifikasi**.
5. Ganti KTP menambah `versi` dan mempertahankan versi sebelumnya; dokumen terkini lain tidak berubah. Benturan unggah paralel tidak menghasilkan dua dokumen terkini.
6. File palsu, kategori tak dikenal, file >5 MiB, request tanpa login, role selain `MAHASISWA`, dan akun tanpa profil ditolak sesuai error convention.
7. Unduh dokumen hanya bisa dilakukan oleh pemilik yang sah; tidak ada URL publik untuk berkas identitas.
8. Kegagalan penyimpanan atau transaksi tidak meninggalkan record/file yatim.
9. Test unit/service dan HTTP dengan fixture terisolasi lulus; jika integration test PostgreSQL diperlukan, gunakan **database uji terpisah**, jangan POST/PATCH pada `sipkita_dev` tanpa otorisasi.

## 9. Cara kerja Codex yang efisien

1. Baca `AGENTS.md`, skema Prisma **aktual**, router/auth/master mahasiswa, serta skill `feature-implementation` dan `code-change-verification` yang benar-benar relevan. Jangan audit seluruh repo atau memanggil semua skill.
2. Sebelum mengubah kode, cocokkan model, kode jenis dokumen, storage/validator yang tersedia, dan apakah rute serupa sudah ada. Laporkan hanya **blocker keputusan** yang benar-benar mengubah hasil.
3. Implementasikan backend minimum sesuai arsitektur `route → controller → service → Prisma` dengan reuse kode/utilitas existing; jangan membuat frontend atau melakukan refaktor di luar scope.
4. Jalankan tes terarah, validasi Prisma, syntax/lint sesuai script, dan `git diff --check` tanpa mengubah data development.
5. Laporan akhir singkat: endpoint, perubahan file, hasil tes nyata, migrasi/data yang (tidak) berubah, dan risiko tersisa. Jangan mengklaim pengujian DB nyata bila belum dilakukan.

**Definition of Done:** Mahasiswa dapat mengedit dua kolom opsional, mengunggah enam berkas secara bertahap, mengganti satu berkas dengan versi terlacak, serta melihat/men-download dokumennya secara aman. **Status 6/6 tidak sama dengan ACC verifikasi.**
