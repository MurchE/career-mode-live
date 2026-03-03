'use client'

import { useCharacterStore } from '@/stores/character-store'

const SKILL_COLORS: Record<string, string> = {
  technical: '#58A6FF',
  leadership: '#FFA657',
  communication: '#BC8CFF',
  analytical: '#79C0FF',
  creative: '#3FB950',
  operational: '#E3B341',
}

const SKILL_LABELS: Record<string, string> = {
  technical: 'Technical',
  leadership: 'Leadership',
  communication: 'Communication',
  analytical: 'Analytical',
  creative: 'Creative',
  operational: 'Operational',
}

const CLASS_DESCRIPTIONS: Record<string, string> = {
  hacker: 'Builds and breaks systems',
  scientist: 'Data-driven decision maker',
  bard: 'Communicator and storyteller',
  paladin: 'Leader and protector',
  ranger: 'Executor and operator',
  artificer: 'Creative builder',
}

const CLASS_ICONS: Record<string, string> = {
  hacker: '>_',
  scientist: 'dx',
  bard: 'Aa',
  paladin: '/\\',
  ranger: '>>',
  artificer: '**',
}

/**
 * SVG-based radar chart for skill visualization.
 */
function RadarChart({ allocation, totalBudget }: { allocation: Record<string, number>; totalBudget: number }) {
  const skills = Object.keys(SKILL_LABELS)
  const cx = 120
  const cy = 120
  const maxR = 90
  const levels = 4

  // Calculate angle for each skill
  const angleStep = (2 * Math.PI) / skills.length
  const startAngle = -Math.PI / 2

  // Grid lines
  const gridLines = []
  for (let level = 1; level <= levels; level++) {
    const r = (maxR / levels) * level
    const points = skills
      .map((_, i) => {
        const angle = startAngle + i * angleStep
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
      })
      .join(' ')
    gridLines.push(
      <polygon
        key={`grid-${level}`}
        points={points}
        fill="none"
        stroke="#30363D"
        strokeWidth="1"
        opacity={0.5}
      />,
    )
  }

  // Axis lines
  const axisLines = skills.map((_, i) => {
    const angle = startAngle + i * angleStep
    return (
      <line
        key={`axis-${i}`}
        x1={cx}
        y1={cy}
        x2={cx + maxR * Math.cos(angle)}
        y2={cy + maxR * Math.sin(angle)}
        stroke="#30363D"
        strokeWidth="1"
        opacity={0.3}
      />
    )
  })

  // Data polygon
  const maxPerSkill = totalBudget * 0.4
  const dataPoints = skills
    .map((skill, i) => {
      const value = allocation[skill] || 0
      const normalized = Math.min(value / maxPerSkill, 1)
      const r = normalized * maxR
      const angle = startAngle + i * angleStep
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    })
    .join(' ')

  // Labels
  const labels = skills.map((skill, i) => {
    const angle = startAngle + i * angleStep
    const labelR = maxR + 20
    const x = cx + labelR * Math.cos(angle)
    const y = cy + labelR * Math.sin(angle)
    return (
      <text
        key={`label-${skill}`}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={SKILL_COLORS[skill]}
        fontSize="10"
        fontWeight="500"
      >
        {SKILL_LABELS[skill]}
      </text>
    )
  })

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[240px] mx-auto">
      {gridLines}
      {axisLines}
      <polygon
        points={dataPoints}
        fill="#58A6FF"
        fillOpacity="0.15"
        stroke="#58A6FF"
        strokeWidth="2"
        className="radar-polygon"
      />
      {/* Data points */}
      {skills.map((skill, i) => {
        const value = allocation[skill] || 0
        const normalized = Math.min(value / maxPerSkill, 1)
        const r = normalized * maxR
        const angle = startAngle + i * angleStep
        return (
          <circle
            key={`point-${skill}`}
            cx={cx + r * Math.cos(angle)}
            cy={cy + r * Math.sin(angle)}
            r="3"
            fill={SKILL_COLORS[skill]}
          />
        )
      })}
      {labels}
    </svg>
  )
}

export function CharacterSheetMini() {
  const { characterSheet } = useCharacterStore()

  if (!characterSheet) return null

  const { suggested_allocation, total_budget, character_class, primary_stat, secondary_stat, confidence, name, title } =
    characterSheet

  const maxVal = Math.max(...Object.values(suggested_allocation))

  return (
    <div className="p-4 space-y-5">
      {/* Character Identity */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-tertiary border border-border">
          <span className="text-sm font-mono font-bold text-accent-blue">
            {CLASS_ICONS[character_class] || '??'}
          </span>
          <span className="text-sm font-semibold capitalize">{character_class}</span>
        </div>
        <h3 className="text-lg font-bold">{name}</h3>
        <p className="text-sm text-text-secondary">{title}</p>
        <p className="text-xs text-text-muted">
          {CLASS_DESCRIPTIONS[character_class] || 'Adventurer'}
        </p>
      </div>

      {/* Radar Chart */}
      <div>
        <RadarChart allocation={suggested_allocation} totalBudget={total_budget} />
      </div>

      {/* Skill Bars */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Skill Distribution</span>
          <span className="font-mono">{total_budget} pts</span>
        </div>
        {Object.entries(suggested_allocation)
          .sort(([, a], [, b]) => b - a)
          .map(([skill, value]) => (
            <div key={skill} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: SKILL_COLORS[skill] }}>
                  {SKILL_LABELS[skill]}
                  {skill === primary_stat && (
                    <span className="ml-1 text-text-muted">(primary)</span>
                  )}
                  {skill === secondary_stat && (
                    <span className="ml-1 text-text-muted">(secondary)</span>
                  )}
                </span>
                <span className="text-xs font-mono text-text-muted">{value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${(value / maxVal) * 100}%`,
                    backgroundColor: SKILL_COLORS[skill],
                  }}
                />
              </div>
            </div>
          ))}
      </div>

      {/* Confidence */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Analysis confidence</span>
          <span className="font-mono text-text-secondary">{Math.round(confidence * 100)}%</span>
        </div>
        <p className="text-xs text-text-muted mt-1">
          Based on resume signal density. Tell the panel more stories to refine.
        </p>
      </div>

      {/* Reset button */}
      <button
        onClick={() => useCharacterStore.getState().resetOnboarding()}
        className="w-full py-2 rounded-lg border border-border text-text-muted text-xs hover:text-text-secondary hover:border-text-muted transition-colors"
      >
        Start Over
      </button>
    </div>
  )
}
