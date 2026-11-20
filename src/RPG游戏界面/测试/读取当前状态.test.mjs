import assert from 'node:assert/strict';
import { readCurrentStat } from '../功能/读取当前状态.ts';

const old = { 玩家: { 具体地点: '湖岸边' }, 攻略角色: { 蕾拉妮: { 具体地点: '湖岸边' } } };
const current = { 玩家: { 具体地点: '图书馆' }, 攻略角色: { 蕾拉妮: { 具体地点: '湖岸边' } } };
const read = values => id => values[id];
assert.equal(readCurrentStat(2, read([old, current, {}])), current);
assert.equal(readCurrentStat(2, read([old, undefined, undefined])), old);
assert.equal(readCurrentStat(1, read([old, current])), current);
const unknown = { 玩家: { 具体地点: '未知' }, 攻略角色: {} };
assert.equal(readCurrentStat(1, read([old, unknown])), unknown);
assert.equal(readCurrentStat(1, read([undefined, {}])), undefined);
