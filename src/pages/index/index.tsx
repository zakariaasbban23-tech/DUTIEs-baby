import { useCallback, useMemo, useState } from 'react'
import { Button, Picker, ScrollView, Switch, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  CHORE_DETAILS,
  Chore,
  Duty,
  ROOMMATES,
  countdownText,
  formatDate,
  formatLongDate,
  getDutyForDate,
  getNextDuty,
  getUpcomingDuties,
  reminderMessage,
  toDateKey
} from '../../utils/schedule'
import {
  CompletionRecord,
  ReminderSetting,
  StorageAdapter,
  addCompletion,
  loadHistory,
  loadReminder,
  saveReminder
} from '../../utils/storage'
import './index.scss'

const storage: StorageAdapter = {
  get(key) {
    try { return Taro.getStorageSync(key) } catch { return null }
  },
  set(key, value) {
    Taro.setStorageSync(key, value)
  }
}

const choreMeta = {
  garbage: { icon: '♻', eyebrow: 'EVERY DAY', className: 'garbage-card' },
  floor: { icon: '✦', eyebrow: 'EVERY 3 DAYS', className: 'floor-card' }
} as const

function completionDay(record: CompletionRecord): string {
  const date = new Date(record.completedAt)
  return Number.isNaN(date.getTime()) ? record.completedAt : formatDate(toDateKey(date), true)
}

