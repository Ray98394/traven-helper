import assert from 'node:assert/strict';
import { getAffectionStage, syncAffectionStage } from '../../变量结构/好感阶段.ts';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { return next(specifier.endsWith('/好感阶段') ? `${specifier}.ts` : specifier, context); } });
const { readAffection, writeAffection, protectAffection } = await import('../功能/好感度.ts');

for (const [score, expected] of [[0, '有所保留'], [24, '有所保留'], [25, '熟悉'], [49, '熟悉'], [50, '特别在意'], [74, '特别在意'], [75, '明确心意'], [99, '明确心意'], [100, '心意满溢']]) {
  assert.equal(getAffectionStage(score, true), expected);
}
assert.equal(getAffectionStage(100, false), '陌生');
const role = { known: [false, '说明'], affection: [65, '说明'], stage: ['熟悉', '说明'], confessed: false };
assert.equal(syncAffectionStage(role), true);
assert.deepEqual(role.stage, ['陌生', '说明']);
role.known[0] = true;
assert.equal(syncAffectionStage(role), true);
assert.deepEqual(role.stage, ['特别在意', '说明']);
const state = readAffection(role);
state.affection = 40;
writeAffection(role, state);
assert.equal(role.stage[0], '熟悉');
const next = { ...role, affection: [80, '说明'], stage: ['错误', '说明'] };
protectAffection(next, role);
assert.equal(next.affection[0], 43);
assert.equal(next.stage[0], '熟悉');
for (const [old, proposed, expected] of [[10, 11, 11], [10, 12, 12], [10, 13, 13], [10, 20, 13], [49, 52, 50], [50, 53, 50], [70, 73, 70], [70, 65, 65]]) {
  const previous = { known: true, affection: old, stage: '熟悉', confessed: false };
  const candidate = { ...previous, affection: proposed };
  protectAffection(candidate, previous);
  assert.equal(candidate.affection, expected);
}
for (const [stage, score] of [['恋人', 100], ['被拒绝', 99]]) {
  const previous = { known: true, affection: score, stage: stage, confessed: true };
  const proposed = { ...previous, affection: 10, stage: '陌生', confessed: false };
  protectAffection(proposed, previous);
  assert.equal(proposed.stage, stage);
  assert.equal(proposed.affection, score);
  assert.equal(proposed.confessed, true);
  assert.equal(syncAffectionStage(proposed), false);
}
