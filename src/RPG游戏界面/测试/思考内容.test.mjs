import test from 'node:test';
import assert from 'node:assert/strict';
import { narrativeOnly, reasoningForDisplay } from '../功能/消息过滤.ts';

test('展示原生和标签中的思考内容，不混入变量更新分析', () => {
  const text = '<think>分析剧情</think>\n[旁白]\n她点点头。\n<UpdateVariable><Analysis>计算好感</Analysis></UpdateVariable>';
  assert.equal(reasoningForDisplay(text, '原生推理'), '原生推理\n\n分析剧情');
  assert.equal(narrativeOnly(text).trim(), '[旁白]\n她点点头。');
  assert.equal(reasoningForDisplay('<thinking>正在思考'), '正在思考');
  assert.equal(reasoningForDisplay('<think>相同</think>', '相同'), '相同');
  assert.equal(reasoningForDisplay('<UpdateVariable><Analysis>变量分析</Analysis></UpdateVariable>'), '');
  assert.equal(reasoningForDisplay('正文', undefined), '');
});
