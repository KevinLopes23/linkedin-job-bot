/** Ícones desenhados à mão, traço único 1.75 (24×24). */
const PATHS = {
  home: 'M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z',
  jobs: 'M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM4 12.5h16',
  board: 'M4.5 5h4v14h-4zM10 5h4v9h-4zM15.5 5h4v11.5h-4z',
  radar: 'M12 12 18 6M20 12a8 8 0 1 1-8-8M16.5 12A4.5 4.5 0 1 1 12 7.5',
  settings:
    'M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5zM19 12c0-.5-.05-1-.15-1.45l1.9-1.5-1.75-3-2.3.85a7 7 0 0 0-2.5-1.45L13.75 3h-3.5l-.45 2.45A7 7 0 0 0 7.3 6.9L5 6.05l-1.75 3 1.9 1.5a7 7 0 0 0 0 2.9l-1.9 1.5 1.75 3 2.3-.85a7 7 0 0 0 2.5 1.45l.45 2.45h3.5l.45-2.45a7 7 0 0 0 2.5-1.45l2.3.85 1.75-3-1.9-1.5c.1-.45.15-.95.15-1.45z',
  external: 'M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10',
  play: 'M8 5.5v13l10.5-6.5z',
  stop: 'M7 7h10v10H7z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15',
  key: 'M14.5 9.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM13.4 12.4 20 19M17 16l2-2',
  check: 'M5 12.5 10 17.5 19 7',
  close: 'M6 6l12 12M18 6 6 18',
  pin: 'M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11zM12 12.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.3c1.8.8 3 2.7 3 5.7',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  note: 'M6 4h9l4 4v12H6zM14.5 4v4.5H19M9 13h7M9 16.5h5',
  clock: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 8v4.5l3 2'
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
