import { describe, expect, it } from 'vitest';
import { REMIND_BASE, reminderNotifications } from './reminders';

describe('夜のお知らせの中身', () => {
  it('正確なアラームを使わない(アラームとリマインダーの許可画面を開かない)', () => {
    const ns = reminderNotifications(['2026-10-14', '2026-10-15'], '21:30');
    expect(ns).toHaveLength(2);
    for (const n of ns) {
      expect(n.isExactNotification).toBe(false);
      expect(n.schedule.allowWhileIdle).toBe(true);
      expect('isExactMandatory' in n).toBe(false);
    }
  });
  it('日付と時刻、id の並び', () => {
    const [a, b] = reminderNotifications(['2026-12-31', '2027-01-01'], '07:05');
    expect(a.id).toBe(REMIND_BASE);
    expect(b.id).toBe(REMIND_BASE + 1);
    expect(a.schedule.at).toEqual(new Date(2026, 11, 31, 7, 5));
    expect(b.schedule.at).toEqual(new Date(2027, 0, 1, 7, 5));
  });
  it('日が無ければ空', () => {
    expect(reminderNotifications([], '21:30')).toEqual([]);
  });
});
