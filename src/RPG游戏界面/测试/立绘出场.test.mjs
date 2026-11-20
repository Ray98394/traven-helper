import assert from 'node:assert/strict';
import { isPortraitPresent, recentPortraitAppearances } from '../功能/立绘出场.ts';
import { splitSceneDialogue } from '../功能/多角色对话.ts';
import { narrativeOnly } from '../功能/消息过滤.ts';

const parseParts = (message, streaming) => splitSceneDialogue(narrativeOnly(message), '', streaming);

assert.equal(isPortraitPresent('图书馆', '图书馆'), true);
assert.equal(isPortraitPresent('图书馆', '湖岸边'), false);
assert.equal(isPortraitPresent('未知', '未知'), false);
assert.equal(isPortraitPresent('图书馆', undefined), false);
assert.equal(isPortraitPresent('', '图书馆'), false);

const chat = [
  { mes: '[甲.neutral]\n很久之前。' },
  { mes: '用户消息', is_user: true },
  { mes: '[乙.joy]\n上一条。\n[丙.sadness]\n也在上一条。' },
  { mes: '系统消息', is_system: true },
  { mes: '[乙.neutral]\n这次仍在。\n[丁.joy]\n这次也在。\n[旁白]\n场景。' },
];
assert.deepEqual(recentPortraitAppearances(chat, parseParts), {
  乙: { current: true, expression: 'neutral' },
  丙: { current: false, expression: 'sadness' },
  丁: { current: true, expression: 'joy' },
});
assert.deepEqual(recentPortraitAppearances([{ mes: '[甲.joy]\n一楼。\n[乙.neutral]\n也在。' }], parseParts), {
  甲: { current: true, expression: 'joy' }, 乙: { current: true, expression: 'neutral' },
});
assert.deepEqual(recentPortraitAppearances(chat, parseParts, '[丙.joy]\n流式。\n[戊.', 4), {
  乙: { current: false, expression: 'joy' },
  丙: { current: true, expression: 'joy' },
});
assert.deepEqual(recentPortraitAppearances(chat, parseParts, '[旁白]\n只有旁白。', 4), {
  乙: { current: false, expression: 'joy' }, 丙: { current: false, expression: 'sadness' },
});
console.info('最近两条模型回复与流式立绘状态检查通过');
