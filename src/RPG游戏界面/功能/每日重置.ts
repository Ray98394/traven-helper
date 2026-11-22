import { locationRegions, regionForLocation } from './区域.ts';
import { moveCharacter } from './地点成员.ts';
export const HOME_LOCATION = '玩家的家';
export const START_DATE = { year: 1, month: 1, date: 1 } as const;
export type CalendarDate = { year: number; month: number; date: number };
export type Schedule = { 每周?: Partial<Record<string, string>>; 指定日期?: Record<string, string> };
export type Schedules = Record<string, Schedule>;
const readValue = (value: unknown) => Array.isArray(value) ? value[0] : value;
function setValue(object: Record<string, any>, key: string, value: unknown) {
  if (Array.isArray(object[key])) object[key][0] = value;
  else object[key] = value;
}

/** 使用公历；星期由日期计算，避免单独保存导致不一致。 */
export function parseDate(raw: any): CalendarDate | null {
  const 年 = readValue(raw?.year), 月 = readValue(raw?.month), 日 = readValue(raw?.date);
  if (typeof 年 !== 'number' || typeof 月 !== 'number' || typeof 日 !== 'number' || ![年, 月, 日].every(Number.isSafeInteger) || 年 < 1 || 年 > 9999 || 月 < 1 || 月 > 12 || 日 < 1) return null;
  const leap = 年 % 4 === 0 && (年 % 100 !== 0 || 年 % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return 日 <= days[月 - 1] ? { year: 年, month: 月, date: 日 } : null;
}
function asUtc(date: CalendarDate): Date {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(date.year, date.month - 1, date.date);
  return value;
}
export function addDays(date: CalendarDate, amount: number): CalendarDate | null {
  if (!parseDate(date) || !Number.isSafeInteger(amount)) return null;
  const utc = asUtc(date);
  utc.setUTCDate(utc.getUTCDate() + amount);
  return parseDate({ year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, date: utc.getUTCDate() });
}
export function weekday(date: CalendarDate): string { return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][asUtc(date).getUTCDay()]; }
export function dateKey(date: CalendarDate): string { return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.date).padStart(2, '0')}`; }
export function formatDate(date: CalendarDate): string { return `${date.year}年${date.month}月${date.date}日 ${weekday(date)}`; }

/** 解析某天的日程，随机区域只在应用日程时抽取。 */
export function scheduledLocation(name: string, schedule: Schedule, date: CalendarDate, random: () => number = Math.random): string | undefined {
  const configured = schedule?.指定日期?.[dateKey(date)] ?? schedule?.每周?.[weekday(date)];
  if (typeof configured !== 'string' || !configured.trim()) return undefined;
  const location = configured.trim();
  if (!location.startsWith('随机.')) return location;
  const region = location.slice('随机.'.length).trim();
  const candidates = Object.entries(locationRegions).filter(([, value]) => value === region).map(([place]) => place);
  if (!region || !candidates.length) {
    console.warn(`[RPG游戏界面] ${name} 的日程区域无可用地点: ${location}`);
    return undefined;
  }
  return candidates[Math.floor(random() * candidates.length)];
}

/** 在副本上更新指定四项；没有日程的角色保留当前地点。 */
export function advanceDay(stat: Record<string, any>, schedules: Schedules = {}, random: () => number = Math.random): boolean {
  const day = readValue(stat.time?.day);
  const currentDate = parseDate(stat.time);
  const player = stat.player;
  const maximum = readValue(player?.energy?.max);
  if (!currentDate || typeof day !== 'number' || !Number.isSafeInteger(day) || day < 1 || typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 0) return false;
  const next = addDays(currentDate, 1);
  if (!next) return false;
  setValue(stat.time, 'day', day + 1);
  for (const key of ['year', 'month', 'date'] as const) setValue(stat.time, key, next[key]);
  setValue(player.energy, 'current', maximum);
  player.area ??= {};
  setValue(player.area, 'region', regionForLocation(HOME_LOCATION));
  setValue(player.area, 'place', HOME_LOCATION);
  {
    for (const [name, schedule] of Object.entries(schedules)) {
      const location = scheduledLocation(name, schedule, next, random);
      if (location) moveCharacter(stat, name, location);
    }
  }
  return true;
}
