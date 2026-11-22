import assert from 'node:assert/strict';
import { getAffectionStage, syncAffectionStage } from '../../变量结构/好感阶段.ts';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { return next(specifier.endsWith('/好感阶段') ? `${specifier}.ts` : specifier, context); } });
const { readAffection, writeAffection, protectAffection } = await import('../功能/好感度.ts');

for (const [score, expected] of [[0, '有所保留'], [19, '有所保留'], [20, '熟悉'], [39, '熟悉'], [40, '亲近'], [59, '亲近'], [60, '特别在意'], [79, '特别在意'], [80, '明确心意'], [99, '明确心意'], [100, '心意满溢']]) {
  assert.equal(getAffectionStage(score, true), expected);
}
assert.equal(getAffectionStage(100, false), '陌生');
const role = { known: [false, '说明'], affection: [65, '说明'], stage: ['亲近', '说明'], confessed: false };
assert.equal(syncAffectionStage(role), true);
assert.deepEqual(role.stage, ['陌生', '说明']);
role.known[0] = true;
assert.equal(syncAffectionStage(role), true);
assert.deepEqual(role.stage, ['特别在意', '说明']);
const state = readAffection(role);
state.affection = 40;
writeAffection(role, state);
assert.equal(role.stage[0], '亲近');
const next = { ...role, affection: [80, '说明'], stage: ['错误', '说明'] };
protectAffection(next, role);
assert.equal(next.stage[0], '明确心意');
for (const [stage, score] of [['恋人', 100], ['被拒绝', 99]]) {
  const previous = { known: true, affection: score, stage: stage, confessed: true };
  const proposed = { ...previous, affection: 10, stage: '陌生', confessed: false };
  protectAffection(proposed, previous);
  assert.equal(proposed.stage, stage);
  assert.equal(proposed.affection, score);
  assert.equal(proposed.confessed, true);
  assert.equal(syncAffectionStage(proposed), false);
}
