type ChatMessage = { mes: string; is_user?: boolean; is_system?: boolean };
type ScenePart = { name: string; expression?: string; text: string; tagged: boolean };
export type PortraitAppearance = { current: boolean; expression: string };

/** 只有玩家和角色的具体地点都确定且相同时才显示。 */
export function isPortraitPresent(playerLocation: string, roleLocation: string | undefined): boolean {
  const player = playerLocation.trim();
  const role = roleLocation?.trim();
  return Boolean(player && player !== '未知' && role && role !== '未知' && role === player);
}

/** 统计最近一条 AI 回复的发言角色；流式内容替代该回复。 */
export function recentPortraitAppearances(
  messages: ChatMessage[],
  parseParts: (message: string, streaming: boolean) => ScenePart[],
  stream?: string,
): Record<string, PortraitAppearance> {
  const last = messages.findLast(message => !message.is_system && !message.is_user);
  const content = stream || (last && typeof last.mes === 'string' ? last.mes : '');
  const result: Record<string, PortraitAppearance> = {};
  if (!content) return result;
  parseParts(content, Boolean(stream)).forEach(part => {
    if (!part.tagged || !part.expression || part.name === '旁白') return;
    const text = part.text.trim();
    const completeSpeech = /^(?:“[^”]+”|「[^」]+」|『[^』]+』|"[^"\n]+")$/.test(text);
    const streamingSpeech = Boolean(stream) && /^(?:“[^”]+|「[^」]+|『[^』]+|"[^"\n]+)$/.test(text);
    if (!completeSpeech && !streamingSpeech) return;
    result[part.name] = { current: true, expression: part.expression };
  });
  return result;
}
