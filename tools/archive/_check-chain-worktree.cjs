/** 磁盘 tools/*.sql vs 工作区 db-migrations.txt(本地真实链) —— 哪些迁移没登记(DbSync 永不执行) */
const fs = require('fs');
const root = 'D:/workspace/yinjia';
const chain = fs.readFileSync(root + '/tools/db-migrations.txt', 'utf8').split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split(/\s+/)[0]).filter((l) => /\.sql$/i.test(l));
const chainSet = new Set(chain);
const onDisk = fs.readdirSync(root + '/tools').filter((f) => f.endsWith('.sql'));
const unreg = onDisk.filter((f) => !chainSet.has(f)).sort();
console.log('链(工作区)登记数: ' + chainSet.size + '   磁盘 scripts: ' + onDisk.length);
console.log('\n=== 未登记(不会被执行) 共 ' + unreg.length + ' 个 ===');
unreg.forEach((f) => {
  const mig = /^migrate-/i.test(f);
  console.log((mig ? '  [迁移] ' : '  [工具] ') + f);
});
