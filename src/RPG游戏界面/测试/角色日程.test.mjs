import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRoleSchedules } from '../功能/世界书角色列表.ts';
import { advanceDay, scheduledLocation } from '../功能/每日重置.ts';
import { characterLocations } from '../功能/地点成员.ts';
import { locationRegions } from '../功能/区域.ts';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { roster } from '../功能/角色索引夹具.mjs';

test('项目角色列表日程可读取并实际用于次日刷新', () => {
  const schedules = parseRoleSchedules(roster);
  const state = {
    time: { day: 1, year: 1, month: 1, date: 1 },
    player: { area: { region: '城镇', place: '月神广场' }, energy: { current: 0, max: 4 } },
    locations: {},
    characters: { 蕾拉妮: {}, 艾琳: {} },
  };
  assert.equal(advanceDay(state, schedules, () => 0), true);
  const positions = characterLocations(state);
  for (const name of ['蕾拉妮', '艾琳', '爱丽丝', '莉娜', '艾尔莎', '薇奥拉']) {
    assert.equal(positions[name], scheduledLocation(name, schedules[name], { year: 1, month: 1, date: 2 }, () => 0));
  }
});

test('每个角色从自己的地点列表独立抽取，指定日期优先', () => {
  const schedules = parseRoleSchedules(`角色列表:\n  甲:\n    日程:\n      随机地点: [图书馆, 训练场]\n      每周:\n        星期一: 随机\n  乙:\n    日程:\n      随机地点: [月神广场, 湖岸边]\n      每周:\n        星期一: 图书馆\n      指定日期:\n        '2024-01-01': 随机\n`);
  const state = { time: { day: 1, year: 2023, month: 12, date: 31 }, player: { area: {}, energy: { current: 0, max: 4 } }, locations: { 月神广场: { present: ['甲', '乙'] } }, characters: { 甲: {}, 乙: {} } };
  const values = [0, 0.999];
  assert.equal(advanceDay(state, schedules, () => values.shift()), true);
  assert.deepEqual(characterLocations(state), { 甲: '图书馆', 乙: '湖岸边' });
  assert.deepEqual(state.locations.月神广场.present, []);
  assert.equal(values.length, 0);
});

test('随机列表为空时保留原地点', () => {
  const state = { time: { day: 1, year: 2023, month: 12, date: 31 }, player: { area: {}, energy: { current: 0, max: 4 } }, locations: { 月神广场: { present: ['甲'] } }, characters: { 甲: {} } };
  assert.equal(advanceDay(state, { 甲: { 每周: { 星期一: '随机' }, 随机地点: [] } }), true);
  assert.equal(characterLocations(state).甲, '月神广场');
});

test('艾尔莎工作日上班，周末的日程不会触发酒馆工作状态', () => {
  const schedule = parseRoleSchedules(roster).艾尔莎;
  for (const date of [1, 2, 3, 4, 5]) {
    assert.equal(scheduledLocation('艾尔莎', schedule, { year: 2024, month: 1, date }), '兔兔酒馆');
  }
  for (const date of [6, 7]) {
    assert.equal(scheduledLocation('艾尔莎', schedule, { year: 2024, month: 1, date }, () => 0), '月神广场');
    assert.equal(scheduledLocation('艾尔莎', schedule, { year: 2024, month: 1, date }, () => 0.999), '芙洛家的面包店');
  }
});


test('薇奥拉平日在学院附近活动，周末前往酒馆', () => {
  const schedule = parseRoleSchedules(roster).薇奥拉;
  assert.deepEqual(schedule.随机地点, ['卡登斯学院', '图书馆', '训练场', '湖岸边']);
  for (const date of [1, 2, 3, 4, 5]) {
    assert.equal(scheduledLocation('薇奥拉', schedule, { year: 2024, month: 1, date }, () => 0), '卡登斯学院');
  }
  for (const date of [6, 7]) {
    assert.equal(scheduledLocation('薇奥拉', schedule, { year: 2024, month: 1, date }), '兔兔酒馆');
  }
});


test('角色日程地点都能在地图上找到', () => {
  const sidebar = readFileSync(new URL('../状态侧栏.vue', import.meta.url), 'utf8');
  const mapNames = new Set([...sidebar.matchAll(/\{ name: '([^']+)', x:/g)].map(match => match[1]));
  mapNames.add('玩家的家');
  assert.deepEqual(Object.keys(locationRegions).sort(), [...mapNames].sort());
  const book = parse(readFileSync(new URL('../../世界书.yaml', import.meta.url), 'utf8'));
  const places = book.条目.filter(entry => entry.名称.startsWith('[地点]')).map(entry => entry.名称.slice('[地点]'.length));
  assert.deepEqual(places.sort(), [...mapNames].sort());
  const schedules = parseRoleSchedules(roster);
  for (const [name, schedule] of Object.entries(schedules)) {
    const places = [...(schedule.随机地点 ?? []), ...Object.values(schedule.每周 ?? {}), ...Object.values(schedule.指定日期 ?? {})];
    for (const place of places.filter(place => place !== '随机')) {
      assert.ok(mapNames.has(place), `${name} 的日程地点 ${place} 未在地图标记`);
      assert.ok(Object.hasOwn(locationRegions, place), `${name} 的日程地点 ${place} 未配置区域`);
    }
  }
});
