SET NOCOUNT ON;
PRINT '=== A. 计量单位档案 bs_uom ===';
SELECT TOP 40 计量单位编码, 计量单位名称 FROM bs_uom WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
GO
PRINT '=== B. 单据里实际用到的计量单位 vs 档案命中 ===';
SELECT 来源, 计量单位, COUNT(*) AS 行数,
       CASE WHEN EXISTS (SELECT 1 FROM bs_uom u WHERE RTRIM(u.计量单位名称) = RTRIM(t.计量单位) AND ISNULL(u.asp_cancel,'N')<>'Y') THEN N'命中' ELSE N'缺档' END AS 档案
FROM (
  SELECT N'材料出库行' AS 来源, 计量单位 FROM bl_material_out WHERE ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL SELECT N'采购入库行', 计量单位 FROM bl_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL SELECT N'商品档案', 计量单位 FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y'
) t WHERE t.计量单位 IS NOT NULL AND RTRIM(t.计量单位) <> ''
GROUP BY 来源, 计量单位 ORDER BY 来源, 行数 DESC;
GO
PRINT '=== C. 生产车间 值 vs 部门档案 ===';
SELECT 来源, 生产车间, COUNT(*) AS 行数,
       CASE WHEN EXISTS (SELECT 1 FROM bs_dept d WHERE RTRIM(d.部门名称) = RTRIM(t.生产车间) AND ISNULL(d.asp_cancel,'N')<>'Y') THEN N'命中' ELSE N'缺档' END AS 部门档案
FROM (
  SELECT N'材料出库头' AS 来源, 生产车间 FROM bd_material_out WHERE ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL SELECT N'产成品入库头', 生产车间 FROM bd_finish_in WHERE ISNULL(asp_cancel,'N')<>'Y'
) t WHERE t.生产车间 IS NOT NULL AND RTRIM(t.生产车间) <> ''
GROUP BY 来源, 生产车间 ORDER BY 来源, 行数 DESC;
GO
PRINT '=== D. 仓库值 vs 仓库档案(材料出库)===';
SELECT 仓库, COUNT(*) AS 行数,
       CASE WHEN EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(t.仓库) AND ISNULL(w.asp_cancel,'N')<>'Y') THEN N'命中' ELSE N'缺档' END AS 仓库档案
FROM bl_material_out t WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓库 IS NOT NULL AND RTRIM(仓库) <> ''
GROUP BY 仓库 ORDER BY 行数 DESC;
GO
PRINT '=== E. 领用人 vs 员工档案(材料出库)==='; 
SELECT 领用人, COUNT(*) AS 行数,
       CASE WHEN EXISTS (SELECT 1 FROM bs_emp e WHERE RTRIM(e.员工名称) = RTRIM(t.领用人) AND ISNULL(e.asp_cancel,'N')<>'Y') THEN N'命中' ELSE N'缺档' END AS 员工档案
FROM bd_material_out t WHERE ISNULL(asp_cancel,'N')<>'Y' AND 领用人 IS NOT NULL AND RTRIM(领用人) <> ''
GROUP BY 领用人 ORDER BY 行数 DESC;
GO
PRINT '=== F. UOM / EMP 面板字段 ===';
SELECT panel_code, col_name, label, data_type, place, seq FROM yj_field WHERE panel_code IN ('UOM') ORDER BY seq;
GO
SELECT '有经手人编码字段的面板' AS k, panel_code, col_name, label, data_type FROM yj_field WHERE col_name IN (N'经手人编码', N'单位编码', N'基本单位编码') ORDER BY panel_code, col_name;
GO
