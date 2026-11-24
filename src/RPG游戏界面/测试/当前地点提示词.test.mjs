import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

// 执行本项目使用的 EJS 语句和原样输出标签，检查最终传入提示词的文本。
function render(template, stat) {
  let source = 'let out = "";\n';
  let last = 0;
  const tags = /<%([_\-=]?)([\s\S]*?)([_-]?)%>/g;
  for (const match of template.matchAll(tags)) {
    source += `out += ${JSON.stringify(template.slice(last, match.index))};\n`;
    source += match[1] === '-' || match[1] === '=' ? `out += (${match[2]});\n` : `${match[2]}\n`;
    last = match.index + match[0].length;
  }
  source += `out += ${JSON.stringify(template.slice(last))}; return out;`;
  return new Function('getvar', source)(() => stat);
}
const source = name => readFileSync(new URL(`../../世界书/${name}.yaml`, import.meta.url), 'utf8');

test('战斗规则模板只在训练场输出', () => {
  assert.match(render(source('战斗规则'), { player: { area: { place: '训练场' } } }), /<训练战斗规则>/);
  assert.doesNotMatch(render(source('战斗规则'), { player: { area: { place: '图书馆' } } }), /<训练战斗规则>|\{\{roll/);
});
test('路人条目只由入场标记触发，不列入常驻内容', () => {
  const config = parse(readFileSync(new URL('../../世界书.yaml', import.meta.url), 'utf8'));
  const entry = config.条目.find(item => item.名称 === '[角色]路人角色生成');
  assert.equal(entry.激活策略.类型, '绿灯');
  assert.deepEqual(entry.激活策略.关键字, ['rpg_arrival_passerby_trigger']);
  assert.match(source('路人角色'), /\{\{random::/);
});

test('敌人详情在战斗触发时按地点和参战对象输出', () => {
  const config = parse(readFileSync(new URL('../../世界书.yaml', import.meta.url), 'utf8'));
  const entry = config.条目.find(item => item.名称 === '[敌人]训练人偶');
  assert.equal(entry.激活策略.类型, '绿灯');
  assert.ok(entry.激活策略.关键字.includes('rpg_battle_active_trigger'));
  assert.deepEqual(entry.激活策略.关键字, ['rpg_battle_active_trigger']);
  const stat = { player: { area: { place: '训练场' } }, aiBattle: { status: 'inactive', enemies: [] } };
  assert.match(render(source('地点-训练场'), stat), /"敌人列表": \["训练人偶"\]/);
  assert.match(render(source('敌人-训练人偶'), stat), /名称: 训练人偶/);
  stat.aiBattle = { status: 'active', enemies: [] };
  assert.match(render(source('敌人-训练人偶'), stat), /名称: 训练人偶/);
  stat.aiBattle = { status: 'active', enemies: [{ name: '其他敌人' }] };
  assert.doesNotMatch(render(source('敌人-训练人偶'), stat), /<敌人详情>/);
  stat.aiBattle.enemies = [{ name: '训练人偶' }];
  assert.match(render(source('敌人-训练人偶'), stat), /防御、防御、攻击/);
  stat.player.area.place = '图书馆';
  assert.doesNotMatch(render(source('敌人-训练人偶'), stat), /<敌人详情>/);
});

test('当前场景与在场规则放在最新聊天之后', () => {
  const config = parse(readFileSync(new URL('../../世界书.yaml', import.meta.url), 'utf8'));
  for (const name of ['[地点]图书馆', '角色出场规则']) {
    const entry = config.条目.find(item => item.名称 === name);
    assert.equal(entry.插入位置.类型, '指定深度');
    assert.equal(entry.插入位置.深度, 0);
    assert.equal(entry.插入位置.角色, '系统');
  }
});

test('酒馆菜单按关键词触发，仅在兔兔酒馆输出', () => {
  const config = parse(readFileSync(new URL('../../世界书.yaml', import.meta.url), 'utf8'));
  const entry = config.条目.find(item => item.名称 === '[菜单]兔兔酒馆菜单');
  assert.equal(entry.激活策略.类型, '绿灯');
  assert.equal(entry.激活策略.扫描深度, undefined);
  for (const word of ['菜单', '酒', '饮品', '蜂蜜暖酒']) assert.ok(entry.激活策略.关键字.includes(word));
  assert.ok(!entry.激活策略.关键字.includes('喝'));
  const template = source('兔兔酒馆菜单');
  for (const place of ['兔兔酒馆', ['兔兔酒馆', '地点']]) {
    const output = render(template, { player: { area: { place } } });
    assert.match(output, /蜂蜜暖酒：\d+金币/);
    assert.match(output, /紫月夜曲：\d+金币/);
  }
  for (const stat of [{}, { player: { area: { place: '图书馆' } } }]) {
    assert.doesNotMatch(render(template, stat), /兔兔酒馆菜单|蜂蜜暖酒/);
  }
});

test('变量和出场模板只发送玩家当前地点，不改变原始状态', () => {
  const stat = { player: { area: { place: '图书馆' } }, locations: { 图书馆: { present: ['艾琳'] }, 湖岸边: { present: ['蕾拉妮'] } }, characters: { 艾琳: { affection: 5 }, 蕾拉妮: { affection: 45, area: { place: '旧地点' } } }, states: { 艾琳: { 'state': '默认' }, 蕾拉妮: { 'state': '默认' } }, outfits: { 艾琳: '默认', 蕾拉妮: '默认' } };
  const before = structuredClone(stat);
  for (const name of ['变量列表', '角色出场规则']) {
    const output = render(source(name), stat);
    assert.match(output, /图书馆/);
    assert.match(output, /艾琳/);
    assert.doesNotMatch(output, /湖岸边|旧地点|蕾拉妮/);
  }
  assert.deepEqual(stat, before);
});
test('没有可用的地点名单时不暴露角色数据', () => {
  for (const location of ['未知', '不存在']) {
    const stat = { player: { area: { place: location } }, locations: {}, characters: { 艾琳: { affection: 5 } }, states: { 艾琳: { 'state': '默认' } }, outfits: { 艾琳: '默认' } };
    const output = render(source('变量列表'), stat);
    assert.doesNotMatch(output, /艾琳/);
    assert.match(output, /"characters":\{\}/);
  }
});
test('角色索引隐藏配置并且只输出在场角色基本信息', () => {
  const index = source('角色列表');
  assert.equal(typeof parse(index).角色索引.艾琳.配置.日程.每周.星期一, 'string');
  assert.doesNotMatch(render(index, {}), /艾琳|角色索引/);
  const stat = { player: { area: { place: '图书馆' } }, locations: { 图书馆: { present: ['艾琳', '爱丽丝'] } } };
  const output = render(index, stat);
  assert.match(output, /艾琳:/);
  assert.match(output, /爱丽丝:/);
  assert.doesNotMatch(output, /蕾拉妮:|日程:|星期一:|立绘目录:|配置:/);
  stat.locations.图书馆.present = [];
  assert.doesNotMatch(render(index, stat), /艾琳|爱丽丝/);
});

test('角色索引常驻并检查地点，扩展详情由关键词触发且只在场输出', () => {
  const config = parse(readFileSync(new URL('../../世界书.yaml', import.meta.url), 'utf8'));
  assert.equal(config.条目.find(item => item.名称 === '[角色]角色索引').激活策略.类型, '蓝灯');
  for (const name of ['蕾拉妮', '艾琳', '爱丽丝', '莉娜', '艾尔莎', '薇奥拉']) {
    assert.equal(config.条目.find(item => item.名称 === `${name}角色详情`), undefined);
    const extended = config.条目.find(item => item.名称 === `[角色]${name}角色扩展详情`);
    assert.equal(extended.激活策略.类型, '绿灯');
    assert.ok(extended.激活策略.关键字.includes(name));
    assert.equal(extended.激活策略.扫描深度, undefined);
    const stat = { player: { area: { place: '图书馆' } }, locations: { 图书馆: { present: [name] } } };
    const briefText = render(source('角色列表'), stat);
    const detailText = render(source(`${name}角色扩展详情`), stat);
    assert.match(briefText, /基本信息:/);
    assert.doesNotMatch(briefText, /固定性格与行为:/);
    assert.match(detailText, /固定性格与行为:/);
    assert.doesNotMatch(detailText, /基本信息:/);
    stat.locations.图书馆.present = [];
    assert.doesNotMatch(render(source(`${name}角色扩展详情`), stat), new RegExp(`${name}:`));
  }
  assert.ok(config.条目.find(item => item.名称 === '[角色]爱丽丝角色扩展详情').激活策略.关键字.includes('金发兔女郎'));
});

test('角色条目只输出本角色最近五天的记忆', () => {
  const stat = { time: { day: 8 }, player: { area: { place: '兔兔酒馆' } }, locations: { 兔兔酒馆: { present: ['爱丽丝'] } }, characterMemories: {
    爱丽丝: [{ day: 2, date: '旧日期', location: '兔兔酒馆', text: '过期事件' }, { day: 7, date: '昨天', location: '兔兔酒馆', text: '玩家请她喝酒' }],
    莉娜: [{ day: 7, date: '昨天', location: '兔兔酒馆', text: '莉娜的私人记忆' }],
  } };
  const output = render(source('爱丽丝角色扩展详情'), stat);
  assert.match(output, /玩家请她喝酒/);
  assert.doesNotMatch(output, /过期事件|莉娜的私人记忆/);
  stat.locations.兔兔酒馆.present = [];
  assert.doesNotMatch(render(source('爱丽丝角色扩展详情'), stat), /玩家请她喝酒/);
});


test('具体地点仅匹配专属标记且只有当前地点输出描述', () => {
  const config = parse(readFileSync(new URL('../../世界书.yaml', import.meta.url), 'utf8'));
  const stat = { player: { area: { place: '图书馆' } } };
  const entries = config.条目.filter(entry => entry.名称.startsWith('[地点]'));
  assert.ok(entries.length);
  for (const entry of entries) {
    const name = entry.名称.slice('[地点]'.length);
    assert.equal(entry.激活策略.类型, '绿灯');
    const marker = `rpg_location_${Array.from(name, c => c.codePointAt(0).toString(16) + '_').join('')}end`;
    assert.deepEqual(entry.激活策略.关键字, [marker]);
    const output = render(source(`地点-${name}`), stat);
    if (name === '图书馆') assert.match(output, /阅览桌/);
    else assert.doesNotMatch(output, /<当前地点场景>/);
  }
  stat.player.area.place = '{{user}}的家';
  assert.match(render(source('地点-玩家的家'), stat), /玩家的家/);
});
