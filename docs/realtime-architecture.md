# Arsitektur pembaruan data realtime SIPKITA

Tanggal keputusan: 16 November 2026.
Status: keputusan arsitektur disetujui; tahap pertama dan kedua runtime telah diimplementasikan.

## Cakupan implementasi tahap kedua

- SSE diperluas ke ADMIN_PRODI, KAPRODI, dan REVIEWER. Sesi serta role diperiksa
  ulang sebelum event dikirim. Scope Admin/Kaprodi mengikuti `authorizedProdiId`:
  jika Prodi tidak dapat ditentukan secara aman, event tidak dikirim.
- Event baru: `pengajuan.administration.updated` dan `pengajuan.assignment.updated`.
  Pemeriksaan kategori, keputusan Admin/ACC Semua, pengiriman pengajuan/perbaikan
  mahasiswa, penugasan individual/bulk, nonaktivasi, dan penggantian reviewer
  menerbitkan event setelah transaksi selesai. Penugasan idempotent tidak menerbitkan
  event baru. Revisi substansi proposal menerbitkan event review setelah commit.
- Reviewer hanya menerima event review/administrasi jika assignment masih aktif dan
  Prodi cocok. Khusus event assignment, reviewer dengan assignment historis pada
  pengajuan tersebut boleh menerima ID invalidasi agar tugas yang dicabut hilang
  dari daftar. Ini tidak memberikan akses ulang ke detail, catatan, atau PDF.
- Daftar serta ringkasan Admin/Kaprodi/Reviewer memakai query cache dan invalidasi
  terarah. Background refresh tidak mengosongkan tabel; perubahan filter/pagination
  tetap memakai loading existing sampai hasil filter terbaru tersedia.
- Detail read-only pengajuan mahasiswa dapat diperbarui otomatis setelah submit.
  Saat draf atau perbaikan administratif sedang terbuka, pembaruan detail ditunda
  agar isian lokal tidak ditimpa. Muat ulang/manual dan refresh setelah penyimpanan
  tetap tersedia. Hasil review memakai query terpisah.
- Modal kerja Admin/Kaprodi memakai cache untuk pembacaan detail tetapi mempertahankan
  snapshot lokal selama terbuka. Event menandai cache stale; detail terbaru dibaca saat
  dibuka/dimuat ulang atau setelah tindakan lokal. Server tetap memvalidasi snapshot,
  assignment, serta status saat menyimpan. Modal tidak direset oleh event daftar.
- Pengujian mencakup regresi PostgreSQL TEST administrasi/assignment/review, event
  commit dan rollback, idempotensi bulk, scope Prodi fail-closed, pencabutan sesi,
  serta pemetaan invalidasi query. Pemeriksaan browser lintas akun tahap kedua dan
  pengukuran beban deployment belum dilakukan.
- Keterbatasan existing: ringkasan kartu masih dihitung dari maksimal 100 hasil daftar,
  sehingga hitungan kategori dapat tidak lengkap di atas batas tersebut. Perbaikan
  agregasi server merupakan scope terpisah; ini bukan jaminan hitungan global.
- Verifikasi data diri, master data, konfigurasi, finalisasi, dan bimbingan belum
  dimigrasikan ke event/cache tahap ini. Tidak ada perubahan schema/migrasi atau Redis.

## Cakupan implementasi tahap pertama

- TanStack Query menjadi cache bersama, terpisah per akun dan role; cache dibersihkan
  saat provider sesi dilepas. Baru query hasil review mahasiswa yang dimigrasikan.
- `GET /api/realtime/events` menggunakan Bearer token dan streaming fetch. Tahap awal
  hanya role MAHASISWA; penerima event ditentukan dari pemilik pengajuan oleh server.
- Review individual dan bulk menerbitkan `pengajuan.review.updated` setelah commit.
  Event menginvalidasi query `kp-reviews` terkait, tanpa mereset form atau mengunduh PDF.
- Heartbeat 20 detik, watchdog client 45 detik, penggabungan event 250 ms, cache stale
  30 detik, retensi 5 menit, resinkronisasi query aktif 120 detik. Angka ini baseline
  implementasi yang masih perlu diuji beban pada deployment sebenarnya.
- Reconnect dan kembali ke tab aktif menyegarkan data; event pada tab tersembunyi
  ditunda. Stream memeriksa sesi/role saat event dan heartbeat. Pencabutan sesi saat
  tidak ada event terdeteksi paling lambat pada pemeriksaan heartbeat berikutnya,
  di luar keterlambatan jaringan/database.
- Pengujian otomatis meliputi HTTP SSE, parser, cache, routing pemilik, pencabutan
  sesi, dan regresi D–H PostgreSQL TEST dengan assertion event commit/rollback/bulk.
  Verifikasi visual lintas akun di browser dan uji beban deployment belum dilakukan.
