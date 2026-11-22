import assert from 'node:assert/strict';
import { test } from 'node:test';
import { travelTo } from '../功能/地点移动.ts';

test('前往新地点消耗精力值，精力不足时保留状态', () => {
  const state = { player: { area: { region: '城镇', place: '玩家的家' }, energy: { current: 1, max: 4 } } };
  assert.equal(travelTo(state, '图书馆'), 'ok');
  assert.deepEqual(state.player, { area: { region: '学院', place: '图书馆' }, energy: { current: 0, max: 4 } });
  const previous = structuredClone(state);
  assert.equal(travelTo(state, '市场'), 'no_points');
  assert.deepEqual(state, previous);
});
