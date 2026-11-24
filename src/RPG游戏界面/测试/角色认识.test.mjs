import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displaySpeaker, knowsRole, readKnowledge } from '../功能/角色认识.ts';

test('只读取明确存在的认识状态，支持 MVU 数组封装', () => {
  assert.equal(knowsRole({ known: [true, '说明'] }), true);
  assert.deepEqual(readKnowledge({ 艾琳: { affection: 25 }, 蕾拉妮: { known: true } }), { 蕾拉妮: true });
});

test('未知角色显示问号，认识后显示姓名，其他名称不遮罩', () => {
  const state = readKnowledge({ 艾琳: { known: false }, 蕾拉妮: { known: true } });
  assert.equal(displaySpeaker('艾琳', state), '？？？');
  assert.equal(displaySpeaker('蕾拉妮', state), '蕾拉妮');
  assert.equal(displaySpeaker('路人', state), '路人');
});
