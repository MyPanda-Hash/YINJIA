/** 逐个读出 9 个未登记 migrate-* 脚本的头部说明(供用户判断是否故意禁入) */
const fs = require('fs');
const root = 'D:/workspace/yinjia/tools/';
const list = ['migrate-golive-cleanup.sql', 'migrate-testdata-cleanup.sql', 'migrate-rd-cleanup.sql',
  'migrate-table-comments.sql', 'migrate-basedata-query-fields.sql', 'migrate-restore-gfda.sql',
  'migrate-spec-testlib-replace.sql'];
for (const f of list) {
  const p = root + f;
  if (!fs.existsSync(p)) { console.log('== ' + f + ' : 文件不存在'); continue; }
  const txt = fs.readFileSync(p, 'utf8');
  const size = fs.statSync(p).size;
  const head = txt.split(/\r?\n/).filter((l) => l.trim().startsWith('--')).slice(0, 4)
    .map((l) => l.replace(/\s+/g, ' ').trim()).join(' ');
  // 是否破坏性
  const destructive = /DELETE FROM|DROP TABLE|TRUNCATE|SHRINK|UPDATE .* SET/i.test(txt);
  console.log('== ' + f + '  (' + size + 'B)' + (destructive ? '  ⚠含删/改' : ''));
  console.log('   ' + head.slice(0, 300));
}
