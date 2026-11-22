type State = Record<string, any>;
const object = (value: unknown): value is State => !!value && typeof value === 'object' && !Array.isArray(value);

/** 将角色从所有地点移除后放入新地点，保证一个角色最多在一个地点。 */
export function moveCharacter(stat: State, name: string, location: string): void {
  const target = location.trim();
  if (!name.trim() || !target || target === '未知') return;
  if (!object(stat.locations)) stat.locations = {};
  for (const entry of Object.values(stat.locations)) {
    if (object(entry) && Array.isArray(entry.present)) entry.present = entry.present.filter((item: unknown) => item !== name);
  }
  if (!object(stat.locations[target])) stat.locations[target] = { present: [] };
  if (!Array.isArray(stat.locations[target].present)) stat.locations[target].present = [];
  stat.locations[target].present.push(name);
}

export function characterLocations(stat: State): Record<string, string> {
  const result: Record<string, string> = {};
  if (!object(stat.locations)) return result;
  for (const [location, entry] of Object.entries(stat.locations)) {
    if (!object(entry) || !Array.isArray(entry.present)) continue;
    for (const name of entry.present) if (typeof name === 'string' && name.trim() && !Object.hasOwn(result, name)) result[name] = location;
  }
  return result;
}

