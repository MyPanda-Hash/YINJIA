-- _fix-material-out-test-line.sql(一次性测试数据修补,测试库专用)
-- 把手工插的测试明细行**补全成真实单据的样子**:
--   · 仓库  → 仓库**名称**(真实单据该列存名称,我先前填了编码 ⇒ resolveWh 名称兜底失败报「仓库档案不存在」)
--   · 仓库id → bs_wh.id
--   · 商品列(材料编码/材料名称/规格型号/计量单位)按 yj_field 的 label→col 映射写入,值取 bs_inv 真实档案
SET NOCOUNT ON;

DECLARE @cItem sysname = (SELECT col_name FROM yj_field WHERE panel_code = N'MATERIAL_OUT' AND label = N'材料编码');
DECLARE @cName sysname = (SELECT col_name FROM yj_field WHERE panel_code = N'MATERIAL_OUT' AND label = N'材料名称');
DECLARE @cSpec sysname = (SELECT col_name FROM yj_field WHERE panel_code = N'MATERIAL_OUT' AND label = N'规格型号');
DECLARE @cUom  sysname = (SELECT col_name FROM yj_field WHERE panel_code = N'MATERIAL_OUT' AND label = N'计量单位');

DECLARE @sql nvarchar(max) = N'
UPDATE l SET
    仓库      = w.仓库名称,
    仓库id    = w.id,
    仓库编码  = w.仓库编码,
    ' + QUOTENAME(@cName) + N' = i.存货名称,
    ' + QUOTENAME(@cSpec) + N' = i.规格型号,
    ' + QUOTENAME(@cUom)  + N' = i.主计量
  FROM bl_material_out l
  OUTER APPLY (SELECT TOP 1 id, 仓库名称, 仓库编码 FROM bs_wh  WHERE 仓库编码 = N''YCL-01'' ORDER BY id) w
  OUTER APPLY (SELECT TOP 1 存货名称, 规格型号, 主计量 FROM bs_inv WHERE 存货编码 = N''HS-2040'') i
 WHERE l.单据编号 = N''CL-2026-10-0003'';';
EXEC sp_executesql @sql;

SELECT N'补全后' AS k, 单据编号, 仓库, 仓库编码, 仓库id, 批号, 数量,
       (SELECT col_name FROM yj_field WHERE panel_code = N'MATERIAL_OUT' AND label = N'材料编码') AS 材料编码列名
  FROM bl_material_out WHERE 单据编号 = N'CL-2026-10-0003';

DECLARE @it sysname = (SELECT col_name FROM yj_field WHERE panel_code = N'MATERIAL_OUT' AND label = N'材料编码');
DECLARE @sql2 nvarchar(max) = N'SELECT N''补全后的商品列'' AS k, ' + QUOTENAME(@it) + N' AS 材料编码, '
  + QUOTENAME(@cName) + N' AS 材料名称, ' + QUOTENAME(@cUom) + N' AS 单位 FROM bl_material_out WHERE 单据编号 = N''CL-2026-10-0003'';';
EXEC sp_executesql @sql2;
