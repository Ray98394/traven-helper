import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterPreviousLocation } from '../功能/地点历史过滤.ts';

test('移除旧地点对话，保留当前地点和系统提示', () => {
  const messages = [{ message_id: 0, role: 'assistant', message: '开场' }, { message_id: 1, role: 'user', message: '湖边' }, { message_id: 2, role: 'assistant', message: '酒馆' }, { message_id: 3, role: 'user', message: '你好' }];
  const prompt = [{ role: 'system', content: '当前地点' }, ...messages.map(({ role, message }) => ({ role, content: message }))];
  assert.equal(filterPreviousLocation(prompt, messages, 2, item => item.message), 2);
  assert.deepEqual(prompt.map(item => item.content), ['当前地点', '酒馆', '你好']);
});

test('当前地点和旧地点内容相同，不能误删当前消息', () => {
  const messages = [{ message_id: 0, role: 'user', message: '你好' }, { message_id: 1, role: 'user', message: '你好' }];
  const prompt = messages.map(({ role, message }) => ({ role, content: message }));
  assert.equal(filterPreviousLocation(prompt, messages, 1, item => item.message), 0);
  assert.equal(prompt.length, 2);
});
