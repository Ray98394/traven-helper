/** 只影响 RPG 聊天区的展示，不修改原始消息或 MVU 的更新数据。 */
export function narrativeOnly(text: string): string {
  const blocks = ['UpdateVariable', 'Update', 'Analysis', 'JSONPatch', 'think', 'thinking', 'reasoning'];
  let result = text;
  for (const tag of blocks) {
    const fullOrStreaming = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?(?:<\\/${tag}\\s*>|$)`, 'gi');
    result = result.replace(fullOrStreaming, '');
  }
  result = result.replace(/<StatusPlaceHolderImpl\s*\/?\s*>/gi, '');
  // 避免流式输出时尚未完整形成的隐藏标签短暂出现在聊天区。
  const lastOpen = result.lastIndexOf('<');
  if (lastOpen >= 0) {
    const tail = result.slice(lastOpen).toLowerCase();
    if (tail.length > 1 && [...blocks, 'StatusPlaceHolderImpl'].some(tag => `<${tag.toLowerCase()}>`.startsWith(tail))) {
      result = result.slice(0, lastOpen);
    }
  }
  return result.trimEnd();
}
