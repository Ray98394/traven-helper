type ChatMessage = { mes: string; is_user?: boolean; is_system?: boolean };
type ScenePart = { name: string; expression?: string; tagged: boolean };
export type PortraitAppearance = { current: boolean; expression: string };

/** 只有玩家和角色的具体地点都确定且相同时才显示。 */
export function isPortraitPresent(playerLocation: string, roleLocation: string | undefined): boolean {
  const player = playerLocation.trim();
  const role = roleLocation?.trim();
  return Boolean(player && player !== '未知' && role && role !== '未知' && role === player);
}

/** 按完整模型回复统计出场角色；流式消息替代正在生成的楼层。 */
export function recentPortraitAppearances(
  messages: ChatMessage[],
  parseParts: (message: string, streaming: boolean) => ScenePart[],
  stream?: string,
  streamingId?: number,
): Record<string, PortraitAppearance> {
  const replies = messages.flatMap((message, index) =>
    !message.is_user && !message.is_system && typeof message.mes === 'string' && !(stream && index === streamingId)
      ? [message.mes]
      : [],
  );
  if (stream) replies.push(stream);
  const selected = replies.slice(-2);
  const result: Record<string, PortraitAppearance> = {};
  selected.forEach((message, index) => {
    const current = index === selected.length - 1;
    const streaming = Boolean(stream) && current;
    parseParts(message, streaming).forEach(part => {
      if (!part.tagged || !part.expression || part.name === '旁白') return;
      result[part.name] = { current, expression: part.expression };
    });
  });
  return result;
}
