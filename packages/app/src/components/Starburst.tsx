/**
 * A hand-drawn "1st edition" style starburst badge — an original CSS/SVG
 * decoration (not a reproduction of any published logo). Used as a banner
 * accent and to carry the round label.
 */
export function Starburst({ label, className }: { label?: string; className?: string }) {
  const spikes = 16;
  const cx = 50;
  const cy = 50;
  const outer = 48;
  const inner = 38;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return (
    <span className={`starburst${className ? ` ${className}` : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <polygon className="starburst__ray" points={pts.join(' ')} />
        <circle className="starburst__ring" cx={cx} cy={cy} r="30" />
      </svg>
      {label && <span className="starburst__label">{label}</span>}
    </span>
  );
}
