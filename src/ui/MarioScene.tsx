/** Official-style Super Mario Mushroom vector artwork. Clean geometry, zero AI distortion. */
export default function MarioScene() {
  return (
    <svg
      viewBox="0 0 400 440"
      className="mario-scene"
      role="img"
      aria-label="Super Mushroom de Mario con sombrero rojo, lunares blancos y ojos clásicos"
    >
      <defs>
        <radialGradient id="shroom-red" cx="45%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FF463A" />
          <stop offset="70%" stopColor="#E52521" />
          <stop offset="100%" stopColor="#C41915" />
        </radialGradient>
        <linearGradient id="shroom-stem" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF2E0" />
          <stop offset="100%" stopColor="#FBD7B3" />
        </linearGradient>
        <clipPath id="shroom-cap-clip">
          <path d="M 68 255 C 50 220 52 165 105 110 C 150 65 250 65 295 110 C 348 165 350 220 332 255 C 316 280 275 284 200 284 C 125 284 84 280 68 255 Z" />
        </clipPath>
        <filter id="mario-drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#8B2638" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Sombra de suelo */}
      <ellipse cx="200" cy="405" rx="140" ry="18" fill="#4A161E" opacity="0.22" />

      {/* Grupo principal con sombra suave */}
      <g filter="url(#mario-drop-shadow)">
        {/* Tallo / Rostro del hongo */}
        <path
          d="M 124 250 C 124 350 142 388 200 388 C 258 388 276 350 276 250 Z"
          fill="url(#shroom-stem)"
          stroke="#1B1718"
          strokeWidth="11"
          strokeLinejoin="round"
        />

        {/* Ojos clásicos de Mario (cápsulas verticales) */}
        <g>
          {/* Ojo izquierdo */}
          <rect x="160" y="286" width="16" height="42" rx="8" fill="#1B1718" />
          <circle cx="165" cy="296" r="4.5" fill="#FFFFFF" />

          {/* Ojo derecho */}
          <rect x="224" y="286" width="16" height="42" rx="8" fill="#1B1718" />
          <circle cx="229" cy="296" r="4.5" fill="#FFFFFF" />
        </g>

        {/* Sombrero del hongo (cap) */}
        <path
          d="M 68 255 C 50 220 52 165 105 110 C 150 65 250 65 295 110 C 348 165 350 220 332 255 C 316 280 275 284 200 284 C 125 284 84 280 68 255 Z"
          fill="url(#shroom-red)"
          stroke="#1B1718"
          strokeWidth="12"
          strokeLinejoin="round"
        />

        {/* Lunares blancos recortados al contorno del sombrero */}
        <g clipPath="url(#shroom-cap-clip)">
          {/* Lunar central gigante */}
          <ellipse
            cx="200"
            cy="176"
            rx="52"
            ry="48"
            fill="#FFFDF7"
            stroke="#1B1718"
            strokeWidth="11"
          />

          {/* Lunar lateral izquierdo */}
          <ellipse
            cx="68"
            cy="192"
            rx="46"
            ry="54"
            fill="#FFFDF7"
            stroke="#1B1718"
            strokeWidth="11"
          />

          {/* Lunar lateral derecho */}
          <ellipse
            cx="332"
            cy="192"
            rx="46"
            ry="54"
            fill="#FFFDF7"
            stroke="#1B1718"
            strokeWidth="11"
          />

          {/* Lunar superior sutil */}
          <ellipse
            cx="200"
            cy="68"
            rx="42"
            ry="24"
            fill="#FFFDF7"
            stroke="#1B1718"
            strokeWidth="10"
          />
        </g>

        {/* Borde exterior definitivo para contorno perfecto */}
        <path
          d="M 68 255 C 50 220 52 165 105 110 C 150 65 250 65 295 110 C 348 165 350 220 332 255 C 316 280 275 284 200 284 C 125 284 84 280 68 255 Z"
          fill="none"
          stroke="#1B1718"
          strokeWidth="12"
          strokeLinejoin="round"
        />
      </g>

      {/* Destellos de Super Estrella sutiles estilo Nintendo */}
      <g fill="#FDD231" opacity="0.9">
        {/* Destello superior derecho */}
        <path d="M 330 90 Q 338 90 338 82 Q 338 90 346 90 Q 338 90 338 98 Q 338 90 330 90 Z" />
        {/* Destello izquierdo */}
        <path d="M 52 290 Q 60 290 60 282 Q 60 290 68 290 Q 60 290 60 298 Q 60 290 52 290 Z" />
      </g>
    </svg>
  );
}
