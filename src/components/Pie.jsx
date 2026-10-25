// Hafif SVG pasta/halka grafikler: karnede çok sayıda küçük grafik olduğu için Chart.js yerine.

export function Donut({ parts, size = 120, thickness = 18, center, sub, legend = false, footer }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value || 0), 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={parts.map(p => `${p.label} ${p.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        {total > 0 &&
          parts.map(p => {
            const len = (Math.max(0, p.value || 0) / total) * c
            const el = (
              <circle
                key={p.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              >
                <title>{`${p.label}: ${+(+p.value).toFixed(2)}`}</title>
              </circle>
            )
            offset += len
            return el
          })}
        {center != null && (
          <text x="50%" y={sub ? '47%' : '50%'} textAnchor="middle" dominantBaseline="middle" className="donut-center" style={{ fontSize: size / 6.2 }}>
            {center}
          </text>
        )}
        {sub && (
          <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle" className="donut-sub" style={{ fontSize: size / 11 }}>
            {sub}
          </text>
        )}
      </svg>
      {legend && (
        <ul className="legend">
          {parts.map(p => (
            <li key={p.label}>
              <span className="dot" style={{ background: p.color }} />
              {p.label} <b>{+(+p.value).toFixed(2)}</b>
              {total > 0 && <small className="muted"> %{Math.round((p.value / total) * 100)}</small>}
            </li>
          ))}
          {footer && <li className="legend-total">{footer}</li>}
        </ul>
      )}
    </div>
  )
}

// Karnedeki puan halkası: değer / maks oranında dolan yay.
export function ScoreRing({ value, max = 500, color, label, size = 112 }) {
  const t = 9
  const r = (size - t) / 2
  const c = 2 * Math.PI * r
  const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div className="ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={t} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={t}
          strokeLinecap="round"
          strokeDasharray={`${ratio * c} ${c}`}
          transform={`rotate(90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="ring-value">
          {Number.isFinite(value) ? value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
        </text>
      </svg>
      <div className="ring-label">{label}</div>
    </div>
  )
}

export const DYB_COLORS = { d: '#22c55e', y: '#ef4444', b: '#cbd5e1' }
