/** 只影响 RPG 聊天区的展示，不修改原始消息或 MVU 的更新数据。 */
export function isGeneratingPlaceholder(text: string, isUser: boolean | undefined, isLatest: boolean, generating: boolean): boolean {
  return generating && isLatest && !isUser && /^(?:\.{3}|…)$/.test(text.trim());
}

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

/** 读取模型返回的思考文本；变量更新块内的 Analysis 不属于剧情思考。 */
export function reasoningForDisplay(text: string, nativeReasoning?: unknown): string {
  const withoutUpdates = text.replace(/<(UpdateVariable|Update|JSONPatch)(?:\s[^>]*)?>[\s\S]*?(?:<\/\1\s*>|$)/gi, '');
  const tagged = Array.from(withoutUpdates.matchAll(/<(think|thinking|reasoning|analysis)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1\s*>|$)/gi), match => match[2].trim()).filter(Boolean);
  const native = typeof nativeReasoning === 'string' ? nativeReasoning.trim() : '';
  return [...new Set([native, ...tagged].filter(Boolean))].join('\n\n');
}
