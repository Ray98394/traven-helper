import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleRoulette, WHEEL_NUMBERS, wheelTargetAngle } from '../功能/轮盘.ts';
const draw = n => () => (n + .5) / 37;
test('轮盘包含 0 到 36，指针角度与各数字对应', () => {
  assert.deepEqual([...WHEEL_NUMBERS].sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i));
  WHEEL_NUMBERS.forEach((number, index) => {
    const aligned = (wheelTargetAngle(number) + index * 360 / 37) % 360;
    assert.ok(aligned < 1e-9 || 360 - aligned < 1e-9);
  });
  assert.throws(() => wheelTargetAngle(37));
});
test('颜色单双按单零规则结算，0 不命中颜色或单双', () => {
  assert.equal(settleRoulette(100, { kind:'red', amount:10 }, draw(1)).balance, 110);
  assert.equal(settleRoulette(100, { kind:'black', amount:10 }, draw(1)).balance, 90);
  assert.equal(settleRoulette(100, { kind:'even', amount:10 }, draw(0)).balance, 90);
  assert.equal(settleRoulette(100, { kind:'odd', amount:10 }, draw(3)).balance, 110);
});
test('数字命中 35 倍净收益，余额不足或无效投注不结算', () => {
  assert.equal(settleRoulette(100, { kind:'number', number:0, amount:2 }, draw(0)).balance, 170);
  assert.equal(settleRoulette(100, { kind:'number', number:36, amount:2 }, draw(35)).balance, 98);
  for (const bet of [{kind:'red',amount:101},{kind:'odd',amount:0},{kind:'number',number:37,amount:1}]) assert.throws(() => settleRoulette(100, bet, draw(0)));
});
