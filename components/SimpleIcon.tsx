// components/SimpleIcon.tsx
// Einfache SVG-Icons als Ersatz für Emojis

interface SimpleIconProps {
  type: string
  className?: string
}

export default function SimpleIcon({ type, className = '' }: SimpleIconProps) {
  const icons: Record<string, JSX.Element> = {
    sun: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
    plug: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 3v3m8-3v3M7 8h10a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2v-8a2 2 0 012-2zm5 10v4" />
      </svg>
    ),
    lightning: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
      </svg>
    ),
    home: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path d="M9 22V12h6v10" fill="white" />
      </svg>
    ),
    chart: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18M7 16l4-4 4 4 6-6" />
      </svg>
    ),
    money: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v2m0 8v2m-2-6h1a2 2 0 110 4h-1m0-4h1a2 2 0 100-4h-1m0 8h4" stroke="white" strokeWidth="1.5" fill="none" />
      </svg>
    ),
    gem: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 3l-3 6 9 12 9-12-3-6H6zm0 0l6 6 6-6M3 9h18" />
      </svg>
    ),
    dashboard: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
    input: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14m-7-7l7 7 7-7" />
      </svg>
    ),
    briefcase: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
    clipboard: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6v4H9V2z" />
      </svg>
    ),
    trend: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" />
      </svg>
    ),
    settings: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v10M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m6 0h10M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24" />
      </svg>
    ),
    plus: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14m-7-7h14" />
      </svg>
    ),
    rocket: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8 2 5 5 3 11c-1 3 0 6 2 8 0 0 0-2 1-3s2-2 3-2c0 2 1 3 3 3s3-1 3-3c1 0 2 1 3 2s1 3 1 3c2-2 3-5 2-8-2-6-5-9-9-9z" />
        <circle cx="8" cy="18" r="2" fill="white" opacity="0.5" />
        <circle cx="16" cy="18" r="2" fill="white" opacity="0.5" />
      </svg>
    ),
    file: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
        <path d="M14 2v6h6M12 18v-6m-3 3l3-3 3 3" />
      </svg>
    ),
    link: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
    car: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 17h14v4H5v-4zM3 11l2-7h14l2 7M3 11h18M7 11V8m10 3V8m-10 6h.01M17 14h.01" />
        <circle cx="7" cy="17" r="2" fill="currentColor" />
        <circle cx="17" cy="17" r="2" fill="currentColor" />
      </svg>
    ),
    heat: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c1 3 2.5 3.5 3.5 4.5S17 8 17 10a5 5 0 01-10 0c0-2 1.5-3.5 2.5-4.5S11 3 12 2z" />
        <path d="M12 12c.5 1.5 1.25 1.75 1.75 2.25s1.25 1.25 1.25 2.25a2.5 2.5 0 01-5 0c0-1 .75-1.75 1.25-2.25S11.5 13.5 12 12z" opacity="0.7" />
      </svg>
    ),
    battery: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="18" height="11" rx="2" />
        <path d="M6 11h8m-8 3h5M20 10v5M23 13h-3" />
      </svg>
    ),
    inverter: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 12h10M12 7v10M9 9l3 3-3 3m6-6l-3 3 3 3" />
      </svg>
    ),
    back: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5m7-7l-7 7 7 7" />
      </svg>
    ),
    wallbox: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M10 6h4M10 10h4M12 14v4" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
    solar: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="10" width="18" height="10" rx="1" />
        <path d="M7 10V6l5-4 5 4v4M9 14h6M8 17h8" />
      </svg>
    ),
    box: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 8l-10-5L1 8l10 5 10-5zM1 12l10 5 10-5M1 16l10 5 10-5" />
      </svg>
    ),
    edit: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    trash: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
      </svg>
    ),
    save: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <path d="M17 21v-8H7v8M7 3v5h8" />
      </svg>
    ),
    error: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4m0 4h.01" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    ),
    check: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    info: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4m0-4h.01" strokeLinecap="round" />
      </svg>
    ),
    lock: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 018 0v4" />
      </svg>
    ),
    globe: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    tree: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        {/* Baumkrone - 3 Ebenen */}
        <path d="M12 2l-4 5h2l-3 4h2l-3.5 5h13L15 11h2l-3-4h2z" opacity="0.9"/>
        {/* Stamm */}
        <rect x="10" y="16" width="4" height="6" rx="0.5"/>
        {/* Boden */}
        <ellipse cx="12" cy="22" rx="5" ry="1" opacity="0.3"/>
      </svg>
    ),
    target: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    ),
    'trend-up': (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" />
      </svg>
    ),
    'trend-down': (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6" />
      </svg>
    ),
    trophy: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 3h10M7 3H5a2 2 0 00-2 2v3c0 3 2 5 4 5h1m10-10h2a2 2 0 012 2v3c0 3-2 5-4 5h-1M7 13v2a5 5 0 0010 0v-2m-5 7v3m-4 0h8" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <rect x="7" y="3" width="10" height="7" rx="1" />
      </svg>
    ),
    alert: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 20h20L12 2z" />
        <path d="M12 9v4m0 4h.01" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    ),
    bulb: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 21h6m-6-4h6m-3-13a6 6 0 00-4 10.5V17h8v-2.5A6 6 0 0012 4z" />
        <circle cx="12" cy="10" r="3" fill="white" opacity="0.5" />
      </svg>
    ),
    calendar: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M8 2v4m8-4v4M3 10h18" />
      </svg>
    ),
    shield: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    upload: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </svg>
    ),
    download: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
    ),
    eye: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    close: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    ),
    checkmark: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    logout: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
    ),
    menu: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12h18M3 6h18M3 18h18" />
      </svg>
    ),
    'chevron-down': (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    ),
    users: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    map: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16" />
      </svg>
    ),
    leaf: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 3C10 3 5 8 5 15c0 3 1 5 3 6 0-2 1-4 3-5-1-2-1-4 0-6 2 3 4 4 7 4 0-3-1-6-3-8 3 0 6 2 7 5 1-5-2-8-5-8z" />
        <path d="M5 15c0 3 2 6 5 7-2-1-3-3-3-5s1-4 2-5c-2 1-4 2-4 3z" opacity="0.5" />
      </svg>
    ),
    list: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  }

  return icons[type] || <span className={className}>•</span>
}
