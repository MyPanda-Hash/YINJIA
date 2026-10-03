// _scan-placeholders2.mjs — 精确版:解析 jdbc.update 的 SQL 字符串与参数列表,只在参数为「简单标识符序列」时比对
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files backend/src/main/java', { shell: true, encoding: 'utf8' })
  .split('\n').filter(f => f.endsWith('.java'));

const issues = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /jdbc\.update\(([\s\S]{0,2500}?)\);\r?\n/g;
  let m;
  while ((m = re.exec(src))) {
    const body = m[1];
    // 找 SQL:从第一个 " 到最后一个 " 连续字符串(允许 + 连接与换行)
    const firstQ = body.indexOf('"');
    const lastQ = body.lastIndexOf('"');
    if (firstQ < 0 || lastQ <= firstQ) continue;
    const sqlPart = body.slice(firstQ, lastQ + 1);
    // 若 SQL 部分含 + 变量(非纯字符串拼接) → 跳过
    if (/\+\s*[A-Za-z_$][\w$]*\s*\+/.test(sqlPart) || /\+\s*[A-Za-z_$][\w$]*\(/.test(sqlPart)) continue;
    const sql = sqlPart.replace(/"\s*\+\s*"/g, '').replace(/^"|"$/g, '').replace(/\\"/g, '"');
    const vm = sql.match(/VALUES\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/i);
    if (!vm) continue;
    const ph = (vm[1].match(/\?/g) || []).length;
    if (!ph) continue;
    // 参数:最后一个 " 之后的尾部
    const tail = body.slice(lastQ + 1).replace(/^\s*,\s*/, '').trim();
    if (!tail) { issues.push(`${f.split(/[\\/]/).pop()}: ?=${ph} args=0 :: ${sql.replace(/\s+/g,' ').slice(0,80)}`); continue; }
    // 按顶层逗号切分
    let depth = 0, parts = [], cur = '';
    for (const ch of tail) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    const cnt = parts.length;
    if (ph !== cnt) issues.push(`${f.split(/[\\/]/).pop()}: ?=${ph} args=${cnt} :: ${sql.replace(/\s+/g,' ').slice(0,80)}`);
  }
}
console.log('扫描:', files.length, '文件 | 不匹配:', issues.length);
issues.forEach(x => console.log('  ' + x));
