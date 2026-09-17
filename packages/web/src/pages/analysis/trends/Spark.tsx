export function Spark({ series }: { series: readonly (number | null)[] }) {
  const known = series.filter((value): value is number => value != null);
  if (known.length < 2) return <span className="sub">—</span>;
  const max = Math.max(...known);
  const min = Math.min(...known);
  const span = max - min || 1;
  const segments: string[][] = [];
  let segment: string[] = [];
  series.forEach((value, index) => {
    if (value == null) {
      if (segment.length) segments.push(segment);
      segment = [];
      return;
    }
    segment.push(`${(index / Math.max(1, series.length - 1)) * 100},${20 - ((value - min) / span) * 18}`);
  });
  if (segment.length) segments.push(segment);
  return (
    <svg className="spark" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
      {segments.map((points) => (
        <polyline
          key={points.join(' ')}
          points={points.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
