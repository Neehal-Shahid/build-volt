import { useId } from "react";

export default function TextField({
  label,
  icon: Icon,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  required = false,
  inputMode,
  pattern,
  minLength,
  maxLength,
  autoFocus,
  disabled,
}) {
  const id = useId();

  return (
    <label className="auth-field" htmlFor={id}>
      {label && <span className="auth-field-label">{label}</span>}
      <span className="auth-input-wrap">
        {Icon && (
          <Icon size={16} className="auth-input-icon" aria-hidden="true" />
        )}
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          pattern={pattern}
          minLength={minLength}
          maxLength={maxLength}
          autoFocus={autoFocus}
          disabled={disabled}
          className={Icon ? "" : "no-icon"}
        />
      </span>
    </label>
  );
}
