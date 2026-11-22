import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRoleSchedules } from '../功能/世界书角色列表.ts';
import { advanceDay, scheduledLocation } from '../功能/每日重置.ts';
import { locationRegions } from '../功能/区域.ts';
import { characterLocations } from '../功能/地点成员.ts';
import { roster } from '../功能/角色索引夹具.mjs';

test('项目角色列表日程可读取并实际用于次日刷新', () => {
  const schedules = parseRoleSchedules(roster);
  const state = {
    time: { day: 1, year: 1, month: 1, date: 1 },
    player: { area: { region: '城镇', place: '市场' }, energy: { current: 0, max: 4 } },
    locations: {},
    characters: { 蕾拉妮: {}, 艾琳: {} },
  };
  assert.equal(advanceDay(state, schedules, () => 0), true);
  const positions = characterLocations(state);
  for (const name of ['蕾拉妮', '艾琳', '爱丽丝']) {
    assert.equal(positions[name], scheduledLocation(name, schedules[name], { year: 1, month: 1, date: 2 }, () => 0));
  }
});

test('随机区域日程在次日独立选择实际地点并保存，指定日期优先', () => {
  const schedules = parseRoleSchedules(`角色列表:\n  甲:\n    日程:\n      每周:\n        星期一: 随机.学院\n  乙:\n    日程:\n      每周:\n        星期一: 随机.学院\n      指定日期:\n        '2024-01-01': 随机.湖泊\n`);
  const state = { time: { day: 1, year: 2023, month: 12, date: 31 }, player: { area: {}, energy: { current: 0, max: 4 } }, locations: { 市场: { present: ['甲', '乙'] } }, characters: { 甲: {}, 乙: {} } };
  const values = [0, 0.999];
  assert.equal(advanceDay(state, schedules, () => values.shift()), true);
  const locations = characterLocations(state);
  assert.equal(locations.甲, Object.keys(locationRegions).find(name => locationRegions[name] === '学院'));
  assert.equal(locations.乙, Object.keys(locationRegions).filter(name => locationRegions[name] === '湖泊').at(-1));
  assert.deepEqual(state.locations.市场.present, []);
  assert.equal(values.length, 0);
  assert.deepEqual(characterLocations(state), locations);
});

test('未知随机区域保留原地点而不创建伪地点', () => {
  const state = { time: { day: 1, year: 2023, month: 12, date: 31 }, player: { area: {}, energy: { current: 0, max: 4 } }, locations: { 市场: { present: ['甲'] } }, characters: { 甲: {} } };
  assert.equal(advanceDay(state, { 甲: { 每周: { 星期一: '随机.不存在' } } }), true);
  assert.equal(characterLocations(state).甲, '市场');
  assert.equal(Object.hasOwn(state.locations, '随机.不存在'), false);
});
