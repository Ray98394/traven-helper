export type NaturalCharacter = { name: string; avatar: string; talkativeness?: number | string };
export type NaturalMessage = { name: string; mes: string; is_user?: boolean; is_system?: boolean };
export type NaturalGroup = { members: string[]; disabled_members?: string[] };

/** Selects one speaker using mentions and talkativeness, avoiding consecutive replies where possible. */
export function selectNaturalSpeaker(
  group: NaturalGroup,
  characters: NaturalCharacter[],
  chat: NaturalMessage[],
  random: () => number = Math.random,
): string | undefined {
  const members = group.members.filter(
    avatar => !group.disabled_members?.includes(avatar) && characters.some(c => c.avatar === avatar),
  );
  if (!members.length) return undefined;
  const last = chat.at(-1);
  const excluded = last && !last.is_user && !last.is_system ? last.name : undefined;
  const otherMembers = members.filter(
    avatar => characters.find(character => character.avatar === avatar)?.name !== excluded,
  );
  const candidates = otherMembers.length ? otherMembers : members;
  const source = last && !last.is_system ? last.mes : '';
  const words = (source.match(/\b\w+\b/gim) ?? []).map(word => word.toLowerCase());
  for (const word of words) {
    const match = candidates.find(avatar => {
      const c = characters.find(character => character.avatar === avatar);
      return c && (c.name.match(/\b\w+\b/gim) ?? []).some(name => name.toLowerCase() === word);
    });
    if (match) return match;
  }
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chatty: string[] = [];
  for (const avatar of shuffled) {
    const character = characters.find(c => c.avatar === avatar);
    if (!character) continue;
    const raw = Number(character.talkativeness);
    const chance = Number.isNaN(raw) ? 0.5 : raw;
    if (chance >= random()) return avatar;
    if (chance > 0) chatty.push(avatar);
  }
  const pool = chatty.length ? chatty : candidates;
  return pool[Math.floor(random() * pool.length)];
}
