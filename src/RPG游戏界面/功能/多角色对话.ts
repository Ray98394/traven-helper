export type ScenePart = { name: string; expression?: string; text: string; tagged: boolean };

/** 解析行首标记，允许正文紧随标记，同时保留正文中的方括号。 */
export function splitSceneDialogue(text: string, fallbackName: string, streaming = false): ScenePart[] {
  if (streaming) text = text.replace(/(?:^|\n)\[[^\]\n]{0,80}$/, '');
  const tag = /^\[(旁白|[^\].\n]{1,40}\.[^\]\n]{1,40})\][ \t]*/gm;
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
export function splitDialogueForDisplay(parts: ScenePart[], streaming = false): ScenePart[] {
  return parts.flatMap(part => {
    if (!part.tagged || part.name === '旁白') return [part];
    const quotes = streaming
      ? /“[^”]*(?:”|$)|「[^」]*(?:」|$)|『[^』]*(?:』|$)|"[^"\n]*(?:"|$)/g
      : /“[^”]*”|「[^」]*」|『[^』]*』|"[^"\n]*"/g;
    const matches = [...part.text.matchAll(quotes)];
    if (!matches.length) return [{ name: '旁白', text: part.text, tagged: true }];
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
