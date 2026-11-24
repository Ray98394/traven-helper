import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, advanceDay, parseDate, weekday } from '../功能/每日重置.ts';
import { commitStateMessage } from '../功能/状态楼层提交.ts';

test('新楼层初始化覆盖变量时，连续休息仍保存日期、精力、地点和角色日程', async () => {
  let id = 0;
  const floors = [{ stat_data: {
    time: { day: 1, year: 2023, month: 12, date: 31 },
    player: { area: { region: '学院', place: '图书馆' }, energy: { current: 0, max: 4 }, money: 95 },
    locations: { 湖岸边: { present: ['艾琳'] } }, states: { 艾琳: { state: '默认' } },
  } }];
  for (const expectedDay of [2, 3]) {
    const data = structuredClone(floors[id]);
    assert.equal(advanceDay(data.stat_data, { 艾琳: { 每周: { 星期一: '图书馆', 星期二: '训练场' } } }), true);
    await commitStateMessage({
      data, message: '休息', previousId: id, chatId: 'chat',
      currentChatId: () => 'chat', lastId: () => id, clone: structuredClone,
      create: async () => { floors.push(structuredClone(floors[id])); id++; },
      replace: async (target, snapshot) => { floors[target] = structuredClone(snapshot); },
      verify: (target, expected) => JSON.stringify(floors[target]) === JSON.stringify(expected),
    });
    assert.equal(floors[id].stat_data.time.day, expectedDay);
    assert.equal(floors[id].stat_data.time.date, expectedDay - 1);
    assert.equal(floors[id].stat_data.player.energy.current, 4);
    assert.equal(floors[id].stat_data.player.area.place, '玩家的家');
    assert.equal(floors[id].stat_data.player.money, 95);
    assert.deepEqual(floors[id].stat_data.locations[expectedDay === 2 ? '图书馆' : '训练场'].present, ['艾琳']);
  }
});

test('公历日期跨月、闰年和跨年，星期随日期变化', () => {
  assert.deepEqual(addDays({ year: 2024, month: 2, date: 28 }, 1), { year: 2024, month: 2, date: 29 });
  assert.deepEqual(addDays({ year: 2023, month: 12, date: 31 }, 1), { year: 2024, month: 1, date: 1 });
  assert.equal(weekday({ year: 2024, month: 1, date: 1 }), '星期一');
  assert.equal(parseDate({ year: 1900, month: 2, date: 29 }), null);
});

test('休息只更新指定内容，日期专属日程优先于每周日程', () => {
  const state = {
    time: { day: [5, '说明'], year: 2023, month: 12, date: 31 },
    player: { area: { region: '学院', place: '图书馆' }, energy: { current: 0, max: 4 }, party: ['艾琳'] },
    locations: { 湖岸边: { present: ['艾琳'] }, 月神广场: { present: ['临时角色'] } },
    characters: { 艾琳: { affection: 25 }, 临时角色: {} },
  };
  assert.equal(advanceDay(state, { 艾琳: { 每周: { 星期一: '图书馆' }, 指定日期: { '2024-01-01': '训练场' } } }), true);
  assert.deepEqual(state.time, { day: [6, '说明'], year: 2024, month: 1, date: 1 });
  assert.equal(state.player.energy.current, 4);
  assert.equal(state.player.area.place, '玩家的家');
  assert.equal(state.player.area.region, '城镇');
  assert.deepEqual(state.player.party, ['艾琳']);
  assert.deepEqual(state.locations.训练场.present, ['艾琳']);
  assert.deepEqual(state.locations.湖岸边.present, []);
  assert.deepEqual(state.locations.月神广场.present, ['临时角色']);
});

test('日期或精力值无效时，不修改任何状态', () => {
  const state = {
    time: { day: 1, year: 2023, month: 2, date: 29 },
    player: { area: { region: '学院', place: '图书馆' }, energy: { current: 0, max: 4 } },
  };
  const original = structuredClone(state);
  assert.equal(advanceDay(state), false);
  assert.deepEqual(state, original);
});
