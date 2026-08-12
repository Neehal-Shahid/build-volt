import { useId, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function PasswordField({
  label = "Password",
  value,
  onChange,
  autoComplete = "current-password",
  placeholder,
  required = true,
  hint,
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <label className="auth-field" htmlFor={id}>
      <span className="auth-field-label">{label}</span>
      <span className="auth-input-wrap">
        <Lock size={16} className="auth-input-icon" aria-hidden="true" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="has-toggle"
        />
        <button
          type="button"
          className="auth-input-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {hint && <span className="auth-field-hint">{hint}</span>}
    </label>
  );
}
