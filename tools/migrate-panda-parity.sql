-- ============================================================================
-- PANDA 对齐迁移(2026-09-01):对比 PANDA-master 轻量化前基准,补齐
-- 智能供应链/新生产 面板的字段与统计维度。全部幂等,可重复执行。
--   A. 单据明细字段补齐(列已存在于 bl_* 表,补 yj_field)
--   B. 单据查询字段补齐(已有列加 query 位 + 新增列 ALTER+注册)
--   C. 报表(明细/统计)查询字段补齐(flat 面板此前无任何查询字段)
--   D. 统计视图重建(补 id 列——10/11 视图缺 id 导致统计面板查询报错;
--      补 PANDA 统计维度:客户/部门/业务员/仓库/供应商/生产车间;排除已作废单)
--   E. 明细视图「单据状态」补已中止档位(yj_doc_status.stopped)
--   F. yj_doc_status 补 stopped/stop_by/stop_at 列(整单中止/中止执行按钮依赖)
--   G. 明细报表 asp_* 列改友好名(制单人/创建时间),隐藏修改留痕列
-- 差异明细见 _diff-report.md(由 _panda-compare.cjs 生成)。
-- ============================================================================
USE HSDZ_MES;
SET NOCOUNT ON;
DECLARE @sql nvarchar(max);

-- ===== A. 单据明细字段补齐(物理列已存在) =====
-- 明细行「仓库」(PANDA 各库存单据明细首列;参照 WH 面板选取)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'仓库', N'仓库', N'Warehouse', N'参照', 'WH', N'仓库名称', N'仓库名称', N'detail', 5, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FINISH_IN' AND col_name=N'仓库')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('FINISH_IN', N'仓库', N'仓库', N'Warehouse', N'参照', 'WH', N'仓库名称', N'仓库名称', N'detail', 5, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND col_name=N'仓库')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('OTHER_IN', N'仓库', N'仓库', N'Warehouse', N'参照', 'WH', N'仓库名称', N'仓库名称', N'detail', 5, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓库')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALE_OUT', N'仓库', N'仓库', N'Warehouse', N'参照', 'WH', N'仓库名称', N'仓库名称', N'detail', 5, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'仓库')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MATERIAL_OUT', N'仓库', N'仓库', N'Warehouse', N'参照', 'WH', N'仓库名称', N'仓库名称', N'detail', 5, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OUTSOURCE_ISSUE' AND col_name=N'仓库')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('OUTSOURCE_ISSUE', N'仓库', N'仓库', N'Warehouse', N'参照', 'WH', N'仓库名称', N'仓库名称', N'detail', 5, 110, 1, 0, 0, 1);
-- 材料出库单明细「加工单号」(PANDA 有,列已在 bl_material_out)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'加工单号')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('MATERIAL_OUT', N'加工单号', N'加工单号', N'Work order no.', N'文本', N'detail', 6, 120, 1, 0, 0, 1);
-- 销售订单明细「预计交货日期/备注」(PANDA 有,列已在 bl_so_order)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'预计交货日期')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SO_ORDER', N'预计交货日期', N'预计交货日期', N'ETD', N'日期', N'detail', 125, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'备注')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SO_ORDER', N'备注', N'备注', N'Remark', N'文本', N'detail', 150, 140, 1, 0, 0, 1);
-- 请购单明细「建议供应商/需求日期/来源单据/来源单号/备注」(PANDA 有,列已在 bl_pu_req)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_REQ' AND col_name=N'建议供应商')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PU_REQ', N'建议供应商', N'建议供应商', N'Suggested supplier', N'文本', N'detail', 145, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_REQ' AND col_name=N'需求日期')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PU_REQ', N'需求日期', N'需求日期', N'Required date', N'日期', N'detail', 146, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_REQ' AND col_name=N'来源单据')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PU_REQ', N'来源单据', N'来源单据', N'Source doc', N'文本', N'detail', 147, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_REQ' AND col_name=N'来源单号')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PU_REQ', N'来源单号', N'来源单号', N'Source no.', N'文本', N'detail', 148, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PU_REQ' AND col_name=N'备注')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PU_REQ', N'备注', N'备注', N'Remark', N'文本', N'detail', 195, 140, 1, 0, 0, 1);

