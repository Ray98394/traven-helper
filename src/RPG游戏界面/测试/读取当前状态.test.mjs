import assert from 'node:assert/strict';
import { readCurrentStat } from '../功能/读取当前状态.ts';

const old = { player: { area: { region: '湖泊', place: '湖岸边' } }, characters: { 蕾拉妮: { area: { region: '湖泊', place: '湖岸边' } } } };
const current = { player: { area: { region: '学院', place: '图书馆' } }, characters: { 蕾拉妮: { area: { region: '湖泊', place: '湖岸边' } } } };
const read = values => id => values[id];
assert.equal(readCurrentStat(2, read([old, current, {}])), current);
assert.equal(readCurrentStat(2, read([old, undefined, undefined])), old);
assert.equal(readCurrentStat(1, read([old, current])), current);
const unknown = { player: { area: { region: '未知', place: '未知' } }, characters: {} };
assert.equal(readCurrentStat(1, read([old, unknown])), unknown);
assert.equal(readCurrentStat(1, read([undefined, {}])), undefined);
