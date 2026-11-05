/**
 * TaskRemindersField — Google Calendar–style relative reminders before deadline.
 * Location: apps/web/src/features/projects/TaskRemindersField.tsx
 */
import { Plus, Trash } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'

export type ReminderDraft = {
  key: string
  offsetValue: number
  offsetUnit: 'minutes' | 'hours' | 'days' | 'weeks'
  channel: 'notification' | 'email'
}

export type ReminderPayload = {
  offsetValue: number
  offsetUnit: ReminderDraft['offsetUnit']
  channel: ReminderDraft['channel']
}

let reminderKeySeq = 0
export function newReminderDraft(
  partial?: Partial<Omit<ReminderDraft, 'key'>>,
): ReminderDraft {
  reminderKeySeq += 1
  return {
    key: `r-${Date.now()}-${reminderKeySeq}`,
    offsetValue: partial?.offsetValue ?? 1,
    offsetUnit: partial?.offsetUnit ?? 'days',
    channel: partial?.channel ?? 'notification',
  }
}

export function remindersFromApi(
  list: ReminderPayload[] | null | undefined,
): ReminderDraft[] {
  if (!Array.isArray(list) || list.length === 0) return []
  return list.map((r) =>
    newReminderDraft({
      offsetValue: r.offsetValue,
      offsetUnit: r.offsetUnit,
      channel: r.channel,
    }),
  )
}

export function remindersToPayload(list: ReminderDraft[]): ReminderPayload[] {
  return list.map(({ offsetValue, offsetUnit, channel }) => ({
    offsetValue: Math.max(0, Math.min(9999, Math.floor(offsetValue) || 0)),
    offsetUnit,
    channel,
  }))
}

type Props = {
  value: ReminderDraft[]
  onChange: (next: ReminderDraft[]) => void
  disabled?: boolean
}

export function TaskRemindersField({ value, onChange, disabled }: Props) {
  const { t } = useI18n()

  function update(key: string, patch: Partial<ReminderDraft>) {
    onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  return (
    <div className="field task-reminders">
      <span className="label">{t('taskReminders')}</span>
      {value.length === 0 ? (
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
          {t('taskRemindersEmpty')}
        </p>
      ) : (
        <ul className="task-reminder-list">
          {value.map((r) => (
            <li key={r.key} className="task-reminder-row">
              <select
                className="input"
                disabled={disabled}
                aria-label={t('taskReminderChannel')}
                value={r.channel}
                onChange={(e) =>
                  update(r.key, { channel: e.target.value as ReminderDraft['channel'] })
                }
              >
                <option value="notification">{t('taskReminderNotification')}</option>
                <option value="email">{t('taskReminderEmail')}</option>
              </select>
              <input
                className="input task-reminder-value"
                type="number"
                min={0}
                max={9999}
                disabled={disabled}
                aria-label={t('taskReminderOffset')}
                value={r.offsetValue}
                onChange={(e) =>
                  update(r.key, { offsetValue: Number(e.target.value) || 0 })
                }
              />
              <select
                className="input"
                disabled={disabled}
                aria-label={t('taskReminderUnit')}
                value={r.offsetUnit}
                onChange={(e) =>
                  update(r.key, { offsetUnit: e.target.value as ReminderDraft['offsetUnit'] })
                }
              >
                <option value="minutes">{t('reminderUnitMinutes')}</option>
                <option value="hours">{t('reminderUnitHours')}</option>
                <option value="days">{t('reminderUnitDays')}</option>
                <option value="weeks">{t('reminderUnitWeeks')}</option>
              </select>
              <span className="muted task-reminder-before">{t('taskReminderBefore')}</span>
              {!disabled ? (
                <button
                  type="button"
                  className="btn icon-btn"
                  aria-label={t('taskReminderRemove')}
                  onClick={() => onChange(value.filter((x) => x.key !== r.key))}
                >
                  <Trash size={14} weight="regular" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {!disabled && value.length < 20 ? (
        <button
          type="button"
          className="btn"
          onClick={() => onChange([...value, newReminderDraft()])}
        >
          <Plus size={14} weight="bold" aria-hidden />
          {t('taskReminderAdd')}
        </button>
      ) : null}
    </div>
  )
}
