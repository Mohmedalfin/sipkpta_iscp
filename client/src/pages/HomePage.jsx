import { useEffect, useState } from 'react';
import api from '../services/api.js';

export default function HomePage() {
  const [connection, setConnection] = useState({ status: 'checking', message: 'Memeriksa koneksi backend…' });

  useEffect(() => {
    const controller = new AbortController();

    api.get('/api/health', { signal: controller.signal })
      .then(({ data }) => {
        setConnection({ status: data.status === 'ok' ? 'connected' : 'error', message: data.message });
      })
      .catch((error) => {
        if (error.code !== 'ERR_CANCELED') {
          setConnection({ status: 'error', message: 'Backend belum dapat dihubungi.' });
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-widest text-blue-700">Project setup</p>
        <h1 className="mt-3 text-4xl font-bold">SIPKITA</h1>
        <p className="mt-3 text-slate-600">Fondasi aplikasi pengelolaan Kerja Praktik, ISCP, dan Tugas Akhir.</p>
        <div className="mt-8 rounded-lg bg-slate-100 p-4" role="status">
          <span className="font-semibold">Status backend: </span>
          <span className={connection.status === 'connected' ? 'text-green-700' : connection.status === 'error' ? 'text-red-700' : 'text-slate-600'}>
            {connection.message}
          </span>
        </div>
      </section>
    </main>
  );
}
