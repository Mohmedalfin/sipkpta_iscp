export default function FormField({ id, label, error, required = false, children }) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="auth-label mb-1.5 block text-xs font-semibold text-ink">
        {label}
        {required && <span className="ml-1 text-danger" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p id={errorId} className="mt-2 text-xs font-medium text-danger 3xl:mt-1.5 3xl:text-[11px]" role="alert">{error}</p>}
    </div>
  );
}

