import assert from 'node:assert/strict';
import { composeCharacterRoster, parseSceneRoster } from '../功能/世界书角色列表.ts';
import { index, roster } from '../功能/角色索引夹具.mjs';

const roles = parseSceneRoster(roster);
assert.deepEqual(Object.keys(roles), ['蕾拉妮', '艾琳', '爱丽丝', '莉娜', '艾尔莎', '薇奥拉']);
assert.equal(roles.艾琳.folder, '艾琳');
for (const name of ['蕾拉妮', '艾琳', '爱丽丝', '莉娜', '艾尔莎', '薇奥拉']) {
  assert.ok(roles[name].appearance, `${name}缺少外貌`);
  assert.ok(!('亲近' in roles[name].affectionBehaviors));
}
assert.match(roster, /兔兔酒馆的服务员/);
const updated = parseSceneRoster(`${roster}\n  # ignored comment\n`);
assert.deepEqual(Object.keys(updated), ['蕾拉妮', '艾琳', '爱丽丝', '莉娜', '艾尔莎', '薇奥拉']);
const added = parseSceneRoster('角色列表:\n  第三位:\n    info: 示例\n');
assert.equal(added.第三位.folder, '第三位');
assert.throws(() => parseSceneRoster('其他: true'), /角色列表/);
assert.deepEqual(parseSceneRoster('角色列表:\n  坏路径:\n    立绘目录: ../秘密\n'), {});
assert.throws(() => composeCharacterRoster('角色索引:\n  艾琳: {}'), /角色索引配置无效/);
assert.deepEqual(Object.keys(parseSceneRoster(composeCharacterRoster(index))), ['蕾拉妮', '艾琳', '爱丽丝', '莉娜', '艾尔莎', '薇奥拉']);
console.log('世界书角色列表、默认目录及非法路径检查通过');
