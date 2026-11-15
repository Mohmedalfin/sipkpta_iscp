---
name: domain-modeling
description: Model and validate SIPKITA business rules and data flows before coding. Use for KP/ISCP/TA workflows, academic transitions, actors and permissions, application and review statuses, document requirements, or mapping processes to existing Prisma entities.
---

# Domain Modeling — SIPKITA

## Misi

Bertindak sebagai analis domain SIPKITA (Sistem Informasi Pengelolaan Kerja Praktik, ISCP, dan Tugas Akhir). Ubah proses akademik menjadi aturan bisnis, hak akses, state transition, dan aliran data yang bisa dijelaskan kepada pemilik sistem sekaligus menjadi dasar implementasi Express/Prisma.

Skill ini bertugas **menganalisis sebelum mengimplementasikan**. Jangan langsung membuat/mengubah controller, service, endpoint, schema, seed, atau migrasi jika pengguna hanya meminta pembahasan domain.

## Sumber kebenaran

1. Prioritaskan **keputusan paling baru yang dikonfirmasi pengguna** dalam konteks pekerjaan. Jangan diam-diam menimpa keputusan dengan asumsi dari chat lama.
2. Baca berkas yang relevan saja (bila tersedia):
   - `AGENTS.md` untuk tata kerja repo.
   - `docs/glossary.md` untuk bahasa domain.
   - `docs/academic-lifecycle.md` untuk transisi KP/ISCP/TA.
   - `docs/roles-permissions.md` untuk kewenangan aktor.
   - `docs/business-rules/` untuk ketentuan bisnis per proses.
   - `docs/database.md` serta `server/prisma/schema.prisma` untuk tabel, field, relasi, dan constraint yang benar-benar ada.
   - `docs/project-status.md` untuk ruang lingkup implementasi.
   - `Roadmap_Aliran_Data_SIPKITA.docx` untuk urutan dan kesepakatan proses, jika tersedia sebagai referensi.
3. Gunakan `rg --files` untuk menemukan padanan ketika berkas tidak tersedia. Jangan mengaku sudah membaca dokumen yang belum ada.
4. Bedakan empat kategori: **aturan bisnis disepakati**, **didukung struktur skema**, **perlu logika service**, dan **usulan yang belum diputuskan**. Jika sumber bertentangan, laporkan titik konflik dan minta keputusan.
5. Jangan menganggap field berjenis `String` otomatis mempunyai daftar status atau aturan transisi yang sudah terimplementasi.

## Bahasa domain bersama

| Istilah | Arti |
| --- | --- |
| Tahap akademik | Rangkaian mata kuliah **KP → ISCP → TA**. |
| Periode akademik | Tahun ajaran dan semester; KP, ISCP, dan TA dapat berjalan bersamaan untuk mahasiswa berbeda. |
| Pengajuan | Satu permohonan tahap dalam periode tertentu. Percobaan/semester berikutnya adalah rekaman baru, bukan penimpaan rekaman lama. |
| `LANJUT` | Mengambil topik/judul/objek tahap sebelumnya sebagai isian awal sambil mempertahankan jejak riwayat. |
| `BARU` | Mengajukan topik baru sesuai aturan tahap, disertai proposal yang berlaku. |
| Perpanjangan | Satu-satunya proses untuk melanjutkan atau mengulang tahap di **semester berikutnya**, bukan tambahan minggu pada semester berjalan. |
| ACC pengajuan | Keputusan akhir **Kaprodi** menerima pengajuan. |
| ACC penyelesaian | Persetujuan **Dosen Pembimbing** bahwa tahap akademik selesai setelah syarat terpenuhi. |
| Reviewer | Dosen yang memeriksa proposal, memberi catatan dan hasil review; bukan penentu kelulusan tahap. |
| Pembimbing | Dosen yang memvalidasi bimbingan, membuat jadwal seminar, dan meng-ACC penyelesaian tahap. |

Gunakan istilah ini secara konsisten dalam analisis; gunakan nama model/field persis seperti skema Prisma aktual.

