export type SyncEntry = { uid: number; name: string; content: string };
export type SyncSources = { init: string; rules: string; roster: string };

/** 仅定位唯一条目；重名时跳过，避免改错用户的世界书。 */
export function planWorldbookSync(entries: SyncEntry[], sources: SyncSources) {
  const definitions = [
    { label: '初始化变量', matches: (name: string) => name.toLowerCase().includes('[initvar]'), content: sources.init },
    { label: '变量更新规则', matches: (name: string) => name === '[mvu_update]变量更新规则' || name === '变量更新规则', content: sources.rules },
    { label: '角色列表', matches: (name: string) => name === '角色列表', content: sources.roster },
  ];
  const updates = new Map<number, string>();
  const skipped: string[] = [];
  for (const definition of definitions) {
    const matches = entries.filter(entry => definition.matches(entry.name));
    if (matches.length !== 1) { skipped.push(definition.label); continue; }
    if (matches[0].content !== definition.content) updates.set(matches[0].uid, definition.content);
  }
  return { updates, skipped };
}
