const unwrap = (value: unknown) => Array.isArray(value) ? value[0] : value;
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);

/** 仅在初始日修复缺失或占位地点，不覆盖已经保存的地点。 */
export function fillInitialRoleLocations(stat: Record<string, any>, configuredRoles: unknown, fallbackRoles: unknown, initialDay: number): boolean {
  const day = unwrap(stat.游戏时间?.天数);
  if (day !== initialDay || !record(stat.攻略角色)) return false;
  const configured = record(configuredRoles) ? configuredRoles : {};
  const fallback = record(fallbackRoles) ? fallbackRoles : {};
  let changed = false;
  for (const [name, rawRole] of Object.entries(stat.攻略角色)) {
    if (!record(rawRole)) continue;
    const old = unwrap(rawRole.具体地点);
    if (typeof old === 'string' && old.trim() && old.trim() !== '未知') continue;
    const configuredRole = record(configured[name]) ? configured[name] : {};
    const fallbackRole = record(fallback[name]) ? fallback[name] : {};
    const initial = unwrap(Object.hasOwn(configuredRole, '具体地点') ? configuredRole.具体地点 : fallbackRole.具体地点);
    if (typeof initial !== 'string' || !initial.trim() || initial.trim() === '未知') continue;
    if (Array.isArray(rawRole.具体地点)) rawRole.具体地点[0] = initial.trim();
    else rawRole.具体地点 = initial.trim();
    changed = true;
  }
  return changed;
}
