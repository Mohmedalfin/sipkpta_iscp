# Kontrak Notifikasi Dalam Aplikasi ? KP

Status: keputusan Tahap 1, 16 November 2026. Dokumen ini menjadi dasar implementasi
bertahap. Tahap 2?5 telah diimplementasikan pada backend dan lonceng client sesuai cakupan
di bawah. Pembuktian visual mobile di browser tetap diperlukan.

## Tujuan dan identitas

Notifikasi memberi tahu akun yang perlu bertindak atau mengetahui keputusan pada
Pengajuan KP. Inbox adalah **per akun User**, bukan per role. Akun dosen dengan role
Reviewer sekaligus Pembimbing melihat satu inbox; tindakan setelah klik tetap
memerlukan role aktif, penugasan aktif, kepemilikan data, dan status yang sah.
Satu akun tidak menerima dua salinan untuk satu kejadian bisnis yang sama.

`Notifikasi` menyimpan kategori, judul, pesan, tautan internal, pembuat opsional,
dan waktu dibuat. `NotifikasiPenerima` menyimpan akun penerima, status baca,
dan waktu baca secara terpisah. ID BigInt disajikan sebagai string di JSON.

## Pemicu tahap awal

Notifikasi dibuat hanya ketika transisi/rekaman bisnis **baru** berhasil commit;
request idempotent, retry tanpa perubahan, update draf, pembacaan, dan refresh
halaman tidak membuat notifikasi. Proses paralel Admin dan Reviewer tidak saling
menunggu hanya karena notifikasi.

| Kejadian baru | Penerima | Kategori | Tujuan UI saat ini |
| --- | --- | --- | --- |
| Mahasiswa mengirim pengajuan reguler KP `DRAFT ? DIAJUKAN` | Akun Admin Prodi dan Kaprodi berwenang pada Prodi pengajuan | `PENGAJUAN_KP` | Admin: `/admin-prodi/verifikasi-pengajuan-kp`; Kaprodi: `/kaprodi/kp/penugasan-reviewer` |
| Admin memutuskan perbaikan/penolakan/ACC administrasi atau pemeriksaan kategori menghasilkan kebutuhan perbaikan baru | Mahasiswa pemilik | `ADMINISTRASI_KP` | `/mahasiswa/pengajuan/kp` |
| Kaprodi membuat penugasan Reviewer aktif | Akun dosen Reviewer yang ditugaskan | `PENUGASAN_REVIEWER_KP` | `/reviewer/review-kp` |
| Reviewer mengirim hasil `LAYAK` atau `REVISI` pada proposal/versi terkini | Mahasiswa pemilik | `REVIEW_PROPOSAL_KP` | `/mahasiswa/pengajuan/kp` |
| Mahasiswa mengirim revisi proposal baru | Semua Reviewer aktif terkait | `REVISI_PROPOSAL_KP` | `/reviewer/review-kp` |
| Kaprodi memberi keputusan akhir pengajuan atau menetapkan Pembimbing baru | Mahasiswa pemilik; akun Pembimbing baru setelah halaman pembimbing siap | `KEPUTUSAN_KP` / `PENUGASAN_PEMBIMBING_KP` | Mahasiswa: `/mahasiswa/pengajuan/kp`; Pembimbing: belum diaktifkan |

Tindakan bulk mengikuti kejadian per pengajuan yang benar-benar berubah, dengan
pembuatan penerima dibatch dalam transaksi. Penerima yang sama pada satu kejadian
dideduplikasi. Pergantian/nonaktivasi Reviewer tidak dikirim sebagai penugasan baru
kepada Reviewer lama; penerima baru hanya diberi tahu bila penugasan baru terbentuk.

Kesiapan finalisasi untuk Kaprodi **belum menjadi pemicu tahap awal**: halaman
`/kaprodi/kp/finalisasi` masih placeholder, dan perubahan beberapa prasyarat dapat
memunculkan pemberitahuan berulang. Pemicu itu ditetapkan setelah layar tujuan dan
aturan deduplikasinya tersedia. Notifikasi pembimbing baru juga ditunda hingga
rute pembimbing yang berfungsi tersedia.

## Aturan konten dan tautan

