// week ids ('W6' or session ids like 'w6') -> theme colour classes; tokens live in index.css
const tones: Record<string, { text: string; dot: string }> = {
  W1: { text: 'text-s1', dot: 'bg-s1' },
  W2: { text: 'text-s2', dot: 'bg-s2' },
  W3: { text: 'text-s3', dot: 'bg-s3' },
  W4: { text: 'text-s4', dot: 'bg-s4' },
  W5: { text: 'text-s5', dot: 'bg-s5' },
  W6: { text: 'text-s6', dot: 'bg-s6' },
  W9: { text: 'text-s9', dot: 'bg-s9' },
  W10: { text: 'text-s10', dot: 'bg-s10' },
}

export function weekText(week: string, fallback = 'text-ink-muted'): string {
  return tones[week.toUpperCase()]?.text ?? fallback
}

export function weekDot(week: string): string {
  return tones[week.toUpperCase()]?.dot ?? 'bg-ink-faint'
}

const weekNum = (id: string) => Number(id.replace(/\D/g, '')) || Infinity

// distinct week labels in teaching order, e.g. ['W10', 'W1', 'W1'] -> ['W1', 'W10']
export function weekOrder(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort((a, b) => weekNum(a) - weekNum(b) || a.localeCompare(b))
}

// ['w1', ..., 'w6', 'w9', 'w10'] -> 'Weeks 1–6, 9 and 10'
export function weekSpan(ids: readonly string[]): string {
  const nums = [...new Set(ids.map(id => Number(id.replace(/\D/g, ''))))]
    .filter(n => n > 0)
    .sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < nums.length; ) {
    let j = i
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++
    if (j - i >= 2) parts.push(`${nums[i]}\u2060–\u2060${nums[j]}`) // word joiners keep '1–6' on one line
    else parts.push(...nums.slice(i, j + 1).map(String))
    i = j + 1
  }
  if (parts.length === 0) return ''
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `${nums.length === 1 ? 'Week' : 'Weeks'} ${list}`
}
