import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Mail, KeyRound } from "lucide-react";
import { api } from "../lib/api";
import AuthLayout from "../auth/AuthLayout";
import TextField from "../auth/TextField";
import PasswordField from "../auth/PasswordField";
import PasswordStrength from "../auth/PasswordStrength";
import OtpInput from "../auth/OtpInput";
import SubmitButton from "../auth/SubmitButton";
import Alert from "../auth/Alert";

const PANEL = {
  eyebrow: "Account recovery",
  heading: "Get back into your account",
  body: "Enter your email and we'll send a reset code you can use right away.",
  points: [
    "Reset codes expire in 1 hour",
    "Use the emailed link or 6-digit code",
    "Your store data stays completely untouched",
  ],
};

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(params.get("token") ? "reset" : "request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [devHint, setDevHint] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestReset(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/api/forgot-password", {
        method: "POST",
        body: { email },
      });
      setMessage(data.message);
      setDevHint(data.devHint || null);
      if (data.devHint?.resetToken) setToken(data.devHint.resetToken);
      setStep("reset");
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/api/reset-password", {
        method: "POST",
        body: {
          password,
          token: token || undefined,
          email: email || undefined,
          otp: otp || undefined,
        },
      });
      setMessage(data.message);
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      setError(err.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Reset password"
      title={
        step === "request" ? "Forgot your password?" : "Set a new password"
      }
      subtitle={
        step === "request"
          ? "No worries — we'll email you a reset code."
          : "Enter your new password below (and the OTP, if not using the emailed link)."
      }
      panel={PANEL}
      footer={
        <div className="auth-footer-links">
          <Link to="/login">Back to log in</Link>
        </div>
      }
    >
      <Alert type="success">{message}</Alert>

      {devHint && (
        <div className="dev-hint">
          <strong>Dev mode</strong>
          <p>
            OTP: <code>{devHint.otp}</code>
          </p>
        </div>
      )}

      {step === "request" ? (
        <form className="auth-form" onSubmit={requestReset}>
          <Alert type="error">{error}</Alert>

          <TextField
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={setEmail}
            required
          />

          <SubmitButton busy={busy} busyLabel="Sending…">
            Send reset code
          </SubmitButton>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submitReset}>
          <Alert type="error">{error}</Alert>

          {!params.get("token") && (
            <TextField
              label="Email"
              icon={Mail}
              type="email"
              value={email}
              onChange={setEmail}
            />
          )}

          <OtpInput
            value={otp}
            onChange={setOtp}
            length={6}
            label="OTP (optional if using link)"
          />

          <div>
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              required
            />
            <PasswordStrength password={password} />
          </div>

          <SubmitButton busy={busy} busyLabel="Updating…">
            <KeyRound size={17} strokeWidth={2.25} />
            Update password
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
