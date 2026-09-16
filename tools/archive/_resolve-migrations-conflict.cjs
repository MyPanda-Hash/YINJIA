// _resolve-migrations-conflict.cjs — db-migrations.txt 冲突解决:
// 远程版(origin/main,含128a5be的必填项迁移+此前全部条目)为底,追加本地未提交的 号池清理 条目
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const file = path.join(root, 'tools', 'db-migrations.txt');

// 1) 远程权威版内容
const remote = execSync('git show origin/main:tools/db-migrations.txt', { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');

// 2) 本地要保留的追加块(从 stash 版尾部截取:qc-recv-pool-clean 条目)
const stashed = execSync('git show "stash@{0}":tools/db-migrations.txt', { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
const marker = 'migrate-qc-recv-pool-clean.sql';
const mIdx = stashed.indexOf(marker);
if (mIdx < 0) throw new Error('stash 版里找不到 pool-clean 条目');
// 向前取到该条目注释块起点(找该块前的空行边界)
let blockStart = stashed.lastIndexOf('\n\n', mIdx);
if (blockStart < 0) throw new Error('找不到条目块起点');
let block = stashed.slice(blockStart); // 含尾部换行
block = block.replace(/\n+$/, '\n');

// 3) 需要确保在列的本地迁移(此前某次清单合并时被弄丢的断点 + 本次新增),缺席则补
const LOCAL_BLOCKS = [
  {
    file: 'migrate-qc-return-attach.sql',
    comment: [
      '# —— 2026-09-15 暂收退料单补 6 附件列位(头表 6 列 + yj_field dataType=附件,页面单附件格聚合;同 QC_INSP/SL_RECV)——',
      '# 前端零改动(附件区由 data_type 驱动 + curDocNo 兜底);译名附件1..6 为全局共享词条已有。幂等可重跑。',
    ],
  },
  {
    file: 'migrate-qc-return-module.sql',
    comment: ['# —— 2026-09-15 暂收退料单归入库存核算(yj_panel.module_group 同步菜单,权限分组/同模块读放行口径一致)——'],
  },
  {
    file: 'migrate-qc-recv-pool-clean.sql',
    comment: ['# —— 2026-09-15 暂收入库单号池残留清理(s_allno 3 行 ZS 记录;主体下线见 migrate-qc-recv-drop.sql)——'],
  },
];
const missing = LOCAL_BLOCKS.filter((b) => !remote.includes(b.file));
let out = remote.replace(/\n+$/, '\n');
for (const b of missing) {
  out += '\n' + b.comment.join('\n') + '\n' + b.file + '\n';
}

// 4) 校验:无冲突标记;关键迁移全在列
const checks = {
  noMarkers: !/[<>=]{7}/.test(out),
  hasRequired: out.includes('migrate-doc-required-fields.sql'),
  hasRecvDrop: out.includes('migrate-qc-recv-drop.sql'),
  hasReturnAttach: out.includes('migrate-qc-return-attach.sql'),
  hasReturnModule: out.includes('migrate-qc-return-module.sql'),
  hasPoolClean: out.includes('migrate-qc-recv-pool-clean.sql'),
};
console.log('补登:', missing.map((b) => b.file).join(', ') || '(无)');
console.log('校验:', JSON.stringify(checks));
if (Object.values(checks).some((v) => !v)) throw new Error('校验未通过,不写回');

fs.writeFileSync(file, out);
console.log('已写回,总行数:', out.split('\n').length);
