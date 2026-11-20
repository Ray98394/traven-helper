export const HOME_LOCATION = '玩家的家';
export const START_DATE = { 年: 1, 月: 1, 日: 1 } as const;
export type CalendarDate = { 年: number; 月: number; 日: number };
export type Schedule = { 每周?: Partial<Record<string, string>>; 指定日期?: Record<string, string> };
export type Schedules = Record<string, Schedule>;
const readValue = (value: unknown) => Array.isArray(value) ? value[0] : value;
function setValue(object: Record<string, any>, key: string, value: unknown) {
  if (Array.isArray(object[key])) object[key][0] = value;
  else object[key] = value;
}

/** 使用公历；星期由日期计算，避免单独保存导致不一致。 */
export function parseDate(raw: any): CalendarDate | null {
  const 年 = readValue(raw?.年), 月 = readValue(raw?.月), 日 = readValue(raw?.日);
  if (typeof 年 !== 'number' || typeof 月 !== 'number' || typeof 日 !== 'number' || ![年, 月, 日].every(Number.isSafeInteger) || 年 < 1 || 年 > 9999 || 月 < 1 || 月 > 12 || 日 < 1) return null;
  const leap = 年 % 4 === 0 && (年 % 100 !== 0 || 年 % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return 日 <= days[月 - 1] ? { 年, 月, 日 } : null;
}
function asUtc(date: CalendarDate): Date {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(date.年, date.月 - 1, date.日);
  return value;
}
export function addDays(date: CalendarDate, amount: number): CalendarDate | null {
  if (!parseDate(date) || !Number.isSafeInteger(amount)) return null;
  const utc = asUtc(date);
  utc.setUTCDate(utc.getUTCDate() + amount);
  return parseDate({ 年: utc.getUTCFullYear(), 月: utc.getUTCMonth() + 1, 日: utc.getUTCDate() });
}
export function weekday(date: CalendarDate): string { return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][asUtc(date).getUTCDay()]; }
export function dateKey(date: CalendarDate): string { return `${String(date.年).padStart(4, '0')}-${String(date.月).padStart(2, '0')}-${String(date.日).padStart(2, '0')}`; }
export function formatDate(date: CalendarDate): string { return `${date.年}年${date.月}月${date.日}日 ${weekday(date)}`; }

/** 在副本上更新指定四项；没有日程的角色保留当前地点。 */
export function advanceDay(stat: Record<string, any>, schedules: Schedules = {}): boolean {
  const day = readValue(stat.游戏时间?.天数);
  const currentDate = parseDate(stat.游戏时间);
  const player = stat.玩家;
  const maximum = readValue(player?.行动点?.上限);
  if (!currentDate || typeof day !== 'number' || !Number.isSafeInteger(day) || day < 1 || typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 0) return false;
  const next = addDays(currentDate, 1);
  if (!next) return false;
  setValue(stat.游戏时间, '天数', day + 1);
  for (const key of ['年', '月', '日'] as const) setValue(stat.游戏时间, key, next[key]);
  setValue(player.行动点, '当前', maximum);
  setValue(player, '具体地点', HOME_LOCATION);
  if (stat.攻略角色 && typeof stat.攻略角色 === 'object' && !Array.isArray(stat.攻略角色)) {
    for (const [name, role] of Object.entries(stat.攻略角色)) {
      if (!role || typeof role !== 'object' || Array.isArray(role)) continue;
      const schedule = schedules[name];
      const location = schedule?.指定日期?.[dateKey(next)] ?? schedule?.每周?.[weekday(next)];
      if (typeof location === 'string' && location.trim()) setValue(role as Record<string, any>, '具体地点', location.trim());
    }
  }
  return true;
}
