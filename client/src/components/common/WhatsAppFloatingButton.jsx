import { memo } from 'react';
import { IconWhatsApp } from './Icons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * WhatsApp Floating Action Button untuk Mahasiswa
 * Menghubungkan mahasiswa langsung dengan Admin Program Studi via WhatsApp
 * Dilengkapi animasi floating, pulse ring, dan badge status aktif.
 */
function WhatsAppFloatingButton() {
  const { session } = useAuth();

  const adminPhone = (import.meta.env.VITE_WA_ADMIN_PRODI || '6281234567890').replace(/\D/g, '');
  const studentName = session?.user?.nama_lengkap || session?.user?.nama_tampilan || '';
  const studentNim = session?.user?.login_id || '';

  const defaultGreeting = studentName
    ? `Halo Admin Prodi Sistem Informasi SIPKITA, saya ${studentName}${studentNim ? ` (NIM: ${studentNim})` : ''} ingin berkonsultasi mengenai layanan akademik.`
    : 'Halo Admin Prodi Sistem Informasi SIPKITA, saya mahasiswa ingin berkonsultasi mengenai layanan akademik.';

  const waHref = `https://wa.me/${adminPhone}?text=${encodeURIComponent(defaultGreeting)}`;

  return (
    <aside
      aria-label="Bantuan Admin Prodi via WhatsApp"
      className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2.5 pointer-events-auto select-none"
    >
      {/* Pill Label & Status (Tampil di layar sm ke atas atau saat di-hover) */}
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="group/pill hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-white/95 backdrop-blur-md px-3.5 py-1.5 shadow-md transition-all duration-300 hover:border-emerald-500/40 hover:bg-white hover:shadow-lg hover:scale-102 focus:outline-hidden"
        title="Hubungi Admin Prodi via WhatsApp"
      >
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-slate-800 tracking-tight group-hover/pill:text-emerald-700 transition-colors">
          Admin Prodi
        </span>
        <span className="rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
          Online
        </span>
      </a>

      {/* Tombol Bundar Utama WhatsApp dengan Animasi Floating & Pulse */}
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hubungi Admin Program Studi melalui WhatsApp"
        title="Chat WhatsApp Admin Prodi"
        className="group relative flex size-12 sm:size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-600/35 transition-all duration-300 hover:bg-[#20bd5a] hover:scale-110 active:scale-95 animate-wa-float animate-wa-pulse-ring focus:outline-hidden cursor-pointer"
      >
        {/* Beacon indikator aktif (Mobile only) */}
        <span className="sm:hidden absolute -top-0.5 -right-0.5 flex size-3">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-white border-2 border-emerald-500" />
        </span>

        {/* Ikon WhatsApp */}
        <IconWhatsApp className="size-6 sm:size-7 fill-current drop-shadow-xs motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-110" />
      </a>
    </aside>
  );
}

export default memo(WhatsAppFloatingButton);
