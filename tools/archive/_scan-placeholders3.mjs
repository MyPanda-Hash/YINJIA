// _scan-placeholders3.mjs — 占位符审计终版:整条 SQL 的全部 ? 数 vs 参数个数(逐条人工可核)
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files backend/src/main/java', { shell: true, encoding: 'utf8' })
  .split('\n').filter(f => f.endsWith('.java'));

const issues = [];
let total = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /jdbc\.update\(([\s\S]{0,2500}?)\);\r?\n/g;
  let m;
  while ((m = re.exec(src))) {
    const body = m[1];
    const firstQ = body.indexOf('"');
    const lastQ = body.lastIndexOf('"');
    if (firstQ < 0 || lastQ <= firstQ) continue;
    const sqlPart = body.slice(firstQ, lastQ + 1);
    // SQL 里混入变量拼接(形如 + col + / + f(x) +)则跳过:占位符是动态的
    if (/\+\s*[A-Za-z_$][\w$]*\s*\+/.test(sqlPart) || /\+\s*[A-Za-z_$][\w$]*\(/.test(sqlPart)) continue;
    const sql = sqlPart.replace(/"\s*\+\s*"/g, '').replace(/^"|"$/g, '').replace(/\\"/g, '"');
    const ph = (sql.match(/\?/g) || []).length;
    if (!ph) continue;
    total++;
    const tail = body.slice(lastQ + 1).replace(/^\s*,\s*/, '').trim();
    let depth = 0, inStr = false, cnt = 0;
    if (tail) {
      cnt = 1;
      for (let i = 0; i < tail.length; i++) {
        const ch = tail[i];
        if (ch === '"' && tail[i - 1] !== '\\') inStr = !inStr;
        if (inStr) continue;
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
        else if (ch === ',' && depth === 0) cnt++;
      }
    }
    if (ph !== cnt) issues.push(`${f.split(/[\\/]/).pop()}: ?=${ph} args=${cnt} :: ${sql.replace(/\s+/g, ' ').slice(0, 100)}`);
  }
}
console.log(`扫描 ${files.length} 文件 / ${total} 条含参 SQL | 不匹配: ${issues.length}`);
issues.forEach(x => console.log('  ' + x));
