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
  assert.equal(result.characters.蕾拉妮.affection, 45);
  assert.deepEqual(result.locations, {});
  assert.deepEqual(result.states, {});
  assert.deepEqual(result.outfits, {});
  assert.equal(result._locationsInit, false);
  assert.ok(z.toJSONSchema(Schema, { io: 'input' }).properties.player);
});
