import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillInitialRoleLocations } from './初始角色地点.ts';

const configured = { 蕾拉妮: { 具体地点: '湖岸边' }, 艾琳: { 具体地点: '图书馆' } };
test('初始日补全缺失和未知地点，保留其他状态与 MVU 描述', () => {
  const state = { 游戏时间: { 天数: 1 }, 攻略角色: { 蕾拉妮: { 具体地点: ['未知', '说明'], 好感度: 45 }, 艾琳: { 好感度: 0 } } };
  assert.equal(fillInitialRoleLocations(state, configured, {}, 1), true);
  assert.deepEqual(state.攻略角色.蕾拉妮, { 具体地点: ['湖岸边', '说明'], 好感度: 45 });
  assert.equal(state.攻略角色.艾琳.具体地点, '图书馆');
});
test('不覆盖明确保存的地点，也不在之后的天数重置地点', () => {
  const state = { 游戏时间: { 天数: 1 }, 攻略角色: { 蕾拉妮: { 具体地点: '训练场' } } };
  assert.equal(fillInitialRoleLocations(state, configured, {}, 1), false);
  assert.equal(state.攻略角色.蕾拉妮.具体地点, '训练场');
  state.游戏时间.天数 = 2;
  state.攻略角色.蕾拉妮.具体地点 = '未知';
  assert.equal(fillInitialRoleLocations(state, configured, {}, 1), false);
});
test('旧初始化条目缺失地点时使用项目默认值；明确配置未知时不覆盖', () => {
  const state = { 游戏时间: { 天数: 1 }, 攻略角色: { 蕾拉妮: {} } };
  assert.equal(fillInitialRoleLocations(state, { 蕾拉妮: {} }, configured, 1), true);
  assert.equal(state.攻略角色.蕾拉妮.具体地点, '湖岸边');
  state.攻略角色.蕾拉妮.具体地点 = '未知';
  assert.equal(fillInitialRoleLocations(state, { 蕾拉妮: { 具体地点: '未知' } }, configured, 1), false);
});
