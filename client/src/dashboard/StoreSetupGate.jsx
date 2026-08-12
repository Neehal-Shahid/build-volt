import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Logo from "../landing/Logo";
import TextField from "../auth/TextField";
import SubmitButton from "../auth/SubmitButton";
import Alert from "../auth/Alert";
import "../auth/auth.css";

export default function StoreSetupGate({ children }) {
  const { store, completeStoreSetup } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (store?.name) setName(store.name);
  }, [store?.name]);

  if (!store?.needsSetup) return children;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await completeStoreSetup(name.trim());
    } catch (err) {
      setError(err.message || "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-standalone">
      <div className="auth-card">
        <div className="auth-panel-brand">
          <Logo />
        </div>
        <p className="auth-eyebrow">Almost there</p>
        <h1 className="auth-title">Name your store</h1>
        <p className="auth-subtitle">
          We'll create a permanent store ID from this name (for example{" "}
          <code>my-shop-a1b2c3</code>) — you can't change it later.
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          <Alert type="error">{error}</Alert>

          <TextField
            label="Store name"
            icon={Store}
            value={name}
            onChange={setName}
            placeholder="e.g. Karachi PC Hub"
            required
            minLength={2}
            maxLength={80}
            autoFocus
          />

          <SubmitButton busy={busy} busyLabel="Saving…">
            Continue to dashboard
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
