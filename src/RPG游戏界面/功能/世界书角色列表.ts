import { parse, stringify } from 'yaml';
import type { Schedules } from './每日重置';

export type Outfit = { description: string; folder: string };
export type RosterRole = { folder: string; confessionLocation?: string; appearance?: string; defaultOutfit?: string; outfits?: Record<string, Outfit>; outfitsByLocation?: Record<string, string>; defaultState?: string; statesByLocation?: Record<string, string>; states?: Record<string, { outfit?: string; behavior?: string }>; affectionBehaviors?: Record<string, string> };
type RoleState = { 'state': string; source?: '自动' | '事件' };

/** 索引只关联角色与详情；其他信息以详情条目的配置为唯一来源。 */
export function composeCharacterRoster(indexContent: string, details: Record<string, string>): string {
  const index = parse(indexContent)?.角色索引;
  if (!index || typeof index !== 'object' || Array.isArray(index)) throw new Error('缺少角色索引');
  const roles: Record<string, unknown> = {};
  for (const [name, entryName] of Object.entries(index)) {
    if (typeof entryName !== 'string' || !details[entryName]) throw new Error(`缺少角色详情: ${name}`);
    const detail = parse(details[entryName])?.[name];
    if (!detail || typeof detail !== 'object' || Array.isArray(detail) || !detail.配置) throw new Error(`角色详情配置无效: ${name}`);
    roles[name] = { ...detail.配置, info: detail.配置.简介 };
  }
  return stringify({ 角色列表: roles });
}

/** 地点改变时更新自动状态；事件状态保持到事件显式解除。 */
export function syncCharacterStates(stat: Record<string, any>, roles: Record<string, RosterRole>, locations: Record<string, string>): boolean {
  if (!stat.states || typeof stat.states !== 'object' || Array.isArray(stat.states)) stat.states = {};
  let changed = false;
  for (const [name, role] of Object.entries(roles)) {
    const states = role.states ?? {};
    const old = stat.states[name] as RoleState | undefined;
    if (old?.source === '事件' && Object.hasOwn(states, old['state'])) continue;
    const chosen = [role.statesByLocation?.[locations[name]], role.defaultState].find(key => typeof key === 'string' && Object.hasOwn(states, key));
    if (!chosen) continue;
    if (old?.['state'] !== chosen || old?.source !== '自动') {
      stat.states[name] = { 'state': chosen, source: '自动' };
      changed = true;
    }
  }
  return changed;
}

export function setEventState(stat: Record<string, any>, name: string, state: string | null, role: RosterRole, location: string): boolean {
  if (state !== null && !Object.hasOwn(role.states ?? {}, state)) return false;
  if (!stat.states || typeof stat.states !== 'object' || Array.isArray(stat.states)) stat.states = {};
  if (state === null) { delete stat.states[name]; syncCharacterStates(stat, { [name]: role }, { [name]: location }); }
  else stat.states[name] = { 'state': state, source: '事件' };
  return true;
}
const safeFolder = (folder: string) => !!folder && !/[\\/:]/.test(folder) && ![...folder].some(char => char.charCodeAt(0) < 32) && folder !== '.' && folder !== '..';

/** 事件指定优先；无效指定回退至地点规则和默认服装。 */
export function selectOutfit(role: RosterRole, location: string, override?: string, currentState?: string): { name: string; description: string; folder: string } | undefined {
  const outfits = role.outfits ?? {};
  const name = [override, currentState && role.states?.[currentState]?.outfit, role.outfitsByLocation?.[location], role.defaultOutfit].find(key => typeof key === 'string' && Object.hasOwn(outfits, key));
  return name ? { name, ...outfits[name] } : undefined;
}

/** 特殊事件在楼层状态副本中指定服装；传入 null 恢复按地点选择。 */
export function setOutfitOverride(stat: Record<string, any>, name: string, outfit: string | null, role: RosterRole): boolean {
  if (outfit !== null && !Object.hasOwn(role.outfits ?? {}, outfit)) return false;
  if (!stat.outfits || typeof stat.outfits !== 'object' || Array.isArray(stat.outfits)) stat.outfits = {};
  if (outfit === null) delete stat.outfits[name];
  else stat.outfits[name] = outfit;
  return true;
}

