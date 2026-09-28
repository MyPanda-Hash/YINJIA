/** 11 个语言包语法校验(ESM export default → 转 CJS 后 eval) */
const fs = require('fs');
const dir = 'D:/workspace/yinjia/frontend/src/i18n/locales/';
let bad = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(dir + f, 'utf8');
  const cjs = src.replace(/export\s+default\s*/, 'module.exports = ');
  try { new Function('module', 'exports', cjs)({ exports: {} }, {}); }
  catch (e) { bad++; console.log('SYNTAX FAIL ' + f + ' → ' + e.message); }
}
console.log(bad ? '有 ' + bad + ' 个语言包语法错误' : 'OK 语言包全部语法通过');