- Cache daftar/detail modul lain, event administrasi/penugasan/finalisasi/bimbingan,
  serta Redis belum diterapkan. Tidak ada perubahan schema atau migrasi.

## 1. Keputusan

SIPKITA menggunakan REST API untuk baca/tulis, SSE untuk pemberitahuan perubahan,
dan cache client untuk memperbarui data yang terdampak. Implementasi awal memakai
event bus dalam memori pada satu proses backend. Redis ditunda sampai deployment
memerlukan distribusi event antarproses atau antarserver.

PostgreSQL tetap menjadi sumber data resmi. Event realtime merupakan petunjuk
bahwa data perlu dibaca ulang, bukan bukti persetujuan akademik atau audit permanen.
Keputusan ini tidak mengubah aturan bisnis, endpoint akademik existing, atau schema.

## 2. Aliran perubahan

1. Client mengirim mutasi melalui REST API existing.
2. Service memeriksa izin, status, dan versi sesuai aturan existing.
3. Seluruh transaksi database selesai commit, termasuk riwayat yang diperlukan.
4. Service menerbitkan event kecil melalui event bus dalam memori.
5. Pengelola SSE memeriksa penerima yang berhak dan mengirim pemberitahuan.
6. Client menandai cache terkait kedaluwarsa. Query yang sedang digunakan
   dimuat ulang secara terarah; query lain dimuat ulang saat diperlukan.

Event tidak boleh diterbitkan dari dalam callback transaksi yang dapat diulang.
Publikasi dilakukan setelah wrapper transaksi berhasil, sehingga rollback atau retry
tidak mengirim pemberitahuan perubahan yang belum sah. Kegagalan publikasi setelah
commit tidak boleh mengubah respons mutasi berhasil menjadi kegagalan penyimpanan.

## 3. Kontrak event internal

Envelope versi awal memuat `event_id`, `schema_version`, `type`, `resource_type`,
`resource_id`, dan `occurred_at`. ID event bersifat unik, bukan nomor versi database.
Waktu event tidak digunakan untuk menentukan versi data mana yang paling baru.
Routing penerima merupakan metadata internal server dan tidak perlu dikirim ke browser.

Nama event dan endpoint transport konkret ditetapkan saat implementasi alur pertama.
Payload tidak membawa token, storage key, PDF, atau data pribadi yang tidak diperlukan.
Client memetakan jenis resource ke query yang terkait; server tidak mengirim URL bebas
yang kemudian langsung diminta oleh client.

Event bus menyediakan operasi publish, subscribe, dan unsubscribe melalui modul
terpusat. Service akademik tidak bergantung pada objek koneksi SSE. Kontrak ini
memungkinkan transport event diganti dengan Redis tanpa merombak aturan akademik.

## 4. Koneksi, autentikasi, dan otorisasi

- Satu pengelola koneksi SSE per aplikasi dalam satu tab; komponen berlangganan
  melalui pengelola tersebut, bukan membuka koneksi masing-masing.
- Gunakan streaming `fetch` dengan Bearer token sesuai autentikasi existing.
  Parser wajib menangani event yang terpotong atau tergabung antar-chunk jaringan.
- Jangan menaruh access token pada query URL. Refresh token tetap melalui mekanisme
  sesi existing. Reconnect harus dibatasi dan tidak memicu refresh berulang paralel.
- Server menentukan scope pengguna, Prodi, role aktif, kepemilikan, dan penugasan.
  ID/channel dari client bukan bukti kewenangan.
- Koneksi ditutup saat logout, role berganti, sesi berakhir/dicabut, atau penugasan
  tidak lagi memenuhi izin. Validasi sesi berkala dan pemeriksaan penerima per event
  diperlukan; koneksi yang sudah terbuka bukan izin akses tanpa batas.
- Pengiriman ke antrean koneksi lambat harus dibatasi; koneksi dapat ditutup dan
  disinkronkan ulang agar antrean tidak menghabiskan memori backend.

## 5. Cache dan pembatasan request

- Identitas query mencakup pengguna, role aktif, resource, ID, filter, dan pagination.
  Pergantian akun/role membersihkan atau memisahkan cache untuk mencegah kebocoran.
- Query yang sama berbagi request berjalan; data tidak diminta ulang oleh setiap
  komponen. Mutasi sukses memperbarui atau menginvalidasi query terkait.
- Event berdekatan digabung per resource/query dalam jendela waktu pendek.
  Bulk tidak memicu refetch daftar sekali per item.
- Invalidasi saat request masih berjalan harus menjadwalkan pembacaan berikutnya
  bila hasil request tersebut berpotensi mendahului event. Jangan kehilangan invalidasi.
- Pada tab tersembunyi, perubahan ditandai dan pembacaan ditunda. Saat kembali aktif,
  data yang perlu disegarkan dimuat dengan pembatasan agar tidak terjadi lonjakan.
