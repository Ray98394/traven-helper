import assert from 'node:assert/strict';
import { isPortraitPresent, recentPortraitAppearances } from '../功能/立绘出场.ts';
import { splitDialogueForDisplay, splitSceneDialogue } from '../功能/多角色对话.ts';
import { narrativeOnly } from '../功能/消息过滤.ts';

const parseParts = (message, streaming) => splitDialogueForDisplay(splitSceneDialogue(narrativeOnly(message), '', streaming), streaming);

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
  { mes: '[乙.neutral]\n“这次仍在。”\n[丁.joy]\n“这次也在。”\n[旁白]\n场景。' },
];
assert.deepEqual(recentPortraitAppearances(chat, parseParts), {
  乙: { current: true, expression: 'neutral' },
  丁: { current: true, expression: 'joy' },
});
assert.deepEqual(recentPortraitAppearances([{ mes: '[甲.joy]\n“一楼。”\n[乙.neutral]\n“也在。”' }], parseParts), {
  甲: { current: true, expression: 'joy' }, 乙: { current: true, expression: 'neutral' },
});
assert.deepEqual(recentPortraitAppearances(chat, parseParts, '[丙.joy]\n“流式。\n[戊.'), {
  丙: { current: true, expression: 'joy' },
});
assert.deepEqual(recentPortraitAppearances(chat, parseParts, '[旁白]\n只有旁白。'), {});
assert.deepEqual(recentPortraitAppearances([...chat, { mes: '新问题', is_user: true }, { mes: '系统消息', is_system: true }], parseParts), {
  乙: { current: true, expression: 'neutral' },
  丁: { current: true, expression: 'joy' },
});
assert.deepEqual(recentPortraitAppearances([{ mes: '新问题', is_user: true }], parseParts), {});
assert.deepEqual(recentPortraitAppearances([...chat, { mes: '新问题', is_user: true }], parseParts, '[丙.joy]\n“新的回复。'), {
  丙: { current: true, expression: 'joy' },
});
assert.deepEqual(recentPortraitAppearances([{ mes: '[甲.default]\n她挥挥手。' }], parseParts), {});
assert.deepEqual(recentPortraitAppearances([{ mes: '[甲.default]\n她走到窗边，静静地望着远处，然后整理衣袖，缓缓回到了自己的座位上。'.repeat(3) }], parseParts), {});
assert.deepEqual(recentPortraitAppearances([{ mes: '[甲.default]\n她挥挥手。“你好。”\n[乙.joy]\n“欢迎。”' }], parseParts), {
  甲: { current: true, expression: 'default' }, 乙: { current: true, expression: 'joy' },
});
console.info('当前楼层与流式立绘状态检查通过');
