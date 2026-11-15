import { createClient } from '@supabase/supabase-js';

export const DEFAULT_BUCKET_NAME = 'sipkita-documents';
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export class StorageServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class DummyWebSocket {}

let cachedClient = null;

export function getBucketName() {
  return process.env.SUPABASE_BUCKET || DEFAULT_BUCKET_NAME;
}

export function isSupabaseStorageConfigured() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key);
}

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new StorageServiceError(
      500,
      'STORAGE_UNCONFIGURED',
      'Konfigurasi Supabase Storage belum lengkap (SUPABASE_URL dan SUPABASE_SECRET_KEY wajib diisi).'
    );
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: DummyWebSocket,
    },
  });

  return cachedClient;
}

export async function ensureBucketExists() {
  if (!isSupabaseStorageConfigured()) return;

  const supabase = getSupabaseClient();
  const bucketName = getBucketName();

  const { data: bucket, error: getError } = await supabase.storage.getBucket(bucketName);
  if (bucket && !getError) {
    return bucket;
  }

  const { data: newBucket, error: createError } = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: MAX_DOCUMENT_BYTES,
    allowedMimeTypes: ['application/pdf'],
  });

  if (createError && !createError.message?.includes('already exists')) {
    throw new StorageServiceError(
      500,
      'STORAGE_BUCKET_ERROR',
      `Gagal memastikan bucket ${bucketName}: ${createError.message}`
    );
  }

  return newBucket;
}

export async function uploadDocument(storageKey, buffer, mimeType = 'application/pdf') {
  const supabase = getSupabaseClient();
  const bucketName = getBucketName();

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(storageKey, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    if (error.statusCode === 409 || error.message?.toLowerCase().includes('already exists')) {
      throw new StorageServiceError(409, 'DOCUMENT_CONFLICT', 'Dokumen dengan kunci ini sudah ada di penyimpanan.');
    }
    throw new StorageServiceError(500, 'STORAGE_UPLOAD_FAILED', `Gagal mengunggah dokumen: ${error.message}`);
  }

  return data;
}

export async function downloadDocument(storageKey) {
  const supabase = getSupabaseClient();
  const bucketName = getBucketName();

  const { data, error } = await supabase.storage.from(bucketName).download(storageKey);

  if (error || !data) {
    const isNotFound = error?.statusCode === 404 || error?.message?.toLowerCase().includes('not found');
    if (isNotFound) {
      throw new StorageServiceError(404, 'DOCUMENT_NOT_FOUND', 'Dokumen tidak ditemukan di penyimpanan.');
    }
    throw new StorageServiceError(500, 'STORAGE_DOWNLOAD_FAILED', `Gagal mengunduh dokumen: ${error?.message || 'Data kosong'}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function createSignedUrl(storageKey, expiresIn = 300) {
  const supabase = getSupabaseClient();
  const bucketName = getBucketName();

  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(storageKey, expiresIn);

  if (error || !data?.signedUrl) {
    throw new StorageServiceError(500, 'STORAGE_SIGNED_URL_FAILED', `Gagal membuat tautan akses: ${error?.message}`);
  }

  return data.signedUrl;
}

export async function deleteDocument(storageKey) {
  const supabase = getSupabaseClient();
  const bucketName = getBucketName();

  const { data, error } = await supabase.storage.from(bucketName).remove([storageKey]);

  if (error) {
    throw new StorageServiceError(500, 'STORAGE_DELETE_FAILED', `Gagal menghapus dokumen: ${error.message}`);
  }

  return data;
}

