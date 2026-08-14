import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import AuthLayout from "../auth/AuthLayout";
import TextField from "../auth/TextField";
import PasswordField from "../auth/PasswordField";
import PasswordStrength from "../auth/PasswordStrength";
import SubmitButton from "../auth/SubmitButton";
import Alert from "../auth/Alert";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [trialDays, setTrialDays] = useState(14);

  useEffect(() => {
    let cancelled = false;
    api("/api/plans")
      .then((res) => {
        if (!cancelled && res?.trialDays) setTrialDays(res.trialDays);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const panel = {
    eyebrow: "Get started",
    heading: "Launch your AI build widget in minutes",
    body: "Join PC parts retailers using BuildBot to turn browsers into confident buyers.",
    points: [
      `${trialDays}-day free trial, no card required`,
      "Works with WooCommerce or manual catalogs",
      "Setup takes less than 10 minutes",
    ],
  };

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!tosAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.')
      return
    }
    setBusy(true);
    try {
      const data = await signup(email, password, tosAccepted);
      navigate("/verify", {
        state: {
          email,
          devHint: data.devHint || null,
          message: data.message,
        },
      });
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Start your free trial"
      subtitle="No credit card required — set up your store in minutes."
      panel={panel}
      footer={
        <>
          <p>
            Already have an account?{" "}
            <Link className="auth-inline-link" to="/login">
              Log in
            </Link>
          </p>
          <div className="auth-footer-links">
            <Link to="/">Home</Link>
          </div>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <Alert type="error">{error}</Alert>

        <TextField
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />

        <div>
          <PasswordField
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            required
          />
          <PasswordStrength password={password} />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', color: '#475569', cursor: 'pointer', marginTop: '0.25rem' }}>
          <input
            type="checkbox"
            checked={tosAccepted}
            onChange={e => setTosAccepted(e.target.checked)}
            style={{ marginTop: '2px', flexShrink: 0, accentColor: '#2A5EE8' }}
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="auth-inline-link">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" target="_blank" className="auth-inline-link">Privacy Policy</Link>
          </span>
        </label>

        <SubmitButton busy={busy} busyLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