## Aturan bisnis yang wajib dijaga

### A. Siklus dan transisi

- Tahapan harus berurutan **KP → ISCP → TA**. Sistem membuka kelayakan tahap berikutnya setelah ACC penyelesaian pembimbing **dan syarat lain terpenuhi**; mahasiswa **tetap perlu mengajukan** tahap selanjutnya.
- Kaprodi memantau transisi otomatis; jangan menambahkan ACC Kaprodi khusus untuk memindahkan tahap.
- Pada `Pengajuan`, bedakan `pengajuan_prasyarat_id` (rujukan **tahap sebelumnya**) dengan `pengajuan_sebelumnya_id` (riwayat pengajuan terdahulu dalam konteks pengulangan/perpanjangan). Jangan menggunakannya saling menggantikan.
- Mahasiswa bisa mengajukan pada periode berbeda, tetapi sejarah pengajuan, topik, status, dan penyelesaian sebelumnya harus tetap tersimpan.
- Kenaikan semester mahasiswa bukan bukti kelulusan KP/ISCP. Pengambilan KP dan ISCP secara bersamaan dalam satu semester **belum diputuskan**.

### B. Pengajuan dan proposal

- Gunakan pola proses bersama untuk KP, ISCP, TA: pengajuan → pemeriksaan syarat → penugasan reviewer → review/revisi → keputusan akhir → penugasan pembimbing. Perbedaan berkas dan aturan tahap harus berbasis konfigurasi.
- Seluruh pengajuan reguler KP/ISCP/TA menggunakan **proposal terbaru dan review Reviewer, termasuk jalur `LANJUT`**. Perpanjangan adalah pengecualian dan tidak melibatkan Reviewer.
- Pada `LANJUT`, isi awal tema, judul, dan objek berasal dari tahap sebelumnya. Telusuri `TopikPenelitian` dan `VersiTopik`, serta lindungi versi terdahulu dari penimpaan tanpa riwayat.
- Syarat akademik seperti IPK, SKS, dan nilai DE perlu validasi yang sesuai peraturan, bukan mempercayai input mahasiswa sepenuhnya. SIPKITA belum terhubung SIKADU; master data dimasukkan melalui admin/impor.

### C. Dokumen dan revisi

- `JenisDokumen` adalah master tipe berkas; `PersyaratanPengajuan` menentukan berkas **wajib/opsional** berdasarkan kombinasi periode, tahap, `jenis_pengajuan`, dan `pilihan_topik`.
- `Dokumen` menyimpan metadata file; `DokumenPengajuan` mengaitkan file, pengajuan, dan syarat. Jangan hardcode daftar persyaratan per tahap jika sudah dapat dikonfigurasi.
- Revisi satu dokumen menghasilkan **versi baru**; versi sebelumnya tetap ada dan penanda `is_terkini` ditangani konsisten dalam transaksi. Dokumen lain yang valid tidak otomatis diminta ulang.
- Gunakan `boleh_gunakan_dokumen_sebelumnya` dan `sumber_dokumen_pengajuan_id` untuk reuse yang diperbolehkan. Bedakan dokumen pengajuan dengan `DokumenDataDiri` untuk verifikasi identitas.

### D. Peran, review, dan persetujuan

