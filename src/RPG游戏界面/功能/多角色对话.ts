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
