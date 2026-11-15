import { useEffect, useState } from 'react';
import FormField from './FormField.jsx';

export default function LoginForm({ onSubmit, pending, serverError }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [showForgotNote, setShowForgotNote] = useState(false);

  useEffect(() => {
    setLoginId('');
    setPassword('');
  }, []);

  function validate() {
    const next = {};
    const normalizedLoginId = loginId.trim();
    if (!normalizedLoginId) next.loginId = 'Masukkan NIM atau NIDN.';
    else if (normalizedLoginId.length > 50 || !/^[A-Za-z0-9._-]+$/.test(normalizedLoginId)) {
      next.loginId = 'Identitas hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.';
    }
    if (!password) next.password = 'Masukkan kata sandi.';
    else if (password.length < 8) next.password = 'Kata sandi minimal 8 karakter.';
    else if (password.length > 1024) next.password = 'Kata sandi terlalu panjang.';
    setErrors(next);
    return { valid: Object.keys(next).length === 0, normalizedLoginId };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const result = validate();
    if (!result.valid) return;
    const succeeded = await onSubmit({ login_id: result.normalizedLoginId, password });
    if (succeeded) setPassword('');
  }

  return (
    <form className="space-y-3.5 sm:space-y-5 3xl:space-y-4" onSubmit={handleSubmit} autoComplete="off" noValidate>
      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm 3xl:py-2.5 3xl:text-xs text-danger" role="alert">
          {serverError}
        </div>
      )}
      <FormField id="login-id" label="NIM / NIDN" required error={errors.loginId}>
        <input
          id="login-id"
          name="login_id"
          type="text"
          autoComplete="off"
          autoFocus
          value={loginId}
          onChange={(event) => { setLoginId(event.target.value); setErrors((current) => ({ ...current, loginId: null })); }}
          aria-invalid={Boolean(errors.loginId)}
          aria-describedby={errors.loginId ? 'login-id-error' : undefined}
          className="auth-input"
          placeholder="Masukkan NIM atau NIDN"
          disabled={pending}
        />
      </FormField>

      <FormField id="password" label="Kata Sandi" required error={errors.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: null })); }}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className="auth-input"
          placeholder="••••••••"
          disabled={pending}
        />
      </FormField>

      <div className="flex flex-col items-end -mt-2 3xl:-mt-1.5">
        <button
          type="button"
          onClick={() => setShowForgotNote((prev) => !prev)}
          className="text-[13px] 3xl:text-[12px] font-bold text-brand hover:text-brand-hover hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded cursor-pointer"
        >
          Lupa Password?
        </button>
        {showForgotNote && (
          <div className="mt-2.5 w-full rounded-lg bg-blue-50/80 p-3 3xl:p-2.5 text-xs 3xl:text-[11px] leading-relaxed border border-blue-100 text-secondary transition-all">
            <p className="font-semibold text-ink">Bantuan Pemulihan Akun</p>
            <p className="mt-0.5 text-muted">
              Silakan hubungi Admin Program Studi atau gunakan email akademik yang terdaftar di SIPKITA untuk pemulihan kata sandi.
            </p>
          </div>
        )}
      </div>

      <button type="submit" className="primary-button" disabled={pending}>
        {pending && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true" />}
        {pending ? 'Memeriksa akun…' : 'Masuk ke Akun'}
      </button>
    </form>
  );
}

