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

test('当前场景与在场规则放在最新聊天之后', () => {
  const config = parse(readFileSync(new URL('../../世界书.yaml', import.meta.url), 'utf8'));
  for (const name of ['地点场景', '角色出场规则']) {
    const entry = config.条目.find(item => item.名称 === name);
    assert.equal(entry.插入位置.类型, '指定深度');
    assert.equal(entry.插入位置.深度, 0);
    assert.equal(entry.插入位置.角色, '系统');
  }
});

test('变量和出场模板只发送玩家当前地点，不改变原始状态', () => {
  const stat = { player: { area: { place: '图书馆' } }, locations: { 图书馆: { present: ['艾琳'] }, 湖岸边: { present: ['蕾拉妮'] } }, characters: { 艾琳: { affection: 5 }, 蕾拉妮: { affection: 45, area: { place: '旧地点' } } }, states: { 艾琳: { 'state': '日常' }, 蕾拉妮: { 'state': '日常' } }, outfits: { 艾琳: '日常', 蕾拉妮: '日常' } };
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
    const stat = { player: { area: { place: location } }, locations: {}, characters: { 艾琳: { affection: 5 } }, states: { 艾琳: { 'state': '日常' } }, outfits: { 艾琳: '日常' } };
    const output = render(source('变量列表'), stat);
    assert.doesNotMatch(output, /艾琳/);
    assert.match(output, /"characters": \{\}/);
  }
});
test('角色索引与配置不进入提示词，只输出在场角色详情', () => {
  const index = source('角色列表');
  assert.equal(parse(index).角色索引.艾琳, '艾琳角色详情');
  assert.doesNotMatch(render(index, {}), /艾琳|角色索引/);
  const detail = source('艾琳角色详情');
  assert.equal(typeof parse(detail).艾琳.配置.日程.每周.星期一, 'string');
  const stat = { player: { area: { place: '图书馆' } }, locations: { 图书馆: { present: ['艾琳'] } } };
  assert.match(render(detail, stat), /艾琳/);
  assert.doesNotMatch(render(detail, stat), /日程:|星期一:|立绘目录:/);
  stat.locations.图书馆.present = [];
  assert.doesNotMatch(render(detail, stat), /艾琳/);
});
test('三个详情根据同一地点名单独立输出，姓名关键词不会改变在场条件', () => {
  const stat = { player: { area: { place: '图书馆' } }, locations: { 图书馆: { present: ['艾琳'] } } };
  for (const name of ['艾琳', '蕾拉妮', '爱丽丝']) {
    const output = render(source(`${name}角色详情`), stat);
    if (name === '艾琳') assert.match(output, /艾琳:/);
    else assert.doesNotMatch(output, new RegExp(`${name}:`));
  }
  stat.locations.图书馆.present.push('爱丽丝');
  assert.match(render(source('爱丽丝角色详情'), stat), /爱丽丝:/);
});