-- ===== A2. 既有头表字段的明细位扩展(PANDA 明细网格含 仓库/加工单号/预计交货日期/备注 等;
--      列在 bd_* 与 bl_* 均存在,同一字段定义同时参与 表单+明细网格,一份定义三处复用) =====
UPDATE yj_field SET place = place + N',detail'
WHERE place NOT LIKE N'%detail' AND (
  (panel_code='PURCHASE_IN'    AND col_name=N'仓库')
  OR (panel_code='FINISH_IN'   AND col_name=N'仓库')
  OR (panel_code='OTHER_IN'    AND col_name=N'仓库')
  OR (panel_code='SALE_OUT'    AND col_name=N'仓库')
  OR (panel_code='MATERIAL_OUT' AND col_name IN (N'仓库', N'加工单号'))
  OR (panel_code='OUTSOURCE_ISSUE' AND col_name=N'仓库')
  OR (panel_code='SO_ORDER'    AND col_name IN (N'预计交货日期', N'备注'))
  OR (panel_code='PU_REQ'      AND col_name IN (N'建议供应商', N'需求日期', N'来源单据', N'来源单号', N'备注'))
);

-- ===== B1. 已有列的查询位补齐(place 前置 query) =====
UPDATE yj_field SET place = N'query,' + place
WHERE place NOT LIKE N'query%' AND (
  (panel_code='SALE_OUT'      AND col_name=N'退货原因')   -- PANDA 销售出库查询项
  OR (panel_code='OTHER_OUT'  AND col_name=N'仓库')       -- PANDA 其他出库查询项
  OR (panel_code='PURCHASE_IN' AND col_name IN (N'采购类型', N'采购订单号', N'合同号'))
  OR (panel_code='MATERIAL_OUT' AND col_name=N'来源单号')
);

-- ===== B2. 缺失查询列:ALTER TABLE + 注册(query,header 文本列) =====
IF COL_LENGTH('bd_purchase_in', N'验货人') IS NULL ALTER TABLE bd_purchase_in ADD [验货人] nvarchar(100) NULL;
IF COL_LENGTH('bd_purchase_in', N'匹配来源单号') IS NULL ALTER TABLE bd_purchase_in ADD [匹配来源单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_purchase_in', N'来源单据') IS NULL ALTER TABLE bd_purchase_in ADD [来源单据] nvarchar(100) NULL;
IF COL_LENGTH('bd_purchase_in', N'来源单号') IS NULL ALTER TABLE bd_purchase_in ADD [来源单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_purchase_in', N'销售订单号') IS NULL ALTER TABLE bd_purchase_in ADD [销售订单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_material_out', N'来源单据') IS NULL ALTER TABLE bd_material_out ADD [来源单据] nvarchar(100) NULL;
IF COL_LENGTH('bd_material_out', N'销售订单号') IS NULL ALTER TABLE bd_material_out ADD [销售订单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_material_out', N'匹配来源单号') IS NULL ALTER TABLE bd_material_out ADD [匹配来源单号] nvarchar(100) NULL;
IF COL_LENGTH('bd_other_in', N'入库类别') IS NULL ALTER TABLE bd_other_in ADD [入库类别] nvarchar(50) NULL;
IF COL_LENGTH('bd_other_in', N'来料客户') IS NULL ALTER TABLE bd_other_in ADD [来料客户] nvarchar(100) NULL;
IF COL_LENGTH('bd_other_out', N'来料客户') IS NULL ALTER TABLE bd_other_out ADD [来料客户] nvarchar(100) NULL;

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'验货人')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'验货人', N'验货人', N'Inspector', N'参照', 'EMP', N'员工名称', N'员工名称', N'query,header', 190, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'匹配来源单号')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'匹配来源单号', N'匹配来源单号', N'Matched source no.', N'文本', N'query,header', 200, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'来源单据')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'来源单据', N'来源单据', N'Source doc', N'文本', N'query,header', 210, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'来源单号')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'来源单号', N'来源单号', N'Source no.', N'文本', N'query,header', 220, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'销售订单号')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'销售订单号', N'销售订单号', N'Sales order no.', N'文本', N'query,header', 230, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'来源单据')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('MATERIAL_OUT', N'来源单据', N'来源单据', N'Source doc', N'文本', N'query,header', 150, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'销售订单号')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('MATERIAL_OUT', N'销售订单号', N'销售订单号', N'Sales order no.', N'文本', N'query,header', 160, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'匹配来源单号')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('MATERIAL_OUT', N'匹配来源单号', N'匹配来源单号', N'Matched source no.', N'文本', N'query,header', 170, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND col_name=N'入库类别')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
  VALUES ('OTHER_IN', N'入库类别', N'入库类别', N'In type', N'下拉框', N'SELECT v FROM (VALUES (N''盘盈入库''),(N''调整入库''),(N''其他'')) AS t(v)', N'query,header', 120, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND col_name=N'来料客户')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('OTHER_IN', N'来料客户', N'来料客户', N'Source customer', N'文本', N'query,header', 130, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND col_name=N'来料客户')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('OTHER_OUT', N'来料客户', N'来料客户', N'Source customer', N'文本', N'query,header', 190, 120, 1, 0, 0, 1);

