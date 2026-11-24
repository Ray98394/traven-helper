import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectDayLines, memorySummaryPrompt, parseDailyMemories } from '../功能/角色记忆.ts';

const lines = [{ location: '兔兔酒馆', present: ['爱丽丝'], role: 'user', text: '请爱丽丝喝酒' }];
test('没有玩家消息的在场剧情也会保留，缺少快照的玩家楼层继承上一条地点', () => {
  const stat = { time: { day: 2 }, player: { area: { place: '兔兔酒馆' } }, locations: { 兔兔酒馆: { present: ['爱丽丝'] } } };
  const history = [{ message_id: 0, role: 'assistant', text: '开场', stat }, { message_id: 1, role: 'assistant', text: '爱丽丝来了', stat }, { message_id: 2, role: 'user', text: '你好' }];
  const collected = collectDayLines(history, 2, ['爱丽丝']);
  assert.equal(collected.length, 2);
  assert.deepEqual(collected[1].present, ['爱丽丝']);
  history.push({ message_id: 3, role: 'assistant', text: '到了家', stat: { time: { day: 2 }, player: { area: { place: '玩家的家' } }, locations: {} } });
  assert.deepEqual(collectDayLines(history, 2, ['爱丽丝'])[2].present, []);
});
test('总结只保存有对应地点和在场记录的角色', () => {
  const result = parseDailyMemories('```json\n{"爱丽丝":[{"location":"兔兔酒馆","text":"玩家请她喝酒。"}]}\n```', lines, 1, '1830年9月5日 星期日');
  assert.equal(result.爱丽丝[0].day, 1);
  assert.throws(() => parseDailyMemories('{"莉娜":[{"location":"兔兔酒馆","text":"聊天"}]}', lines, 1, '日期'));
  assert.throws(() => parseDailyMemories('{"爱丽丝":[{"location":"湖岸边","text":"聊天"}]}', lines, 1, '日期'));
  assert.throws(() => parseDailyMemories('{"爱丽丝":[{"location":"兔兔酒馆","text":"聊天"},{"location":"兔兔酒馆","text":"喝酒"}]}', lines, 1, '日期'), /重复/);
  assert.throws(() => parseDailyMemories(JSON.stringify({ 爱丽丝: [{ location: '兔兔酒馆', text: '长'.repeat(121) }] }), lines, 1, '日期'), /超过120字/);
  assert.match(memorySummaryPrompt('日期', lines), /不代表听到私人对话/);
});
