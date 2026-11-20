import { parse } from 'yaml';
import type { Schedules } from './每日重置';

export type RosterRole = { folder: string; fallback: string; confessionLocation?: string };

/** 日程从同一份角色列表读取；指定日期优先于每周安排。 */
export function parseRoleSchedules(content: string): Schedules {
  const data: unknown = parse(content);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('角色列表格式无效');
  const roles = (data as Record<string, unknown>).角色列表;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) throw new Error('缺少角色列表');
  const schedules: Schedules = {};
  for (const [name, role] of Object.entries(roles)) {
    if (!role || typeof role !== 'object' || Array.isArray(role)) continue;
    const schedule = (role as Record<string, unknown>).日程;
    if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) continue;
    const raw = schedule as Record<string, unknown>;
    const map = (value: unknown): Record<string, string> => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'string' && item.trim())) as Record<string, string>
      : {};
    schedules[name] = { 每周: map(raw.每周), 指定日期: map(raw.指定日期) };
  }
  return schedules;
}

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
    const rawLocation = (value as Record<string, unknown>).表白地点;
    const confessionLocation = typeof rawLocation === 'string' ? rawLocation.trim() : '';
    roles[name] = { folder, fallback: fallbacks[name]?.fallback ?? '', ...(confessionLocation ? { confessionLocation } : {}) };
  }
  return roles;
}
