/**
 * Plain-language descriptions for common 5-field cron expressions
 * ("0 9 * * *" → "Every day at 09:00"). Returns `null` for anything it can't
 * describe exactly, so callers show the raw expression instead of guessing.
 *
 * Follows croniter semantics (the scheduler Agno uses): day-of-week 0 and 7
 * are Sunday, names such as MON or JAN are accepted, and an expression that
 * restricts both day-of-month and day-of-week (OR semantics) is not described.
 */

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *'
}

const DAY_ALIASES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
}

const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** Monday-first order for listing weekdays. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const MAX_LISTED_TIMES = 4

function parseValue(
  token: string,
  aliases: Record<string, number> | undefined
): number | null {
  if (/^\d+$/.test(token)) return Number(token)
  if (aliases && token in aliases) return aliases[token]
  return null
}

/**
 * Expands one cron field (`*`, `*\/n`, `a`, `a-b`, `a-b/n`, `a/n`, and comma
 * lists of those) into its sorted values, or `null` when it is invalid.
 */
function expandField(
  field: string,
  min: number,
  max: number,
  aliases?: Record<string, number>
): number[] | null {
  const values = new Set<number>()
  for (const item of field.split(',')) {
    const [range, stepText, ...extra] = item.split('/')
    if (extra.length > 0 || range === '') return null
    let step = 1
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText)) return null
      step = Number(stepText)
      if (step < 1) return null
    }
    let start: number
    let end: number
    if (range === '*') {
      start = min
      end = max
    } else if (range.includes('-')) {
      const [from, to, ...rest] = range.split('-')
      const low = parseValue(from, aliases)
      const high = parseValue(to, aliases)
      if (rest.length > 0 || low === null || high === null || low > high) {
        return null
      }
      start = low
      end = high
    } else {
      const value = parseValue(range, aliases)
      if (value === null) return null
      start = value
      // "a/n" means every n-th value starting at a.
      end = stepText !== undefined ? max : value
    }
    if (start < min || end > max) return null
    for (let value = start; value <= end; value += step) values.add(value)
  }
  return [...values].sort((a, b) => a - b)
}

const pad = (value: number) => String(value).padStart(2, '0')
const clock = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const ORDINAL_SUFFIXES: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' }

export function ordinal(value: number): string {
  const tens = value % 100
  if (tens >= 11 && tens <= 13) return `${value}th`
  return `${value}${ORDINAL_SUFFIXES[value % 10] ?? 'th'}`
}

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

const isContiguous = (values: number[]) =>
  values.every((value, index) => index === 0 || value === values[index - 1] + 1)

/**
 * `at` phrases name fixed clock times ("at 09:00 and 17:00"); `every`
 * phrases describe a recurrence within the day ("every 15 minutes").
 */
type TimePhrase = { kind: 'at'; text: string } | { kind: 'every'; text: string }

function describeTime(minute: string, hour: string): TimePhrase | null {
  const stepMinutes = /^\*\/(\d+)$/.exec(minute)
  if (hour === '*') {
    if (minute === '*') return { kind: 'every', text: 'every minute' }
    if (stepMinutes) {
      const step = Number(stepMinutes[1])
      if (step < 1 || step > 59) return null
      return {
        kind: 'every',
        text: step === 1 ? 'every minute' : `every ${step} minutes`
      }
    }
    const minutes = expandField(minute, 0, 59)
    if (!minutes || minutes.length > MAX_LISTED_TIMES) return null
    return {
      kind: 'every',
      text: `every hour at ${joinList(minutes.map((value) => `:${pad(value)}`))}`
    }
  }

  // The remaining patterns need a single minute.
  if (!/^\d+$/.test(minute)) return null
  const atMinute = Number(minute)
  if (atMinute > 59) return null

  const stepHours = /^\*\/(\d+)$/.exec(hour)
  if (stepHours) {
    const step = Number(stepHours[1])
    if (step < 1 || step > 23) return null
    return {
      kind: 'every',
      text:
        step === 1
          ? `every hour at :${pad(atMinute)}`
          : `every ${step} hours at :${pad(atMinute)}`
    }
  }

  const hours = expandField(hour, 0, 23)
  if (!hours) return null
  if (hours.length <= MAX_LISTED_TIMES) {
    return {
      kind: 'at',
      text: `at ${joinList(hours.map((value) => clock(value, atMinute)))}`
    }
  }
  if (isContiguous(hours)) {
    const first = clock(hours[0], atMinute)
    const last = clock(hours[hours.length - 1], atMinute)
    return { kind: 'every', text: `every hour from ${first} to ${last}` }
  }
  return null
}

function describeWeekdays(days: number[]): string {
  const set = new Set(days)
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) {
    return 'weekday'
  }
  return joinList(
    WEEK_ORDER.filter((day) => set.has(day)).map((day) => DAY_NAMES[day])
  )
}

export function describeCron(
  expression: string | null | undefined
): string | null {
  if (!expression) return null
  const normalized = expression.trim().toLowerCase()
  if (!normalized) return null
  const fields = (MACROS[normalized] ?? normalized).split(/\s+/)
  if (fields.length !== 5) return null
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields

  const time = describeTime(minute, hour)
  if (!time) return null

  // Every day.
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return time.kind === 'at' ? `Every day ${time.text}` : capitalize(time.text)
  }

  // Specific days of the week.
  if (dayOfMonth === '*' && month === '*') {
    const expanded = expandField(dayOfWeek, 0, 7, DAY_ALIASES)
    if (!expanded) return null
    const days = [...new Set(expanded.map((day) => day % 7))]
    if (days.length === 7) {
      return time.kind === 'at'
        ? `Every day ${time.text}`
        : capitalize(time.text)
    }
    const label = describeWeekdays(days)
    if (time.kind === 'at') return `Every ${label} ${time.text}`
    return `${capitalize(time.text)} on ${label === 'weekday' ? 'weekdays' : label}`
  }

  // Specific days of the month.
  if (month === '*' && dayOfWeek === '*') {
    const days = expandField(dayOfMonth, 1, 31)
    if (!days || days.length > MAX_LISTED_TIMES) return null
    const label = `the ${joinList(days.map(ordinal))}`
    return time.kind === 'at'
      ? `Every month on ${label} ${time.text}`
      : `${capitalize(time.text)} on ${label} of each month`
  }

  // One day a year.
  if (dayOfWeek === '*' && time.kind === 'at') {
    const days = expandField(dayOfMonth, 1, 31)
    const months = expandField(month, 1, 12, MONTH_ALIASES)
    if (days?.length === 1 && months?.length === 1) {
      return `Every year on ${MONTH_NAMES[months[0] - 1]} ${days[0]} ${time.text}`
    }
  }

  return null
}
