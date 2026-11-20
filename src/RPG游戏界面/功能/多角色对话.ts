export type ScenePart = { name: string; expression?: string; text: string; tagged: boolean };

/** 只解析独占一行的标记，避免把正文里的方括号当作角色。 */
export function splitSceneDialogue(text: string, fallbackName: string, streaming = false): ScenePart[] {
  if (streaming) text = text.replace(/(?:^|\n)\[[^\]\n]{0,80}$/, '');
  const tag = /^\[(旁白|[^\].\n]{1,40}\.[^\]\n]{1,40})\]\s*$/gm;
  const matches = [...text.matchAll(tag)];
  if (!matches.length) return text.trim() ? [{ name: fallbackName, text, tagged: false }] : [];
  const result: ScenePart[] = [];
  const prefix = text.slice(0, matches[0].index).trim();
  if (prefix) result.push({ name: '旁白', text: prefix, tagged: true });
  matches.forEach((match, index) => {
    const [name, expression] = match[1].split('.', 2);
    const content = text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length).trim();
    if (content || streaming) result.push({ name, expression, text: content, tagged: true });
  });
  return result;
}

/** 显示层将角色标记中的叙述与引号内台词分开；原始标记仍用于立绘。 */
export function splitDialogueForDisplay(parts: ScenePart[]): ScenePart[] {
  return parts.flatMap(part => {
    if (!part.tagged || part.name === '旁白') return [part];
    const quotes = /“[^”]*”|「[^」]*」|『[^』]*』|"[^"\n]*"/g;
    const matches = [...part.text.matchAll(quotes)];
    if (!matches.length) {
      // 旧消息可能不带引号，短句继续按角色台词处理。
      return part.text.length >= 55 || /\n\s*\n/.test(part.text)
        ? [{ name: '旁白', text: part.text, tagged: true }]
        : [part];
    }
    const result: ScenePart[] = [];
    let offset = 0;
    for (const match of matches) {
      const narrative = part.text.slice(offset, match.index).trim();
      if (narrative) result.push({ name: '旁白', text: narrative, tagged: true });
      result.push({ ...part, text: match[0] });
      offset = match.index! + match[0].length;
    }
    const tail = part.text.slice(offset).trim();
    if (tail) result.push({ name: '旁白', text: tail, tagged: true });
    return result;
  });
}
