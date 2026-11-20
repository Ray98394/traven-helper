import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWorldbookSync } from './世界书同步.ts';

const sources = { init: '初始化', rules: '规则', roster: '角色' };
test('只更新三个唯一匹配条目的内容，不改变其他条目', () => {
  const entries = [
    { uid: 1, name: '[initvar]变量初始化勿开', content: '旧初始化' },
    { uid: 2, name: '[mvu_update]变量更新规则', content: '规则' },
    { uid: 3, name: '角色列表', content: '旧角色' },
    { uid: 4, name: '其他设定', content: '保留' },
  ];
  const result = planWorldbookSync(entries, sources);
  assert.deepEqual([...result.updates], [[1, '初始化'], [3, '角色']]);
  assert.deepEqual(result.skipped, []);
  assert.equal(entries[3].content, '保留');
});

test('缺失或重名条目不更新', () => {
  const result = planWorldbookSync([
    { uid: 1, name: '角色列表', content: '旧' },
    { uid: 2, name: '角色列表', content: '旧' },
  ], sources);
  assert.equal(result.updates.size, 0);
  assert.deepEqual(result.skipped, ['初始化变量', '变量更新规则', '角色列表']);
});