-- ===== C1. 明细报表查询字段补齐(字段已存在,加 query 位) =====
UPDATE yj_field SET place = N'query,' + place
WHERE place NOT LIKE N'query%' AND panel_code IN (
  'SALES_ORDER_DETAIL','PURCHASE_IN_DETAIL','FINISH_IN_DETAIL','OTHER_IN_DETAIL','SALE_OUT_DETAIL',
  'MATERIAL_OUT_DETAIL','OTHER_OUT_DETAIL','OUTSOURCE_IN_DETAIL','OUTSOURCE_ISSUE_DETAIL',
  'MANU_ORDER_DETAIL','DISPATCH_DETAIL')
AND col_name IN (N'单据日期', N'单据编号', N'单据状态', N'客户', N'供应商', N'委外供应商',
  N'业务员', N'部门', N'生产车间', N'仓库', N'存货名称', N'产品名称', N'材料名称', N'合同号');

-- ===== C2. 统计报表查询字段补齐(新维度列由 D 部分视图重建产生,注册即列) =====
-- 通用维度注册:日期/客户/供应商/仓库/生产车间/部门/业务员/委外供应商
DECLARE @dims TABLE (panel sysname, col sysname, en nvarchar(80), seq int);
INSERT INTO @dims VALUES
  ('SALES_ORDER_STATS',  N'客户',       N'Customer',        15),
  ('SALES_ORDER_STATS',  N'部门',       N'Dept',            16),
  ('SALES_ORDER_STATS',  N'业务员',     N'Salesperson',     17),
  ('SALES_ORDER_STATS',  N'存货编码',   N'Item code',       18),
  ('PURCHASE_IN_STATS',  N'仓库',       N'Warehouse',       11),
  ('PURCHASE_IN_STATS',  N'供应商编码', N'Vendor code',     12),
  ('PURCHASE_IN_STATS',  N'供应商',     N'Vendor',          13),
  ('FINISH_IN_STATS',    N'生产车间',   N'Workshop',        11),
  ('FINISH_IN_STATS',    N'仓库',       N'Warehouse',       12),
  ('FINISH_IN_STATS',    N'项目',       N'Project',         13),
  ('OTHER_IN_STATS',     N'仓库',       N'Warehouse',       11),
  ('SALE_OUT_STATS',     N'客户',       N'Customer',        11),
  ('SALE_OUT_STATS',     N'仓库',       N'Warehouse',       12),
  ('MATERIAL_OUT_STATS', N'生产车间',   N'Workshop',        11),
  ('MATERIAL_OUT_STATS', N'仓库',       N'Warehouse',       12),
  ('OTHER_OUT_STATS',    N'仓库',       N'Warehouse',       11),
  ('OTHER_OUT_STATS',    N'部门',       N'Dept',            12),
  ('MANU_ORDER_STATS',   N'生产车间',   N'Workshop',        12),
  ('MANU_ORDER_STATS',   N'客户',       N'Customer',        13),
  ('MANU_ORDER_STATS',   N'产品编码',   N'Product code',    14),
  ('MANU_ORDER_STATS',   N'规格型号',   N'Spec',            15),
  ('MANU_ORDER_STATS',   N'生产单位',   N'UOM',             16),
  ('DISPATCH_STATS',     N'部门',       N'Dept',            11),
  ('OUTSOURCE_IN_STATS', N'仓库',       N'Warehouse',       11),
  ('OUTSOURCE_ISSUE_STATS', N'仓库',    N'Warehouse',       11);
