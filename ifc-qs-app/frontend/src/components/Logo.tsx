interface LogoProps {
  /** Size of the icon square in px */
  size?: number
  /** Show the wordmark next to the icon */
  showWordmark?: boolean
  /** Show the tagline below the wordmark */
  showTagline?: boolean
}

export function Logo({ size = 40, showWordmark = true, showTagline = false }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="6" fill="#1D3461" />
        <polygon points="16,5 25,13 7,13" fill="#ffffff" />
        <rect x="8" y="13" width="16" height="10" fill="#ffffff" />
        <rect x="13" y="17" width="6" height="6" rx="1" fill="#C9951A" />
        <rect x="4" y="25" width="24" height="3" rx="1.5" fill="#C9951A" />
        <rect x="8"  y="23" width="1" height="2" fill="#C9951A" />
        <rect x="12" y="23" width="1" height="2" fill="#C9951A" />
        <rect x="16" y="23" width="1" height="2" fill="#C9951A" />
        <rect x="20" y="23" width="1" height="2" fill="#C9951A" />
        <rect x="24" y="23" width="1" height="2" fill="#C9951A" />
      </svg>

      {showWordmark && (
        <div className="leading-none">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-black tracking-tight text-gray-900">QS</span>
            <span className="text-xl font-light tracking-tight text-gray-900">Tavern</span>
          </div>
          {showTagline && (
            <p className="text-xs text-gray-400 mt-0.5">IFC Quantity Surveyor</p>
          )}
        </div>
      )}
    </div>
  )
}
