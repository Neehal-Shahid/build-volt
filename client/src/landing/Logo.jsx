export default function Logo({ size = 30, withWordmark = true, className = '' }) {
  return (
    <span className={`lp-logo ${className}`.trim()}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="9" fill="#0A1A2D" />
        <path
          d="M9 21.5V10.5C9 9.94772 9.44772 9.5 10 9.5H16.7C18.6882 9.5 20.3 11.1118 20.3 13.1C20.3 14.2255 19.7811 15.2287 18.9689 15.885C20.2792 16.4602 21.2 17.7684 21.2 19.3C21.2 21.3488 19.5488 23 17.5 23H10C9.44772 23 9 22.5523 9 21.5Z"
          fill="url(#lp-logo-gradient)"
        />
        <path d="M9 9.5H16.7C18.6882 9.5 20.3 11.1118 20.3 13.1C20.3 14.2255 19.7811 15.2287 18.9689 15.885" stroke="none" />
        <defs>
          <linearGradient id="lp-logo-gradient" x1="9" y1="9.5" x2="21.2" y2="23" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4C86FF" />
            <stop offset="1" stopColor="#2A5EE8" />
          </linearGradient>
        </defs>
      </svg>
      {withWordmark && <span className="lp-logo-word">BuildBot</span>}
    </span>
  )
}
