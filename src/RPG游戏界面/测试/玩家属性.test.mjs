import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abilityModifier, adjustResource, armorTotal, resourceLimits, syncPlayerResources } from '../功能/玩家属性.ts';
import { advanceDay } from '../功能/每日重置.ts';

test('属性修正和生命魔力上限符合设计公式', () => {
  assert.equal(armorTotal({ base: 3, equipment: 0 }), 3);
  assert.equal(armorTotal({ base: 3, equipment: 3 }), 6);
  assert.equal(abilityModifier(9), -1);
  assert.equal(abilityModifier(14), 2);
  assert.deepEqual(resourceLimits(3, { dexterity: 10, constitution: 14, intelligence: 14 }), { health: 28, mana: 20 });
  assert.throws(() => abilityModifier(21));
});
test('资源上限变化保留损失，休息恢复资源且精力固定为4', () => {
  assert.equal(adjustResource(8, 12, 14), 10);
  assert.equal(adjustResource(12, 12, 10), 10);
  const player = { level: 1, attributes: { dexterity: 10, constitution: 14, intelligence: 14 }, health: { current: 8, max: 10 }, mana: { current: 4, max: 10 }, energy: { current: 0, max: 4 }, area: { place: '湖岸边', region: '城镇' } };
  syncPlayerResources(player);
  assert.deepEqual(player.health, { current: 10, max: 12 });
  assert.deepEqual(player.mana, { current: 8, max: 14 });
  assert.equal(advanceDay({ time: { day: 1, year: 1830, month: 9, date: 5 }, player }, {}), true);
  assert.deepEqual(player.health, { current: 12, max: 12 });
  assert.deepEqual(player.mana, { current: 14, max: 14 });
  assert.deepEqual(player.energy, { current: 4, max: 4 });
});
test('休息时角色战斗资源按属性计算并恢复', () => {
  const combat = { level: 1, attributes: { dexterity: 10, constitution: 14, intelligence: 14 }, health: { current: 4, max: 10 }, mana: { current: 3, max: 10 }, energy: { current: 1, max: 4 } };
  const stat = { time: { day: 1, year: 1830, month: 9, date: 5 }, player: { energy: { current: 2, max: 4 }, area: {} }, characters: { 蕾拉妮: { combat } } };
  assert.equal(advanceDay(stat, {}), true);
  assert.deepEqual(combat.health, { current: 12, max: 12 });
  assert.deepEqual(combat.mana, { current: 14, max: 14 });
  assert.deepEqual(combat.energy, { current: 4, max: 4 });
});
