import assert from 'node:assert/strict';
import { getAffectionStage, syncAffectionStage } from '../../变量结构/好感阶段.ts';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { return next(specifier.endsWith('/好感阶段') ? `${specifier}.ts` : specifier, context); } });
const { readAffection, writeAffection, protectAffection } = await import('../功能/好感度.ts');

for (const [score, expected] of [[0, '有所保留'], [19, '有所保留'], [20, '熟悉'], [39, '熟悉'], [40, '亲近'], [59, '亲近'], [60, '特别在意'], [79, '特别在意'], [80, '明确心意'], [99, '明确心意'], [100, '心意满溢']]) {
  assert.equal(getAffectionStage(score, true), expected);
}
assert.equal(getAffectionStage(100, false), '陌生');
const role = { 是否认识: [false, '说明'], 好感度: [65, '说明'], 好感度阶段: ['亲近', '说明'], 是否恋人: false, 表白已触发: false, 拒绝后固定: false };
assert.equal(syncAffectionStage(role), true);
assert.deepEqual(role.好感度阶段, ['陌生', '说明']);
role.是否认识[0] = true;
assert.equal(syncAffectionStage(role), true);
assert.deepEqual(role.好感度阶段, ['特别在意', '说明']);
const state = readAffection(role);
state.好感度 = 40;
writeAffection(role, state);
assert.equal(role.好感度阶段[0], '亲近');
const next = { ...role, 好感度: [80, '说明'], 好感度阶段: ['错误', '说明'] };
protectAffection(next, role);
assert.equal(next.好感度阶段[0], '明确心意');
