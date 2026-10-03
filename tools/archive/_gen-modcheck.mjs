// _gen-modcheck.mjs — 生成 智能供应链/品质管理 两模块的面板存在性+授权核对 SQL
import fs from 'node:fs';
const { scm, qc } = JSON.parse(fs.readFileSync('tools/archive/_modpanels.json', 'utf8'));
const all = [...new Set([...scm, ...qc])];
const vals = all.map(p => `(N'${p}')`).join(',');
const sql = [
  'SET NOCOUNT ON;',
  `SELECT N'缺失面板' AS 问题, v.p AS 面板 FROM (VALUES ${vals}) v(p) WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = v.p);`,
  `SELECT N'无授权行' AS 问题, v.p AS 面板 FROM (VALUES ${vals}) v(p) WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = v.p);`,
  `SELECT N'面板总数' AS 项, CAST(COUNT(*) AS varchar(10)) AS 值 FROM yj_panel WHERE panel_code IN (SELECT p FROM (VALUES ${vals}) v(p));`,
  `SELECT N'授权行总数' AS 项, CAST(COUNT(*) AS varchar(10)) AS 值 FROM yj_role_panel WHERE panel_code IN (SELECT p FROM (VALUES ${vals}) v(p));`,
].join('\n');
fs.writeFileSync('tools/archive/_chkmod.sql', sql + '\n', 'utf8');
console.log('生成, 覆盖面板数:', all.length);
