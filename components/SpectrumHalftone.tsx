const STOPS = ["#d65620", "#9f7aee", "#4575cd", "#71d2f0", "#44b48b", "#f4df69"];

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t);
  };
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
}

function spectrum(t: number) {
  const clamped = Math.min(0.999, Math.max(0, t));
  const scaled = clamped * (STOPS.length - 1);
  const i = Math.floor(scaled);
  return mix(STOPS[i], STOPS[i + 1], scaled - i);
}

export function SpectrumHalftone() {
  const cols = 34;
  const rows = 22;
  const dots = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const t = x / (cols - 1) * 0.72 + y / (rows - 1) * 0.28;
      const r = 1.15 + ((x * 3 + y * 5) % 5) * 0.28;
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={16 + x * 18}
          cy={14 + y * 16}
          r={r}
          fill={spectrum(t)}
          opacity={0.28 + ((x + y) % 4) * 0.05}
        />,
      );
    }
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 640 380"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {dots}
    </svg>
  );
}
