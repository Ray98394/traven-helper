import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, advanceDay, parseDate, weekday } from './每日重置.ts';

test('公历日期跨月、闰年和跨年，星期随日期变化', () => {
  assert.deepEqual(addDays({ 年: 2024, 月: 2, 日: 28 }, 1), { 年: 2024, 月: 2, 日: 29 });
  assert.deepEqual(addDays({ 年: 2023, 月: 12, 日: 31 }, 1), { 年: 2024, 月: 1, 日: 1 });
  assert.equal(weekday({ 年: 2024, 月: 1, 日: 1 }), '星期一');
  assert.equal(parseDate({ 年: 1900, 月: 2, 日: 29 }), null);
});

test('休息只更新指定内容，日期专属日程优先于每周日程', () => {
  const state = {
    游戏时间: { 天数: [5, '说明'], 年: 2023, 月: 12, 日: 31 },
    玩家: { 具体地点: '图书馆', 行动点: { 当前: 0, 上限: 4 }, 战斗队伍: ['艾琳'] },
    攻略角色: { 艾琳: { 具体地点: ['湖岸边', '说明'], 好感度: 25 }, 临时角色: { 具体地点: '市场' } },
  };
  assert.equal(advanceDay(state, { 艾琳: { 每周: { 星期一: '图书馆' }, 指定日期: { '2024-01-01': '训练场' } } }), true);
  assert.deepEqual(state.游戏时间, { 天数: [6, '说明'], 年: 2024, 月: 1, 日: 1 });
  assert.equal(state.玩家.行动点.当前, 4);
  assert.equal(state.玩家.具体地点, '玩家的家');
  assert.deepEqual(state.玩家.战斗队伍, ['艾琳']);
  assert.deepEqual(state.攻略角色.艾琳.具体地点, ['训练场', '说明']);
  assert.equal(state.攻略角色.临时角色.具体地点, '市场');
});

test('日期或行动点无效时，不修改任何状态', () => {
  const state = { 游戏时间: { 天数: 1, 年: 2023, 月: 2, 日: 29 }, 玩家: { 具体地点: '图书馆', 行动点: { 当前: 0, 上限: 4 } } };
  const original = structuredClone(state);
  assert.equal(advanceDay(state), false);
  assert.deepEqual(state, original);
});
