/* eslint-disable */
// @ts-nocheck
import _ from 'lodash';
import fs from 'node:fs';
import path from 'node:path';
<<<<<<< HEAD
import { pathToFileURL } from 'node:url';
import z from 'zod';

for (const schema_file of fs.globSync('src/**/schema.ts')) {
  try {
    globalThis._ = _;
    globalThis.z = z;
    const module = await import(pathToFileURL(path.resolve(import.meta.dirname, schema_file)).href);
    if (_.has(module, 'Schema')) {
      let schema = _.get(module, 'Schema');
=======
import z from 'zod';

fs.globSync('src/**/schema.ts').forEach(async schema_file => {
  try {
    globalThis._ = _;
    globalThis.z = z;
    const module = await import(
      (process.platform === 'win32' ? 'file://' : '') + path.resolve(import.meta.dirname, schema_file)
    );
    if (_.has(module, 'Schema')) {
      const schema = _.get(module, 'Schema');
>>>>>>> 884ced41021768bed2bf7e03c14e0da9ce08e010
      if (_.isFunction(schema)) {
        schema = schema();
      }
      fs.writeFileSync(
        path.join(path.dirname(schema_file), 'schema.json'),
        JSON.stringify(z.toJSONSchema(schema, { io: 'input', reused: 'ref' }), null, 2),
      );
    }
  } catch (e) {
    console.error(`生成 '${schema_file}' 对应的 schema.json 失败: ${e}`);
<<<<<<< HEAD
    process.exitCode = 1;
  }
}
=======
  }
});
>>>>>>> 884ced41021768bed2bf7e03c14e0da9ce08e010
