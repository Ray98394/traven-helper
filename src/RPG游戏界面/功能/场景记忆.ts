import { narrativeOnly } from './消息过滤.ts';

export type MemoryMessage = { message_id: number; role: string; message: string; is_hidden?: boolean };
export type SceneMemory = {
  location: string;
  start: number;
  end: number;
  participants: string[];
  sources: { id: number; role: string; text: string }[];
  knowledge?: Record<string, string>;
};
export type MemoryStore = { sceneStart: number; scenes: SceneMemory[] };

export function makeScene(location: string, participants: string[], messages: MemoryMessage[], start: number): SceneMemory | null {
  const sources = messages.filter(m => m.message_id >= start && !m.is_hidden && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ id: m.message_id, role: m.role, text: narrativeOnly(m.message).trim() })).filter(m => m.text);
  if (!sources.length) return null;
  return { location, start, end: sources.at(-1)!.id, participants: [...new Set(participants)], sources };
}

/** 任何来源消息发生删除、重写或重选时，不使用旧摘要，也不隐藏原文。 */
export function validScene(scene: SceneMemory, messages: MemoryMessage[]): boolean {
  return scene.sources.length > 0 && scene.sources.every(source => {
    const current = messages.find(m => m.message_id === source.id);
    return current && !current.is_hidden && current.role === source.role && narrativeOnly(current.message).trim() === source.text;
  });
}

export function relevantMemories(scenes: SceneMemory[], messages: MemoryMessage[], present: string[], location: string): string {
  const result = scenes.filter(scene => validScene(scene, messages) && scene.knowledge).flatMap(scene => {
    const entries = present.flatMap(name => scene.knowledge?.[name] ? [{ 角色: name, 知晓的经历: scene.knowledge[name] }] : []);
    const player = scene.location === location ? scene.knowledge?.玩家 : undefined;
    return entries.length || player ? [{ 地点: scene.location, 玩家记忆: player, 角色记忆: entries }] : [];
  });
  return result.length ? `以下为角色亲历或明确获知的过去事件；其他角色不自动知晓。当前地点、状态与最新对话优先：\n${JSON.stringify(result)}` : '';
}

/** 仅在消息文本和来源完全一致、且不与未归档楼层重复时移除。 */
export function removeArchivedMessages<T extends { role: string; content?: unknown }>(prompt: T[], scenes: SceneMemory[], messages: MemoryMessage[]): void {
  const archived = scenes.filter(s => s.knowledge && validScene(s, messages)).flatMap(s => s.sources);
  const archivedIds = new Set(archived.map(s => s.id));
  const protectedText = new Set(messages.filter(m => !archivedIds.has(m.message_id)).map(m => `${m.role}\0${narrativeOnly(m.message).trim()}`));
  const counts = new Map<string, number>();
  for (const item of archived) {
    const key = `${item.role}\0${item.text}`;
    if (!protectedText.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (let i = 0; i < prompt.length;) {
    const item = prompt[i];
    if ((item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') { i++; continue; }
    const key = `${item.role}\0${item.content.trim()}`;
    const remaining = counts.get(key) ?? 0;
    if (remaining) { prompt.splice(i, 1); counts.set(key, remaining - 1); }
    else i++;
  }
}