DECLARE d CURSOR FOR SELECT panel, col, en, seq FROM @dims;
DECLARE @p sysname, @c sysname, @e nvarchar(80), @s int;
OPEN d;
FETCH NEXT FROM d INTO @p, @c, @e, @s;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=''' + @p + N''' AND col_name=N''' + @c + N''')
    INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (''' + @p + N''', N''' + @c + N''', N''' + @c + N''', N''' + @e + N''', N''文本'', N''query'', ' + CAST(@s AS nvarchar) + N', 110, 0, 0, 0, 1)';
  EXEC(@sql);
  FETCH NEXT FROM d INTO @p, @c, @e, @s;
END
CLOSE d; DEALLOCATE d;
-- 统计表既有日期/货物维度列补 query 位
UPDATE yj_field SET place = N'query,' + place
WHERE place NOT LIKE N'query%' AND panel_code LIKE '%STATS'
  AND col_name IN (N'单据日期', N'存货名称', N'产品名称', N'材料名称', N'工序名称', N'委外供应商');

-- ===== D. 统计视图重建(id 列 + PANDA 维度 + 排除已作废) =====
-- 注:除 v_sales_order_stats 外全部缺 id 列,queryFlat 的 ORDER BY t.id 直接报「列名 id 无效」
EXEC('CREATE OR ALTER VIEW v_sales_order_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[客户编码], h.[客户], h.[部门], h.[业务员], l.[存货编码], l.[存货名称], l.[规格型号], l.[销售单位] AS [计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [订单数], SUM(COALESCE(l.[数量],0)) AS [数量],
  SUM(COALESCE(l.[金额],0)) AS [金额], SUM(COALESCE(l.[含税金额],0)) AS [含税金额],
  SUM(COALESCE(l.[折扣金额],0)) AS [折扣金额], MIN(l.[预计交货日期]) AS [预计交货日期]
FROM bd_so_order h LEFT JOIN bl_so_order l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''SO_ORDER'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, h.[客户编码], h.[客户], h.[部门], h.[业务员], l.[存货编码], l.[存货名称], l.[规格型号], l.[销售单位]');

EXEC('CREATE OR ALTER VIEW v_purchase_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[仓库], h.[供应商编码], h.[供应商], l.[存货名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量],
  SUM(COALESCE(l.[金额],0)) AS [金额], SUM(COALESCE(l.[含税金额],0)) AS [含税金额],
  SUM(COALESCE(l.[费用调整],0)) AS [费用调整], SUM(COALESCE(l.[费用金额],0)) AS [费用金额]
FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''PURCHASE_IN'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, h.[仓库], h.[供应商编码], h.[供应商], l.[存货名称], l.[规格型号], l.[计量单位]');

EXEC('CREATE OR ALTER VIEW v_finish_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[生产车间], h.[仓库], h.[项目], l.[产品名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量],
  SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''FINISH_IN'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, h.[生产车间], h.[仓库], h.[项目], l.[产品名称], l.[规格型号], l.[计量单位]');

EXEC('CREATE OR ALTER VIEW v_other_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[仓库], l.[存货名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [实收数量],
  SUM(COALESCE(l.[数量2],0)) AS [数量(辅)], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''OTHER_IN'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, h.[仓库], l.[存货名称], l.[规格型号], l.[计量单位]');

EXEC('CREATE OR ALTER VIEW v_sale_out_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[客户], h.[仓库], l.[存货名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量],
  SUM(COALESCE(l.[销售金额],0)) AS [金额], SUM(COALESCE(l.[成本价]*l.[数量],0)) AS [成本金额],
  SUM(COALESCE(l.[税额],0)) AS [税额], SUM(COALESCE(l.[折扣金额],0)) AS [折扣金额]
FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''SALE_OUT'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, h.[客户], h.[仓库], l.[存货名称], l.[规格型号], l.[计量单位]');

EXEC('CREATE OR ALTER VIEW v_material_out_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[生产车间], h.[仓库], l.[材料名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量],
  SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''MATERIAL_OUT'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, h.[生产车间], h.[仓库], l.[材料名称], l.[规格型号], l.[计量单位]');

EXEC('CREATE OR ALTER VIEW v_other_out_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  l.[仓库], h.[部门], l.[存货名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量],
  SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''OTHER_OUT'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, l.[仓库], h.[部门], l.[存货名称], l.[规格型号], l.[计量单位]');

