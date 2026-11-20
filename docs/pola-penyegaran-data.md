# Pola penyegaran data SIPKITA

## Perilaku pengguna

- Tombol Segarkan hanya untuk daftar operasional dan pelacakan read-only.
- Draf baru, draf tersimpan, dan perbaikan administratif KP tidak menyediakan tombol
  Segarkan halaman. Retry tetap tersedia ketika pemuatan awal gagal.
- Refresh pelacakan mahasiswa hanya membaca detail pengajuan dan review terkait.
  Opsi master, seluruh riwayat, serta isian form tidak dimuat ulang oleh tombol itu.
- Tombol menampilkan spinner/status busy dan dinonaktifkan selama request berjalan.
  Loading tombol dipisahkan dari loading awal tabel; filter dan halaman tetap.

## Pengendalian request

Daftar yang sudah memakai TanStack Query memakai `refreshQueries` untuk invalidasi
keluarga cache menu terkait saja. Hanya query aktif yang refetch; query tidak aktif
ditandai stale. Request yang masih berjalan digunakan bersama (`cancelRefetch: false`)
agar klik manual tidak membatalkan lalu memulai ulang request yang sama.

Pelacakan mahasiswa memakai fetchQuery dengan key detail/review yang sama seperti
pembaruan otomatis dan kunci klik manual selama proses berjalan. Respons dari pilihan
riwayat lama diabaikan setelah pengguna berpindah pilihan.

SSE tetap memakai penggabungan event 250 ms dan pembatalan pembacaan lama untuk
menjaga konsistensi ketika event perubahan datang. Perlakuan ini berbeda dari klik
manual karena event menandakan hasil request berjalan bisa sudah tertinggal.

Master Mahasiswa, Dosen, Verifikasi Data Diri, dan Pengaturan Akademik mempertahankan
loader existing; tombol busy mencegah refresh manual berulang. Query filter yang
berubah tetap membatalkan request lama. Migrasi seluruh master ke cache/SSE tidak
termasuk penyesuaian ini. Callback setelah simpan tetap harus menyegarkan hasilnya.

## Verifikasi

Tes terarah mencakup penolakan refresh pada kondisi edit, deduplikasi dua refresh
bersamaan, data cache lama tetap terlihat, dan cache menu lain tidak tersentuh.
Uji browser diperlukan untuk mengetik draf, membuka perbaikan, serta mengklik
Segarkan pada daftar sambil memastikan filter/pagination tetap terjaga.


## Konsistensi visual daftar

Tombol refresh seluruh toolbar memakai `RefreshButton`: tinggi 36 px, radius dan
border seragam, label Segarkan Data pada desktop, ikon dengan label aksesibel pada
mobile, spinner saat busy, serta kunci klik selama callback async berlangsung.
Animasi menghormati prefers-reduced-motion.

Skeleton memakai `TableSkeletonRows` dengan lima baris dan jumlah kolom sesuai tabel.
Panel konfigurasi memakai `ListSkeleton` dengan gaya yang sama untuk pemuatan awal.
Master Mahasiswa/Dosen dan konfigurasi membedakan request data yang sama dengan
perubahan filter/halaman. Request data yang sama mempertahankan isi daftar; skeleton
muncul untuk data awal atau filter/halaman baru. Tidak ada tambahan request atau
interval polling akibat perubahan visual ini.
