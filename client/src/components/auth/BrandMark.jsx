import utyLogo from '../../assets/uty-yogyakarta-logo-logobase.net.png';

export default function BrandMark({ inverse = false, compact = false, className = '' }) {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 min-w-0 ${className}`} aria-label="SIPKITA Universitas Teknologi Yogyakarta">
        <img
          src={utyLogo}
          alt="Logo UTY"
          className="h-[26px] w-auto max-w-[85px] object-contain shrink-0"
        />
        <div className={`h-5 w-px shrink-0 ${inverse ? 'bg-white/25' : 'bg-line'}`} aria-hidden="true" />
        <div className="min-w-0 flex flex-col justify-center">
          <strong className={`block text-xs font-extrabold leading-none tracking-tight whitespace-nowrap ${inverse ? 'text-white' : 'text-ink'}`}>
            SIPKITA
          </strong>
          <span className={`block mt-0.5 text-[9px] font-semibold whitespace-nowrap tracking-tight ${inverse ? 'text-blue-100/90' : 'text-muted'}`}>
            Sistem Informasi
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3.5 ${className}`} aria-label="SIPKITA Universitas Teknologi Yogyakarta">
      <img
        src={utyLogo}
        alt="Logo UTY"
        className="h-7 w-auto object-contain sm:h-11 3xl:h-9.5"
      />
      <div className={`h-6 w-px sm:h-8 3xl:h-7 ${inverse ? 'bg-white/30' : 'bg-line'}`} aria-hidden="true" />
      <div>
        <strong className={`block text-sm sm:text-lg font-bold leading-none tracking-tight 3xl:text-base ${inverse ? 'text-white' : 'text-ink'}`}>
          SIPKITA
        </strong>
        <span className={`block mt-0.5 sm:mt-1 text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider 3xl:text-[10px] ${inverse ? 'text-blue-100' : 'text-muted'}`}>
          Sistem Informasi Akademik
        </span>
      </div>
    </div>
  );
}
