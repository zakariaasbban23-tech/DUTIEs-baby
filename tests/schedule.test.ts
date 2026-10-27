import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  countdownText,
  differenceInDays,
  getDutyForDate,
  getNextDuty,
  getUpcomingDuties,
  reminderMessage
} from '../src/utils/schedule'
import {
  STORAGE_KEYS,
  addCompletion,
  createMemoryStorage,
  loadHistory,
  loadReminder,
  saveHistory,
  saveReminder
} from '../src/utils/storage'

const floorCases = [
  ['2026-10-29', 'Zakaria'],
  ['2026-11-01', 'Yegor'],
  ['2026-11-04', 'Roman'],
  ['2026-11-07', 'Zakaria'],
  ['2026-11-10', 'Yegor']
] as const

const garbageCases = [
  ['2026-10-27', 'Zakaria'],
  ['2026-10-28', 'Roman'],
  ['2026-10-29', 'Yegor'],
  ['2026-10-30', 'Zakaria']
] as const

test('floor-cleaning assignments match every required date', () => {
  floorCases.forEach(([date, person]) => assert.equal(getDutyForDate('floor', date)?.person, person))
})

test('garbage rotation remains unchanged', () => {
  garbageCases.forEach(([date, person]) => assert.equal(getDutyForDate('garbage', date)?.person, person))
})

test('October 27 shows Zakaria’s floor turn in two days', () => {
  const duty = getNextDuty('floor', '2026-10-27')
  assert.equal(duty.person, 'Zakaria')
  assert.equal(duty.date, '2026-10-29')
  assert.equal(duty.daysAway, 2)
  assert.equal(countdownText(duty), 'Your turn in 2 days')
})

test('floor has no assignee between three-day duties', () => {
  assert.equal(getDutyForDate('floor', '2026-10-27'), null)
  assert.equal(getDutyForDate('floor', '2026-10-30'), null)
  assert.equal(getNextDuty('floor', '2026-10-30').date, '2026-11-01')
})

test('calendar arithmetic handles month boundaries and dates before anchors', () => {
  assert.equal(addDays('2026-10-30', 2), '2026-11-01')
  assert.equal(differenceInDays('2026-11-01', '2026-10-29'), 3)
  assert.equal(getDutyForDate('floor', '2026-10-26'), null)
  assert.equal(getNextDuty('floor', '2026-10-26').person, 'Zakaria')
  assert.equal(getNextDuty('garbage', '2026-10-26').date, '2026-10-27')
})

test('upcoming floor assignments follow independent order', () => {
  assert.deepEqual(
    getUpcomingDuties('floor', '2026-10-27').map(row => [row.date, row.person]),
    floorCases.slice(0, 3).map(row => [...row])
  )
})

test('reminder message contains chore, roommate, due date and time', () => {
  const message = reminderMessage('floor', getNextDuty('floor', '2026-10-27'), '18:30')
  assert.match(message, /Floor Cleaning/)
  assert.match(message, /Zakaria/)
  assert.match(message, /Thursday, Oct 29, 2026/)
  assert.match(message, /18:30/)
})

test('garbage and floor completions are fully isolated', () => {
  const storage = createMemoryStorage()
  addCompletion(storage, { id: 'g1', chore: 'garbage', dueDate: '2026-10-27', person: 'Zakaria', completedAt: '2026-10-27T12:00:00.000Z' })
  assert.equal(loadHistory(storage, 'garbage').length, 1)
  assert.equal(loadHistory(storage, 'floor').length, 0)
  assert.equal(storage.get(STORAGE_KEYS.floorHistory), null)

  addCompletion(storage, { id: 'f1', chore: 'floor', dueDate: '2026-10-29', person: 'Zakaria', completedAt: '2026-10-29T12:00:00.000Z' })
  assert.equal(loadHistory(storage, 'garbage').length, 1)
  assert.equal(loadHistory(storage, 'floor').length, 1)
  assert.equal(getNextDuty('floor', '2026-10-29').person, 'Zakaria')
  assert.equal(getDutyForDate('garbage', '2026-10-28')?.person, 'Roman')
})

test('completion records and settings survive storage reloads', () => {
  const storage = createMemoryStorage()
  addCompletion(storage, { id: 'f1', chore: 'floor', dueDate: '2026-10-29', person: 'Zakaria', completedAt: '2026-10-29T12:00:00.000Z' })
  saveReminder(storage, 'floor', { enabled: false, time: '19:45' })

  assert.equal(loadHistory(storage, 'floor')[0].id, 'f1')
  assert.deepEqual(loadReminder(storage, 'floor'), { enabled: false, time: '19:45' })
  assert.deepEqual(loadReminder(storage, 'garbage'), { enabled: true, time: '20:00' })
})

test('reminder preferences save independently', () => {
  const storage = createMemoryStorage()
  saveReminder(storage, 'garbage', { enabled: false, time: '21:00' })
  saveReminder(storage, 'floor', { enabled: true, time: '17:30' })
  assert.deepEqual(loadReminder(storage, 'garbage'), { enabled: false, time: '21:00' })
  assert.deepEqual(loadReminder(storage, 'floor'), { enabled: true, time: '17:30' })
})

test('legacy garbage records migrate without deleting original data', () => {
  const legacy = { id: 'old-1', chore: 'garbage', dueDate: '2026-10-20', person: 'Yegor', completedAt: '2026-10-20T12:00:00.000Z' }
  const storage = createMemoryStorage({ garbageHistory: [legacy] })
  const rows = loadHistory(storage, 'garbage')
  saveHistory(storage, 'garbage', rows)
  assert.equal(loadHistory(storage, 'garbage').length, 1)
  assert.deepEqual(storage.get('garbageHistory'), [legacy])
  assert.equal(loadHistory(storage, 'garbage')[0].id, 'old-1')
})
