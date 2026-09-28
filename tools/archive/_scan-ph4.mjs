// _scan-ph4.mjs — 逐语句解析:用括号配对取 jdbc.update(...) 的完整参数区,再分离 SQL 串与 args
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files backend/src/main/java', { shell: true, encoding: 'utf8' })
  .split('\n').filter(f => f.endsWith('.java'));
const issues = [];
let total = 0;

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let idx = 0;
  while ((idx = src.indexOf('jdbc.update(', idx)) >= 0) {
    // 括号配对找该调用的结束
    let i = idx + 'jdbc.update('.length, depth = 1, inStr = false, esc = false;
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    const call = src.slice(idx + 'jdbc.update('.length, i - 1);
    idx = i;
    // 拆分:第一个顶层逗号之前 = SQL 表达式,之后 = 参数
    let d2 = 0, inS = false, e2 = false, splitAt = -1;
    for (let k = 0; k < call.length; k++) {
      const ch = call[k];
      if (e2) { e2 = false; continue; }
      if (ch === '\\') { e2 = true; continue; }
      if (ch === '"') { inS = !inS; continue; }
      if (inS) continue;
      if ('([{'.includes(ch)) d2++;
      else if (')]}'.includes(ch)) d2--;
      else if (ch === ',' && d2 === 0) { splitAt = k; break; }
    }
    if (splitAt < 0) continue;                     // 无参数
    const sqlExpr = call.slice(0, splitAt);
    const argsExpr = call.slice(splitAt + 1);
    // SQL 里含三元/变量拼接 → 跳过(动态)
    if (/[?:]/.test(sqlExpr.replace(/"[^"]*"/g, '')) || /\+\s*[A-Za-z_$][\w$]*\s*\+/.test(sqlExpr)) continue;
    const sql = [...sqlExpr.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => x[1]).join(' ');
    const ph = (sql.match(/\?/g) || []).length;
    if (!ph) continue;
    total++;
    // 参数个数:顶层逗号切分(带字符串/括号状态)
    let d3 = 0, inS3 = false, e3 = false, cnt = 0, any = false;
    for (let k = 0; k < argsExpr.length; k++) {
      const ch = argsExpr[k];
      if (e3) { e3 = false; continue; }
      if (ch === '\\') { e3 = true; continue; }
      if (ch === '"') { inS3 = !inS3; any = true; continue; }
      if (inS3) { any = true; continue; }
      if (ch.trim()) any = true;
      if ('([{'.includes(ch)) d3++;
      else if (')]}'.includes(ch)) d3--;
      else if (ch === ',' && d3 === 0) cnt++;
    }
    if (any) cnt++;
    if (ph !== cnt) issues.push(`${f.split(/[\\/]/).pop()}: ?=${ph} args=${cnt} :: ${sql.replace(/\s+/g, ' ').slice(0, 95)}`);
  }
}
console.log(`扫描 ${files.length} 文件 / ${total} 条静态含参 SQL | 不匹配: ${issues.length}`);
issues.forEach(x => console.log('  ' + x));
