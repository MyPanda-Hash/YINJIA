/**
 * 生产域模块:本地工作区 vs 最后已知远端(origin/main=HEAD) 逐文件比对
 * 输出:①本地改动的生产域源码(M) ②本地新增/远端没有的(??) ③非静态的源码删除(D) ④改动规模
 */
const { execSync } = require('child_process');
const run = (cmd) => execSync(cmd, { cwd: 'D:/workspace/yinjia', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lines = run('git status --porcelain').split(/\r?\n/).filter(Boolean);
const rows = lines.map((l) => ({ x: l[0] === ' ' ? l[1] : l[0], y: l[1], path: l.slice(3).replace(/^"|"$/g, '') }));
const isStatic = (p) => p.includes('resources/static/') || p.endsWith('dist/');
const isProd = (p) => /(views\/modules\/plan\/|business\/print-formats|ScheduleBoardService|OrderConvertService|QuickScheduleService|ManuWritebackService|manu\/|Manu[A-Z]|ScheduleBoardController|OrderConvertController|ProdLineController|migrate-manu|migrate-line|line-open|print-formats|MANU)/i.test(p);
const isSrc = (p) => /\.(java|vue|js|sql|md|txt|json|bat|ps1|cjs|mjs|ts)$/i.test(p);
const m = rows.filter((r) => (r.x === 'M' || r.y === 'M') && !isStatic(r.path));
const u = rows.filter((r) => r.x === '?' && !isStatic(r.path) && isSrc(r.path));
const d = rows.filter((r) => r.x === 'D' || r.y === 'D').filter((r) => !isStatic(r.path));
console.log('本地工作区 vs HEAD:  M=' + rows.filter((r) => /M/.test(r.x + r.y)).length
  + '  D=' + rows.filter((r) => /D/.test(r.x + r.y)).length
  + '  ??.all=' + rows.filter((r) => r.x === '?').length + '\n');
console.log('=== ① 本地改动(M,非 static) 共 ' + m.length + ' ===');
m.forEach((r) => console.log('  [' + (isProd(r.path) ? '生产域' : '  其他') + '] ' + r.path));
console.log('\n=== ② 本地新增、远端不存在(??,源码类) 共 ' + u.length + ' ===');
u.forEach((r) => console.log('  [' + (isProd(r.path) ? '生产域' : '  其他') + '] ' + r.path));
console.log('\n=== ③ 源码删除(D,非 static) 共 ' + d.length + ' ===');
d.forEach((r) => console.log('  ' + r.path));
