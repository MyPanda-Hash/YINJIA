-- _q-picklist-1014h.sql — 探针 v8:材料出库单建单所需的取值口径(只读)
SET NOCOUNT ON;
PRINT '=== 1) MATERIAL_OUT 业务类型/出库类别 下拉选项(dict_sql) ===';
SELECT label, data_type, dict_sql FROM yj_field
WHERE panel_code = N'MATERIAL_OUT' AND label IN (N'业务类型', N'出库类别', N'生产车间');
PRINT '=== 2) 产线档案(生产线→生产车间) ===';
SELECT 生产线, 生产车间, 日产能, 小时产能, 停用 FROM bs_prod_line ORDER BY id;
PRINT '=== 3) 工单行的产线分布(plang.scx) ===';
SELECT ISNULL(p.scx, N'(空)') AS 生产线, COUNT(*) AS 工单行数 FROM plang p GROUP BY p.scx ORDER BY 2 DESC;
PRINT '=== 4) 部门档案里是否有这些车间名(参照 DEPT) ===';
SELECT COUNT(*) AS 部门数 FROM bs_dept;
SELECT TOP 20 部门名称 FROM bs_dept ORDER BY id;
PRINT '=== 5) MATERIAL_OUT 面板行 ===';
SELECT * FROM yj_panel WHERE panel_code = N'MATERIAL_OUT';
PRINT '=== 6) yj_field 全部 MATERIAL_OUT 头字段的 required ===';
SELECT label, required, visible, hidden, editable FROM yj_field WHERE panel_code = N'MATERIAL_OUT' AND place LIKE N'%header%' ORDER BY seq;
