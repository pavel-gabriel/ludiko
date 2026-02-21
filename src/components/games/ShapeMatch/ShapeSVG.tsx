interface ShapeSVGProps {
  shape: string;
  color: string;
  size?: number;
}

/**
 * Renders a colorful SVG shape.
 * Used in Shape Match game for both the target prompt and answer options.
 */
export default function ShapeSVG({ shape, color, size = 80 }: ShapeSVGProps) {
  const half = size / 2;
  const common = { fill: color, stroke: '#374151', strokeWidth: 2 };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      {shape === 'circle' && (
        <circle cx={half} cy={half} r={half - 4} {...common} />
      )}
      {shape === 'square' && (
        <rect x={4} y={4} width={size - 8} height={size - 8} rx={4} {...common} />
      )}
      {shape === 'triangle' && (
        <polygon
          points={`${half},4 ${size - 4},${size - 4} 4,${size - 4}`}
          {...common}
        />
      )}
      {shape === 'star' && (
        <polygon
          points={starPoints(half, half, 5, half - 4, half * 0.4)}
          {...common}
        />
      )}
      {shape === 'heart' && (
        <path d={heartPath(half, size)} {...common} />
      )}
      {shape === 'diamond' && (
        <polygon
          points={`${half},4 ${size - 4},${half} ${half},${size - 4} 4,${half}`}
          {...common}
        />
      )}
      {shape === 'hexagon' && (
        <polygon
          points={hexPoints(half, half, half - 4)}
          {...common}
        />
      )}
      {shape === 'oval' && (
        <ellipse cx={half} cy={half} rx={half - 4} ry={half * 0.6} {...common} />
      )}
    </svg>
  );
}

/** Generate star polygon points */
function starPoints(cx: number, cy: number, spikes: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  const step = Math.PI / spikes;
  let angle = -Math.PI / 2;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
    angle += step;
  }
  return pts.join(' ');
}

/** Generate heart SVG path — proper heart with two lobes */
function heartPath(half: number, size: number): string {
  const s = size;
  const top = s * 0.3;
  const bottom = s * 0.88;
  return `M ${half} ${bottom}
    C ${s * 0.05} ${s * 0.6}, ${s * 0.0} ${s * 0.2}, ${half * 0.5} ${top}
    A ${s * 0.15} ${s * 0.15} 0 0 1 ${half} ${top + s * 0.08}
    A ${s * 0.15} ${s * 0.15} 0 0 1 ${s - half * 0.5} ${top}
    C ${s * 1.0} ${s * 0.2}, ${s * 0.95} ${s * 0.6}, ${half} ${bottom} Z`;
}

/** Generate regular hexagon points */
function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}
