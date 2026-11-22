import { parse } from 'yaml';
import { getAffectionStage } from '../../变量结构/好感阶段';
import { characterLocations } from './地点成员.ts';

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
    'An unknown character may be named in narration or by others; keep using their real name in speaker tags. The interface masks the speaker label until the player learns their identity through an introduction. Do not control the player.',
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
    if (place !== location) continue;
    const rawInfo = (roster as Record<string, unknown>)[name];
    const info = rawInfo && typeof rawInfo === 'object' && !Array.isArray(rawInfo) ? rawInfo as Record<string, unknown> : {};
    const n = unwrap(role.affection);
    const known = unwrap(role.known);
    actors.push({ name, affection: typeof n === 'number' && Number.isFinite(n) ? n : null, personality: text(info.info), state: text(unwrap(stat.states?.[name]?.['state'])), known: known === true || known === 1, stage: getAffectionStage(role.affection, known, role.stage) });
  }
  return { location, actors };
}

export function arrivalPrompt(scene: ArrivalScene): string {
  const present = scene.actors.length
    ? scene.actors.map(actor => ({ 姓名: actor.name, 玩家是否认识: actor.known, 性格与设定: actor.personality || '依已有角色设定', 当前状态: actor.state || '未设置', 好感度: actor.affection, 好感阶段: actor.stage }))
    : [];
  return [
    'The player has left the previous scene and just arrived at the location below. Start a new scene at this location now; do not continue the previous scene or its dialogue. Describe the environment and what each listed character is doing. Based on personality, relationship stage and context, decide naturally whether each approaches; do not force everyone to speak.',
    'An unrecognized character is a stranger. Conversation alone does not establish identity: update 是否认识 only after a self-introduction or a clear introduction by someone else. Names may appear in narration and conversation.',
    'Follow the live location constraints. Do not invent the arrival of configured characters; anonymous background NPCs are allowed. Do not decide the player’s actions or words, move the player again, or deduct action points. Put each spoken line on its own line as [角色名.表情] “台词”. Begin descriptions, including character actions, with [旁白] on the same line as the text; the tag does not need a separate line.',
    JSON.stringify({ 地点: scene.location, 在场角色: present }),
  ].join('\n');
}