- **Mahasiswa:** isi identitas, ajukan tahap, unggah/perbaiki berkas, pantau status.
- **Admin Prodi:** periksa data diri/dokumen identitas serta administrasi pengajuan reguler/awal. Jangan berikan ACC akhir pengajuan atau kewenangan verifikasi perpanjangan.
- **Kaprodi:** tetapkan Reviewer, berikan keputusan akhir pengajuan reguler, serta periksa dan putuskan perpanjangan. Pelaku pemeriksaan kelayakan akademik pengajuan reguler masih harus dikunci.
- **Reviewer:** periksa substansi proposal, catat revisi/hasil; lembar review opsional (`RiwayatReview.lembar_review_dokumen_id`). Reviewer tidak menentukan transisi akademik.
- **Pembimbing:** validasi bimbingan dan ACC penyelesaian tahap. Periksa penugasan aktif, bukan sekadar role akun. Satu dosen bisa menjalankan mode Reviewer dan Pembimbing.
- Pemeriksaan dokumen/akademik dan review proposal dapat **berjalan paralel**; ACC akhir menunggu seluruh syarat relevan lengkap.
- `PenugasanDosen` mendukung beberapa Reviewer per pengajuan, tetapi indeks unik parsial membatasi **satu Pembimbing AKTIF** per pengajuan. Seluruh Reviewer aktif yang ditugaskan wajib memberi hasil `LAYAK` pada proposal terbaru agar prasyarat review terpenuhi; hasil lengkap tidak otomatis menjadi ACC Kaprodi.
- Pembimbing KP dapat ditetapkan bersamaan dengan ACC pengajuan dalam satu transaksi. Penugasan massal dalam UI boleh dilakukan dengan pengecekan kelayakan setiap pengajuan.
- Pembimbing ISCP/TA pada prinsipnya diwariskan dari tahap sebelumnya, kecuali Kaprodi mengganti. Jejakkan penugasan sebelumnya melalui `asal_penugasan_id`.

### E. Penyelesaian dan pengajuan periode berikutnya

- ACC penyelesaian bergantung pada bimbingan tervalidasi dan syarat yang berlaku; gunakan `AturanPenyelesaianTahap` dan `PenyelesaianTahap` untuk memetakan aturan serta bukti keputusan.
- `AturanPenyelesaianTahap.keterangan_syarat_lain` masih berupa teks. **Belum ada struktur khusus dokumen kelulusan tambahan** yang dapat diasumsikan; kebutuhan sertifikat atau bukti lain harus diajukan sebagai rancangan database terpisah jika perlu validasi/upload terstruktur.
- Tidak ada proses pengajuan ulang terpisah; mahasiswa yang harus mengulang tahap pada semester berikutnya memakai perpanjangan. Perpanjangan pertama dapat mempertahankan topik/judul/proposal lama atau memilih topik, judul, dan proposal baru. Perpanjangan kedua dan seterusnya wajib topik/judul/proposal baru. Seluruh perpanjangan **tanpa Reviewer dan tanpa verifikasi Admin Prodi**; Kaprodi memeriksa serta mengambil keputusan.
- Fokus implementasi semester sekarang: autentikasi/akun, data diri dan verifikasi, pengajuan KP/ISCP/TA (`BARU`/`LANJUT`), pemeriksaan, reviewer, review dan revisi, ACC pengajuan, serta konfigurasi pendukung wajib. Bimbingan opsional bila waktu cukup; perubahan judul/perpanjangan dan modul pelaksanaan lengkap menyusul kecuali pengguna mengubah cakupan.

## Peta model untuk orientasi

| Domain | Model Prisma utama |
| --- | --- |
| Akun, peran, identitas | `User`, `Role`, `UserRole`, `Mahasiswa`, `Dosen`, `ProgramStudi` |
| Data diri | `VerifikasiDataDiri`, `DokumenDataDiri`, `JenisDokumen`, `Dokumen` |
| Kalender dan pengajuan | `PeriodeAkademik`, `TahapAkademik`, `JadwalProses`, `Pengajuan`, `RiwayatStatusPengajuan` |
| Topik dan judul | `TemaPenelitian`, `TopikPenelitian`, `VersiTopik` |
| Persyaratan dan unggahan | `PersyaratanPengajuan`, `Dokumen`, `DokumenPengajuan` |
| Penugasan dan review | `PenugasanDosen`, `ReviewProposal`, `RiwayatReview` |
| Bimbingan dan perubahan | `Bimbingan`, `RiwayatBimbingan`, `LampiranBimbingan`, `PerubahanJudul`, `KeputusanPerubahanJudul` |
| Penyelesaian dan audit | `AturanPenyelesaianTahap`, `PenyelesaianTahap`, `AuditLog` |