export default function Index() {
  const [today, setToday] = useState(() => toDateKey(new Date()))
  const [testDate, setTestDate] = useState(today)
  const [guide, setGuide] = useState<Chore | null>(null)
  const [histories, setHistories] = useState<Record<Chore, CompletionRecord[]>>(() => ({
    garbage: loadHistory(storage, 'garbage'),
    floor: loadHistory(storage, 'floor')
  }))
  const [reminders, setReminders] = useState<Record<Chore, ReminderSetting>>(() => ({
    garbage: loadReminder(storage, 'garbage'),
    floor: loadReminder(storage, 'floor')
  }))

  const refresh = useCallback(() => {
    const currentDay = toDateKey(new Date())
    setToday(currentDay)
    setTestDate(currentDay)
    setHistories({ garbage: loadHistory(storage, 'garbage'), floor: loadHistory(storage, 'floor') })
    setReminders({ garbage: loadReminder(storage, 'garbage'), floor: loadReminder(storage, 'floor') })
  }, [])

  useDidShow(refresh)

  const duties = useMemo<Record<Chore, Duty>>(() => ({
    garbage: getNextDuty('garbage', today),
    floor: getNextDuty('floor', today)
  }), [today])

  const upcoming = useMemo(() => ({
    garbage: getUpcomingDuties('garbage', today, 3, false),
    floor: getUpcomingDuties('floor', today, 3, true)
  }), [today])

  const testResult = useMemo(() => ({
    garbage: getDutyForDate('garbage', testDate),
    floor: getDutyForDate('floor', testDate),
    nextFloor: getNextDuty('floor', testDate)
  }), [testDate])

  function updateReminder(chore: Chore, patch: Partial<ReminderSetting>) {
    const next = { ...reminders[chore], ...patch }
    setReminders(previous => ({ ...previous, [chore]: next }))
    saveReminder(storage, chore, next)
  }

  function markDone(chore: Chore) {
    const duty = duties[chore]
    if (histories[chore].some(record => record.dueDate === duty.date)) return
    const now = new Date()
    const record: CompletionRecord = {
      id: `${chore}-${duty.date}-${now.getTime()}`,
      chore,
      dueDate: duty.date,
      person: duty.person,
      completedAt: now.toISOString()
    }
    const next = addCompletion(storage, record)
    setHistories(previous => ({ ...previous, [chore]: next }))
    Taro.showToast({ title: `${CHORE_DETAILS[chore].title} saved`, icon: 'success' })
  }

  async function copyReminder(chore: Chore) {
    const message = reminderMessage(chore, duties[chore], reminders[chore].time)
    await Taro.setClipboardData({ data: message })
  }

  function renderReminder(chore: Chore) {
    const setting = reminders[chore]
    const duty = duties[chore]
    return (
      <View className='reminder-panel'>
        <View className='reminder-heading'>
          <View>
            <Text className='reminder-title'>Reminder preference</Text>
            <Text className='reminder-caption'>Stored on this device only</Text>
          </View>
          <Switch
            checked={setting.enabled}
            color='#C49A42'
            onChange={event => updateReminder(chore, { enabled: event.detail.value })}
          />
        </View>
        <View className='reminder-row'>
          <Text>Time</Text>
          <Picker mode='time' value={setting.time} onChange={event => updateReminder(chore, { time: event.detail.value })}>
            <Text className='time-value'>{setting.time} ›</Text>
          </Picker>
        </View>
        <View className='next-reminder'>
          <Text className='next-reminder-label'>NEXT REMINDER</Text>
          <Text className='next-reminder-value'>
            {setting.enabled ? `${formatLongDate(duty.date)} · ${setting.time}` : 'Turned off'}
          </Text>
          {setting.enabled && <Text className='next-reminder-person'>{duty.person} · {CHORE_DETAILS[chore].title}</Text>}
        </View>
        <View className='reminder-actions'>
          <Button className='text-button' onClick={() => copyReminder(chore)}>Copy message</Button>
          <Button className='text-button' onClick={() => setGuide(guide === chore ? null : chore)}>
            {guide === chore ? 'Hide guide' : 'Calendar setup'}
          </Button>
        </View>
        {guide === chore && (
          <View className='calendar-guide'>
            <Text className='guide-title'>Free phone-calendar reminder</Text>
            <Text>1. Copy the reminder message above.</Text>
            <Text>2. Open your phone Calendar and create an event on {formatDate(duty.date, true)} at {setting.time}.</Text>
            <Text>3. Paste the message into the event notes and enable its alert.</Text>
            <Text>4. For {duty.person}’s later turns, repeat every {chore === 'garbage' ? '3 days' : '9 days'}, or create each turn separately.</Text>
            <Text className='guide-warning'>WeChat subscription notifications and scheduled cloud tasks are not activated. This app does not send push notifications.</Text>
          </View>
        )}
      </View>
    )
  }

  function renderCard(chore: Chore) {
    const duty = duties[chore]
    const history = histories[chore]
    const recorded = history.some(record => record.dueDate === duty.date)
    const isFloor = chore === 'floor'
    return (
      <View className={`duty-card ${choreMeta[chore].className}`}>
        <View className='card-topline'>
          <View className='chore-heading'>
            <View className='chore-icon'><Text>{choreMeta[chore].icon}</Text></View>
            <View>
              <Text className='card-eyebrow'>{choreMeta[chore].eyebrow}</Text>
              <Text className='card-title'>{CHORE_DETAILS[chore].title}</Text>
            </View>
          </View>
          <View className='status-pill'><Text>{duty.daysAway === 0 ? 'DUE TODAY' : 'SCHEDULED'}</Text></View>
        </View>

        <View className='assignment'>
          <View className='avatar' style={{ backgroundColor: ROOMMATES[duty.person].color }}>
            <Text>{ROOMMATES[duty.person].initial}</Text>
          </View>
          <View className='assignment-copy'>
            <Text className='countdown'>{countdownText(duty)}</Text>
            <Text className='assigned-name'>{duty.person}</Text>
            <Text className='assigned-date'>{isFloor ? 'Next cleaning · ' : 'Today · '}{formatLongDate(duty.date)}</Text>
          </View>
        </View>

        <Button className={`done-button ${recorded ? 'is-disabled' : ''}`} disabled={recorded} onClick={() => markDone(chore)}>
          {recorded ? '✓  Completion recorded' : isFloor ? 'Mark floor cleaning as done' : 'Mark garbage as done'}
        </Button>
        <Text className='schedule-note'>Completing a chore saves history only — it never changes the rotation.</Text>

        <View className='subsection'>
          <Text className='section-label'>UPCOMING TURNS</Text>
          {upcoming[chore].map(item => (
            <View className='upcoming-row' key={`${chore}-${item.date}`}>
              <View className='mini-avatar' style={{ backgroundColor: ROOMMATES[item.person].color }}><Text>{ROOMMATES[item.person].initial}</Text></View>
              <Text className='upcoming-name'>{item.person}</Text>
              <Text className='upcoming-date'>{formatDate(item.date, true)}</Text>
            </View>
          ))}
        </View>

        <View className='latest-row'>
          <Text>Latest completion</Text>
          <Text>{history.length ? completionDay(history[0]) : 'Not recorded yet'}</Text>
        </View>

        {renderReminder(chore)}

        <View className='history-section'>
          <Text className='section-label'>COMPLETION HISTORY</Text>
          {history.length === 0 ? (
            <Text className='empty-history'>No completions yet. Your records stay on this device.</Text>
          ) : history.slice(0, 6).map(record => (
            <View className='history-row' key={record.id}>
              <View>
                <Text className='history-person'>{record.person}</Text>
                <Text className='history-date'>Scheduled {formatDate(record.dueDate, true)}</Text>
              </View>
              <Text className='history-completed'>Done {completionDay(record)}</Text>
            </View>
          ))}
        </View>
      </View>
    )
  }

  return (
    <ScrollView scrollY className='page-scroll' enhanced showScrollbar={false}>
      <View className='page'>
        <View className='hero'>
          <View className='brand-row'>
            <View className='brand-mark'><Text>D</Text></View>
            <Text className='brand-name'>DORM DUTY</Text>
          </View>
          <Text className='hero-title'>Two chores.{`\n`}Zero confusion.</Text>
          <Text className='hero-subtitle'>A simple rhythm for a happier home.</Text>
          <View className='today-chip'><Text>{formatLongDate(today)}</Text></View>
        </View>

        {renderCard('garbage')}
        {renderCard('floor')}

        <View className='date-checker'>
          <Text className='section-label'>SCHEDULE CHECKER</Text>
          <Text className='checker-title'>Check any date</Text>
          <Text className='checker-copy'>Test the rotations without changing your device clock.</Text>
          <Picker mode='date' value={testDate} onChange={event => setTestDate(event.detail.value)}>
            <View className='date-picker'><Text>{formatLongDate(testDate)}</Text><Text>Change</Text></View>
          </Picker>
          <View className='test-result'><Text>Garbage</Text><Text>{testResult.garbage?.person}</Text></View>
          <View className='test-result'><Text>Floor cleaning</Text><Text>{testResult.floor?.person || 'No cleaning assigned'}</Text></View>
          <Text className='test-next'>Next floor duty: {testResult.nextFloor.person} · {formatDate(testResult.nextFloor.date, true)} ({countdownText(testResult.nextFloor)})</Text>
        </View>

        <View className='privacy-note'>
          <Text className='privacy-title'>Local & private</Text>
          <Text>Schedules calculate automatically. Completion history and reminder preferences are stored only on this device and are not synchronized between roommates.</Text>
        </View>
        <View className='footer-space' />
      </View>
    </ScrollView>
  )
}
