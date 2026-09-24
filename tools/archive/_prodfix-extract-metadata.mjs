// 从生产域迁移脚本中抽「纯元数据批次」(只含 INSERT INTO yj_panel/yj_field/yj_role_panel),
// 生成 tools/archive/_prodfix-metadata.sql —— 用于修复回滚期被清空的生产面板元数据
// (老脚本因后续迁移裁剪了列而不可整体重放:CREATE VIEW 引用 生产车间 会报「列名无效」)。
// 用法: node tools/archive/_prodfix-extract-metadata.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
// [脚本, 批次号] —— 批次号经 _inspect 确认只含元数据 INSERT
const PLAN = [
  ['migrate-manu-order-schedule.sql', 6],
  ['migrate-schedule-plan-form.sql', 3],
  ['migrate-schedule-capacity.sql', 4],
  ['migrate-panel-flow.sql', 3],
];

const batchesOf = (text) => {
  const out = [];
  let cur = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*GO\s*$/i.test(line)) { out.push(cur); cur = []; continue; }
    cur.push(line);
  }
  out.push(cur);
  return out;
};

const parts = [];
for (const [file, n] of PLAN) {
  const text = fs.readFileSync(path.join(root, 'tools', file), 'utf8');
  const b = batchesOf(text)[n - 1];
  if (!b) throw new Error(`${file} 无第 ${n} 批`);
  const sql = b.join('\n').trim();
  const bad = /CREATE (VIEW|TABLE)|DROP VIEW|ALTER TABLE|sp_rename/i.test(sql);
  if (bad) throw new Error(`${file} 第 ${n} 批含 DDL,不适合抽取`);
  parts.push(`-- ── 摘自 tools/${file} 第 ${n} 批(纯元数据 INSERT,含 IF NOT EXISTS 守卫,幂等) ──\n${sql}`);
}

const header = `-- _prodfix-metadata.sql — 生产域面板元数据补登记(一次性修复,2026-09-24)
-- 背景:下拉生产域分支后,本地两账套的 LINE_LOAD / MANU_SCHEDULE 面板字段注册缺失
--   (回滚期清理把生产面板元数据清空;PROD_LINE/OP_TIME/PROD_ABN 已随各自脚本恢复)。
-- 为什么不重跑原脚本:迁移链是**单向**的 —— migrate-manu-order-schedule / migrate-panel-flow /
--   migrate-schedule-plan-form / migrate-schedule-capacity 的 CREATE VIEW 引用 bd_manu_order.[生产车间],
--   该列已被 migrate-manu-prune-legacy.sql 裁剪 ⇒ 整体重放必报「列名 '生产车间' 无效」,
--   且 DbSync 遇错**中止后续脚本**,元数据批次永远跑不到(2026-09-24 实测)。
-- 因此只抽这些脚本里的**纯元数据批次**单独执行(全部带 IF NOT EXISTS 守卫,幂等可重跑)。
-- ⚠ 一次性修复脚本:不改迁移链,不入 db-migrations.txt;两账套各跑一次即可。
SET NOCOUNT ON;

`;
fs.writeFileSync(path.join(root, 'tools', 'archive', '_prodfix-metadata.sql'), header + parts.join('\n\n') + '\nGO\n');
console.log('已生成 tools/archive/_prodfix-metadata.sql,包含批次:', PLAN.map(([f, n]) => `${f}#${n}`).join(', '));
