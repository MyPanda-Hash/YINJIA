-- 销售订单迁移(SO_ORDER + 明细/统计报表)
USE HSDZ_MES;
SET NOCOUNT ON;

IF OBJECT_ID('bd_so_order') IS NULL CREATE TABLE bd_so_order (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据编号] nvarchar(200) NULL,

  [单据日期] date NULL,

  [客户] nvarchar(200) NULL,

  [客户编码] nvarchar(100) NULL,

  [结算客户] nvarchar(100) NULL,

  [部门] nvarchar(100) NULL,

  [部门.负责人] nvarchar(200) NULL,

  [业务员] nvarchar(100) NULL,

  [项目] nvarchar(200) NULL,

  [预计交货日期] date NULL,

  [联系人] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);

IF OBJECT_ID('bl_so_order') IS NULL CREATE TABLE bl_so_order (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NULL,

  [存货名称.品牌] nvarchar(200) NULL,

  [存货名称] nvarchar(200) NULL,

  [存货编码] nvarchar(100) NULL,

  [规格型号] nvarchar(200) NULL,

  [数量] decimal(18,4) NULL,

  [销售单位] nvarchar(100) NULL,

  [单价] decimal(18,4) NULL,

  [税率%] decimal(18,4) NULL,

  [含税单价] decimal(18,4) NULL,

  [金额] decimal(18,4) NULL,

  [含税金额] decimal(18,4) NULL,

  [折扣金额] decimal(18,4) NULL,

  [预计交货日期] date NULL,

  [现存量] decimal(18,4) NULL,

  [备注] nvarchar(200) NULL,

  asp_user1 nvarchar(50) NULL
);

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='SO_ORDER') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('SO_ORDER', N'销售订单', N'智能供应链', 'doc', 'bl_so_order', 'bd_so_order', N'单据编号', 'id', N'单据编号', 'SO', N'单据日期', 50, 'items', N'智能供应链');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户', N'客户', N'参照', NULL, 'PARTNER', N'往来单位名称', N'往来单位名称', N'query,header', 30, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'客户编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'客户编码', N'客户编码', N'下拉框', N'SELECT v FROM (VALUES (N''KH001''),(N''KH002''),(N''KH003''),(N''KH004''),(N''KH005'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'结算客户') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'结算客户', N'结算客户', N'下拉框', N'SELECT v FROM (VALUES (N''华东铝业''),(N''中天精工''),(N''西部材料''),(N''南方重工''),(N''北方机械'')) AS t(v)', NULL, NULL, NULL, N'header', 50, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'部门') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'部门', N'部门', N'下拉框', N'SELECT v FROM (VALUES (N''销售一部''),(N''销售二部''),(N''国际部'')) AS t(v)', NULL, NULL, NULL, N'query,header', 60, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'部门.负责人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'部门.负责人', N'部门.负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'业务员') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'业务员', N'业务员', N'下拉框', N'SELECT v FROM (VALUES (N''张伟''),(N''李娜''),(N''王芳''),(N''陈强'')) AS t(v)', NULL, NULL, NULL, N'query,header', 80, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'项目') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'项目', N'项目', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'预计交货日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'预计交货日期', N'预计交货日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 100, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'联系人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'联系人', N'联系人', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'存货名称.品牌') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'存货名称.品牌', N'存货名称.品牌', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'存货名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'存货名称', N'存货名称', N'参照', NULL, 'INV', N'存货名称', N'存货名称', N'detail', 20, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'存货编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'存货编码', N'存货编码', N'下拉框', N'SELECT v FROM (VALUES (N''CP001''),(N''CP002''),(N''CP003''),(N''CP004''),(N''CP005'')) AS t(v)', NULL, NULL, NULL, N'detail', 30, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'规格型号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 50, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'销售单位') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'销售单位', N'销售单位', N'下拉框', N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套'')) AS t(v)', NULL, NULL, NULL, N'detail', 60, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'单价') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 70, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'税率%') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'税率%', N'税率%', N'小数', NULL, NULL, NULL, NULL, N'detail', 80, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'含税单价') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'含税单价', N'含税单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 90, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'金额') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 100, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'含税金额') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'含税金额', N'含税金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 110, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'折扣金额') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'折扣金额', N'折扣金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 120, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'预计交货日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'预计交货日期', N'预计交货日期', N'日期', NULL, NULL, NULL, NULL, N'detail', 130, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'现存量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'现存量', N'现存量', N'小数', NULL, NULL, NULL, NULL, N'detail', 140, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 140, 1, 0, 0, 1);

-- 明细表视图
EXEC('CREATE VIEW v_sales_order_detail AS SELECT h.*, l.[单据编号] AS line_no, l.[存货名称.品牌], l.[存货名称], l.[存货编码], l.[规格型号], l.[数量], l.[销售单位], l.[单价], l.[税率%], l.[含税单价], l.[金额], l.[含税金额], l.[折扣金额], l.[预计交货日期], l.[现存量], l.[备注] FROM bd_so_order h LEFT JOIN bl_so_order l ON h.[单据编号]=l.[单据编号]');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='SALES_ORDER_DETAIL') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('SALES_ORDER_DETAIL', N'销售订单明细表', N'智能供应链', 'flat', 'v_sales_order_detail', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'智能供应链');

-- 统计表视图
EXEC('CREATE VIEW v_sales_order_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [订单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_so_order h LEFT JOIN bl_so_order l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='SALES_ORDER_STATS') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('SALES_ORDER_STATS', N'销售订单统计表', N'智能供应链', 'flat', 'v_sales_order_stats', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'智能供应链');

DECLARE @n sysname, @i int;
DECLARE cc CURSOR FOR SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('v_sales_order_detail') AND c.name NOT IN ('id','asp_cancel') ORDER BY c.column_id;
SET @i = 0; OPEN cc; FETCH NEXT FROM cc INTO @n;
WHILE @@FETCH_STATUS = 0 BEGIN SET @i += 10;
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALES_ORDER_DETAIL' AND col_name=@n)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALES_ORDER_DETAIL', @n, @n, N'文本', N'detail', @i, 130, 1, 0, 0, 1);
  FETCH NEXT FROM cc INTO @n; END
CLOSE cc; DEALLOCATE cc;
DECLARE cc2 CURSOR FOR SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('v_sales_order_stats') AND c.name NOT IN ('id') ORDER BY c.column_id;
SET @i = 0; OPEN cc2; FETCH NEXT FROM cc2 INTO @n;
WHILE @@FETCH_STATUS = 0 BEGIN SET @i += 10;
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALES_ORDER_STATS' AND col_name=@n)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALES_ORDER_STATS', @n, @n, N'文本', N'detail', @i, 120, 1, 0, 0, 1);
  FETCH NEXT FROM cc2 INTO @n; END
CLOSE cc2; DEALLOCATE cc2;

