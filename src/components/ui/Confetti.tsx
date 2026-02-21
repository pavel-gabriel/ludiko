import { useEffect, useState } from 'react';

const COLORS = ['#FFB6C1', '#87CEEB', '#98FB98', '#FFFACD', '#DDA0DD', '#FFDAB9', '#FF6B6B', '#4ECDC4'];
const PARTICLE_COUNT = 60;

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  drift: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 2,
    size: 6 + Math.random() * 8,
    drift: (Math.random() - 0.5) * 80,
  }));
}

export default function Confetti() {
  const [particles] = useState(generateParticles);
  const [visible, setVisible] = useState(true);

  /* Respect prefers-reduced-motion */
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible || prefersReducedMotion) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
