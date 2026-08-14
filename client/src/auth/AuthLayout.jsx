import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import Logo from "../landing/Logo";
import leftImg from "../../Images/Left-Img.png";
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
      {/* ── Dark brand panel ── */}
      <div className="auth-panel">
        {/* Blue glow radial */}
        <div className="auth-panel-glow" aria-hidden="true" />

        {/* PC-components illustration — white outlines, screen-blended on dark bg */}
        <img
          src={leftImg}
          alt=""
          aria-hidden="true"
          className="auth-panel-img"
        />

        {/* Logo — light-text variant for dark panel */}
        <Link to="/" className="auth-panel-brand">
          <Logo dark height={30} />
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

      {/* ── White form side ── */}
      <div className="auth-form-side">
        {/* Mobile header — light logo on white bg */}
        <Link to="/" className="auth-mobile-brand">
          <Logo height={28} />
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
