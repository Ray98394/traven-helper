import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRoleSchedules } from './世界书角色列表.ts';
import { advanceDay } from './每日重置.ts';

test('项目角色列表日程可读取并实际用于次日刷新', () => {
  const roster = readFileSync(new URL('../../世界书/角色列表.yaml', import.meta.url), 'utf8');
  const schedules = parseRoleSchedules(roster);
  const state = {
    游戏时间: { 天数: 1, 年: 1, 月: 1, 日: 1 },
    玩家: { 具体地点: '市场', 行动点: { 当前: 0, 上限: 4 } },
    攻略角色: { 蕾拉妮: { 具体地点: '未知' }, 艾琳: { 具体地点: '未知' } },
  };
  assert.equal(advanceDay(state, schedules), true);
  assert.equal(state.攻略角色.蕾拉妮.具体地点, '图书馆');
  assert.equal(state.攻略角色.艾琳.具体地点, '雷格努姆学院');
});
