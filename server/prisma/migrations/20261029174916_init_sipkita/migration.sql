-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "login_id" VARCHAR(50) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status_akun" VARCHAR(20) NOT NULL DEFAULT 'AKTIF',
    "last_login_at" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "kode_peran" VARCHAR(30) NOT NULL,
    "nama_peran" VARCHAR(100) NOT NULL,
    "deskripsi" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" INTEGER,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "program_studi" (
    "id" SERIAL NOT NULL,
    "kode_prodi" VARCHAR(30),
    "nama_prodi" VARCHAR(150) NOT NULL,
    "jenjang" VARCHAR(10) NOT NULL,
    "nama_fakultas" VARCHAR(150) NOT NULL,
    "nama_perguruan_tinggi" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_studi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mahasiswa" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "program_studi_id" INTEGER NOT NULL,
    "nim" VARCHAR(25) NOT NULL,
    "nama_lengkap" VARCHAR(150) NOT NULL,
    "nik_kependudukan" VARCHAR(16),
    "tempat_lahir" VARCHAR(100),
    "tanggal_lahir" DATE NOT NULL,
    "no_telepon" VARCHAR(20),
    "alamat" TEXT,
    "tahun_angkatan" SMALLINT,
    "status_data" VARCHAR(20) NOT NULL DEFAULT 'AKTIF',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mahasiswa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dosen" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "program_studi_id" INTEGER NOT NULL,
    "kode_dosen" VARCHAR(25) NOT NULL,
    "nidn" VARCHAR(20),
    "nama_lengkap" VARCHAR(150) NOT NULL,
    "no_telepon" VARCHAR(20),
    "tanggal_lahir" DATE NOT NULL,
    "jabatan_fungsional" VARCHAR(100),
    "is_homebase_si" BOOLEAN NOT NULL DEFAULT false,
    "status_data" VARCHAR(20) NOT NULL DEFAULT 'AKTIF',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dosen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifikasi_data_diri" (
    "id" SERIAL NOT NULL,
    "mahasiswa_id" INTEGER NOT NULL,
    "status_verifikasi" VARCHAR(30) NOT NULL DEFAULT 'BELUM_DIVERIFIKASI',
    "catatan_admin" TEXT,
    "diajukan_at" TIMESTAMPTZ(6),
    "diperiksa_oleh_user_id" INTEGER,
    "diperiksa_at" TIMESTAMPTZ(6),
    "diverifikasi_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verifikasi_data_diri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumen_data_diri" (
    "id" SERIAL NOT NULL,
    "verifikasi_data_diri_id" INTEGER NOT NULL,
    "jenis_dokumen_id" INTEGER NOT NULL,
    "dokumen_id" INTEGER NOT NULL,
    "versi" INTEGER NOT NULL DEFAULT 1,
    "is_terkini" BOOLEAN NOT NULL DEFAULT true,
    "status_dokumen" VARCHAR(30) NOT NULL DEFAULT 'BELUM_DIPERIKSA',
    "catatan_admin" TEXT,
    "diperiksa_oleh_user_id" INTEGER,
    "diperiksa_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dokumen_data_diri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" SERIAL NOT NULL,
    "jenis_data" VARCHAR(20) NOT NULL,
    "nama_file" VARCHAR(255) NOT NULL,
    "lokasi_file" VARCHAR(500),
    "status_import" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "jumlah_baris" INTEGER NOT NULL DEFAULT 0,
    "jumlah_valid" INTEGER NOT NULL DEFAULT 0,
    "jumlah_tidak_valid" INTEGER NOT NULL DEFAULT 0,
    "jumlah_berhasil" INTEGER NOT NULL DEFAULT 0,
    "jumlah_dilewati" INTEGER NOT NULL DEFAULT 0,
    "jumlah_gagal" INTEGER NOT NULL DEFAULT 0,
    "ringkasan_kesalahan" JSONB,
    "diunggah_oleh_user_id" INTEGER NOT NULL,
    "dikonfirmasi_oleh_user_id" INTEGER,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "aktor_user_id" INTEGER,
    "aksi" VARCHAR(80) NOT NULL,
    "entitas" VARCHAR(80) NOT NULL,
    "entitas_id" BIGINT,
    "data_sebelum" JSONB,
    "data_sesudah" JSONB,
    "keterangan" TEXT,
    "alamat_ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periode_akademik" (
    "id" SERIAL NOT NULL,
    "tahun_ajaran" VARCHAR(9) NOT NULL,
    "semester" VARCHAR(10) NOT NULL,
    "tanggal_mulai" DATE NOT NULL,
    "tanggal_selesai" DATE NOT NULL,
    "status_periode" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "periode_akademik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tahap_akademik" (
    "id" SERIAL NOT NULL,
    "kode_tahap" VARCHAR(10) NOT NULL,
    "nama_tahap" VARCHAR(100) NOT NULL,
    "urutan" SMALLINT NOT NULL,
    "maks_perpanjangan" SMALLINT,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tahap_akademik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal_proses" (
    "id" SERIAL NOT NULL,
    "periode_akademik_id" INTEGER NOT NULL,
    "tahap_akademik_id" INTEGER NOT NULL,
    "jenis_proses" VARCHAR(40) NOT NULL,
    "tanggal_buka" TIMESTAMPTZ(6) NOT NULL,
    "tanggal_tutup" TIMESTAMPTZ(6) NOT NULL,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "keterangan" TEXT,
    "dibuat_oleh_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jadwal_proses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengajuan" (
    "id" SERIAL NOT NULL,
    "nomor_pengajuan" VARCHAR(40),
    "mahasiswa_id" INTEGER NOT NULL,
    "periode_akademik_id" INTEGER NOT NULL,
    "tahap_akademik_id" INTEGER NOT NULL,
    "jenis_pengajuan" VARCHAR(20) NOT NULL,
    "pilihan_topik" VARCHAR(20) NOT NULL,
    "topik_penelitian_id" INTEGER,
    "versi_topik_id" INTEGER,
    "pengajuan_prasyarat_id" INTEGER,
    "pengajuan_sebelumnya_id" INTEGER,
    "usulan_pembimbing_id" INTEGER,
    "ipk_saat_pengajuan" DECIMAL(3,2),
    "jumlah_sks_saat_pengajuan" SMALLINT,
    "memiliki_nilai_de" BOOLEAN,
    "daftar_mk_nilai_de" TEXT,
    "status_pemeriksaan_akademik" VARCHAR(30) NOT NULL DEFAULT 'BELUM_DIPERIKSA',
    "catatan_pemeriksaan_akademik" TEXT,
    "akademik_diperiksa_oleh_user_id" INTEGER,
    "akademik_diperiksa_at" TIMESTAMPTZ(6),
    "status_pengajuan" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "status_pengerjaan" VARCHAR(30),
    "catatan_keputusan" TEXT,
    "diputuskan_oleh_user_id" INTEGER,
    "diputuskan_at" TIMESTAMPTZ(6),
    "diajukan_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pengajuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tema_penelitian" (
    "id" SERIAL NOT NULL,
    "kode_tema" VARCHAR(30) NOT NULL,
    "nama_tema" VARCHAR(150) NOT NULL,
    "deskripsi" TEXT,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tema_penelitian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topik_penelitian" (
    "id" SERIAL NOT NULL,
    "mahasiswa_id" INTEGER NOT NULL,
    "tema_penelitian_id" INTEGER NOT NULL,
    "status_topik" VARCHAR(20) NOT NULL DEFAULT 'AKTIF',
    "alasan_penutupan" VARCHAR(50),
    "ditutup_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "topik_penelitian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versi_topik" (
    "id" SERIAL NOT NULL,
    "topik_penelitian_id" INTEGER NOT NULL,
    "nomor_versi" SMALLINT NOT NULL,
    "judul_penelitian" VARCHAR(255) NOT NULL,
    "objek_penelitian" VARCHAR(255),
    "lokasi_penelitian" TEXT,
    "perubahan_judul_id" INTEGER,
    "status_versi" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "berlaku_mulai_at" TIMESTAMPTZ(6),
    "berlaku_selesai_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "versi_topik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_status_pengajuan" (
    "id" BIGSERIAL NOT NULL,
    "pengajuan_id" INTEGER NOT NULL,
    "jenis_status" VARCHAR(20) NOT NULL,
    "status_sebelum" VARCHAR(30),
    "status_sesudah" VARCHAR(30) NOT NULL,
    "diubah_oleh_user_id" INTEGER,
    "catatan" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_status_pengajuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenis_dokumen" (
    "id" SERIAL NOT NULL,
    "kode_jenis" VARCHAR(50) NOT NULL,
    "nama_jenis" VARCHAR(150) NOT NULL,
    "kategori_dokumen" VARCHAR(30) NOT NULL,
    "deskripsi" TEXT,
    "format_diizinkan" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maks_ukuran_mb" SMALLINT,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jenis_dokumen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persyaratan_pengajuan" (
    "id" SERIAL NOT NULL,
    "periode_akademik_id" INTEGER NOT NULL,
    "tahap_akademik_id" INTEGER NOT NULL,
    "jenis_pengajuan" VARCHAR(20) NOT NULL,
    "pilihan_topik" VARCHAR(20) NOT NULL,
    "jenis_dokumen_id" INTEGER NOT NULL,
    "is_wajib" BOOLEAN NOT NULL DEFAULT true,
    "boleh_gunakan_dokumen_sebelumnya" BOOLEAN NOT NULL DEFAULT false,
    "petunjuk" TEXT,
    "urutan_tampil" SMALLINT NOT NULL DEFAULT 1,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "persyaratan_pengajuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumen" (
    "id" SERIAL NOT NULL,
    "diunggah_oleh_user_id" INTEGER NOT NULL,
    "nama_file_asli" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "ukuran_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dokumen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumen_pengajuan" (
    "id" SERIAL NOT NULL,
    "pengajuan_id" INTEGER NOT NULL,
    "persyaratan_pengajuan_id" INTEGER NOT NULL,
    "dokumen_id" INTEGER NOT NULL,
    "nomor_versi" SMALLINT NOT NULL DEFAULT 1,
    "is_terkini" BOOLEAN NOT NULL DEFAULT true,
    "sumber_dokumen" VARCHAR(20) NOT NULL DEFAULT 'UNGGAH_BARU',
    "sumber_dokumen_pengajuan_id" INTEGER,
    "status_pemeriksaan" VARCHAR(30) NOT NULL DEFAULT 'BELUM_DIPERIKSA',
    "catatan_pemeriksaan" TEXT,
    "diperiksa_oleh_user_id" INTEGER,
    "diperiksa_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dokumen_pengajuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penugasan_dosen" (
    "id" SERIAL NOT NULL,
    "pengajuan_id" INTEGER NOT NULL,
    "dosen_id" INTEGER NOT NULL,
    "jenis_penugasan" VARCHAR(20) NOT NULL,
    "asal_penugasan_id" INTEGER,
    "sumber_penugasan" VARCHAR(20) NOT NULL,
    "ditetapkan_oleh_user_id" INTEGER,
    "status_penugasan" VARCHAR(20) NOT NULL DEFAULT 'AKTIF',
    "mulai_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "berakhir_at" TIMESTAMPTZ(6),
    "alasan_perubahan" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "penugasan_dosen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_proposal" (
    "id" SERIAL NOT NULL,
    "penugasan_dosen_id" INTEGER NOT NULL,
    "status_review" VARCHAR(30) NOT NULL DEFAULT 'BELUM_DIPERIKSA',
    "hasil_review" VARCHAR(30),
    "catatan_akhir" TEXT,
    "mulai_review_at" TIMESTAMPTZ(6),
    "selesai_review_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "review_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_review" (
    "id" BIGSERIAL NOT NULL,
    "review_proposal_id" INTEGER NOT NULL,
    "putaran_ke" SMALLINT NOT NULL,
    "dokumen_pengajuan_id" INTEGER NOT NULL,
    "versi_topik_id" INTEGER NOT NULL,
    "hasil_review" VARCHAR(30) NOT NULL,
    "catatan_reviewer" TEXT,
    "lembar_review_dokumen_id" INTEGER,
    "direview_oleh_user_id" INTEGER NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bimbingan" (
    "id" SERIAL NOT NULL,
    "pengajuan_id" INTEGER NOT NULL,
    "jenis_bimbingan" VARCHAR(10) NOT NULL,
    "tanggal_bimbingan" DATE,
    "ringkasan" TEXT,
    "status_bimbingan" VARCHAR(25) NOT NULL DEFAULT 'DRAFT',
    "versi_pengiriman_terakhir" SMALLINT NOT NULL DEFAULT 0,
    "catatan_pembimbing_terakhir" TEXT,
    "diperiksa_oleh_user_id" INTEGER,
    "diperiksa_at" TIMESTAMPTZ(6),
    "diajukan_pertama_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bimbingan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_bimbingan" (
    "id" BIGSERIAL NOT NULL,
    "bimbingan_id" INTEGER NOT NULL,
    "dilakukan_oleh_user_id" INTEGER NOT NULL,
    "aksi" VARCHAR(30) NOT NULL,
    "versi_pengiriman" SMALLINT NOT NULL,
    "status_sebelum" VARCHAR(25),
    "status_sesudah" VARCHAR(25) NOT NULL,
    "tanggal_bimbingan_snapshot" DATE,
    "ringkasan_snapshot" TEXT,
    "catatan" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_bimbingan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lampiran_bimbingan" (
    "id" SERIAL NOT NULL,
    "riwayat_bimbingan_id" BIGINT NOT NULL,
    "dokumen_id" INTEGER NOT NULL,
    "jenis_lampiran" VARCHAR(25) NOT NULL,
    "keterangan" TEXT,
    "urutan_tampil" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lampiran_bimbingan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perubahan_judul" (
    "id" SERIAL NOT NULL,
    "pengajuan_id" INTEGER NOT NULL,
    "versi_topik_asal_id" INTEGER NOT NULL,
    "judul_usulan" VARCHAR(255) NOT NULL,
    "objek_usulan" VARCHAR(255) NOT NULL,
    "lokasi_usulan" VARCHAR(255),
    "alasan_perubahan" TEXT NOT NULL,
    "proposal_perubahan_dokumen_id" INTEGER,
    "status_perubahan" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "diajukan_at" TIMESTAMPTZ(6),
    "diputuskan_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "perubahan_judul_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keputusan_perubahan_judul" (
    "id" SERIAL NOT NULL,
    "perubahan_judul_id" INTEGER NOT NULL,
    "diperiksa_oleh_user_id" INTEGER NOT NULL,
    "peran_pemeriksa" VARCHAR(20) NOT NULL,
    "putaran_ke" SMALLINT NOT NULL DEFAULT 1,
    "keputusan" VARCHAR(20) NOT NULL,
    "catatan" TEXT,
    "judul_diperiksa_snapshot" VARCHAR(255) NOT NULL,
    "objek_diperiksa_snapshot" VARCHAR(255) NOT NULL,
    "lokasi_diperiksa_snapshot" VARCHAR(255),
    "proposal_dokumen_id" INTEGER NOT NULL,
    "diputuskan_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keputusan_perubahan_judul_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penyelesaian_tahap" (
    "id" SERIAL NOT NULL,
    "pengajuan_id" INTEGER NOT NULL,
    "aturan_penyelesaian_tahap_id" INTEGER NOT NULL,
    "jumlah_bimbingan_saat_acc" SMALLINT NOT NULL,
    "minimal_bimbingan_saat_acc" SMALLINT NOT NULL,
    "catatan_penyelesaian" TEXT,
    "disetujui_oleh_user_id" INTEGER NOT NULL,
    "disetujui_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penyelesaian_tahap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal_seminar" (
    "id" SERIAL NOT NULL,
    "pengajuan_id" INTEGER NOT NULL,
    "mulai_at" TIMESTAMPTZ(6) NOT NULL,
    "selesai_at" TIMESTAMPTZ(6),
    "jenis_pelaksanaan" VARCHAR(10) NOT NULL,
    "lokasi_seminar" VARCHAR(255),
    "tautan_seminar" VARCHAR(500),
    "keterangan" TEXT,
    "status_jadwal" VARCHAR(20) NOT NULL DEFAULT 'TERJADWAL',
    "dibuat_oleh_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jadwal_seminar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_jadwal_seminar" (
    "id" BIGSERIAL NOT NULL,
    "jadwal_seminar_id" INTEGER NOT NULL,
    "aksi" VARCHAR(20) NOT NULL,
    "mulai_at_snapshot" TIMESTAMPTZ(6) NOT NULL,
    "selesai_at_snapshot" TIMESTAMPTZ(6),
    "jenis_pelaksanaan_snapshot" VARCHAR(10) NOT NULL,
    "lokasi_snapshot" VARCHAR(255),
    "tautan_snapshot" VARCHAR(500),
    "keterangan_snapshot" TEXT,
    "status_snapshot" VARCHAR(20) NOT NULL,
    "alasan_perubahan" TEXT,
    "dilakukan_oleh_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_jadwal_seminar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifikasi" (
    "id" BIGSERIAL NOT NULL,
    "kategori_notifikasi" VARCHAR(40) NOT NULL,
    "judul" VARCHAR(200) NOT NULL,
    "pesan" TEXT NOT NULL,
    "tautan_internal" VARCHAR(255),
    "dibuat_oleh_user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifikasi_penerima" (
    "id" BIGSERIAL NOT NULL,
    "notifikasi_id" BIGINT NOT NULL,
    "penerima_user_id" INTEGER NOT NULL,
    "status_dibaca" BOOLEAN NOT NULL DEFAULT false,
    "dibaca_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifikasi_penerima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_dokumen" (
    "id" SERIAL NOT NULL,
    "kode_template" VARCHAR(40) NOT NULL,
    "nama_template" VARCHAR(150) NOT NULL,
    "versi" SMALLINT NOT NULL,
    "sumber_template" VARCHAR(20) NOT NULL,
    "renderer_key" VARCHAR(100),
    "file_template_dokumen_id" INTEGER,
    "keterangan" TEXT,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuat_oleh_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "template_dokumen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aturan_penyelesaian_tahap" (
    "id" SERIAL NOT NULL,
    "tahap_akademik_id" INTEGER NOT NULL,
    "periode_akademik_id" INTEGER NOT NULL,
    "minimal_bimbingan" SMALLINT NOT NULL,
    "keterangan_syarat_lain" TEXT,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "ditetapkan_oleh_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "aturan_penyelesaian_tahap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_id_key" ON "users"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_kode_peran_key" ON "roles"("kode_peran");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_roles_assigned_by_user_id_idx" ON "user_roles"("assigned_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "program_studi_kode_prodi_key" ON "program_studi"("kode_prodi");

-- CreateIndex
CREATE UNIQUE INDEX "mahasiswa_user_id_key" ON "mahasiswa"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mahasiswa_nim_key" ON "mahasiswa"("nim");

-- CreateIndex
CREATE UNIQUE INDEX "mahasiswa_nik_kependudukan_key" ON "mahasiswa"("nik_kependudukan");

-- CreateIndex
CREATE INDEX "mahasiswa_program_studi_id_idx" ON "mahasiswa"("program_studi_id");

-- CreateIndex
CREATE UNIQUE INDEX "dosen_user_id_key" ON "dosen"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dosen_kode_dosen_key" ON "dosen"("kode_dosen");

-- CreateIndex
CREATE UNIQUE INDEX "dosen_nidn_key" ON "dosen"("nidn");

-- CreateIndex
CREATE INDEX "dosen_program_studi_id_idx" ON "dosen"("program_studi_id");

-- CreateIndex
CREATE UNIQUE INDEX "verifikasi_data_diri_mahasiswa_id_key" ON "verifikasi_data_diri"("mahasiswa_id");

-- CreateIndex
CREATE INDEX "verifikasi_data_diri_diperiksa_oleh_user_id_idx" ON "verifikasi_data_diri"("diperiksa_oleh_user_id");

-- CreateIndex
CREATE INDEX "dokumen_data_diri_jenis_dokumen_id_idx" ON "dokumen_data_diri"("jenis_dokumen_id");

-- CreateIndex
CREATE INDEX "dokumen_data_diri_dokumen_id_idx" ON "dokumen_data_diri"("dokumen_id");

-- CreateIndex
CREATE INDEX "dokumen_data_diri_diperiksa_oleh_user_id_idx" ON "dokumen_data_diri"("diperiksa_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dokumen_data_diri_verifikasi_data_diri_id_jenis_dokumen_id__key" ON "dokumen_data_diri"("verifikasi_data_diri_id", "jenis_dokumen_id", "versi");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dokumen_diri_terkini" ON "dokumen_data_diri"("verifikasi_data_diri_id", "jenis_dokumen_id") WHERE ("is_terkini" = true);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "import_batches_diunggah_oleh_user_id_idx" ON "import_batches"("diunggah_oleh_user_id");

-- CreateIndex
CREATE INDEX "import_batches_dikonfirmasi_oleh_user_id_idx" ON "import_batches"("dikonfirmasi_oleh_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_aktor_user_id_idx" ON "audit_logs"("aktor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entitas_entitas_id_idx" ON "audit_logs"("entitas", "entitas_id");

-- CreateIndex
CREATE UNIQUE INDEX "periode_akademik_tahun_ajaran_semester_key" ON "periode_akademik"("tahun_ajaran", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "tahap_akademik_kode_tahap_key" ON "tahap_akademik"("kode_tahap");

-- CreateIndex
CREATE UNIQUE INDEX "tahap_akademik_urutan_key" ON "tahap_akademik"("urutan");

-- CreateIndex
CREATE INDEX "jadwal_proses_tahap_akademik_id_idx" ON "jadwal_proses"("tahap_akademik_id");

-- CreateIndex
CREATE INDEX "jadwal_proses_dibuat_oleh_user_id_idx" ON "jadwal_proses"("dibuat_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "jadwal_proses_periode_akademik_id_tahap_akademik_id_jenis_p_key" ON "jadwal_proses"("periode_akademik_id", "tahap_akademik_id", "jenis_proses");

-- CreateIndex
CREATE UNIQUE INDEX "pengajuan_nomor_pengajuan_key" ON "pengajuan"("nomor_pengajuan");

-- CreateIndex
CREATE INDEX "pengajuan_mahasiswa_id_tahap_akademik_id_periode_akademik_i_idx" ON "pengajuan"("mahasiswa_id", "tahap_akademik_id", "periode_akademik_id");

-- CreateIndex
CREATE INDEX "pengajuan_periode_akademik_id_idx" ON "pengajuan"("periode_akademik_id");

-- CreateIndex
CREATE INDEX "pengajuan_tahap_akademik_id_idx" ON "pengajuan"("tahap_akademik_id");

-- CreateIndex
CREATE INDEX "pengajuan_topik_penelitian_id_idx" ON "pengajuan"("topik_penelitian_id");

-- CreateIndex
CREATE INDEX "pengajuan_versi_topik_id_idx" ON "pengajuan"("versi_topik_id");

-- CreateIndex
CREATE INDEX "pengajuan_pengajuan_prasyarat_id_idx" ON "pengajuan"("pengajuan_prasyarat_id");

-- CreateIndex
CREATE INDEX "pengajuan_pengajuan_sebelumnya_id_idx" ON "pengajuan"("pengajuan_sebelumnya_id");

-- CreateIndex
CREATE INDEX "pengajuan_usulan_pembimbing_id_idx" ON "pengajuan"("usulan_pembimbing_id");

-- CreateIndex
CREATE INDEX "pengajuan_akademik_diperiksa_oleh_user_id_idx" ON "pengajuan"("akademik_diperiksa_oleh_user_id");

-- CreateIndex
CREATE INDEX "pengajuan_diputuskan_oleh_user_id_idx" ON "pengajuan"("diputuskan_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tema_penelitian_kode_tema_key" ON "tema_penelitian"("kode_tema");

-- CreateIndex
CREATE UNIQUE INDEX "tema_penelitian_nama_tema_key" ON "tema_penelitian"("nama_tema");

-- CreateIndex
CREATE INDEX "topik_penelitian_mahasiswa_id_idx" ON "topik_penelitian"("mahasiswa_id");

-- CreateIndex
CREATE INDEX "topik_penelitian_tema_penelitian_id_idx" ON "topik_penelitian"("tema_penelitian_id");

-- CreateIndex
CREATE UNIQUE INDEX "versi_topik_perubahan_judul_id_key" ON "versi_topik"("perubahan_judul_id");

-- CreateIndex
CREATE UNIQUE INDEX "versi_topik_topik_penelitian_id_nomor_versi_key" ON "versi_topik"("topik_penelitian_id", "nomor_versi");

-- CreateIndex
CREATE INDEX "riwayat_status_pengajuan_pengajuan_id_created_at_idx" ON "riwayat_status_pengajuan"("pengajuan_id", "created_at");

-- CreateIndex
CREATE INDEX "riwayat_status_pengajuan_diubah_oleh_user_id_idx" ON "riwayat_status_pengajuan"("diubah_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "jenis_dokumen_kode_jenis_key" ON "jenis_dokumen"("kode_jenis");

-- CreateIndex
CREATE INDEX "persyaratan_pengajuan_tahap_akademik_id_idx" ON "persyaratan_pengajuan"("tahap_akademik_id");

-- CreateIndex
CREATE INDEX "persyaratan_pengajuan_jenis_dokumen_id_idx" ON "persyaratan_pengajuan"("jenis_dokumen_id");

-- CreateIndex
CREATE UNIQUE INDEX "persyaratan_pengajuan_periode_akademik_id_tahap_akademik_id_key" ON "persyaratan_pengajuan"("periode_akademik_id", "tahap_akademik_id", "jenis_pengajuan", "pilihan_topik", "jenis_dokumen_id");

-- CreateIndex
CREATE UNIQUE INDEX "dokumen_storage_key_key" ON "dokumen"("storage_key");

-- CreateIndex
CREATE INDEX "dokumen_diunggah_oleh_user_id_idx" ON "dokumen"("diunggah_oleh_user_id");

-- CreateIndex
CREATE INDEX "dokumen_pengajuan_persyaratan_pengajuan_id_idx" ON "dokumen_pengajuan"("persyaratan_pengajuan_id");

-- CreateIndex
CREATE INDEX "dokumen_pengajuan_dokumen_id_idx" ON "dokumen_pengajuan"("dokumen_id");

-- CreateIndex
CREATE INDEX "dokumen_pengajuan_sumber_dokumen_pengajuan_id_idx" ON "dokumen_pengajuan"("sumber_dokumen_pengajuan_id");

-- CreateIndex
CREATE INDEX "dokumen_pengajuan_diperiksa_oleh_user_id_idx" ON "dokumen_pengajuan"("diperiksa_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dokumen_pengajuan_pengajuan_id_persyaratan_pengajuan_id_nom_key" ON "dokumen_pengajuan"("pengajuan_id", "persyaratan_pengajuan_id", "nomor_versi");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dokumen_pengajuan_terkini" ON "dokumen_pengajuan"("pengajuan_id", "persyaratan_pengajuan_id") WHERE ("is_terkini" = true);

-- CreateIndex
CREATE INDEX "penugasan_dosen_pengajuan_id_jenis_penugasan_status_penugas_idx" ON "penugasan_dosen"("pengajuan_id", "jenis_penugasan", "status_penugasan");

-- CreateIndex
CREATE INDEX "penugasan_dosen_dosen_id_idx" ON "penugasan_dosen"("dosen_id");

-- CreateIndex
CREATE INDEX "penugasan_dosen_asal_penugasan_id_idx" ON "penugasan_dosen"("asal_penugasan_id");

-- CreateIndex
CREATE INDEX "penugasan_dosen_ditetapkan_oleh_user_id_idx" ON "penugasan_dosen"("ditetapkan_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pembimbing_aktif" ON "penugasan_dosen"("pengajuan_id") WHERE ("jenis_penugasan" = 'PEMBIMBING' AND "status_penugasan" = 'AKTIF');

-- CreateIndex
CREATE UNIQUE INDEX "review_proposal_penugasan_dosen_id_key" ON "review_proposal"("penugasan_dosen_id");

-- CreateIndex
CREATE INDEX "riwayat_review_dokumen_pengajuan_id_idx" ON "riwayat_review"("dokumen_pengajuan_id");

-- CreateIndex
CREATE INDEX "riwayat_review_versi_topik_id_idx" ON "riwayat_review"("versi_topik_id");

-- CreateIndex
CREATE INDEX "riwayat_review_lembar_review_dokumen_id_idx" ON "riwayat_review"("lembar_review_dokumen_id");

-- CreateIndex
CREATE INDEX "riwayat_review_direview_oleh_user_id_idx" ON "riwayat_review"("direview_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "riwayat_review_review_proposal_id_putaran_ke_key" ON "riwayat_review"("review_proposal_id", "putaran_ke");

-- CreateIndex
CREATE INDEX "bimbingan_pengajuan_id_status_bimbingan_idx" ON "bimbingan"("pengajuan_id", "status_bimbingan");

-- CreateIndex
CREATE INDEX "bimbingan_diperiksa_oleh_user_id_idx" ON "bimbingan"("diperiksa_oleh_user_id");

-- CreateIndex
CREATE INDEX "riwayat_bimbingan_bimbingan_id_created_at_idx" ON "riwayat_bimbingan"("bimbingan_id", "created_at");

-- CreateIndex
CREATE INDEX "riwayat_bimbingan_dilakukan_oleh_user_id_idx" ON "riwayat_bimbingan"("dilakukan_oleh_user_id");

-- CreateIndex
CREATE INDEX "lampiran_bimbingan_riwayat_bimbingan_id_idx" ON "lampiran_bimbingan"("riwayat_bimbingan_id");

-- CreateIndex
CREATE INDEX "lampiran_bimbingan_dokumen_id_idx" ON "lampiran_bimbingan"("dokumen_id");

-- CreateIndex
CREATE INDEX "perubahan_judul_pengajuan_id_idx" ON "perubahan_judul"("pengajuan_id");

-- CreateIndex
CREATE INDEX "perubahan_judul_versi_topik_asal_id_idx" ON "perubahan_judul"("versi_topik_asal_id");

-- CreateIndex
CREATE INDEX "perubahan_judul_proposal_perubahan_dokumen_id_idx" ON "perubahan_judul"("proposal_perubahan_dokumen_id");

-- CreateIndex
CREATE INDEX "keputusan_perubahan_judul_perubahan_judul_id_putaran_ke_idx" ON "keputusan_perubahan_judul"("perubahan_judul_id", "putaran_ke");

-- CreateIndex
CREATE INDEX "keputusan_perubahan_judul_diperiksa_oleh_user_id_idx" ON "keputusan_perubahan_judul"("diperiksa_oleh_user_id");

-- CreateIndex
CREATE INDEX "keputusan_perubahan_judul_proposal_dokumen_id_idx" ON "keputusan_perubahan_judul"("proposal_dokumen_id");

-- CreateIndex
CREATE UNIQUE INDEX "penyelesaian_tahap_pengajuan_id_key" ON "penyelesaian_tahap"("pengajuan_id");

-- CreateIndex
CREATE INDEX "penyelesaian_tahap_aturan_penyelesaian_tahap_id_idx" ON "penyelesaian_tahap"("aturan_penyelesaian_tahap_id");

-- CreateIndex
CREATE INDEX "penyelesaian_tahap_disetujui_oleh_user_id_idx" ON "penyelesaian_tahap"("disetujui_oleh_user_id");

-- CreateIndex
CREATE INDEX "jadwal_seminar_pengajuan_id_status_jadwal_idx" ON "jadwal_seminar"("pengajuan_id", "status_jadwal");

-- CreateIndex
CREATE INDEX "jadwal_seminar_dibuat_oleh_user_id_idx" ON "jadwal_seminar"("dibuat_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_seminar_terjadwal" ON "jadwal_seminar"("pengajuan_id") WHERE ("status_jadwal" = 'TERJADWAL');

-- CreateIndex
CREATE INDEX "riwayat_jadwal_seminar_jadwal_seminar_id_created_at_idx" ON "riwayat_jadwal_seminar"("jadwal_seminar_id", "created_at");

-- CreateIndex
CREATE INDEX "riwayat_jadwal_seminar_dilakukan_oleh_user_id_idx" ON "riwayat_jadwal_seminar"("dilakukan_oleh_user_id");

-- CreateIndex
CREATE INDEX "notifikasi_dibuat_oleh_user_id_idx" ON "notifikasi"("dibuat_oleh_user_id");

-- CreateIndex
CREATE INDEX "notifikasi_penerima_penerima_user_id_status_dibaca_idx" ON "notifikasi_penerima"("penerima_user_id", "status_dibaca");

-- CreateIndex
CREATE UNIQUE INDEX "notifikasi_penerima_notifikasi_id_penerima_user_id_key" ON "notifikasi_penerima"("notifikasi_id", "penerima_user_id");

-- CreateIndex
CREATE INDEX "template_dokumen_file_template_dokumen_id_idx" ON "template_dokumen"("file_template_dokumen_id");

-- CreateIndex
CREATE INDEX "template_dokumen_dibuat_oleh_user_id_idx" ON "template_dokumen"("dibuat_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_dokumen_kode_template_versi_key" ON "template_dokumen"("kode_template", "versi");

-- CreateIndex
CREATE INDEX "aturan_penyelesaian_tahap_periode_akademik_id_idx" ON "aturan_penyelesaian_tahap"("periode_akademik_id");

-- CreateIndex
CREATE INDEX "aturan_penyelesaian_tahap_ditetapkan_oleh_user_id_idx" ON "aturan_penyelesaian_tahap"("ditetapkan_oleh_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "aturan_penyelesaian_tahap_tahap_akademik_id_periode_akademi_key" ON "aturan_penyelesaian_tahap"("tahap_akademik_id", "periode_akademik_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mahasiswa" ADD CONSTRAINT "mahasiswa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mahasiswa" ADD CONSTRAINT "mahasiswa_program_studi_id_fkey" FOREIGN KEY ("program_studi_id") REFERENCES "program_studi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dosen" ADD CONSTRAINT "dosen_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dosen" ADD CONSTRAINT "dosen_program_studi_id_fkey" FOREIGN KEY ("program_studi_id") REFERENCES "program_studi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifikasi_data_diri" ADD CONSTRAINT "verifikasi_data_diri_mahasiswa_id_fkey" FOREIGN KEY ("mahasiswa_id") REFERENCES "mahasiswa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifikasi_data_diri" ADD CONSTRAINT "verifikasi_data_diri_diperiksa_oleh_user_id_fkey" FOREIGN KEY ("diperiksa_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_data_diri" ADD CONSTRAINT "dokumen_data_diri_verifikasi_data_diri_id_fkey" FOREIGN KEY ("verifikasi_data_diri_id") REFERENCES "verifikasi_data_diri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_data_diri" ADD CONSTRAINT "dokumen_data_diri_jenis_dokumen_id_fkey" FOREIGN KEY ("jenis_dokumen_id") REFERENCES "jenis_dokumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_data_diri" ADD CONSTRAINT "dokumen_data_diri_dokumen_id_fkey" FOREIGN KEY ("dokumen_id") REFERENCES "dokumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_data_diri" ADD CONSTRAINT "dokumen_data_diri_diperiksa_oleh_user_id_fkey" FOREIGN KEY ("diperiksa_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_diunggah_oleh_user_id_fkey" FOREIGN KEY ("diunggah_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_dikonfirmasi_oleh_user_id_fkey" FOREIGN KEY ("dikonfirmasi_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_aktor_user_id_fkey" FOREIGN KEY ("aktor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_proses" ADD CONSTRAINT "jadwal_proses_periode_akademik_id_fkey" FOREIGN KEY ("periode_akademik_id") REFERENCES "periode_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_proses" ADD CONSTRAINT "jadwal_proses_tahap_akademik_id_fkey" FOREIGN KEY ("tahap_akademik_id") REFERENCES "tahap_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_proses" ADD CONSTRAINT "jadwal_proses_dibuat_oleh_user_id_fkey" FOREIGN KEY ("dibuat_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_mahasiswa_id_fkey" FOREIGN KEY ("mahasiswa_id") REFERENCES "mahasiswa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_periode_akademik_id_fkey" FOREIGN KEY ("periode_akademik_id") REFERENCES "periode_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_tahap_akademik_id_fkey" FOREIGN KEY ("tahap_akademik_id") REFERENCES "tahap_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_topik_penelitian_id_fkey" FOREIGN KEY ("topik_penelitian_id") REFERENCES "topik_penelitian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_versi_topik_id_fkey" FOREIGN KEY ("versi_topik_id") REFERENCES "versi_topik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_pengajuan_prasyarat_id_fkey" FOREIGN KEY ("pengajuan_prasyarat_id") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_pengajuan_sebelumnya_id_fkey" FOREIGN KEY ("pengajuan_sebelumnya_id") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_usulan_pembimbing_id_fkey" FOREIGN KEY ("usulan_pembimbing_id") REFERENCES "dosen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_akademik_diperiksa_oleh_user_id_fkey" FOREIGN KEY ("akademik_diperiksa_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan" ADD CONSTRAINT "pengajuan_diputuskan_oleh_user_id_fkey" FOREIGN KEY ("diputuskan_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topik_penelitian" ADD CONSTRAINT "topik_penelitian_mahasiswa_id_fkey" FOREIGN KEY ("mahasiswa_id") REFERENCES "mahasiswa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topik_penelitian" ADD CONSTRAINT "topik_penelitian_tema_penelitian_id_fkey" FOREIGN KEY ("tema_penelitian_id") REFERENCES "tema_penelitian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versi_topik" ADD CONSTRAINT "versi_topik_topik_penelitian_id_fkey" FOREIGN KEY ("topik_penelitian_id") REFERENCES "topik_penelitian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versi_topik" ADD CONSTRAINT "versi_topik_perubahan_judul_id_fkey" FOREIGN KEY ("perubahan_judul_id") REFERENCES "perubahan_judul"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_status_pengajuan" ADD CONSTRAINT "riwayat_status_pengajuan_pengajuan_id_fkey" FOREIGN KEY ("pengajuan_id") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_status_pengajuan" ADD CONSTRAINT "riwayat_status_pengajuan_diubah_oleh_user_id_fkey" FOREIGN KEY ("diubah_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persyaratan_pengajuan" ADD CONSTRAINT "persyaratan_pengajuan_periode_akademik_id_fkey" FOREIGN KEY ("periode_akademik_id") REFERENCES "periode_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persyaratan_pengajuan" ADD CONSTRAINT "persyaratan_pengajuan_tahap_akademik_id_fkey" FOREIGN KEY ("tahap_akademik_id") REFERENCES "tahap_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persyaratan_pengajuan" ADD CONSTRAINT "persyaratan_pengajuan_jenis_dokumen_id_fkey" FOREIGN KEY ("jenis_dokumen_id") REFERENCES "jenis_dokumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen" ADD CONSTRAINT "dokumen_diunggah_oleh_user_id_fkey" FOREIGN KEY ("diunggah_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_pengajuan" ADD CONSTRAINT "dokumen_pengajuan_pengajuan_id_fkey" FOREIGN KEY ("pengajuan_id") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_pengajuan" ADD CONSTRAINT "dokumen_pengajuan_persyaratan_pengajuan_id_fkey" FOREIGN KEY ("persyaratan_pengajuan_id") REFERENCES "persyaratan_pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_pengajuan" ADD CONSTRAINT "dokumen_pengajuan_dokumen_id_fkey" FOREIGN KEY ("dokumen_id") REFERENCES "dokumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_pengajuan" ADD CONSTRAINT "dokumen_pengajuan_sumber_dokumen_pengajuan_id_fkey" FOREIGN KEY ("sumber_dokumen_pengajuan_id") REFERENCES "dokumen_pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumen_pengajuan" ADD CONSTRAINT "dokumen_pengajuan_diperiksa_oleh_user_id_fkey" FOREIGN KEY ("diperiksa_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_dosen" ADD CONSTRAINT "penugasan_dosen_pengajuan_id_fkey" FOREIGN KEY ("pengajuan_id") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_dosen" ADD CONSTRAINT "penugasan_dosen_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_dosen" ADD CONSTRAINT "penugasan_dosen_asal_penugasan_id_fkey" FOREIGN KEY ("asal_penugasan_id") REFERENCES "penugasan_dosen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_dosen" ADD CONSTRAINT "penugasan_dosen_ditetapkan_oleh_user_id_fkey" FOREIGN KEY ("ditetapkan_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_proposal" ADD CONSTRAINT "review_proposal_penugasan_dosen_id_fkey" FOREIGN KEY ("penugasan_dosen_id") REFERENCES "penugasan_dosen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_review" ADD CONSTRAINT "riwayat_review_review_proposal_id_fkey" FOREIGN KEY ("review_proposal_id") REFERENCES "review_proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_review" ADD CONSTRAINT "riwayat_review_dokumen_pengajuan_id_fkey" FOREIGN KEY ("dokumen_pengajuan_id") REFERENCES "dokumen_pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_review" ADD CONSTRAINT "riwayat_review_versi_topik_id_fkey" FOREIGN KEY ("versi_topik_id") REFERENCES "versi_topik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_review" ADD CONSTRAINT "riwayat_review_lembar_review_dokumen_id_fkey" FOREIGN KEY ("lembar_review_dokumen_id") REFERENCES "dokumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_review" ADD CONSTRAINT "riwayat_review_direview_oleh_user_id_fkey" FOREIGN KEY ("direview_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bimbingan" ADD CONSTRAINT "bimbingan_pengajuan_id_fkey" FOREIGN KEY ("pengajuan_id") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bimbingan" ADD CONSTRAINT "bimbingan_diperiksa_oleh_user_id_fkey" FOREIGN KEY ("diperiksa_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_bimbingan" ADD CONSTRAINT "riwayat_bimbingan_bimbingan_id_fkey" FOREIGN KEY ("bimbingan_id") REFERENCES "bimbingan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_bimbingan" ADD CONSTRAINT "riwayat_bimbingan_dilakukan_oleh_user_id_fkey" FOREIGN KEY ("dilakukan_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lampiran_bimbingan" ADD CONSTRAINT "lampiran_bimbingan_riwayat_bimbingan_id_fkey" FOREIGN KEY ("riwayat_bimbingan_id") REFERENCES "riwayat_bimbingan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lampiran_bimbingan" ADD CONSTRAINT "lampiran_bimbingan_dokumen_id_fkey" FOREIGN KEY ("dokumen_id") REFERENCES "dokumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perubahan_judul" ADD CONSTRAINT "perubahan_judul_pengajuan_id_fkey" FOREIGN KEY ("pengajuan_id") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perubahan_judul" ADD CONSTRAINT "perubahan_judul_versi_topik_asal_id_fkey" FOREIGN KEY ("versi_topik_asal_id") REFERENCES "versi_topik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perubahan_judul" ADD CONSTRAINT "perubahan_judul_proposal_perubahan_dokumen_id_fkey" FOREIGN KEY ("proposal_perubahan_dokumen_id") REFERENCES "dokumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keputusan_perubahan_judul" ADD CONSTRAINT "keputusan_perubahan_judul_perubahan_judul_id_fkey" FOREIGN KEY ("perubahan_judul_id") REFERENCES "perubahan_judul"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keputusan_perubahan_judul" ADD CONSTRAINT "keputusan_perubahan_judul_diperiksa_oleh_user_id_fkey" FOREIGN KEY ("diperiksa_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keputusan_perubahan_judul" ADD CONSTRAINT "keputusan_perubahan_judul_proposal_dokumen_id_fkey" FOREIGN KEY ("proposal_dokumen_id") REFERENCES "dokumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penyelesaian_tahap" ADD CONSTRAINT "penyelesaian_tahap_pengajuan_id_fkey" FOREIGN KEY ("pengajuan_id") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penyelesaian_tahap" ADD CONSTRAINT "penyelesaian_tahap_aturan_penyelesaian_tahap_id_fkey" FOREIGN KEY ("aturan_penyelesaian_tahap_id") REFERENCES "aturan_penyelesaian_tahap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penyelesaian_tahap" ADD CONSTRAINT "penyelesaian_tahap_disetujui_oleh_user_id_fkey" FOREIGN KEY ("disetujui_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_seminar" ADD CONSTRAINT "jadwal_seminar_pengajuan_id_fkey" FOREIGN KEY ("pengajuan_id") REFERENCES "pengajuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_seminar" ADD CONSTRAINT "jadwal_seminar_dibuat_oleh_user_id_fkey" FOREIGN KEY ("dibuat_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_jadwal_seminar" ADD CONSTRAINT "riwayat_jadwal_seminar_jadwal_seminar_id_fkey" FOREIGN KEY ("jadwal_seminar_id") REFERENCES "jadwal_seminar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_jadwal_seminar" ADD CONSTRAINT "riwayat_jadwal_seminar_dilakukan_oleh_user_id_fkey" FOREIGN KEY ("dilakukan_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikasi" ADD CONSTRAINT "notifikasi_dibuat_oleh_user_id_fkey" FOREIGN KEY ("dibuat_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikasi_penerima" ADD CONSTRAINT "notifikasi_penerima_notifikasi_id_fkey" FOREIGN KEY ("notifikasi_id") REFERENCES "notifikasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikasi_penerima" ADD CONSTRAINT "notifikasi_penerima_penerima_user_id_fkey" FOREIGN KEY ("penerima_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_dokumen" ADD CONSTRAINT "template_dokumen_file_template_dokumen_id_fkey" FOREIGN KEY ("file_template_dokumen_id") REFERENCES "dokumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_dokumen" ADD CONSTRAINT "template_dokumen_dibuat_oleh_user_id_fkey" FOREIGN KEY ("dibuat_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aturan_penyelesaian_tahap" ADD CONSTRAINT "aturan_penyelesaian_tahap_tahap_akademik_id_fkey" FOREIGN KEY ("tahap_akademik_id") REFERENCES "tahap_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aturan_penyelesaian_tahap" ADD CONSTRAINT "aturan_penyelesaian_tahap_periode_akademik_id_fkey" FOREIGN KEY ("periode_akademik_id") REFERENCES "periode_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aturan_penyelesaian_tahap" ADD CONSTRAINT "aturan_penyelesaian_tahap_ditetapkan_oleh_user_id_fkey" FOREIGN KEY ("ditetapkan_oleh_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
