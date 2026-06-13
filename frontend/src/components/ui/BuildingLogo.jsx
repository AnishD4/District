export function BuildingLogo({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M6 21V6.4L12 3l6 3.4V21H6Z" fill="#17202d" />
      <path d="M8.1 20.2V9.2H11v11h-2.9Zm4.9 0V9.2H16v11h-3Z" fill="#27354a" />
      <path d="M7.6 8.6 12 6.2l4.4 2.4v1.1H7.6V8.6Z" fill="#49627c" />
      <rect x="9.2" y="11.1" width="1.2" height="1.8" rx="0.25" fill="#fff4a8" />
      <rect x="13.6" y="11.1" width="1.2" height="1.8" rx="0.25" fill="#ffcf5a" />
      <rect x="9.2" y="14.3" width="1.2" height="1.8" rx="0.25" fill="#7cf7d4" />
      <rect x="13.6" y="14.3" width="1.2" height="1.8" rx="0.25" fill="#ff8f1f" />
      <rect x="11.15" y="4.8" width="1.7" height="1.1" rx="0.25" fill="#f4f9ff" />
      <path d="M5.2 21h13.6" stroke="#f4f9ff" strokeOpacity="0.45" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  )
}
