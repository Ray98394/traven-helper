import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fillInitialRoleLocations } from '../功能/初始角色地点.ts';
import { characterLocations, moveCharacter } from '../功能/地点成员.ts';

test('角色移动从所有旧地点移除，并保留其他成员', () => {
  const state = { locations: { 甲: { present: ['艾琳', '蕾拉妮'] }, 乙: { present: ['艾琳'] } } };
  moveCharacter(state, '艾琳', '丙');
  assert.deepEqual(state.locations, { 甲: { present: ['蕾拉妮'] }, 乙: { present: [] }, 丙: { present: ['艾琳'] } });
});
test('新聊天按初始日期读取日程，随机仅抽取一次', () => {
  const schedules = { 蕾拉妮: { 每周: { 星期一: '湖岸边' } }, 艾琳: { 每周: { 星期一: '随机' }, 随机地点: ['湖岸边', '码头'] }, 爱丽丝: { 每周: {} } };
  const state = { time: { day: 1, year: 2024, month: 1, date: 1 }, locations: {}, characters: {} };
  let calls = 0;
  assert.equal(fillInitialRoleLocations(state, schedules, 1, () => { calls++; return 0; }), true);
  assert.deepEqual(characterLocations(state), { 蕾拉妮: '湖岸边', 艾琳: '湖岸边' });
  assert.equal(calls, 1);
  assert.equal(fillInitialRoleLocations(state, schedules, 1, () => { calls++; return 0.9; }), false);
  assert.equal(calls, 1);
});
test('已有地点不重置；初始日期无效时等待有效日期', () => {
  const schedules = { 艾琳: { 每周: { 星期一: '图书馆' } } };
  const existing = { time: { day: 1, year: 2024, month: 1, date: 1 }, locations: { 月神广场: { present: ['艾琳'] } } };
  assert.equal(fillInitialRoleLocations(existing, schedules, 1), true);
  assert.equal(characterLocations(existing).艾琳, '月神广场');
  const invalid = { time: { day: 1 }, locations: {} };
  assert.equal(fillInitialRoleLocations(invalid, schedules, 1), false);
  assert.equal(invalid._locationsInit, undefined);
});
test('初始日期专属日程优先于每周日程', () => {
  const state = { time: { day: 1, year: 2024, month: 1, date: 1 }, locations: {} };
  fillInitialRoleLocations(state, { 艾琳: { 每周: { 星期一: '图书馆' }, 指定日期: { '2024-01-01': '训练场' } } }, 1);
  assert.equal(characterLocations(state).艾琳, '训练场');
});

test('首日地点表为空时可恢复初始化，不重置已有地点', () => {
  const schedules = { 蕾拉妮: { 每周: { 星期日: '湖岸边' } } };
  const state = { time: { day: 1, year: 1830, month: 9, date: 5 }, locations: {}, _locationsInit: true };
  assert.equal(fillInitialRoleLocations(state, schedules, 1), true);
  assert.equal(characterLocations(state).蕾拉妮, '湖岸边');
  moveCharacter(state, '蕾拉妮', '图书馆');
  assert.equal(fillInitialRoleLocations(state, schedules, 1), false);
  assert.equal(characterLocations(state).蕾拉妮, '图书馆');
});
