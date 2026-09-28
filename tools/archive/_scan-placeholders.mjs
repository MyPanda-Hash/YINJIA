// _scan-placeholders.mjs — 全项目扫描 jdbc.update 的 ? 数与参数数不匹配(2026-09-24,index out of range 类 bug 预防)
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files backend/src/main/java', { shell: true, encoding: 'utf8' })
  .split('\n').filter(f => f.endsWith('.java'));

const issues = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // 匹配 jdbc.update(...) 整块(到分号),允许多行
  const re = /jdbc\.update\(([\s\S]{0,1500}?)\);/g;
  let m;
  while ((m = re.exec(src))) {
    const body = m[1];
    // SQL 字面量部分(第一个字符串开始到最后一个字符串结束)
    // 简单法:把所有 "..." 串拼起来当 SQL;剩余部分当参数
    const strs = [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
    if (!strs.length) continue;
    // 判断是否有变量拼接(形如 + var + / + str(...) +)混在 SQL 中 → 跳过
    if (/\+\s*[A-Za-z_]/.test(body.slice(0, body.lastIndexOf('",')))) continue;
    const sql = strs.map(x => x[1]).join(' ');
    const vm = sql.match(/VALUES\s*\(([^)]*)\)/i);
    if (!vm) continue;
    const ph = (vm[1].match(/\?/g) || []).length;
    if (!ph) continue;
    // 参数 = body 中最后一个字符串之后的尾部
    const lastStrIdx = body.lastIndexOf('"');
    const tail = body.slice(lastStrIdx + 1).replace(/^\s*,\s*/, '');
    let depth = 0, cnt = 0;
    if (tail.trim()) {
      cnt = 1;
      for (const ch of tail) {
        if ('(['.includes(ch)) depth++;
        else if (')]'.includes(ch)) depth--;
        else if (ch === ',' && depth === 0) cnt++;
      }
    }
    if (ph !== cnt) issues.push(`${f.split(/[\\/]/).pop()}: ?=${ph} args=${cnt} :: ${sql.replace(/\s+/g, ' ').slice(0, 90)}`);
  }
}
console.log('扫描文件:', files.length, '| 疑似不匹配:', issues.length);
issues.forEach(x => console.log('  ' + x));
