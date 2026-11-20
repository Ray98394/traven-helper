import { parse } from 'yaml';
import { getAffectionStage } from '../../变量结构/好感阶段';

type Actor = { name: string; affection: number | null; personality: string; state: string; known: boolean };
export type ArrivalScene = { location: string; actors: Actor[] };
const unwrap = (value: unknown) => Array.isArray(value) ? value[0] : value;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** 从当前楼层变量重新计算，不把未设置地点的角色当作确定不在场。 */
export function currentScenePrompt(stat: Record<string, any>): string {
  const location = text(unwrap(stat?.玩家?.具体地点));
  const roles = stat?.攻略角色;
  if (!location || location === '未知' || !roles || typeof roles !== 'object' || Array.isArray(roles)) {
    throw new Error('玩家地点或角色状态尚未初始化');
  }
  const present: string[] = [];
  const elsewhere: Record<string, string> = {};
  const unknown: string[] = [];
  for (const [name, raw] of Object.entries(roles)) {
    const place = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? text(unwrap((raw as Record<string, unknown>).具体地点)) : '';
    if (!place || place === '未知') unknown.push(name);
    else if (place === location) present.push(name);
    else elsewhere[name] = place;
  }
  return [
    'The live location below overrides the setting and speakers in previous messages. If the location has changed, the previous scene has ended: begin or continue the current scene here, not the old conversation. Only characters in present may act or speak in person here. Characters in elsewhere are not physically present; their names may be mentioned, and remote communication requires an established means. Do not move them here based on earlier dialogue or appearance conditions. Characters in unknown have no confirmed location; do not assume they are present. Background NPCs are allowed. Presence does not require dialogue.',
    'An unknown character may be named in narration or by others; keep using their real name in speaker tags. The interface masks the speaker label until the player learns their identity through an introduction. Do not control the player.',
    JSON.stringify({ location, present, elsewhere, unknown }),
  ].join('\n');
}

export function affectionStage(value: number | null): string {
  return value === null ? '未知' : getAffectionStage(value, true);
}

/** 位置来自当前楼层变量，人物设定来自绑定世界书的角色列表。 */
export function buildArrivalScene(stat: Record<string, any>, rosterContent: string): ArrivalScene {
  const location = text(unwrap(stat.玩家?.具体地点));
  if (!location || location === '未知' || !stat.攻略角色 || typeof stat.攻略角色 !== 'object' || Array.isArray(stat.攻略角色)) {
    throw new Error('玩家地点或角色状态尚未初始化');
  }
  const parsed: unknown = parse(rosterContent);
  const roster = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>).角色列表 : null;
  if (!roster || typeof roster !== 'object' || Array.isArray(roster)) throw new Error('角色列表格式无效');
  const actors: Actor[] = [];
  for (const [name, raw] of Object.entries(stat.攻略角色)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const role = raw as Record<string, unknown>;
    if (text(unwrap(role.具体地点)) !== location) continue;
    const rawInfo = (roster as Record<string, unknown>)[name];
    const info = rawInfo && typeof rawInfo === 'object' && !Array.isArray(rawInfo) ? rawInfo as Record<string, unknown> : {};
    const n = unwrap(role.好感度);
    const known = unwrap(role.是否认识);
    actors.push({ name, affection: typeof n === 'number' && Number.isFinite(n) ? n : null, personality: text(info.info), state: text(info['current state']), known: known === true || known === 1 });
  }
  return { location, actors };
}

export function arrivalPrompt(scene: ArrivalScene): string {
  const present = scene.actors.length
    ? scene.actors.map(actor => ({ 姓名: actor.name, 玩家是否认识: actor.known, 性格与设定: actor.personality || '依已有角色设定', 当前关系: actor.state || '依既有剧情', 好感度: actor.affection, 好感阶段: actor.known ? affectionStage(actor.affection) : '陌生' }))
    : [];
  return [
    'The player has left the previous scene and just arrived at the location below. Start a new scene at this location now; do not continue the previous scene or its dialogue. Describe the environment and what each listed character is doing. Based on personality, relationship stage and context, decide naturally whether each approaches; do not force everyone to speak.',
    'An unrecognized character is a stranger. Conversation alone does not establish identity: update 是否认识 only after a self-introduction or a clear introduction by someone else. Names may appear in narration and conversation.',
    'Follow the live location constraints. Do not invent the arrival of configured characters; anonymous background NPCs are allowed. Do not decide the player’s actions or words, move the player again, or deduct action points. Put [角色名.表情] on its own line before spoken dialogue in Chinese quotation marks; put [旁白] before descriptions, including character actions.',
    JSON.stringify({ 地点: scene.location, 在场角色: present }),
  ].join('\n');
}