Judul menyebut aksi singkat; pesan memberi konteks minimum seperti nomor pengajuan
atau nama mahasiswa yang memang boleh dilihat penerima. Catatan review lengkap,
data pribadi yang tidak perlu, token, URL file, dan isi PDF tidak dimasukkan.
`tautan_internal` hanya rute aplikasi yang diizinkan untuk role tujuan; tidak boleh
berisi URL eksternal atau skema seperti `javascript:`. Saat halaman belum mendukung
deep link ke satu pengajuan, tautan menuju daftar yang sudah berfungsi. UI tidak
boleh mengklaim modal/detail otomatis terbuka dari ID jika belum ada dukungannya.
Jika role aktif tidak cocok, pengguna diarahkan melalui mekanisme pemilihan role
existing sebelum membuka rute. Otorisasi server tetap berlaku saat membuka data.
Notifikasi historis tetap terlihat setelah penugasan dicabut, tanpa memulihkan akses
ke halaman detail atau dokumen. Tautan yang tidak lagi dapat diakses memberi pesan
wajar dan tidak membuka data.

## Status baca dan tampilan

- Membuka dropdown tidak menandai item dibaca.
- Klik item menandai **hanya item milik akun login** sebagai dibaca, lalu menuju
  tautan yang masih valid; navigasi gagal tidak menghapus notifikasi.
- Aksi `Tandai semua dibaca` berlaku pada seluruh notifikasi belum dibaca milik
  akun, termasuk yang tidak muncul pada halaman pertama. Keduanya idempotent.
- Badge menampilkan jumlah belum dibaca aktual; nol menyembunyikan badge.
  Daftar diurutkan terbaru dahulu, dipaginasi, dan dapat difilter dibaca/belum.
- Status baca dan `dibaca_at` milik tiap penerima; satu penerima membaca tidak
  mengubah status penerima lain. Tidak ada hard delete atau kedaluwarsa otomatis.

## Konsistensi dan realtime

Perubahan akademik dan pembuatan notifikasi serta penerimanya berada dalam transaksi
Prisma yang sama. Rollback berarti tidak ada notifikasi. Service wajib memeriksa
apakah transisi/rekaman sumber benar-benar baru sebelum membuat notifikasi; unique
`(notifikasi_id, penerima_user_id)` hanya mencegah penerima ganda pada satu pesan,
bukan dua pesan berbeda untuk kejadian sama. Jika satu transaksi dapat diulang atau
balapan, deduplikasi harus ditautkan pada identitas kejadian bisnis yang stabil dan
diuji terhadap retry/konkurensi; jangan mengandalkan pemeriksaan baca saja.

Setelah commit, event bus/SSE mengirim invalidasi kecil hanya ke akun penerima.
Konten inbox tetap dibaca melalui REST. Koneksi putus tidak menghilangkan catatan:
client memuat ulang count dan daftar saat reconnect/focus, dengan cache bersama dan
penggabungan invalidasi. Perubahan baca disinkronkan ke tab lain akun yang sama.
SSE bukan bukti pengiriman permanen. Perluasan role Pembimbing menunggu pemicu
Pembimbing diaktifkan.

## Batas implementasi

Scope awal hanya notifikasi **dalam aplikasi** untuk kejadian KP pada tabel yang
sudah ada. Email, WhatsApp, push, pengingat waktu, ISCP/TA, dan notifikasi seminar
memerlukan kontrak terpisah. Tidak ada perubahan schema atau migrasi yang disetujui
oleh dokumen ini. Tahap selanjutnya: API inbox/count/baca, integrasi transaksi KP,
event realtime, lalu penggantian konten contoh di lonceng client.


## Status implementasi tahap 4?5

Event `notifikasi.updated` dikirim hanya kepada akun penerima sesudah transaksi
serializable berhasil commit. Event baca satu/semua menyegarkan tab lain akun yang sama.
Koneksi SSE existing juga menerima role Pembimbing untuk pembaruan inbox. Client
menginvalidasi query count dan daftar, menggabungkan event dekat, menunda refetch saat
tab tersembunyi, dan menyinkron ulang setelah reconnect. Lonceng memakai data API;
panel mobile mengikuti lebar viewport dan daftar bergulir. Pengujian otomatis backend,
HTTP SSE, PostgreSQL TEST, cache, dan build telah dijalankan. Uji visual pada browser
mobile dan lintas dua tab nyata masih perlu dilakukan.