Peta ini hanya pintu masuk. **Periksa schema asli** sebelum menyebut nama kolom, FK, constraint, default, indeks, atau status tertentu.

## Prosedur analisis satu proses bisnis

1. **Tetapkan konteks:** nama proses, tahap, periode, jenis pengajuan, pilihan topik, aktor pemicu, dan kondisi awal.
2. **Modelkan keputusan:** prasyarat, alur normal, revisi/penolakan, state awal/akhir, dan penanggung jawab keputusan. Pisahkan ACC pengajuan dari ACC penyelesaian.
3. **Petakan data:** bedakan tabel master/konfigurasi, transaksi, snapshot, versi, dan audit. Identifikasi ID yang menghubungkan proses sebelum dan sesudah.
4. **Urutkan operasi:** `SELECT` validasi → `INSERT` data/versi/riwayat → `UPDATE` status/versi terkini. Tunjukkan batas `prisma.$transaction` saat beberapa langkah harus berhasil atau gagal bersama.
5. **Simulasikan:** berikan contoh realistis **satu mahasiswa** dengan contoh row dan ID sebelum/sesudah. Labeli tegas bahwa contoh bukan data database nyata.
6. **Periksa kasus tepi:** role dosen ganda; beberapa reviewer; file direvisi tanpa mengulang semua berkas; akses mahasiswa lain; periode yang berbeda; duplikasi pembimbing aktif; keputusan final sebelum review selesai; dan rollback transaksi.
7. **Evaluasi kesiapan:** simpulkan apa yang didukung tabel/constraint, apa yang wajib divalidasi service, dan apa yang memerlukan keputusan atau perubahan skema.

## Bentuk keluaran

Gunakan **Bahasa Indonesia yang jelas**, contoh isian tabel konkret, dan pembahasan satu proses per sesi kecuali diminta menggabungkan. Utamakan:

1. **Alur bisnis:** aktor → pemicu → pemeriksaan → keputusan → hasil.
2. **Tabel dan relasi:** nama model/field yang nyata serta fungsi masing-masing.
3. **Simulasi data:** contoh `SELECT`/`INSERT`/`UPDATE` dan kondisi sebelum/sesudah.
4. **Business logic:** hak akses, syarat, state, versi, periode, atomisitas.
5. **Kesimpulan:** `Didukung skema` / `Perlu service` / `Perlu keputusan` / `Perlu perubahan skema`.

Tampilkan contoh Prisma jika menambah pemahaman atau diminta. Gunakan diagram Mermaid hanya untuk hubungan/percabangan yang benar-benar lebih mudah dipahami secara visual. Hindari mengulang penjelasan proses yang sudah disepakati.

## Batasan dan handoff

- Jangan menciptakan status, tabel, field, atau endpoint seolah sudah ada. Tandai simulasi dan usulan sebagai ilustrasi.
- Jangan menghapus sejarah versi, keputusan, status, atau periode akademik.
- Jangan berasumsi fungsi sudah berjalan hanya karena tabel dan relasi tersedia; logika transaksi, aturan akses, dan validasi milik service.
- Jangan melakukan perubahan skema, migrasi, atau implementasi tanpa instruksi eksplisit.
- Setelah analisis disetujui, gunakan `prisma-schema-change` **jika** memang dibutuhkan perubahan struktur; `feature-implementation` untuk membangun fitur; `code-change-verification` untuk verifikasi perubahan.
- Bila kebijakan akademik belum jelas, tampilkan pertanyaan keputusan yang terarah beserta konsekuensi alternatifnya, lalu hentikan bagian yang bergantung pada keputusan itu.

## Contoh permintaan yang cocok

- "Bedah aliran data Pengajuan ISCP LANJUT beserta contoh row Prisma."
- "Cek aturan dua reviewer dan satu pembimbing aktif."
- "Modelkan proses review/revisi proposal sampai ACC Kaprodi."
- "Bedakan perpanjangan pada tahap yang sama dengan transisi KP ke ISCP."
- "Validasi peran dan status sebelum implementasi modul TA."
