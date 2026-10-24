import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export default function ChartBox({ type, data, options, height = 260 }) {
  const ref = useRef(null)
  const chart = useRef(null)

  useEffect(() => {
    Chart.defaults.color = css('--muted')
    Chart.defaults.borderColor = css('--grid')
    Chart.defaults.font.family = css('--font')
    chart.current = new Chart(ref.current, {
      type,
      data,
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, ...options }
    })
    return () => chart.current?.destroy()
  }, [type, JSON.stringify(data), JSON.stringify(options)])

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={ref} />
    </div>
  )
}
