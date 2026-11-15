# Pola Realtime SIPKITA

SIPKITA menggunakan **cache bersama + SSE + event bus** untuk memperbarui data
pada layar tanpa meminta API terus-menerus. PostgreSQL tetap menjadi sumber data resmi.

## Alur utama

1. Pengguna menyimpan perubahan melalui REST API.
2. Backend memvalidasi kewenangan dan menyelesaikan transaksi database.
3. Setelah commit, service menerbitkan event kecil melalui event bus dalam memori.
4. SSE memeriksa sesi, role, serta akses penerima sebelum mengirim event.
5. Client menandai cache terkait sebagai stale, lalu membaca ulang data melalui REST API.

Event hanya membawa identitas perubahan, bukan isi dokumen atau data sensitif.
Rollback tidak menerbitkan event.

## Pembagian tanggung jawab

| Bagian | Fungsi |
| --- | --- |
| REST API | Membaca dan menyimpan data dengan validasi server |
| TanStack Query | Berbagi cache dan request antarkomponen dalam satu tab, terpisah per akun/role |
| Event bus | Menyalurkan pemberitahuan setelah commit pada satu proses backend |
| SSE `/api/realtime/events` | Mengirim pemberitahuan dari server ke client memakai Bearer token |

Cache dibersihkan saat akun/role berganti. Form dan modal yang sedang diedit
mempertahankan isian lokal; perubahan dari luar tidak langsung menimpanya.

## Pengendalian beban

- Event client digabung selama 250 ms; refetch diarahkan hanya ke query terkait.
- Tab tersembunyi menunda refetch sampai aktif kembali.
- Cache dianggap segar selama 30 detik dan disimpan hingga 5 menit setelah tidak digunakan.
- Query realtime yang aktif melakukan rekonsiliasi berkala 120 detik sebagai pengaman.
- Heartbeat server 20 detik dan watchdog client 45 detik mendeteksi koneksi macet.
- Reconnect memakai jeda bertahap 1?30 detik ditambah jitter hingga 500 ms.
  Penghitung direset setelah menerima data pada koneksi yang bertahan minimal 60 detik.
- Pengiriman subscriber tidak ditunggu respons mutasi. Tiap subscriber memiliki
  satu pengiriman aktif dan maksimal 64 event tertunda; event sejenis untuk resource
  yang sama digabung. Timeout 10 detik atau antrean penuh menutup koneksi.
- Setelah reconnect, client menyinkronkan kembali cache. Cleanup subscription aman
  dipanggil berulang tanpa memutus subscription baru.

## Cakupan dan batas saat ini

Sudah diterapkan pada alur Pengajuan KP: review proposal, administrasi, dan penugasan
reviewer untuk Mahasiswa, Admin Prodi, Kaprodi, serta Reviewer sesuai aksesnya.
Master data, konfigurasi, verifikasi data diri, finalisasi, dan bimbingan belum
seluruhnya menggunakan pola ini.

Event bersifat sementara dan tidak memiliki replay persisten. Lookup penerima masih
ditunggu publisher; timeout subscriber tidak membatalkan query Prisma yang sudah berjalan.
Rekonsiliasi REST menjaga data tetap dapat dipulihkan jika event terlewat.

Redis belum digunakan. Implementasi mendukung satu proses backend; deployment dengan
beberapa proses/server memerlukan transport event bersama seperti Redis Pub/Sub.
Parameter di atas merupakan baseline, belum hasil uji kapasitas deployment.

Referensi lengkap: [arsitektur realtime](realtime-architecture.md) dan
[hasil verifikasi](realtime-verification.md).
