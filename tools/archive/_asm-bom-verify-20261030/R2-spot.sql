SET NOCOUNT ON;
SELECT 'R2-panel' AS what, COUNT(*) AS cnt FROM yj_panel WHERE panel_code='ASM_BOM';
GO
SELECT 'R2-field' AS what, COUNT(*) AS cnt,
       SUM(CASE WHEN COL_LENGTH('dbo.bs_asm_bom', col_name) IS NULL THEN 1 ELSE 0 END) AS miss_col FROM yj_field WHERE panel_code='ASM_BOM';
GO
SELECT 'R2-rows' AS what, COUNT(*) AS rows_cnt, COUNT(DISTINCT 单据编号) AS docs, COUNT(DISTINCT 产品编码) AS prods FROM bs_asm_bom;
GO
SELECT 'R2-工序非组装' AS what, COUNT(*) AS cnt FROM bs_asm_bom WHERE 工序 <> N'组装';
GO
SELECT 'R2-用量偏差' AS what, COUNT(*) AS cnt FROM bs_asm_bom WHERE ABS(标准用量 - ROUND(用量分子/用量分母,4)) > 0.00005;
GO
SELECT 'R2-行序异常单' AS what, COUNT(*) AS cnt FROM (
  SELECT 单据编号 FROM bs_asm_bom GROUP BY 单据编号
  HAVING MIN(行序)<>1 OR MAX(行序)<>COUNT(*) OR COUNT(DISTINCT 行序)<>COUNT(*)) x;
GO
SELECT 'R2-一单多产品' AS what, COUNT(*) AS cnt FROM (
  SELECT 单据编号 FROM bs_asm_bom GROUP BY 单据编号 HAVING COUNT(DISTINCT 产品编码)>1) x;
GO
SELECT 'R2-面板译名语言数' AS what, COUNT(DISTINCT locale) AS cnt FROM yj_translation WHERE scope='panel' AND ref_key=N'组装物料清单';
GO
SELECT 'R2-字段缺en' AS what, COUNT(*) AS cnt FROM (
  SELECT DISTINCT label FROM yj_field f WHERE f.panel_code='ASM_BOM'
    AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en')) x;
GO
SELECT 'R2-授权行' AS what, COUNT(*) AS cnt FROM yj_role_panel WHERE panel_code='ASM_BOM';
GO
SELECT 'R2-角色数' AS what, COUNT(*) AS cnt FROM yj_role;
GO
SELECT 'R2-schema_log' AS what, script_name, content_hash FROM yj_schema_log
WHERE script_name IN (N'migrate-asm-bom-20261030.sql', N'migrate-asm-bom-data-20261030.sql') ORDER BY script_name;
GO
