// _gen-perms-migration.mjs — 生成 智能供应链+品质管理 两模块的角色授权补齐迁移
// 口径照 migrate-rd-2026-newpanels-perm:按面板类型分档 perms,给既有角色补行(NOT EXISTS 幂等)
import fs from 'node:fs';

const { scm, qc } = JSON.parse(fs.readFileSync('tools/archive/_modpanels.json', 'utf8'));

// 分档:报表/明细/目录/看板类 = 只读+导出;其余单据/档案类 = 全权
const READONLY = new Set([
  ...scm.filter(p => /(_DETAIL|_STATS|STOCK_BALANCE|STOCK_LEDGER|STOCK_SUMMARY|_LIST|LOT_TRACE|QC_CATALOG|QC_INSP_REQ)/.test(p)),
  ...qc.filter(p => /(LOT_TRACE|QC_CATALOG|QC_INSP_REQ)/.test(p)),
]);
const rows = [...new Set([...scm, ...qc])].map(p => ({
  p,
  perms: READONLY.has(p) ? 'view,query,export,print' : 'view,query,add,modify,modlog,del,export',
}));

const vals = rows.map(r => `  (N'${r.p}', N'${r.perms}')`).join(',\n');
const sql = `-- migrate-scm-qc-perms-20260924.sql — 智能供应链+品质管理 两模块角色授权补齐(2026-09-24)
-- 【为什么需要】新面板只有 yj_panel/yj_field 行不足让**非管理员**看见:可见性走 yj_role_panel,
--   本库 51 个面板中大量无授权行(实测 30+)。本支按 migrate-rd-2026-newpanels-perm 同口径补齐。
-- 【perms 分档】报表/明细/统计/目录/追溯类=只读+导出(view,query,export,print);
--   单据/档案类=普通文书全权(view,query,add,modify,modlog,del,export)。
-- can_approve='N'(审批权由组织架构按角色单独勾,不替业务预设)。幂等:NOT EXISTS 按 role_id+panel_code。
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;

DECLARE @perms TABLE (panel_code nvarchar(40), perms nvarchar(400));
INSERT INTO @perms VALUES
${vals};

INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, p.panel_code, p.perms, 'N'
FROM yj_role r CROSS JOIN @perms p
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = p.panel_code);

SELECT N'补齐后授权行: ' + CAST(COUNT(*) AS varchar(10)) FROM yj_role_panel;
SELECT N'仍无授权面板: ' + CAST(COUNT(*) AS varchar(10)) FROM @perms p
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.panel_code = p.panel_code);
PRINT N'migrate-scm-qc-perms-20260924 完成';
GO
`;
fs.writeFileSync('tools/migrate-scm-qc-perms-20260924.sql', sql, 'utf8');
console.log('生成, 面板:', rows.length, '| 只读档:', rows.filter(r => r.perms.startsWith('view,query,export')).length);
