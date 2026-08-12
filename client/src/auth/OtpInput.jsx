import { useRef } from "react";

export default function OtpInput({
  value,
  onChange,
  length = 6,
  label = "6-digit code",
}) {
  const inputs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  function setDigitAt(index, digit) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(""));
  }

  function handleChange(index, raw) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigitAt(index, digit);
    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    const focusIndex = Math.min(text.length, length - 1);
    inputs.current[focusIndex]?.focus();
  }

  return (
    <div className="auth-field">
      <span className="auth-field-label">{label}</span>
      <div className="auth-otp-row" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className="auth-otp-box"
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-label={`Digit ${i + 1} of ${length}`}
          />
        ))}
      </div>
    </div>
  );
}