- PDF dan ZIP dimuat berdasarkan tindakan pengguna, bukan setiap event status.
- Form yang memiliki isian lokal tidak ditimpa otomatis. Tampilkan informasi perubahan
  dan tetap gunakan snapshot/version check server sebelum menyimpan.
- Loading awal boleh memakai skeleton. Refresh latar mempertahankan data yang sudah
  terlihat dan tidak membuka/menutup modal atau mereset pagination tanpa alasan.

Cache terpusat memakai TanStack Query pada implementasi tahap pertama yang disetujui.
Parameter waktu pada bagian cakupan adalah baseline, bukan hasil pengukuran kapasitas
deployment. Dependency tambahan berikutnya mengikuti persetujuan tersendiri.

## 6. Ketahanan dan batas jaminan

Event awal bersifat sementara: tidak ada replay persisten atau jaminan setiap event
tersampaikan. Proses mati setelah commit sebelum publikasi dapat membuat event hilang.
Restart backend menghapus seluruh event dan koneksi dalam memori.

Karena itu wajib ada heartbeat, deteksi koneksi macet, reconnect dengan backoff dan
jitter, serta resinkronisasi query aktif setelah koneksi pulih. Sinkronisasi berkala
berfrekuensi rendah pada tab aktif menjadi pengaman perubahan yang terlewat saat
koneksi tampak sehat; interval ditetapkan melalui pengujian beban. Sinkronisasi saat
tab kembali aktif dan aksi muat ulang manual juga dipertahankan.

Tidak ada jaminan latensi maksimum sebelum interval dan kondisi deployment diuji.
Realtime tidak menggantikan transaksi, histori database, atau pemeriksaan versi.

## 7. Deployment dan Redis

Tahap awal mendukung satu proses backend yang menangani mutasi dan koneksi SSE.
Menambah worker/instance tanpa transport bersama dapat membuat event tidak sampai
ke pengguna di proses lain. Sticky session saja tidak menyelesaikan distribusi ini.

Ketika beberapa proses diperlukan, event bus diganti/dilengkapi adapter Redis Pub/Sub;
setiap proses tetap memeriksa izin koneksi lokalnya. Browser tidak terhubung langsung
ke Redis. Pub/Sub tidak menyediakan replay; pengaman resinkronisasi tetap wajib.
Redis Streams dan transactional outbox baru dinilai jika muncul kebutuhan pengiriman
event persisten, dengan persetujuan schema/dependency/infrastruktur yang relevan.

Proxy deployment harus mendukung streaming: hindari buffering SSE, sesuaikan timeout,
dan pastikan heartbeat serta pemutusan koneksi bekerja. Ukur jumlah koneksi, reconnect,
kegagalan publikasi, antrean lambat, dan jumlah refetch yang dipicu event tanpa
mencatat token atau payload pribadi.

## 8. Tahapan implementasi dan acceptance criteria

1. Fondasi cache client, identitas query, invalidasi, dan pemisahan sesi/role.
2. Satu alur: hasil review proposal berubah → detail pengajuan mahasiswa diperbarui.
3. Pengamanan reconnect, expiry/revocation, tab tersembunyi, request berjalan,
   serta form dengan isian lokal.
4. Perluasan bertahap ke verifikasi, penugasan, finalisasi, dan bimbingan sesuai scope
   yang diminta. Redis tetap ditunda selama backend satu proses.

Uji minimal: commit berhasil mengirim event; rollback tidak mengirim; pengguna asing
dan reviewer nonaktif tidak menerima data; bulk tidak menyebabkan badai request;
event duplikat aman; event selama refetch tidak hilang; logout/role change memutus
koneksi; reconnect dan restart menghasilkan data terbaru; form tidak kehilangan isian;
mutasi tetap sah jika publikasi gagal. Pengujian mutatif hanya pada PostgreSQL TEST.

Fondasi transport/cache dan alur review → mahasiswa sudah diterapkan sesuai cakupan
tahap pertama di atas. Perluasan modul dilakukan bertahap; Redis dan perubahan
database belum diterapkan.


## Penguatan transport setelah verifikasi

- Backoff reconnect naik 1-30 detik (+ jitter sampai 500 ms), termasuk ketika stream
  hanya mengirim ready lalu putus. Reset menunggu data pada koneksi sehat >=60 detik.
- Subscriber diproses independen tanpa menahan respons mutasi untuk menunggu delivery.
  Setiap subscriber memiliki satu delivery aktif dan maksimal 64 hint pending, digabung
  berdasarkan type/resource. Timeout 10 detik atau overflow menutup stream dan membuang
  antrean; ready setelah reconnect memicu resinkronisasi cache.
- Unsubscribe idempotent dan membuang antrean serta timer milik subscription tersebut.
- Publikasi tetap setelah commit; lookup penerima masih awaited. Tidak ada jaminan
  replay event, dan timeout delivery tidak membatalkan query Prisma yang sudah berjalan.
