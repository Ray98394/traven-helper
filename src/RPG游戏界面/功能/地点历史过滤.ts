type Message = { message_id: number; role: string; message: string; is_hidden?: boolean };
type Prompt = { role: string; content?: unknown };

/** 只删除可与旧楼层精确对应的消息；同文的新楼层始终优先保留。 */
export function filterPreviousLocation(prompt: Prompt[], messages: Message[], start: number, format: (message: Message) => string): number {
  if (!Number.isSafeInteger(start) || start <= 0) return 0;
  const key = (role: string, content: string) => `${role}\0${content.trim()}`;
  const active = messages.filter(item => !item.is_hidden && (item.role === 'user' || item.role === 'assistant'));
  const current = new Set(active.filter(item => item.message_id >= start).map(item => key(item.role, format(item))).filter(item => !item.endsWith('\0')));
  const counts = new Map<string, number>();
  for (const item of active.filter(item => item.message_id < start)) {
    const text = format(item).trim();
    if (!text) continue;
    const id = key(item.role, text);
    if (!current.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let removed = 0;
  for (let i = 0; i < prompt.length;) {
    const item = prompt[i];
    if ((item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') { i++; continue; }
    const id = key(item.role, item.content), count = counts.get(id) ?? 0;
    if (count > 0) { prompt.splice(i, 1); counts.set(id, count - 1); removed++; } else i++;
  }
  return removed;
}
