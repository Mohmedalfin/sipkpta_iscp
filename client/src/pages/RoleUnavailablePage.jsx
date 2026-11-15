import SignOutButton from '../components/layout/SignOutButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function RoleUnavailablePage() {
  const { session } = useAuth();
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <section className="w-full max-w-md rounded-xl border border-line bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold text-brand">SIPKITA</p>
        <h1 className="mt-5 text-2xl font-bold text-ink">Halaman peran ini belum tersedia</h1>
        <p className="mt-3 text-sm leading-6 text-secondary">
          Anda masuk sebagai {session?.user?.activeRole?.replaceAll('_', ' ')}. Saat ini hanya ruang kerja Mahasiswa dan Admin Program Studi yang aktif pada antarmuka web.
        </p>
        <SignOutButton className="mt-6" />
      </section>
    </main>
  );
}
