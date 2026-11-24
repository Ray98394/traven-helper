export type MemoryEvent = { day: number; date: string; location: string; text: string };
export type DayLine = { location: string; present: string[]; role: string; text: string };

type HistoryLine = { message_id: number; role: string; is_hidden?: boolean; text: string; stat?: any };

/** 普通玩家楼层不一定保存独立快照，沿用之前最近的有效楼层状态。 */
export function collectDayLines(messages: HistoryLine[], day: number, roles: string[]): DayLine[] {
  const allowed = new Set(roles), lines: DayLine[] = [];
  let previous: any;
  for (const message of messages) {
    const stat = message.stat;
    const candidateDay = Array.isArray(stat?.time?.day) ? stat.time.day[0] : stat?.time?.day;
    const candidatePlace = Array.isArray(stat?.player?.area?.place) ? stat.player.area.place[0] : stat?.player?.area?.place;
    if (Number.isSafeInteger(candidateDay) && typeof candidatePlace === 'string') previous = stat;
    if (message.message_id === 0 || message.is_hidden || !['user', 'assistant'].includes(message.role) || message.text.startsWith('[旁白] 一天结束了。')) continue;
    const current = previous;
    const currentDay = Array.isArray(current?.time?.day) ? current.time.day[0] : current?.time?.day;
    const location = Array.isArray(current?.player?.area?.place) ? current.player.area.place[0] : current?.player?.area?.place;
    if (currentDay !== day || typeof location !== 'string' || !message.text.trim()) continue;
    const rawPresent = current.locations?.[location]?.present;
    const present = Array.isArray(rawPresent) ? rawPresent.filter((name: unknown): name is string => typeof name === 'string' && allowed.has(name)) : [];
    lines.push({ location, present, role: message.role, text: message.text.trim() });
  }
  return lines;
}

/** 只接收当天有可能在场的角色和地点，避免模型虚构角色或地点。 */
export function parseDailyMemories(raw: string, lines: DayLine[], day: number, date: string): Record<string, MemoryEvent[]> {
  const json = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('总结格式无效');
  const result: Record<string, MemoryEvent[]> = {};
  for (const [name, events] of Object.entries(parsed)) {
    if (!Array.isArray(events)) throw new Error('总结中的角色记忆格式无效');
    for (const event of events) {
      if (!event || typeof event !== 'object' || typeof event.location !== 'string' || typeof event.text !== 'string') throw new Error('总结中的事件格式无效');
      const location = event.location.trim(), text = event.text.trim();
      if (!text || !lines.some(line => line.location === location && line.present.includes(name))) throw new Error('总结包含无效内容或不在场的角色');
      if (text.length > 120) throw new Error('角色地点总结超过120字，请重试');
      if (result[name]?.some(item => item.location === location)) throw new Error('同一角色在同一地点的总结重复，请重试');
      (result[name] ??= []).push({ day, date, location, text });
    }
  }
  return result;
}

export function memorySummaryPrompt(date: string, lines: DayLine[]): string {
  return `请总结${date}的角色经历。仅输出 JSON 对象，格式为 {"角色名":[{"location":"地点","text":"简短事实"}]}，没有值得记录的事件时输出 {}。同一角色在同一地点当天的所有互动必须合并成一条记录，即使多次到访也只写一条；每条用一两句话概括，尽量不超过80字，最多120字。只保留重要事件、约定和未解决事项，不逐句复述、罗列细节或描述表情动作；普通聊天概括谈话主题即可。只记录聊天中真实发生且该角色明确参与或明确知晓的内容；仅在场不代表听到私人对话，不确定就省略。不要编造玩家想法、行动、约定或角色认知；不要把玩家单方面愿望当成已经发生的事实。只使用输入中的角色名和地点。以下是按地点与在场名单标记的聊天正文：\n${JSON.stringify(lines)}`;
}
