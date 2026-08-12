import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../auth/AuthLayout";
import TextField from "../auth/TextField";
import PasswordField from "../auth/PasswordField";
import PasswordStrength from "../auth/PasswordStrength";
import SubmitButton from "../auth/SubmitButton";
import Alert from "../auth/Alert";

const PANEL = {
  eyebrow: "Get started",
  heading: "Launch your AI build widget in minutes",
  body: "Join PC parts retailers using BuildBot to turn browsers into confident buyers.",
  points: [
    "14-day free trial, no card required",
    "Works with WooCommerce or manual catalogs",
    "Setup takes less than 10 minutes",
  ],
};

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await signup(email, password);
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
      panel={PANEL}
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

        <SubmitButton busy={busy} busyLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
