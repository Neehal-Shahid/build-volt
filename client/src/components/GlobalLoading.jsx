import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { subscribeLoading } from "../lib/api";

export default function GlobalLoading() {
  const [on, setOn] = useState(false);
  useEffect(() => subscribeLoading(setOn), []);
  if (!on) return null;
  return (
    <div className="global-loading" aria-live="polite">
      <Loader2 size={14} className="global-loading-spinner" />
      Working…
    </div>
  );
}
