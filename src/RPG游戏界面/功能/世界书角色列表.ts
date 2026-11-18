import { parse } from 'yaml';

export type RosterRole = { folder: string; fallback: string };

/** 角色列表作为唯一的角色名来源；未指定目录时使用角色名。 */
export function parseSceneRoster(content: string, fallbacks: Record<string, { fallback?: string }> = {}): Record<string, RosterRole> {
  const data: unknown = parse(content);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('角色列表条目必须是 YAML 对象');
  const list = (data as Record<string, unknown>).角色列表;
  if (!list || typeof list !== 'object' || Array.isArray(list)) throw new Error('缺少 YAML 对象“角色列表”');
  const roles: Record<string, RosterRole> = {};
  for (const [name, value] of Object.entries(list)) {
    if (!name.trim() || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const rawFolder = (value as Record<string, unknown>).立绘目录;
    const folder = typeof rawFolder === 'string' && rawFolder.trim() ? rawFolder.trim() : name;
    if (/[\\/:]/.test(folder) || [...folder].some(char => char.charCodeAt(0) < 32) || folder === '.' || folder === '..') {
      console.warn(`[RPG游戏界面] 跳过无效立绘目录: ${name}`);
      continue;
    }
    roles[name] = { folder, fallback: fallbacks[name]?.fallback ?? '' };
  }
  return roles;
}
