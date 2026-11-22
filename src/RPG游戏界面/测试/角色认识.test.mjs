import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displaySpeaker, knowsRole, readKnowledge } from '../功能/角色认识.ts';

test('只遮罩未知角色的发言者标题，不修改其他姓名', () => {
  const state = readKnowledge({ 蕾拉妮: { known: true }, 艾琳: { known: [false, '说明'] } });
  assert.equal(displaySpeaker('艾琳', state), '？？？');
  assert.equal(displaySpeaker('蕾拉妮', state), '蕾拉妮');
  assert.equal(displaySpeaker('旁白', state), '旁白');
  assert.equal(displaySpeaker('路人', state), '路人');
  assert.equal(displaySpeaker('艾琳', { ...state, 艾琳: true }), '艾琳');
});
test('只读取明确存在的认识状态，支持 MVU 数组封装', () => {
  assert.equal(knowsRole({ known: [true, '说明'] }), true);
  assert.deepEqual(readKnowledge({ 艾琳: { affection: 25 }, 蕾拉妮: { known: true } }), { 蕾拉妮: true });
});
