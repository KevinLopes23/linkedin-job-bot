/** Marca do Vagalume: asas em V e o abdômen aceso (mesmo desenho do ícone do app). */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="60 110 392 330" aria-hidden="true">
      <defs>
        <radialGradient id="logo-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffe27a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffb020" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="logo-core" cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.55" stopColor="#ffe680" />
          <stop offset="1" stopColor="#f5b32a" />
        </radialGradient>
      </defs>
      <circle className="logo__halo" cx="256" cy="320" r="150" fill="url(#logo-halo)" />
      <path d="M248 300 C 210 230, 140 150, 92 128 C 120 190, 170 262, 238 316 Z" fill="#b9c8f5" opacity="0.85" />
      <path d="M264 300 C 302 230, 372 150, 420 128 C 392 190, 342 262, 274 316 Z" fill="#b9c8f5" opacity="0.85" />
      <circle cx="256" cy="246" r="20" fill="#e9eeff" />
      <ellipse className="logo__core" cx="256" cy="330" rx="46" ry="62" fill="url(#logo-core)" />
    </svg>
  )
}
