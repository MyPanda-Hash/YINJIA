// _analyze.cjs — 服务器备份 vs 本地库:未登记对象比对(一次性探针)
const fs = require('fs');
const objs = fs.readFileSync(__dirname + '/local-objects.txt', 'utf8')
  .split(/\r?\n/).filter(l => /^[TV] /.test(l)).map(l => ({ k: l[0], n: l.slice(2).trim() }));
const txt = fs.readFileSync('tools/db-inuse-tables.txt', 'utf8');
const regT = new Set([...txt.matchAll(/^table:(\S+)/gm)].map(m => m[1]));
const doc = fs.readFileSync('docs/development/数据库表清单.md', 'utf8');
// 文档表格行里第一列的反引号对象名(表与视图都这样登记)
const docNames = new Set([...doc.matchAll(/\|\s*`([A-Za-z_][A-Za-z0-9_]*)`\s*\|/g)].map(m => m[1]));
const missV = objs.filter(o => o.k === 'V' && !docNames.has(o.n));
console.log('--- 本地未登记视图(' + missV.length + ') ---');
missV.forEach(o => console.log(' ', o.n));
// 迁移链定位:db-migrations.txt 里最后一条已在服务器 log 的脚本
const chain = fs.readFileSync('tools/db-migrations.txt', 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
const srvLog = fs.readFileSync(__dirname + '/srv-log.txt', 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const srvSet = new Set(srvLog);
let lastIdx = -1, last = '';
chain.forEach((l, i) => { const name = l.trim().split(/[ \t]/)[0]; if (srvSet.has(name)) { lastIdx = i; last = name; } });
console.log('--- 服务器迁移链定位 ---');
console.log('链总条目(去注释):', chain.length, ' 服务器已登:', srvLog.length);
console.log('链上最后已执行:', lastIdx >= 0 ? (lastIdx + 1) + '/' + chain.length + '  ' + last : '(链外)');
const chainMissing = chain.map(l => l.trim().split(/[ \t]/)[0]).filter(n => !srvSet.has(n));
console.log('链上服务器未执行(' + chainMissing.length + '):');
chainMissing.forEach(n => console.log('  ', n));
