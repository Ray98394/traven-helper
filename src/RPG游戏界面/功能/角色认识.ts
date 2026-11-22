type Role = Record<string, unknown>;
export type Knowledge = Record<string, boolean>;

export function knowsRole(role: unknown): boolean {
  if (!role || typeof role !== 'object' || Array.isArray(role)) return false;
  const value = (role as Role).known;
  return (Array.isArray(value) ? value[0] : value) === true || (Array.isArray(value) ? value[0] : value) === 1;
}

export function readKnowledge(roles: unknown): Knowledge {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return {};
  return Object.fromEntries(Object.entries(roles)
    .filter(([, role]) => role && typeof role === 'object' && !Array.isArray(role) && Object.hasOwn(role, 'known'))
    .map(([name, role]) => [name, knowsRole(role)]));
}

/** 只遮罩配置角色的说话人标题，不改动正文、旁白或其他人物提及的名字。 */
export function displaySpeaker(name: string, knowledge: Knowledge): string {
  return Object.hasOwn(knowledge, name) && !knowledge[name] ? '？？？' : name;
}
