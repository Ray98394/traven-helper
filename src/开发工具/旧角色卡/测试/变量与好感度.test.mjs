import assert from 'node:assert/strict';
import fs from 'node:fs';
import _ from 'lodash';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

globalThis.z = z;
globalThis._ = _;
const { Schema } = await import('../../../变量结构/schema.ts');
const { readAffection, writeAffection, protectAffection } = await import('../../../RPG游戏界面/功能/好感度.ts');
const init = parseYaml(fs.readFileSync(new URL('../../../世界书/[initvar]变量初始化勿开.yaml', import.meta.url), 'utf8'));
const initial = Schema.parse(init);
assert.equal(initial.攻略角色.蕾拉妮.好感度, 45);
assert.equal(initial.攻略角色.艾琳.好感度, 0);
assert.deepEqual(Schema.parse(initial), initial);
const state = structuredClone(initial.攻略角色.蕾拉妮);
state.好感度 = 110;
assert.equal(Schema.parse({ 攻略角色: { 蕾拉妮: state } }).攻略角色.蕾拉妮.好感度, 100);
assert.equal(Schema.safeParse({ 攻略角色: { 蕾拉妮: { ...state, 是否恋人: 'false' } } }).success, false);

const locked = { 好感度: 100, 是否恋人: false, 表白已触发: false, 拒绝后固定: false };
const proposed = { 好感度: 20, 是否恋人: true, 表白已触发: true, 拒绝后固定: true };
protectAffection(proposed, locked);
assert.deepEqual(proposed, locked);

const rejected = { 好感度: 99, 是否恋人: false, 表白已触发: true, 拒绝后固定: true };
const retry = { 好感度: 100, 是否恋人: true, 表白已触发: false, 拒绝后固定: false };
protectAffection(retry, rejected);
assert.deepEqual(retry, rejected);
const edited = structuredClone(initial.攻略角色.蕾拉妮);
writeAffection(edited, { ...readAffection(edited), 好感度: 100 });
assert.equal(edited.好感度, 100);
console.info('MVU Schema 与好感度保护检查通过');
