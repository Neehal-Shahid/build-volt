import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getPlatformInfo } from "../lib/platformInfo";
import AuthLayout from "../auth/AuthLayout";
import TextField from "../auth/TextField";
import OtpInput from "../auth/OtpInput";
import SubmitButton from "../auth/SubmitButton";
import Alert from "../auth/Alert";

const PANEL = {
  eyebrow: "One last step",
  heading: "Confirm it's really you",
  body: "We sent a 6-digit code to your email. Enter it here, or open the verification link we sent.",
  points: [
    "Codes expire after 24 hours",
    "Check spam if you don't see it",
    "Your trial starts the moment you verify",
  ],
};

export default function Verify() {
  const { verifyOtp, verifyToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [devHint, setDevHint] = useState(location.state?.devHint || null);
  const [message, setMessage] = useState(location.state?.message || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkStatus, setLinkStatus] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [supportEmail, setSupportEmail] = useState("");
  const cooldownRef = useRef(null);

  useEffect(() => {
    getPlatformInfo().then((info) => setSupportEmail(info.supportEmail));
  }, []);

  useEffect(() => {
    const token = params.get("token");
    if (!token) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setLinkStatus("Verifying link…");
      try {
        await verifyToken(token);
        if (!cancelled) navigate("/dashboard", { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Link verification failed");
          setLinkStatus("");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, verifyToken, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError("Enter the full 6-digit code");
      return;
    }
    setBusy(true);
    try {
      await verifyOtp(email, otp);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  // Clean up the countdown interval on unmount
  useEffect(() => () => clearInterval(cooldownRef.current), []);

  function startCooldown(seconds = 60) {
    setCooldown(seconds);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function resend() {
    setError("");
    setBusy(true);
    try {
      const data = await api("/api/resend-verification", {
        method: "POST",
        body: { email },
      });
      setMessage(data.message);
      setDevHint(data.devHint || null);
      setResendCount((c) => c + 1);
      startCooldown(60);
    } catch (err) {
      setError(err.message || "Could not resend");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Verify email"
      title="Check your inbox"
      subtitle="Enter the 6-digit code from your email, or open the verification link."
      panel={PANEL}
      footer={
        <div className="auth-footer-links">
          <Link to="/login">Log in</Link>
          <span className="auth-footer-dot" />
          <Link to="/">Home</Link>
        </div>
      }
    >
      <Alert type="success">{message}</Alert>
      <Alert type="info">{linkStatus}</Alert>

      {devHint && (
        <div className="dev-hint">
          <strong>Dev mode (no real email yet)</strong>
          <p>
            OTP: <code>{devHint.otp}</code>
          </p>
          {devHint.verifyLink && (
            <p className="muted" style={{ wordBreak: "break-all" }}>
              Link: {devHint.verifyLink}
            </p>
          )}
        </div>
      )}

      <form className="auth-form" onSubmit={onSubmit}>
        <Alert type="error">{error}</Alert>

        <TextField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={setEmail}
          required
        />

        <OtpInput
          value={otp}
          onChange={setOtp}
          length={6}
          label="6-digit code"
        />

        <SubmitButton busy={busy} busyLabel="Verifying…">
          <ShieldCheck size={17} strokeWidth={2.25} />
          Verify
        </SubmitButton>
        <button
          className="btn btn-ghost auth-secondary"
          type="button"
          onClick={resend}
          disabled={busy || !email || cooldown > 0}
        >
          <RefreshCw size={15} strokeWidth={2.25} />
          {cooldown > 0 ? `Resend in ${cooldown}s…` : "Resend code"}
        </button>

        {resendCount >= 3 && (
          <p className="auth-hint">
            Still not getting the code? Check your spam folder
            {supportEmail ? (
              <> or <a href={`mailto:${supportEmail}`}>contact support</a></>
            ) : (
              " or contact support"
            )}.
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