EXEC('CREATE OR ALTER VIEW v_manu_order_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
  h.[生产车间], h.[客户], l.[产品编码], l.[产品名称], l.[规格型号], l.[生产单位],
  COUNT(DISTINCT h.[合同号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [计划数量],
  SUM(COALESCE(l.[累计汇报套数(工序单位)],0)) AS [累计汇报数量],
  SUM(CASE WHEN h.[完工日期] IS NOT NULL THEN COALESCE(l.[数量],0) ELSE 0 END) AS [完工数量],
  CAST(ISNULL(100.0*SUM(COALESCE(l.[累计汇报套数(工序单位)],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0),0) AS decimal(18,2)) AS [生产进度%]
FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''MANU_ORDER'' AND s.doc_no=h.[合同号] AND s.canceled=''Y'')
GROUP BY h.asp_cancel, h.[生产车间], h.[客户], l.[产品编码], l.[产品名称], l.[规格型号], l.[生产单位]');

EXEC('CREATE OR ALTER VIEW v_dispatch_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[部门], l.[生产车间], l.[工序名称], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [派工单数], SUM(COALESCE(l.[计划数量],0)) AS [计划数量],
  SUM(COALESCE(l.[派工数量],0)) AS [派工数量], SUM(COALESCE(l.[累计汇报数量],0)) AS [累计汇报数量],
  MAX(l.[派工加工状态]) AS [派工加工状态]
FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''DISPATCH'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, h.[部门], l.[生产车间], l.[工序名称], l.[计量单位]');

EXEC('CREATE OR ALTER VIEW v_outsource_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[委外供应商], h.[仓库], l.[产品名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [入库单数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量],
  SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''OUTSOURCE_IN'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], h.[仓库], l.[产品名称], l.[规格型号], l.[计量单位]');

EXEC('CREATE OR ALTER VIEW v_outsource_issue_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[委外供应商], h.[仓库], l.[材料名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [发料单数], SUM(COALESCE(l.[数量],0)) AS [数量],
  SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''OUTSOURCE_ISSUE'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], h.[仓库], l.[材料名称], l.[规格型号], l.[计量单位]');

-- 统计表新增度量列注册(PANDA 对齐:销售含税/折扣、采购费用、销售成本)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALES_ORDER_STATS' AND col_name=N'含税金额')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALES_ORDER_STATS', N'含税金额', N'含税金额', N'Incl. tax amt', N'小数', N'detail', 80, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALES_ORDER_STATS' AND col_name=N'折扣金额')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALES_ORDER_STATS', N'折扣金额', N'折扣金额', N'Discount amt', N'小数', N'detail', 90, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALES_ORDER_STATS' AND col_name=N'预计交货日期')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALES_ORDER_STATS', N'预计交货日期', N'预计交货日期', N'ETD', N'日期', N'detail', 95, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN_STATS' AND col_name=N'含税金额')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN_STATS', N'含税金额', N'含税金额', N'Incl. tax amt', N'小数', N'detail', 80, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN_STATS' AND col_name=N'费用调整')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN_STATS', N'费用调整', N'费用调整', N'Cost adjust', N'小数', N'detail', 85, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN_STATS' AND col_name=N'费用金额')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN_STATS', N'费用金额', N'费用金额', N'Expense amt', N'小数', N'detail', 90, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT_STATS' AND col_name=N'成本金额')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALE_OUT_STATS', N'成本金额', N'成本金额', N'Cost amt', N'小数', N'detail', 80, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT_STATS' AND col_name=N'税额')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALE_OUT_STATS', N'税额', N'税额', N'Tax amt', N'小数', N'detail', 85, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT_STATS' AND col_name=N'折扣金额')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALE_OUT_STATS', N'折扣金额', N'折扣金额', N'Discount amt', N'小数', N'detail', 90, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER_STATS' AND col_name=N'累计汇报数量')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('MANU_ORDER_STATS', N'累计汇报数量', N'累计汇报数量', N'Reported qty', N'小数', N'detail', 60, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER_STATS' AND col_name=N'生产进度%')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('MANU_ORDER_STATS', N'生产进度%', N'生产进度%', N'Progress %', N'小数', N'detail', 70, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND col_name=N'数量(辅)')
  INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('OTHER_IN_STATS', N'数量(辅)', N'数量(辅)', N'Qty (aux)', N'小数', N'detail', 75, 110, 0, 0, 0, 1);

-- ===== E. yj_doc_status 补中止列 + 明细视图状态 CASE 补已中止档位 =====
IF COL_LENGTH('yj_doc_status', 'stopped') IS NULL ALTER TABLE yj_doc_status ADD stopped char(1) NULL;
IF COL_LENGTH('yj_doc_status', 'stop_by') IS NULL ALTER TABLE yj_doc_status ADD stop_by nvarchar(50) NULL;
IF COL_LENGTH('yj_doc_status', 'stop_at') IS NULL ALTER TABLE yj_doc_status ADD stop_at datetime2 NULL;

DECLARE @old_case nvarchar(max) = N'CASE WHEN ISNULL(s.canceled,N''N'')=N''Y'' THEN N''已作废'' WHEN ISNULL(s.pending,N''N'')=N''Y'' THEN N''审批中'' WHEN s.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END';
DECLARE @new_case nvarchar(max) = N'CASE WHEN ISNULL(s.canceled,N''Y'')=N''Y'' THEN N''已作废'' WHEN ISNULL(s.stopped,N''N'')=N''Y'' THEN N''已中止'' WHEN ISNULL(s.pending,N''N'')=N''Y'' THEN N''审批中'' WHEN s.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END';
-- 注:须用 sys.sql_modules(INFORMATION_SCHEMA.VIEWS.VIEW_DEFINITION 截断至 4000 字符);
--     先快照到表变量(避免边改边读),存量定义为 CREATE VIEW 须转 ALTER VIEW
DECLARE @snap TABLE (name sysname, def nvarchar(max));
INSERT INTO @snap (name, def)
SELECT v.name, m.definition FROM sys.sql_modules m JOIN sys.views v ON v.object_id = m.object_id
WHERE m.definition LIKE N'%已作废%审批中%' AND m.definition NOT LIKE N'%stopped%';
DECLARE @n sysname, @d nvarchar(max);
DECLARE v CURSOR LOCAL STATIC FOR SELECT name, def FROM @snap;
OPEN v;
FETCH NEXT FROM v INTO @n, @d;
WHILE @@FETCH_STATUS = 0 BEGIN
  IF CHARINDEX(@old_case, @d) > 0 BEGIN
    SET @sql = REPLACE(@d, @old_case, @new_case);
    IF @sql LIKE N'CREATE VIEW%' SET @sql = N'ALTER' + STUFF(@sql, 1, 6, N'');
    EXEC(@sql);
  END
  FETCH NEXT FROM v INTO @n, @d;
END
CLOSE v; DEALLOCATE v;

-- ===== F. 明细报表 asp_* 列友好化(制单人/创建时间;隐藏修改留痕) =====
UPDATE yj_field SET label = N'制单人', label_en = N'Prepared by'
WHERE panel_code IN ('SALES_ORDER_DETAIL','PURCHASE_IN_DETAIL','FINISH_IN_DETAIL','OTHER_IN_DETAIL','SALE_OUT_DETAIL',
  'MATERIAL_OUT_DETAIL','OTHER_OUT_DETAIL','OUTSOURCE_IN_DETAIL','OUTSOURCE_ISSUE_DETAIL','MANU_ORDER_DETAIL','DISPATCH_DETAIL')
  AND col_name = N'asp_user1' AND label = N'asp_user1';
UPDATE yj_field SET label = N'创建时间', label_en = N'Created at'
WHERE panel_code IN ('SALES_ORDER_DETAIL','PURCHASE_IN_DETAIL','FINISH_IN_DETAIL','OTHER_IN_DETAIL','SALE_OUT_DETAIL',
  'MATERIAL_OUT_DETAIL','OTHER_OUT_DETAIL','OUTSOURCE_IN_DETAIL','OUTSOURCE_ISSUE_DETAIL','MANU_ORDER_DETAIL','DISPATCH_DETAIL')
  AND col_name = N'asp_time1' AND label = N'asp_time1';
UPDATE yj_field SET visible = 0
WHERE panel_code LIKE '%_DETAIL' AND col_name IN (N'asp_user2', N'asp_time2');

-- ===== 校验输出 =====
SELECT COUNT(*) AS fields_total FROM yj_field WHERE panel_code LIKE '%STATS' OR panel_code LIKE '%_DETAIL';
SELECT v.name AS view_name, CASE WHEN c.object_id IS NULL THEN 'NO-ID' ELSE 'ok' END AS id_col
FROM sys.views v LEFT JOIN sys.columns c ON c.object_id=v.object_id AND c.name='id'
WHERE v.name LIKE 'v%stats%' ORDER BY v.name;
PRINT N'panda-parity 迁移完成';
