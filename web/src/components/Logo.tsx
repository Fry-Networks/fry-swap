interface LogoProps {
  className?: string;
  showNetwork?: boolean;
}

export default function Logo({ className = 'w-12 h-12', showNetwork = false }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Red gradient for the paper airplane */}
        <linearGradient id="fryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF0000" />
          <stop offset="100%" stopColor="#8B0000" />
        </linearGradient>
        <linearGradient id="fryGradientDark" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#660000" />
          <stop offset="100%" stopColor="#CC0000" />
        </linearGradient>
        {/* Glow filter */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Network orbital lines (optional) */}
      {showNetwork && (
        <g className="animate-orbit" style={{ transformOrigin: '50px 50px' }}>
          {/* Orbital circle */}
          <ellipse
            cx="50"
            cy="50"
            rx="40"
            ry="40"
            fill="none"
            stroke="#1A1A1A"
            strokeWidth="2"
            strokeDasharray="8 4"
          />
          {/* Connection lines */}
          <line x1="10" y1="50" x2="25" y2="35" stroke="#1A1A1A" strokeWidth="2" />
          <line x1="90" y1="50" x2="75" y2="65" stroke="#1A1A1A" strokeWidth="2" />
          {/* Nodes */}
          <circle cx="10" cy="50" r="4" fill="#1A1A1A" />
          <circle cx="90" cy="50" r="4" fill="#1A1A1A" />
          <circle cx="50" cy="15" r="3" fill="#1A1A1A" />
          <circle cx="50" cy="85" r="3" fill="#1A1A1A" />
        </g>
      )}

      {/* 3D Paper Airplane / Origami shape */}
      <g filter="url(#glow)">
        {/* Top left face (brightest) */}
        <polygon
          points="30,65 50,20 50,50"
          fill="url(#fryGradient)"
        />
        {/* Top right face */}
        <polygon
          points="50,20 70,40 50,50"
          fill="#CC0000"
        />
        {/* Bottom face (darkest) */}
        <polygon
          points="30,65 50,50 70,75"
          fill="url(#fryGradientDark)"
        />
        {/* Right face */}
        <polygon
          points="50,50 70,40 70,75"
          fill="#990000"
        />
        {/* Edge highlights */}
        <line x1="50" y1="20" x2="50" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <line x1="30" y1="65" x2="50" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      </g>
    </svg>
  );
}
