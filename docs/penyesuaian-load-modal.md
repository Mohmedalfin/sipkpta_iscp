# Penyesuaian load modal SIPKITA

Tahap keamanan dan pemisahan loading, 17 November 2026.

## Selesai

- Navigasi dan tutup modal penugasan Reviewer/finalisasi dikunci selama mutasi;
  ref mencegah submit ganda dalam satu frame. Respons detail lama tidak menjadi
  konteks tindakan pada pengajuan baru.
- Detail master Mahasiswa/Dosen, verifikasi data diri, detail/kandidat penugasan
  Reviewer, serta PDF pemeriksaan admin meneruskan AbortSignal hingga Axios.
  Cleanup tetap mengabaikan respons yang sudah kedaluwarsa.
- PDF Reviewer memakai lifecycle terpisah. Detail tampil tanpa menunggu file;
  loading/error/retry PDF tidak mengulang pengambilan detail atau mengosongkan form.
  Object URL dicabut saat file berganti atau modal dilepas.
- Kandidat modal individual Reviewer/Pembimbing memakai cache bersama per jenis dan
  pengajuan selama 30 detik. Detail dan kandidat memiliki status loading/error terpisah.
  Kandidat gagal memblokir aksi penetapan/penggantian, tetapi detail tetap terbaca.
- Modal finalisasi memakai focus trap existing. Cache/form tetap tidak direset oleh SSE.

## Batas dan tahap berikutnya

Pemilih kandidat masih mengambil maksimal 100 record. Pencarian server dengan debounce
serta pagination perlu diterapkan pada modal individual dan bulk sebelum mendukung
Prodi dengan kandidat di atas batas ini. Jangan mengambil seluruh halaman otomatis.
Modal impor dan editor yang tidak memerlukan fetch awal tidak perlu ditambah request
atau skeleton buatan. Pembatalan baca tidak membatalkan transaksi mutasi server.

Cleanup PDF verifikasi data diri pada kode aktual sudah bergantung pada URL, sehingga
klaim audit awal bahwa effect itu berjalan pada setiap render tidak berlaku lagi.

## Bukti verifikasi

Regresi service, Reviewer, finalisasi, dan JSX: 30 pemeriksaan PASS. Tes adapter HTTP
untuk enam service detail/PDF/kandidat membuktikan abort diteruskan: 1 PASS.
Build Vite PASS (warning bundle existing). Interaksi modal, pergantian konteks cepat,
koneksi lambat, dan keyboard belum diuji langsung di browser. Tidak ada perubahan
backend, schema, migrasi, atau data development.
