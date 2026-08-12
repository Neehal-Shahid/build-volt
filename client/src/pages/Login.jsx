import { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../auth/AuthLayout";
import TextField from "../auth/TextField";
import PasswordField from "../auth/PasswordField";
import SubmitButton from "../auth/SubmitButton";
import Alert from "../auth/Alert";

const PANEL = {
  eyebrow: "Welcome back",
  heading: "Pick up right where you left off",
  body: "Manage your catalog, widget, and billing from one dashboard built for PC parts retailers.",
  points: [
    "Live recommendation analytics",
    "One dashboard for products & billing",
    "Instant widget customization",
  ],
};

export default function Login() {
  const { login, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      if (err.data?.needsVerification) {
        navigate("/verify", { state: { email: err.data.email || email } });
        return;
      }
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Store owner"
      title="Log in to BuildBot"
      subtitle="Enter your details to access your dashboard."
      panel={PANEL}
      footer={
        <>
          <p>
            New to BuildBot?{" "}
            <Link className="auth-inline-link" to="/signup">
              Create an account
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
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            required
          />
          <div className="auth-row" style={{ marginTop: "0.6rem" }}>
            <span />
            <Link className="auth-inline-link" to="/reset-password">
              Forgot password?
            </Link>
          </div>
        </div>

        <SubmitButton busy={busy} busyLabel="Signing in…">
          Log in
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
