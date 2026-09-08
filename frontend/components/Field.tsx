type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'numeric' | 'email';
  defaultValue?: string;
};

export function Field({
  label,
  name,
  type = 'text',
  placeholder,
  hint,
  error,
  required,
  autoComplete,
  inputMode,
  defaultValue,
}: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        defaultValue={defaultValue}
        aria-invalid={!!error}
        aria-describedby={[
          hint && !error ? hintId : null,
          error ? errorId : null,
        ].filter(Boolean).join(' ') || undefined}
        // dir="ltr" on phone inputs: an Egyptian number is read left to right
        // even inside an RTL page, and letting it inherit rtl puts the cursor
        // and the digits in visually confusing places while typing.
        dir={inputMode === 'tel' || type === 'email' ? 'ltr' : undefined}
        className={`form-control text-base ${
          inputMode === 'tel' || type === 'email' ? 'text-start' : ''
        }`}
      />
      {hint && !error && (
        <p id={hintId} className="px-1 text-xs leading-relaxed text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  error,
  required,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ''}
        aria-invalid={!!error}
        className="form-control text-base"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-brand-contrast
        transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? '...' : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {message}
    </div>
  );
}
