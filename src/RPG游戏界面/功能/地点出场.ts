import { parse } from 'yaml';
import { getAffectionStage } from '../../变量结构/好感阶段';
import { characterLocations } from './地点成员.ts';
import { battleLocations } from './区域.ts';

type Actor = { name: string; affection: number | null; personality: string; state: string; known: boolean; stage: string };
export type ArrivalScene = { location: string; actors: Actor[] };
const unwrap = (value: unknown) => Array.isArray(value) ? value[0] : value;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** 从当前楼层变量重新计算，不把未设置地点的角色当作确定不在场。 */
export function currentScenePrompt(stat: Record<string, any>): string {
  const location = text(unwrap(stat?.player?.area?.place));
  const roles = stat?.characters;
  if (!location || location === '未知' || !roles || typeof roles !== 'object' || Array.isArray(roles)) {
    throw new Error('玩家地点或角色状态尚未初始化');
  }
  const members = stat?.locations?.[location]?.present;
  const present = Array.isArray(members) ? [...new Set(members.filter((name: unknown): name is string => typeof name === 'string' && !!name.trim()))] : [];
  return [
    'The live location below overrides the setting and speakers in previous messages. If the location has changed, the previous scene has ended: begin or continue the current scene here, not the old conversation. Only configured characters in present may act or speak here in person; absent characters may be mentioned but cannot appear without a location change. Remote communication requires an established means. Background NPCs are allowed. Presence does not require dialogue.',
    'For characters not yet recognized by the player, narration uses visible traits or role, not their name, until an explicit introduction lets the player identify them. Other characters may naturally use names they know. Speaker tags always use real names for rendering and do not establish player knowledge. Do not control the player.',
    JSON.stringify({ location, present }),
  ].join('\n');
}

export function affectionStage(value: number | null): string {
  return value === null ? '未知' : getAffectionStage(value, true);
}

/** 位置和状态来自当前楼层变量，人物设定由索引和角色详情汇总。 */
export function buildArrivalScene(stat: Record<string, any>, rosterContent: string): ArrivalScene {
  const location = text(unwrap(stat.player?.area?.place));
  if (!location || location === '未知' || !stat.characters || typeof stat.characters !== 'object' || Array.isArray(stat.characters)) {
    throw new Error('玩家地点或角色状态尚未初始化');
  }
  const parsed: unknown = parse(rosterContent);
  const roster = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>).角色列表 : null;
  if (!roster || typeof roster !== 'object' || Array.isArray(roster)) throw new Error('角色列表格式无效');
  const actors: Actor[] = [];
  const locations = characterLocations(stat);
  for (const [name, place] of Object.entries(locations)) {
    const raw = stat.characters[name];
    const role = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    if (place !== location || !Object.hasOwn(roster, name)) continue;
    const rawInfo = (roster as Record<string, unknown>)[name];
    const info = rawInfo && typeof rawInfo === 'object' && !Array.isArray(rawInfo) ? rawInfo as Record<string, unknown> : {};
    const n = unwrap(role.affection);
    const known = unwrap(role.known);
    actors.push({ name, affection: typeof n === 'number' && Number.isFinite(n) ? n : null, personality: text(info.info), state: text(unwrap(stat.states?.[name]?.['state'])), known: known === true || known === 1, stage: getAffectionStage(role.affection, known, role.stage) });
  }
  return { location, actors };
}

export function arrivalPrompt(scene: ArrivalScene): string {
  const present = scene.actors.map(actor => ({ 姓名: actor.name, 玩家是否认识: actor.known, 当前状态: actor.state || '默认', 好感阶段: actor.stage }));
  return [
    `以旁白描写当前地点：${scene.location}，参考当前地点条目的场地描述。`,
    ...(present.length ? [`在场特殊角色：${JSON.stringify(present)}。`] : []),
    ...(battleLocations.has(scene.location) ? ['地点规则：玩家可点击消息框上方的开始战斗按钮进入切磋；未点击时不开始战斗。'] : []),
  ].join('\n');
}

/** 路人只在入场时、无特殊角色且不属于战斗地点时生成。 */
export function shouldGeneratePasserby(scene: ArrivalScene): boolean {
  return scene.actors.length === 0 && !battleLocations.has(scene.location);
}

/** 把界面提示放在变量更新块之前，确保更新块仍位于正文末尾。 */
export function appendBattleArrivalHint(message: string, location: string): string {
  if (!battleLocations.has(location) || !message.trim()) return message;
  const hint = '[旁白] 【操作提示】点击消息框上方的“开始战斗”进入切磋；战斗中输入“攻击”或“防御”。';
  if (message.includes(hint)) return message;
  const update = message.search(/<UpdateVariable(?:\s[^>]*)?>/i);
  return update < 0 ? `${message.trimEnd()}\n\n${hint}` : `${message.slice(0, update).trimEnd()}\n\n${hint}\n\n${message.slice(update)}`;
}
