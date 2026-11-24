export type Attributes = { dexterity: number; constitution: number; intelligence: number };
export function armorTotal(armor: { base: number; equipment: number }): number {
  return armor.base + armor.equipment;
}
export function abilityModifier(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error('属性值必须为1至20的整数');
  return Math.floor((value - 10) / 2);
}
export function resourceLimits(level: number, attributes: Attributes) {
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new Error('等级必须为1至20的整数');
  const con = abilityModifier(attributes.constitution), intelligence = abilityModifier(attributes.intelligence);
  abilityModifier(attributes.dexterity);
  return { health: Math.max(1, 10 + con + (level - 1) * Math.max(1, 6 + con)), mana: Math.max(1, 10 + intelligence * 2 + (level - 1) * 3) };
}
/** 更新上限时保持已损失的数量；降低上限时只截断超出部分。 */
export function adjustResource(current: number, oldMax: number, newMax: number): number {
  if (![current, oldMax, newMax].every(Number.isInteger) || oldMax < 1 || newMax < 1 || current < 0 || current > oldMax) throw new Error('资源数据无效');
  return Math.min(newMax, current + Math.max(0, newMax - oldMax));
}
export function syncPlayerResources(player: { level: number; attributes: Attributes; health: { current: number; max: number }; mana: { current: number; max: number } }) {
  const limits = resourceLimits(player.level, player.attributes);
  for (const key of ['health', 'mana'] as const) {
    const resource = player[key], next = limits[key];
    resource.current = adjustResource(resource.current, resource.max, next);
    resource.max = next;
  }
}
