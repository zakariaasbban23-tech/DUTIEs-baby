export type Roommate = 'Zakaria' | 'Roman' | 'Yegor'
export type Chore = 'garbage' | 'floor'

export interface DateParts {
  year: number
  month: number
  day: number
}

export interface Duty {
  chore: Chore
  date: string
  person: Roommate
  daysAway: number
}

export const ROOMMATES: Record<Roommate, { initial: string; color: string }> = {
  Zakaria: { initial: 'Z', color: '#C49A42' },
  Roman: { initial: 'R', color: '#91A991' },
  Yegor: { initial: 'Y', color: '#537E78' }
}

export const CHORE_DETAILS = {
  garbage: { title: 'Garbage Duty', action: 'Take out the garbage' },
  floor: { title: 'Floor Cleaning', action: 'Clean the floor' }
} as const

const SCHEDULES = {
  garbage: { anchor: '2026-10-27', interval: 1, order: ['Zakaria', 'Roman', 'Yegor'] as Roommate[] },
  floor: { anchor: '2026-10-29', interval: 3, order: ['Zakaria', 'Yegor', 'Roman'] as Roommate[] }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Create a local-noon date from components, never by parsing an ISO datetime. */
export function localDate(parts: DateParts): Date {
  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0)
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fromDateKey(key: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) throw new Error(`Invalid date key: ${key}`)
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  const date = localDate(parts)
  if (toDateKey(date) !== key) throw new Error(`Invalid calendar date: ${key}`)
  return parts
}

/** A timezone-free serial day number calculated from already-local date components. */
export function dayNumber(key: string): number {
  const { year, month, day } = fromDateKey(key)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

export function differenceInDays(later: string, earlier: string): number {
  return dayNumber(later) - dayNumber(earlier)
}

export function addDays(key: string, amount: number): string {
  const parts = fromDateKey(key)
  return toDateKey(localDate({ ...parts, day: parts.day + amount }))
}

export function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

export function getDutyForDate(chore: Chore, date: string): Duty | null {
  const schedule = SCHEDULES[chore]
  const elapsed = differenceInDays(date, schedule.anchor)
  if (elapsed < 0 || elapsed % schedule.interval !== 0) return null
  const turn = Math.floor(elapsed / schedule.interval)
  return {
    chore,
    date,
    person: schedule.order[positiveModulo(turn, schedule.order.length)],
    daysAway: 0
  }
}

export function getNextDuty(chore: Chore, fromDate: string): Duty {
  const schedule = SCHEDULES[chore]
  const elapsed = differenceInDays(fromDate, schedule.anchor)
  let turnsFromAnchor: number

  if (elapsed <= 0) {
    turnsFromAnchor = 0
  } else {
    turnsFromAnchor = Math.ceil(elapsed / schedule.interval)
  }

  const date = addDays(schedule.anchor, turnsFromAnchor * schedule.interval)
  return {
    chore,
    date,
    person: schedule.order[positiveModulo(turnsFromAnchor, schedule.order.length)],
    daysAway: differenceInDays(date, fromDate)
  }
}

export function getUpcomingDuties(chore: Chore, fromDate: string, count = 3, includeCurrent = true): Duty[] {
  const first = getNextDuty(chore, includeCurrent ? fromDate : addDays(fromDate, 1))
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(first.date, index * SCHEDULES[chore].interval)
    return getDutyForDate(chore, date) as Duty
  })
}

export function formatDate(key: string, includeYear = false): string {
  const { year, month, day } = fromDateKey(key)
  return `${MONTHS[month - 1]} ${day}${includeYear ? `, ${year}` : ''}`
}

export function formatLongDate(key: string): string {
  const date = localDate(fromDateKey(key))
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return `${weekdays[date.getDay()]}, ${formatDate(key, true)}`
}

export function countdownText(duty: Duty): string {
  const owner = duty.person === 'Zakaria' ? 'Your turn' : `${duty.person}’s turn`
  if (duty.daysAway === 0) return `${owner} today`
  if (duty.daysAway === 1) return `${owner} tomorrow`
  return `${owner} in ${duty.daysAway} days`
}

export function reminderMessage(chore: Chore, duty: Duty, time: string): string {
  return `${CHORE_DETAILS[chore].title}: ${duty.person} is responsible on ${formatLongDate(duty.date)}. Reminder time: ${time}.`
}
