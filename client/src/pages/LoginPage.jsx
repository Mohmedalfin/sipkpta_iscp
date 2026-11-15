import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandMark from '../components/auth/BrandMark.jsx';
import LoginForm from '../components/auth/LoginForm.jsx';
import RolePicker from '../components/auth/RolePicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { authErrorMessage } from '../services/auth.js';

const stages = [
  {
    code: 'KP',
    label: 'Kerja Praktik',
    desc: 'Pengalaman kerja industri terstruktur, verifikasi proposal dan administrasi instansi.',
  },
  {
    code: 'ISCP',
    label: 'Capstone Project',
    desc: 'Pengembangan proyek sistem informasi terpadu, kolaborasi tim, dan review proposal.',
  },
  {
    code: 'TA',
    label: 'Tugas Akhir',
    desc: 'Riset ilmiah mandiri terarah, bimbingan berkala pembimbing, dan sidang kelulusan.',
  },
];

const typingWords = [
  'KP, ISCP & Tugas Akhir',
  'Kerja Praktik (KP)',
  'Capstone Project (ISCP)',
  'Tugas Akhir (TA)',
];

function useTypewriter(words, { typingSpeed = 80, deletingSpeed = 40, pauseDelay = 2200 } = {}) {
  const [wordIndex, setWordIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(words[0].length);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const currentWord = words[wordIndex];

    if (!isDeleting && subIndex === currentWord.length) {
      const timeout = setTimeout(() => setIsDeleting(true), pauseDelay);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && subIndex === 0) {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [subIndex, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDelay]);

  return words[wordIndex].substring(0, subIndex);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, initializing, signIn, chooseRole, clear } = useAuth();
  const toast = useToast();
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const typedStageText = useTypewriter(typingWords);
  const [pending, setPending] = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initializing && session?.user.activeRole) navigate('/', { replace: true });
  }, [initializing, session, navigate]);

  async function handleLogin(credentials) {
    setPending(true);
    setError('');
    try {
      const next = await signIn(credentials);
      toast.success('Berhasil masuk ke akun SIPKITA!');
      if (next.user.activeRole) navigate('/', { replace: true });
      return true;
    } catch (requestError) {
      const msg = authErrorMessage(requestError, 'Login gagal. Periksa identitas dan kata sandi.');
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setPending(false);
    }
  }

  async function handleRole(role) {
    setPendingRole(role);
    setError('');
    try {
      await chooseRole(role);
      toast.success(`Berhasil masuk sebagai ${role}.`);
      navigate('/', { replace: true });
    } catch (requestError) {
      const msg = authErrorMessage(requestError, 'Peran tidak dapat diaktifkan.');
      setError(msg);
      toast.error(msg);
    } finally {
      setPendingRole(null);
    }
  }

  const needsRole = session && !session.user.activeRole;

  return (
    <main className="min-h-dvh h-dvh lg:h-auto overflow-hidden lg:overflow-visible bg-brand flex flex-col justify-between lg:grid lg:grid-cols-[58%_42%] xl:grid-cols-[60%_40%]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-brand px-5 pt-4 pb-3 sm:px-10 sm:py-8 lg:min-h-screen lg:px-16 xl:px-20 lg:py-14 shrink-0" aria-labelledby="brand-heading">
        <BrandMark inverse />
        <div className="brand-content my-2 sm:my-6 lg:my-auto lg:py-8">
          <div className="hidden sm:inline-flex items-center rounded-full bg-white/20 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
            Sistem Terintegrasi
          </div>

          <h2
            id="brand-heading"
            className="brand-heading mt-3 sm:mt-5 3xl:mt-4 text-base sm:text-3xl lg:text-[2.2rem] 3xl:text-[1.85rem] 3xl:leading-snug 4xl:text-[2.75rem] 4xl:leading-tight text-white font-bold leading-tight tracking-[-0.03em] min-h-[3.25rem] sm:min-h-[5.5rem] lg:min-h-[6.5rem] 3xl:min-h-[5.25rem] 4xl:min-h-[7.5rem]"
          >
            <span className="block text-white">Kelola Administrasi Mahasiswa</span>
            <span className="block text-[#EBE0FF] font-extrabold mt-0.5 sm:mt-1">
              {typedStageText}
              <span
                className="inline-block w-[2px] sm:w-[2.5px] 4xl:w-[3.5px] h-[0.85em] bg-[#EBE0FF] ml-1 align-baseline animate-pulse"
                aria-hidden="true"
              />
            </span>
          </h2>

          <p className="brand-desc hidden sm:block mt-4 text-xs leading-relaxed text-blue-100/90 sm:text-sm sm:leading-6 max-w-lg font-normal">
            Mendukung pengelolaan alur Kerja Praktik, Capstone Project, dan Tugas Akhir Mahasiswa.
          </p>

          {/* Notion Interactive Capsule Buttons for "KP -> ISCP -> TA" - Hidden on mobile */}
          <div className="stage-buttons-container hidden lg:block mt-6 max-w-md">
            <div className="mb-2.5 flex items-center justify-between text-xs text-blue-100/80">
              <span className="stage-section-title font-semibold uppercase tracking-wider text-[10px] text-blue-200/85">
                Alur Tahap Akademik
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="tablist" aria-label="Alur tahap akademik KP, ISCP, TA">
              {stages.map((stage, index) => {
                const isActive = activeStageIndex === index;
                return (
                  <div key={stage.code} className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      role="tab"
                      id={`stage-tab-${stage.code.toLowerCase()}`}
                      aria-selected={isActive}
                      aria-controls={`stage-panel-${stage.code.toLowerCase()}`}
                      onClick={() => setActiveStageIndex(index)}
                      className={`stage-btn group inline-flex items-center justify-center gap-2 rounded-full px-3 py-1 text-xs font-bold tracking-tight transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand cursor-pointer motion-reduce:transition-none motion-reduce:transform-none ${
                        isActive
                          ? 'bg-[#EBE0FF] text-slate-900 shadow-sm hover:bg-[#E2D5FE] hover:shadow active:scale-[0.98]'
                          : 'bg-white/15 text-white/95 hover:bg-white/25 hover:text-white active:scale-[0.97]'
                      }`}
                    >
                      <span
                        className={`stage-dot size-2 rounded-full transition-transform duration-300 group-hover:scale-125 motion-reduce:transform-none ${
                          isActive ? 'bg-[#2563EB]' : 'bg-white/60'
                        }`}
                        aria-hidden="true"
                      />
                      <span>{stage.code}</span>
                    </button>

                    {index < stages.length - 1 && (
                      <span className="stage-arrow text-white/40 text-xs font-bold select-none" aria-hidden="true">
                        &rarr;
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Active Stage Details Card - Constant Height & Width with CSS Grid Overlay */}
            <div
              className="stage-card mt-3.5 grid grid-cols-1 w-full max-w-md min-h-[70px] sm:min-h-[66px] rounded-xl bg-white/[0.08] p-3 border border-white/15 backdrop-blur-sm"
              aria-live="polite"
            >
              {stages.map((stage, index) => {
                const isActive = activeStageIndex === index;
                return (
                  <div
                    key={stage.code}
                    id={`stage-panel-${stage.code.toLowerCase()}`}
                    role="tabpanel"
                    aria-labelledby={`stage-tab-${stage.code.toLowerCase()}`}
                    className={`col-start-1 row-start-1 w-full flex flex-col justify-center transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="stage-card-dot size-1.5 rounded-full bg-[#2563EB] shrink-0" aria-hidden="true" />
                        <h3 className="stage-card-title text-xs font-bold text-white tracking-tight">
                          {stage.label} ({stage.code})
                        </h3>
                      </div>
                      <span className="stage-card-step text-[10px] font-medium text-blue-200/80 shrink-0">
                        Tahap {index + 1} dari {stages.length}
                      </span>
                    </div>
                    <p className="stage-card-desc mt-1 text-[11px] text-blue-100/90 leading-snug font-normal">
                      {stage.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <p className="hidden text-xs text-blue-100/70 lg:block">© {new Date().getFullYear()} Program Studi Sistem Informasi.</p>
      </section>

      <section className="flex flex-1 flex-col justify-center bg-grid-canvas px-5 py-4 sm:px-10 sm:py-10 lg:min-h-screen lg:px-12 xl:px-14 rounded-t-[28px] sm:rounded-t-none lg:rounded-tl-[48px] xl:rounded-tl-[56px] shadow-lg lg:shadow-sm" aria-label="Form autentikasi">
        <div className="w-full max-w-[420px] mx-auto">
          {initializing ? (
            <div className="flex items-center gap-3 text-sm text-secondary" role="status">
              <span className="size-5 animate-spin rounded-full border-2 border-line border-t-brand motion-reduce:animate-none" aria-hidden="true" />
              Memeriksa sesi…
            </div>
          ) : needsRole ? (
            <>
              <RolePicker roles={session.user.roles} pendingRole={pendingRole} error={error} onSelect={handleRole} />
              <button type="button" className="mt-6 text-sm font-semibold text-secondary underline decoration-line underline-offset-4 hover:text-ink cursor-pointer" onClick={clear} disabled={Boolean(pendingRole)}>
                Masuk dengan akun lain
              </button>
            </>
          ) : (
            <>
              <div className="mb-3 sm:mb-6 3xl:mb-5">
                <h1 className="text-lg sm:text-2xl 3xl:text-[1.375rem] font-bold tracking-tight text-ink">
                  Selamat Datang
                </h1>
              </div>
              <LoginForm onSubmit={handleLogin} pending={pending} serverError={error} />
              <p className="mt-3.5 sm:mt-8 border-t border-line pt-2.5 sm:pt-6 text-center text-[10px] sm:text-xs leading-4 sm:leading-5 text-muted">
                Akses akun mengikuti kewenangan dan peran yang diberikan oleh pengelola sistem.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

