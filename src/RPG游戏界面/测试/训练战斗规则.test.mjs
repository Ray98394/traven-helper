import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { battleStartProblem, shouldTriggerBattleRules } from '../功能/战斗触发.ts';

test('训练战斗初始化与世界书使用单次行动，不再配置战斗行动点', () => {
  const initial = parse(readFileSync(new URL('../../世界书/[initvar]变量初始化勿开.yaml', import.meta.url), 'utf8'));
  const rules = readFileSync(new URL('../../世界书/战斗规则.yaml', import.meta.url), 'utf8');
  assert.equal(Object.hasOwn(initial.aiBattle, 'actionPoints'), false);
  assert.equal(Object.hasOwn(initial.aiBattle, 'attacked'), false);
  assert.doesNotMatch(rules, /行动点|actionPoints/);
  assert.match(rules, /每回合各单位最多行动一次/);
  assert.match(rules, /只执行第一个/);
  for (const title of ['阶段一【检查与初始化】', '阶段二【确定本次行动】', '阶段三【逐次检定与伤害】', '阶段四【战况与简短叙事】', '阶段五【更新变量】']) assert.ok(rules.includes(title));
  assert.match(rules, /不得重掷先攻或重置敌人/);
  assert.match(rules, /无法从记录可靠还原，则暂停/);
  assert.equal(initial.aiBattle.startHealth, null);
  assert.match(rules, /\{\{roll 1d20\}\}/);
  assert.match(rules, /\{\{roll 1d4\}\}/);
  assert.match(rules, /自然1自动失手/);
  assert.match(rules, /自然20自动命中，第一次骰子的20本身不增加伤害/);
  assert.match(rules, /失手时伤害为0，不进行命中效果判定，也不取伤害骰/);
  assert.match(rules, /1为大失败×0\.3；2～5为勉强命中×0\.8；6～15为有效命中×1；16～19为暴击×1\.5；20为大成功×2/);
  assert.match(rules, /向下取整\(基础伤害×命中效果倍率\)，最低为0/);
  assert.match(rules, /player\.armor\.base（初始护甲）\+player\.armor\.equipment/);
  assert.match(rules, /目标正在防御则本次比较的护甲再加2/);
  assert.doesNotMatch(rules, /目标防御值=10\+目标敏捷修正值/);
  assert.match(rules, /玩家生命恢复到 startHealth/);
  assert.doesNotMatch(rules, /生命层级|层级系数|抹杀|概念破碎|超暴击/);
});

test('仅当前聊天按钮请求或进行中的战斗触发规则，普通聊天不会触发', () => {
  assert.equal(shouldTriggerBattleRules('训练场', 'inactive', null, 'chat-a'), false);
  assert.equal(shouldTriggerBattleRules('训练场', 'inactive', 'chat-a', 'chat-a'), true);
  assert.equal(shouldTriggerBattleRules('训练场', 'inactive', 'chat-a', 'chat-b'), false);
  assert.equal(shouldTriggerBattleRules('训练场', 'active', null, 'chat-a'), true);
  assert.equal(shouldTriggerBattleRules('图书馆', 'active', 'chat-a', 'chat-a'), false);
  const stat = { player: { area: { place: '训练场' }, health: { current: 10 }, armor: { base: 10, equipment: 0 }, attributes: { dexterity: 10 } }, aiBattle: { status: 'inactive' } };
  assert.equal(battleStartProblem(stat), null);
  assert.match(battleStartProblem({ ...stat, aiBattle: { status: 'active' } }), /尚未结束/);
  assert.match(battleStartProblem({ ...stat, player: { ...stat.player, health: { current: 0 } } }), /生命/);
  assert.match(battleStartProblem({ ...stat, player: { ...stat.player, armor: undefined } }), /护甲/);
  const config = parse(readFileSync(new URL('../../世界书.yaml', import.meta.url), 'utf8'));
  for (const name of ['[战斗]战斗规则', '[敌人]训练人偶']) assert.deepEqual(config.条目.find(entry => entry.名称 === name).激活策略.关键字, ['rpg_battle_active_trigger']);
  assert.doesNotMatch(readFileSync(new URL('../../世界书/地点-训练场.yaml', import.meta.url), 'utf8'), /<训练战斗规则>|\{\{roll /);
});