export function appearancePrompt(roles: Record<string, RosterRole>, playerLocation: string, locations: Record<string, string>, overrides: Record<string, string>, states: Record<string, RoleState> = {}, affectionStages: Record<string, string> = {}): string {
  if (!playerLocation || playerLocation === '未知') return '';
  const descriptions = Object.entries(roles).flatMap(([name, role]) => {
    if (locations[name] !== playerLocation) return [];
    const currentState = states[name]?.['state'];
    const outfit = selectOutfit(role, locations[name], overrides[name], currentState);
    const state = currentState ? role.states?.[currentState] : undefined;
    const stage = affectionStages[name];
    const affectionBehavior = stage ? role.affectionBehaviors?.[stage] : undefined;
    return role.appearance || outfit?.description || state?.behavior || affectionBehavior ? [{ 角色: name, 外貌: role.appearance || undefined, 当前状态: state ? currentState : undefined, 状态表现: state?.behavior || undefined, 服装: outfit?.description || undefined, 好感度阶段: affectionBehavior ? stage : undefined, 阶段表现: affectionBehavior || undefined }] : [];
  });
  return descriptions.length ? `在场角色当前外貌、状态与关系阶段，以此为准；阶段表现结合角色性格和当前场合自然演绎：\n${JSON.stringify(descriptions)}` : '';
}

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
export function parseSceneRoster(content: string): Record<string, RosterRole> {
  const data: unknown = parse(content);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('角色列表条目必须是 YAML 对象');
  const list = (data as Record<string, unknown>).角色列表;
  if (!list || typeof list !== 'object' || Array.isArray(list)) throw new Error('缺少 YAML 对象“角色列表”');
  const roles: Record<string, RosterRole> = {};
  for (const [name, value] of Object.entries(list)) {
    if (!name.trim() || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const rawFolder = (value as Record<string, unknown>).立绘目录;
    const folder = typeof rawFolder === 'string' && rawFolder.trim() ? rawFolder.trim() : name;
    if (!safeFolder(folder)) {
      console.warn(`[RPG游戏界面] 跳过无效立绘目录: ${name}`);
      continue;
    }
    const rawLocation = (value as Record<string, unknown>).表白地点;
    const confessionLocation = typeof rawLocation === 'string' ? rawLocation.trim() : '';
    const raw = value as Record<string, any>;
    const rawOutfits = raw.服装 && typeof raw.服装 === 'object' && !Array.isArray(raw.服装) ? raw.服装 : {};
    const variants = rawOutfits.款式 && typeof rawOutfits.款式 === 'object' && !Array.isArray(rawOutfits.款式) ? rawOutfits.款式 : {};
    const outfits: Record<string, Outfit> = {};
    for (const [outfitName, item] of Object.entries(variants)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const data = item as Record<string, unknown>;
      const outfitFolder = typeof data.立绘目录 === 'string' && data.立绘目录.trim() ? data.立绘目录.trim() : folder;
      if (!safeFolder(outfitFolder)) { console.warn(`[RPG游戏界面] 跳过无效服装立绘目录: ${name}/${outfitName}`); continue; }
      outfits[outfitName] = { folder: outfitFolder, description: typeof data.描述 === 'string' ? data.描述.trim() : '' };
    }
    const mapping = rawOutfits.地点映射 && typeof rawOutfits.地点映射 === 'object' && !Array.isArray(rawOutfits.地点映射) ? rawOutfits.地点映射 : {};
    const stateConfig = raw.状态 && typeof raw.状态 === 'object' && !Array.isArray(raw.状态) ? raw.状态 : {};
    const stateEntries = stateConfig.可用状态 && typeof stateConfig.可用状态 === 'object' && !Array.isArray(stateConfig.可用状态) ? stateConfig.可用状态 : {};
    const states = Object.fromEntries(Object.entries(stateEntries).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value)).map(([key, value]) => { const v = value as Record<string, unknown>; return [key, { outfit: typeof v.服装 === 'string' ? v.服装 : undefined, behavior: typeof v.表现 === 'string' ? v.表现 : undefined }]; }));
    const stateMap = stateConfig.地点映射 && typeof stateConfig.地点映射 === 'object' && !Array.isArray(stateConfig.地点映射) ? stateConfig.地点映射 : {};
    const rawBehaviors = raw.好感度阶段表现 && typeof raw.好感度阶段表现 === 'object' && !Array.isArray(raw.好感度阶段表现) ? raw.好感度阶段表现 : {};
    const affectionBehaviors = Object.fromEntries(Object.entries(rawBehaviors).filter(([, item]) => typeof item === 'string' && item.trim())) as Record<string, string>;
    roles[name] = { folder, ...(confessionLocation ? { confessionLocation } : {}), appearance: typeof raw.外貌 === 'string' ? raw.外貌.trim() : '', defaultOutfit: typeof rawOutfits.默认 === 'string' ? rawOutfits.默认 : undefined, outfits, outfitsByLocation: Object.fromEntries(Object.entries(mapping).filter(([, item]) => typeof item === 'string')) as Record<string, string>, defaultState: typeof stateConfig.默认 === 'string' ? stateConfig.默认 : undefined, states, statesByLocation: Object.fromEntries(Object.entries(stateMap).filter(([, item]) => typeof item === 'string')) as Record<string, string>, affectionBehaviors };
  }
  return roles;
}
