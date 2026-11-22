import { characterLocations, moveCharacter } from './地点成员.ts';
import { parseDate, scheduledLocation, type Schedules } from './每日重置.ts';

const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const unwrap = (value: unknown) => Array.isArray(value) ? value[0] : value;

/** 新聊天仅在初始日按角色日程初始化一次。 */
export function fillInitialRoleLocations(stat: Record<string, any>, schedules: Schedules, initialDay: number, random: () => number = Math.random): boolean {
  let changed = false;
  if (!object(stat.locations)) { stat.locations = {}; changed = true; }
  if (unwrap(stat._locationsInit) === true) return changed;
  if (unwrap(stat.time?.day) === initialDay && Object.keys(characterLocations(stat)).length === 0) {
    const date = parseDate(stat.time);
    if (!date) return changed;
    for (const [name, schedule] of Object.entries(schedules)) {
      const location = scheduledLocation(name, schedule, date, random);
      if (location) moveCharacter(stat, name, location);
    }
  }
  if (Array.isArray(stat._locationsInit)) stat._locationsInit[0] = true;
  else stat._locationsInit = true;
  changed = true;
  return changed;
}
