import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import z from 'zod';
import _ from 'lodash';

globalThis.z = z;
globalThis._ = _;
const { Schema } = await import('../../变量结构/schema.ts');

test('新聊天初始化数据符合英文变量结构', async () => {
  const initial = parse(await readFile(new URL('../../世界书/[initvar]变量初始化勿开.yaml', import.meta.url), 'utf8'));
  const result = Schema.parse(initial);
  assert.equal(result.time.day, 1);
  assert.equal(result.player.area.place, '玩家的家');
  assert.equal(result.player.energy.current, 4);
  assert.deepEqual(result.player.armor, { base: 3, equipment: 0 });
  assert.deepEqual(Schema.parse({ ...initial, player: { ...initial.player, armor: undefined } }).player.armor, { base: 3, equipment: 0 });
  assert.deepEqual(Schema.parse({ ...initial, player: { ...initial.player, armor: { base: 10, equipment: 3 } } }).player.armor, { base: 10, equipment: 3 });
  assert.equal(result.aiBattle.startHealth, null);
  assert.equal(Schema.parse({ ...initial, aiBattle: { ...initial.aiBattle, startHealth: 8 } }).aiBattle.startHealth, 8);
  assert.equal(result.characters.蕾拉妮.affection, 45);
  assert.deepEqual(result.characters.蕾拉妮.combat.attributes, { dexterity: 10, constitution: 10, intelligence: 10 });
  assert.deepEqual(Object.keys(result.player.magic), ['结晶', '爆裂', '奥秘', '纹章']);
  assert.equal(result.player.magic.爆裂.proficiency, 0);
  assert.equal(result.characters.蕾拉妮.combat.magic.纹章.proficiency, 0);
  assert.equal('strength' in result.player.attributes, false);
  assert.equal(result.characters.蕾拉妮.combat.health.max, 10);
  assert.equal(result.characters.蕾拉妮.combat.mana.max, 10);
  assert.equal(result.characters.蕾拉妮.combat.energy.max, 4);
  assert.deepEqual(result.characters.莉娜, { known: false, affection: 0, stage: '陌生', confessed: false });
  assert.deepEqual(result.characters.艾尔莎, { known: false, affection: 0, stage: '陌生', confessed: false });
  assert.deepEqual(result.characters.薇奥拉, { known: false, affection: 0, stage: '陌生', confessed: false });
  assert.deepEqual(result.locations, {});
  assert.deepEqual(result.states, {});
  assert.deepEqual(result.outfits, {});
  assert.equal(result._locationsInit, false);
  assert.ok(z.toJSONSchema(Schema, { io: 'input' }).properties.player);
});


test('金币不再属于 MVU 玩家变量', () => {
  const state = Schema.parse({ player: { area: { place: '兔兔酒馆' } }, characters: {} });
  assert.equal('money' in state.player, false);
});
