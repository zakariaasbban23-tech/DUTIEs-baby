import type { Chore, Roommate } from './schedule'

export interface CompletionRecord {
  id: string
  chore: Chore
  dueDate: string
  person: Roommate
  completedAt: string
}

export interface ReminderSetting {
  enabled: boolean
  time: string
}

export interface StorageAdapter {
  get(key: string): unknown
  set(key: string, value: unknown): void
}

export const STORAGE_KEYS = {
  garbageHistory: 'dormDuty.garbage.completions.v1',
  floorHistory: 'dormDuty.floor.completions.v1',
  garbageReminder: 'dormDuty.garbage.reminder.v1',
  floorReminder: 'dormDuty.floor.reminder.v1',
  migrated: 'dormDuty.migration.v1'
} as const

export const DEFAULT_REMINDERS: Record<Chore, ReminderSetting> = {
  garbage: { enabled: true, time: '20:00' },
  floor: { enabled: true, time: '18:00' }
}

const LEGACY_HISTORY_KEYS: Record<Chore, string[]> = {
  garbage: ['garbageHistory', 'garbageCompletionHistory', 'garbage_completions', 'completionHistory'],
  floor: ['floorHistory', 'floorCleaningHistory', 'floor_completions']
}

function historyKey(chore: Chore): string {
  return chore === 'garbage' ? STORAGE_KEYS.garbageHistory : STORAGE_KEYS.floorHistory
}

function reminderKey(chore: Chore): string {
  return chore === 'garbage' ? STORAGE_KEYS.garbageReminder : STORAGE_KEYS.floorReminder
}

function isCompletion(value: unknown): value is CompletionRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<CompletionRecord>
  return typeof record.dueDate === 'string' && typeof record.completedAt === 'string' &&
    (record.chore === 'garbage' || record.chore === 'floor') &&
    (record.person === 'Zakaria' || record.person === 'Roman' || record.person === 'Yegor')
}

export function loadHistory(storage: StorageAdapter, chore: Chore): CompletionRecord[] {
  const current = storage.get(historyKey(chore))
  const currentRows = Array.isArray(current) ? current.filter(isCompletion).filter(row => row.chore === chore) : []

  // Read and merge known legacy keys without deleting or overwriting the originals.
  const legacyRows = LEGACY_HISTORY_KEYS[chore].flatMap(key => {
    const value = storage.get(key)
    if (!Array.isArray(value)) return []
    return value.filter(isCompletion).filter(row => row.chore === chore)
  })

  const unique = new Map<string, CompletionRecord>()
  ;[...legacyRows, ...currentRows].forEach(row => unique.set(row.id || `${row.chore}-${row.dueDate}-${row.completedAt}`, row))
  return [...unique.values()].sort((a, b) => b.completedAt.localeCompare(a.completedAt))
}

export function saveHistory(storage: StorageAdapter, chore: Chore, rows: CompletionRecord[]): void {
  storage.set(historyKey(chore), rows)
}

export function addCompletion(storage: StorageAdapter, record: CompletionRecord): CompletionRecord[] {
  const rows = loadHistory(storage, record.chore)
  const withoutSameTurn = rows.filter(row => row.dueDate !== record.dueDate)
  const next = [record, ...withoutSameTurn]
  saveHistory(storage, record.chore, next)
  return next
}

export function loadReminder(storage: StorageAdapter, chore: Chore): ReminderSetting {
  const value = storage.get(reminderKey(chore)) as Partial<ReminderSetting> | null
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : DEFAULT_REMINDERS[chore].enabled,
    time: typeof value?.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
      ? value.time
      : DEFAULT_REMINDERS[chore].time
  }
}

export function saveReminder(storage: StorageAdapter, chore: Chore, setting: ReminderSetting): void {
  storage.set(reminderKey(chore), { ...setting })
}

export function createMemoryStorage(initial: Record<string, unknown> = {}): StorageAdapter & { data: Record<string, unknown> } {
  const data = { ...initial }
  return {
    data,
    get(key: string) {
      const value = data[key]
      return value === undefined ? null : JSON.parse(JSON.stringify(value))
    },
    set(key: string, value: unknown) {
      data[key] = JSON.parse(JSON.stringify(value))
    }
  }
}
