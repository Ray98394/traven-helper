import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { affectionStages, getAffectionStage } from '../../变量结构/好感阶段.ts';
import {
  appearancePrompt,
  parseSceneRoster,
  selectOutfit,
  setEventState,
  setOutfitOverride,
  syncCharacterStates,
} from '../功能/世界书角色列表.ts';
import { roster } from '../功能/角色索引夹具.mjs';

const roles = parseSceneRoster(roster);
test('蕾拉妮的战斗状态可由事件启用并恢复默认', () => {
  const stat = {};
  assert.equal(setEventState(stat, '蕾拉妮', '战斗中', roles.蕾拉妮, '湖岸边'), true);
  assert.equal(stat.states.蕾拉妮.state, '战斗中');
  assert.equal(selectOutfit(roles.蕾拉妮, '湖岸边', undefined, '战斗中').name, '默认');
  assert.equal(setEventState(stat, '蕾拉妮', null, roles.蕾拉妮, '湖岸边'), true);
  assert.equal(stat.states.蕾拉妮.state, '默认');
});
test('每位角色都有默认状态、默认服装和对应立绘', () => {
  for (const role of Object.values(roles)) {
    assert.ok(role.states.默认);
    assert.ok(role.outfits.默认);
    assert.ok(existsSync(new URL(`../../美术/角色立绘/${role.folder}/默认/默认.png`, import.meta.url)));
    for (const [location, state] of Object.entries(role.statesByLocation)) {
      assert.ok(role.states[state], `${location} 的状态不存在`);
      const outfit = role.states[state].outfit ?? '默认';
      assert.ok(role.outfits[outfit], `${state} 的服装不存在`);
      assert.ok(existsSync(new URL(`../../美术/角色立绘/${role.folder}/${outfit}/默认.png`, import.meta.url)));
    }
  }
});
test('所有角色均配置各阶段表现，仅发送在场角色当前的阶段', () => {
  for (const name of ['蕾拉妮', '艾琳', '爱丽丝', '莉娜', '艾尔莎', '薇奥拉']) {
    assert.deepEqual(Object.keys(roles[name].affectionBehaviors).sort(), [...affectionStages].sort());
  }
  const locations = { 爱丽丝: '兔兔酒馆', 艾琳: '图书馆' };
  const output = appearancePrompt(
    roles,
    '兔兔酒馆',
    locations,
    {},
    { 爱丽丝: { 'state': '工作中' } },
    { 爱丽丝: '熟悉', 艾琳: '恋人' },
  );
  assert.ok(output.includes(roles.爱丽丝.affectionBehaviors.熟悉));
  assert.match(output, /按酒馆安排陪客人/);
  assert.doesNotMatch(output, /艾琳|认真表达心意|在玩家接受表白后/);
  const changed = appearancePrompt(roles, '兔兔酒馆', locations, {}, {}, { 爱丽丝: '被拒绝' });
  assert.match(changed, /尊重玩家的决定/);
  assert.ok(!changed.includes(roles.爱丽丝.affectionBehaviors.熟悉));
  assert.equal(getAffectionStage(80, false, '明确心意'), '陌生');
  assert.equal(getAffectionStage(99, true, '被拒绝'), '被拒绝');
  assert.equal(getAffectionStage(100, true, '恋人'), '恋人');
});
test('按角色地点选择服装，事件指定可保存并恢复自动选择', () => {
  const role = roles.爱丽丝;
  assert.equal(selectOutfit(role, '兔兔酒馆').name, '工作服');
  assert.equal(selectOutfit(role, '湖岸边', undefined, '默认').name, '默认');
  const stat = {};
  assert.equal(setOutfitOverride(stat, '爱丽丝', '默认', role), true);
  assert.equal(selectOutfit(role, '兔兔酒馆', stat.outfits.爱丽丝).name, '默认');
  assert.equal(setOutfitOverride(stat, '爱丽丝', '不存在', role), false);
  assert.equal(stat.outfits.爱丽丝, '默认');
  assert.equal(setOutfitOverride(stat, '爱丽丝', null, role), true);
  assert.equal(selectOutfit(role, '兔兔酒馆', stat.outfits.爱丽丝).name, '工作服');
});
test('地点同步状态，事件可覆盖并恢复，服装和表现使用同一状态', () => {
  const stat = {};
  const locations = { 爱丽丝: '兔兔酒馆' };
  assert.equal(syncCharacterStates(stat, roles, locations), true);
  assert.equal(stat.states.爱丽丝['state'], '工作中');
  assert.equal(selectOutfit(roles.爱丽丝, '兔兔酒馆', undefined, stat.states.爱丽丝['state']).name, '工作服');
  assert.equal(setEventState(stat, '爱丽丝', '默认', roles.爱丽丝, '兔兔酒馆'), true);
  syncCharacterStates(stat, roles, locations);
  assert.equal(stat.states.爱丽丝['state'], '默认');
  const prompt = appearancePrompt(roles, '兔兔酒馆', locations, {}, stat.states);
  assert.match(prompt, /便服/);
  assert.match(prompt, /自己的计划/);
  assert.doesNotMatch(prompt, /兔女郎服装/);
  assert.equal(setEventState(stat, '爱丽丝', null, roles.爱丽丝, '兔兔酒馆'), true);
  assert.equal(stat.states.爱丽丝['state'], '工作中');
  assert.equal(syncCharacterStates(stat, roles, { 爱丽丝: '湖岸边' }), true);
  assert.equal(stat.states.爱丽丝['state'], '默认');
});
test('提示词只包含在场角色及所选服装，未知地点不输出', () => {
  const locations = { 爱丽丝: '兔兔酒馆', 艾琳: '图书馆' };
  const result = appearancePrompt(roles, '兔兔酒馆', locations, {});
  assert.match(result, /爱丽丝/);
  assert.match(result, /兔女郎服装/);
  assert.doesNotMatch(result, /艾琳|日常便服/);
  assert.match(appearancePrompt(roles, '兔兔酒馆', locations, { 爱丽丝: '默认' }), /日常便服/);
  assert.equal(appearancePrompt(roles, '未知', locations, {}), '');
});
test('无效立绘路径不能作为服装目录', () => {
  const invalid = parseSceneRoster(
    '角色列表:\n  人物:\n    服装:\n      款式:\n        ../outside:\n          描述: 不安全\n',
  );
  assert.equal(selectOutfit(invalid.人物, '任意'), undefined);
});
