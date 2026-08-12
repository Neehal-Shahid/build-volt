import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import Logo from "../landing/Logo";
import "./auth.css";

export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  panel,
  footer,
}) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-panel-glow" aria-hidden="true" />
        <Link to="/" className="auth-panel-brand">
          <Logo />
        </Link>

        {panel && (
          <div className="auth-panel-copy">
            {panel.eyebrow && (
              <p className="auth-panel-eyebrow">{panel.eyebrow}</p>
            )}
            <h2>{panel.heading}</h2>
            <p>{panel.body}</p>
            {panel.points?.length > 0 && (
              <ul>
                {panel.points.map((point) => (
                  <li key={point}>
                    <Check size={15} strokeWidth={3} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="auth-form-side">
        <Link to="/" className="auth-mobile-brand">
          <Logo />
        </Link>

        <div className="auth-card">
          {eyebrow && <p className="auth-eyebrow">{eyebrow}</p>}
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}

          {children}

          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
