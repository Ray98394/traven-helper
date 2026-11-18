import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSceneRoster } from '../功能/世界书角色列表.ts';

const roster = readFileSync(new URL('../../场景角色卡/世界书/角色列表.yaml', import.meta.url), 'utf8');
const roles = parseSceneRoster(roster, { 艾琳: { fallback: 'embedded' }, 无关角色: { fallback: 'ignored' } });
assert.deepEqual(Object.keys(roles), ['蕾拉妮', '艾琳']);
assert.equal(roles.艾琳.folder, '艾琳');
assert.equal(roles.艾琳.fallback, 'embedded');
const updated = parseSceneRoster(`${roster}\n  # ignored comment\n`);
assert.deepEqual(Object.keys(updated), ['蕾拉妮', '艾琳']);
const added = parseSceneRoster('角色列表:\n  第三位:\n    info: 示例\n');
assert.equal(added.第三位.folder, '第三位');
assert.throws(() => parseSceneRoster('其他: true'), /角色列表/);
assert.deepEqual(parseSceneRoster('角色列表:\n  坏路径:\n    立绘目录: ../秘密\n'), {});
console.log('世界书角色列表、默认目录及非法路径检查通过');
