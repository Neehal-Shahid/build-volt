import { ArrowRight, Circle } from "lucide-react";

export default function SetupNudge({ label, stepNumber, totalSteps, onGo }) {
  return (
    <button type="button" className="sd-setup-nudge" onClick={onGo}>
      <Circle size={8} className="sd-setup-nudge-dot" fill="currentColor" />
      <span className="sd-setup-nudge-text">
        <strong>Step {stepNumber} of {totalSteps}:</strong> {label}
      </span>
      <span className="sd-setup-nudge-cta">
        Go <ArrowRight size={14} />
      </span>
    </button>
  );
}
