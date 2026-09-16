-- fix-db-restore-20260915.sql — 数据库修复(2026-09-15 setup-db 破坏性重跑事故的终态修复)
-- 背景:setup-db.sql 因内容哈希变化被 DbSync 重跑,DROP 重建 yj_* 核心表;后续哈希未变的脚本被跳过,
--      造成 yj_doc_status 列、RD 表、标准库、消息、附件、21 个报表面板视图等零散缺失。
-- 本脚本以「服务器部署快照(tools/deploy-all.sql,2026-09-02)+ 后续契约脚本」为口径,统一收口:
--   §1 bl_dispatch 重建为服务器口径(中文列 + 生产车间;当前为英文列空表,重建无损)
--   §2 DISPATCH 面板元数据对齐服务器口径(头行分表 + 中文字段,清掉英文残留)
--   §2.5 SO_ORDER 品牌列名归一为服务器口径「品牌」(服务器手工更名未脚本化,从零跑链的库只有「存货名称品牌」)
--   §3 重建 22 个报表面板视图(11 DETAIL + 11 STATS;v_sales_order_detail 用 status-align 的状态派生版)
--   §4 DISPATCH_DETAIL/DISPATCH_STATS 面板注册 + 全部 22 个报表面板字段按终版视图列重注册
--   §5 自检
-- 幂等:可重复执行(视图 CREATE OR ALTER / 字段先删后注册 / 表按列形态守卫)。
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ════════ §1 bl_dispatch → 服务器口径 ════════
IF COL_LENGTH('dbo.bl_dispatch', N'工序编码') IS NULL
BEGIN
    IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL DROP TABLE dbo.bl_dispatch;
    CREATE TABLE dbo.[bl_dispatch] (
      [id] int IDENTITY(1,1) NOT NULL,
      [单据编号] nvarchar(60) NULL,
      [工序编码] nvarchar(60) NULL,
      [工序名称] nvarchar(200) NULL,
      [工作中心] nvarchar(60) NULL,
      [设备] nvarchar(100) NULL,
      [班组] nvarchar(60) NULL,
      [工人] nvarchar(60) NULL,
      [加工类型] nvarchar(20) NULL,
      [计划数量] float NULL,
      [已派工数量] float NULL,
      [派工数量] float NULL,
      [计量单位] nvarchar(20) NULL,
      [派工加工状态] nvarchar(20) NULL,
      [累计汇报数量] float NULL,
      [委外供应商] nvarchar(100) NULL,
      [规格型号] nvarchar(200) NULL,
      [预开工日] date NULL,
      [预完工日] date NULL,
      [备注] nvarchar(500) NULL,
      [comm] nvarchar(10) NOT NULL DEFAULT ('0'),
      [asp_user1] nvarchar(40) NULL, [asp_time1] datetime NULL,
      [asp_user2] nvarchar(40) NULL, [asp_time2] datetime NULL,
      [asp_cancel] nvarchar(2) NULL, [asp_print] int NULL DEFAULT ((0)),
      [生产车间] nvarchar(60) NULL,
      CONSTRAINT pk_bl_dispatch PRIMARY KEY (id)
    );
END
IF COL_LENGTH('dbo.bl_dispatch', N'生产车间') IS NULL ALTER TABLE dbo.bl_dispatch ADD [生产车间] nvarchar(60) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bl_dispatch') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工序派工单行表(中文列,服务器口径;含生产车间列供统计视图分组)', N'SCHEMA', N'dbo', N'TABLE', N'bl_dispatch';
GO

-- ════════ §2.5 SO_ORDER 品牌列名归一 → 服务器口径 ════════
-- 服务器已把 bl_so_order.[存货名称品牌] 更名为 [品牌](fix-db-restore-tail.sql 按此口径重注册字段);
-- 从零跑链的库(测试库/全量部署)只会得到 _so_part1.sql 的 [存货名称品牌],此处统一归一,§3 视图才建得起来。
IF COL_LENGTH('dbo.bl_so_order', N'存货名称品牌') IS NOT NULL AND COL_LENGTH('dbo.bl_so_order', N'品牌') IS NULL
BEGIN
  EXEC sp_rename N'bl_so_order.[存货名称品牌]', N'品牌', N'COLUMN';
  UPDATE yj_field SET col_name = N'品牌' WHERE panel_code = 'SO_ORDER' AND col_name = N'存货名称品牌';
END
GO

-- ════════ §2 DISPATCH 面板元数据 → 服务器口径 ════════
UPDATE yj_panel SET head_table = 'bd_dispatch', group_col = N'单据编号', date_col = N'单据日期'
WHERE panel_code = 'DISPATCH';
GO
DELETE FROM yj_field WHERE panel_code = 'DISPATCH'
AND col_name IN ('dispatch_no','dispatch_date','biz_type','workshop','work_order_no','product_name','process_name',
  'work_center','equipment','team','worker','work_type','plan_qty','dispatched_qty','dispatch_qty','unit',
  'plan_start','plan_end','dispatch_status','reported_qty','spec','handler','project','dept','remark');
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
SELECT 'DISPATCH', v.col, v.label, v.typ, v.dict, v.place, v.seq, v.w, 1, 0, 0, 1
FROM (VALUES
(N'单据编号', N'单据编号', N'文本', CAST(NULL AS nvarchar(500)), N'query,header', 1, 130),
(N'单据日期', N'单据日期', N'日期', NULL, N'query,header', 2, 130),
(N'业务类型', N'业务类型', N'下拉框', N'SELECT mc FROM dm_gx WHERE lb=''GXLX'' AND ISNULL(asp_cancel,''N'')<>''Y''', N'query,header', 3, 130),
(N'生产车间', N'生产车间', N'文本', NULL, N'query,header', 4, 130),
(N'加工单号', N'加工单号', N'文本', NULL, N'header', 5, 130),
(N'产品名称', N'产品名称', N'文本', NULL, N'header', 6, 130),
(N'预开工日', N'预开工日', N'日期', NULL, N'header', 7, 130),
(N'预完工日', N'预完工日', N'日期', NULL, N'header', 8, 130),
(N'经手人', N'经手人', N'文本', NULL, N'header', 9, 130),
(N'项目', N'项目', N'文本', NULL, N'header', 10, 130),
(N'部门', N'部门', N'文本', NULL, N'header', 11, 130),
(N'备注', N'备注', N'文本', NULL, N'header', 12, 130),
(N'工序编码', N'工序编码', N'文本', NULL, N'detail', 20, 130),
(N'工序名称', N'工序名称', N'文本', NULL, N'query,detail', 21, 130),
(N'工作中心', N'工作中心', N'文本', NULL, N'detail', 22, 130),
(N'设备', N'设备', N'文本', NULL, N'detail', 23, 130),
(N'班组', N'班组', N'文本', NULL, N'detail', 24, 130),
(N'工人', N'工人', N'文本', NULL, N'detail', 25, 130),
(N'加工类型', N'加工类型', N'文本', NULL, N'detail', 26, 130),
(N'计划数量', N'计划数量', N'小数', NULL, N'detail', 27, 110),
(N'已派工数量', N'已派工数量', N'小数', NULL, N'detail', 28, 110),
(N'派工数量', N'派工数量', N'小数', NULL, N'detail', 29, 110),
(N'计量单位', N'计量单位', N'文本', NULL, N'detail', 30, 90),
(N'派工加工状态', N'派工加工状态', N'文本', NULL, N'detail', 31, 110),
(N'累计汇报数量', N'累计汇报数量', N'小数', NULL, N'detail', 32, 120),
(N'委外供应商', N'委外供应商', N'文本', NULL, N'detail', 33, 130),
(N'规格型号', N'规格型号', N'文本', NULL, N'detail', 34, 130)
) v(col, label, typ, dict, place, seq, w)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'DISPATCH' AND f.col_name = v.col);
GO

-- ════════ §3 重建 22 个报表面板视图(服务器快照口径) ════════
EXEC('CREATE OR ALTER VIEW v_dispatch_detail AS SELECT h.*, l.[工序编码], l.[工序名称], l.[工作中心], l.[设备], l.[班组], l.[工人], l.[加工类型], l.[计划数量], l.[已派工数量], l.[派工数量], l.[计量单位], l.[派工加工状态], l.[累计汇报数量], l.[委外供应商], l.[规格型号] FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号]=l.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_dispatch_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序名称], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [派工单数], SUM(COALESCE(l.[计划数量],0)) AS [计划数量], SUM(COALESCE(l.[派工数量],0)) AS [派工数量], SUM(COALESCE(l.[累计汇报数量],0)) AS [累计汇报数量], MAX(l.[派工加工状态]) AS [派工加工状态] FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序名称], l.[计量单位]');
EXEC('CREATE OR ALTER VIEW v_finish_in_detail AS SELECT h.*, l.[产品名称], l.[存货图片], l.[规格型号], l.[智能选单], l.[计量单位], l.[金额], l.[单价], l.[实收数量], l.[现存量], l.[现存量说明], l.[图号] FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_finish_in_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, l.[产品名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[产品名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE OR ALTER VIEW v_manu_order_detail AS SELECT h.*, l.[生产类型], l.[产品编码], l.[存货图片], l.[产品名称], l.[规格型号], l.[型号], l.[适用BOM], l.[BOM展开方式], l.[生产单位], l.[数量], l.[齐套数量(主)], l.[累计汇报套数(工序单位)], l.[可用量], l.[可用量说明], l.[现存量], l.[现存量说明], l.[产品字符公用自定义项1], l.[图号], l.[单重], l.[总重], l.[需求令号] FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号]');
EXEC('CREATE OR ALTER VIEW v_manu_order_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, l.[产品名称], COUNT(DISTINCT h.[合同号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[齐套数量(主)],0)) AS [齐套数量] FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号] GROUP BY h.asp_cancel, l.[产品名称]');
EXEC('CREATE OR ALTER VIEW v_material_out_detail AS SELECT h.*, l.[材料名称], l.[计量单位], l.[数量], l.[单价], l.[金额], l.[规格型号], l.[手工确定成本], l.[明细备注], l.[现存量], l.[现存量说明] FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_material_out_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, l.[材料名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[材料名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE OR ALTER VIEW v_other_in_detail AS SELECT h.*, l.[存货名称], l.[规格型号], l.[计量单位], l.[数量], l.[智能选单], l.[计量单位2], l.[数量2], l.[单价], l.[金额], l.[现存量], l.[现存量说明] FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_other_in_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE OR ALTER VIEW v_other_out_detail AS SELECT h.*, l.[单据编号] AS line_no, l.[存货名称], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], l.[现存量], l.[备注] AS [行备注] FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_other_out_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE OR ALTER VIEW v_outsource_in_detail AS SELECT h.*, l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位], l.[实收数量], l.[单价], l.[金额], l.[现存量], l.[行中止] FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_outsource_in_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [入库单数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE OR ALTER VIEW v_outsource_issue_detail AS SELECT h.*, l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], l.[行中止] FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_outsource_issue_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [发料单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE OR ALTER VIEW v_purchase_in_detail AS SELECT h.*, l.[存货名称], l.[存货图片], l.[规格型号], l.[实收数量], l.[计量单位], l.[实收数量2], l.[计量单位2], l.[计量单位组合], l.[换算率], l.[单价], l.[税率%], l.[单价2], l.[含税单价2], l.[含税单价], l.[金额], l.[含税金额], l.[费用调整], l.[费用金额], l.[现存量], l.[现存量说明], l.[产成品图片] FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_purchase_in_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE OR ALTER VIEW v_sale_out_detail AS SELECT h.*, l.[存货名称], l.[存货编码], l.[规格型号], l.[计量单位], l.[数量], l.[智能选单], l.[成本价], l.[税率%], l.[售价], l.[含税售价], l.[销售金额], l.[税额], l.[含税销售金额], l.[折扣金额], l.[现存量], l.[现存量说明], l.[需求令号], l.[退货原因] FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_sale_out_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量] FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
-- v_sales_order_detail 用 status-align 的状态派生版(单据状态/审核人来自 yj_doc_status;品牌列口径)
IF OBJECT_ID('v_sales_order_detail') IS NOT NULL DROP VIEW v_sales_order_detail;
EXEC(N'CREATE VIEW v_sales_order_detail AS SELECT h.[id], h.[单据编号], h.[单据日期], h.[客户], h.[客户编码], h.[结算客户], h.[部门], h.[部门负责人], h.[业务员], h.[项目], h.[预计交货日期], h.[联系人], h.[备注], h.[审核时间], h.[审批人], h.[审批时间], h.asp_user1, h.asp_time1, h.asp_cancel'
  + N', l.[单据编号] AS line_no, l.[品牌], l.[存货名称], l.[存货编码], l.[规格型号], l.[数量], l.[销售单位], l.[单价], l.[税率%], l.[含税单价], l.[金额], l.[含税金额], l.[折扣金额], l.[现存量]'
  + N', CASE WHEN ISNULL(s.canceled,N''N'')=N''Y'' THEN N''已作废'''
  + N' WHEN ISNULL(s.pending,N''N'')=N''Y'' THEN N''审批中'''
  + N' WHEN s.shr IS NOT NULL THEN N''已审核'''
  + N' ELSE N''草稿'' END AS [单据状态]'
  + N', s.shr AS [审核人]'
  + N' FROM bd_so_order h LEFT JOIN bl_so_order l ON h.[单据编号]=l.[单据编号]'
  + N' LEFT JOIN yj_doc_status s ON s.panel_code = ''SO_ORDER'' AND s.doc_no = h.[单据编号]');
EXEC('CREATE OR ALTER VIEW v_sales_order_stats AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[销售单位], COUNT(DISTINCT h.[单据编号]) AS [订单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额], SUM(COALESCE(l.[含税金额],0)) AS [含税金额] FROM bd_so_order h LEFT JOIN bl_so_order l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[销售单位]');
GO

-- ════════ §4 报表面板注册 + 字段按终版视图重注册 ════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='DISPATCH_DETAIL') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('DISPATCH_DETAIL', N'工序派工单明细表', N'报表', 'flat', 'v_dispatch_detail', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='DISPATCH_STATS') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('DISPATCH_STATS', N'工序派工单统计表', N'报表', 'flat', 'v_dispatch_stats', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'生产制造');
GO
-- 22 个报表面板:字段清空后按终版视图列自动发现注册(flat 面板字段=视图列,label=列名)
DECLARE @panels TABLE (panel_code varchar(40), view_name sysname, is_stats bit);
INSERT INTO @panels VALUES
('DISPATCH_DETAIL','v_dispatch_detail',0),('DISPATCH_STATS','v_dispatch_stats',1),
('FINISH_IN_DETAIL','v_finish_in_detail',0),('FINISH_IN_STATS','v_finish_in_stats',1),
('MANU_ORDER_DETAIL','v_manu_order_detail',0),('MANU_ORDER_STATS','v_manu_order_stats',1),
('MATERIAL_OUT_DETAIL','v_material_out_detail',0),('MATERIAL_OUT_STATS','v_material_out_stats',1),
('OTHER_IN_DETAIL','v_other_in_detail',0),('OTHER_IN_STATS','v_other_in_stats',1),
('OTHER_OUT_DETAIL','v_other_out_detail',0),('OTHER_OUT_STATS','v_other_out_stats',1),
('OUTSOURCE_IN_DETAIL','v_outsource_in_detail',0),('OUTSOURCE_IN_STATS','v_outsource_in_stats',1),
('OUTSOURCE_ISSUE_DETAIL','v_outsource_issue_detail',0),('OUTSOURCE_ISSUE_STATS','v_outsource_issue_stats',1),
('PURCHASE_IN_DETAIL','v_purchase_in_detail',0),('PURCHASE_IN_STATS','v_purchase_in_stats',1),
('SALE_OUT_DETAIL','v_sale_out_detail',0),('SALE_OUT_STATS','v_sale_out_stats',1),
('SALES_ORDER_DETAIL','v_sales_order_detail',0),('SALES_ORDER_STATS','v_sales_order_stats',1);
DECLARE @pc varchar(40), @vw sysname, @isStats bit, @n sysname, @i int;
DECLARE pc CURSOR FOR SELECT panel_code, view_name, is_stats FROM @panels;
OPEN pc; FETCH NEXT FROM pc INTO @pc, @vw, @isStats;
WHILE @@FETCH_STATUS = 0 BEGIN
  DELETE FROM yj_field WHERE panel_code = @pc;
  SET @i = 0;
  DECLARE fc CURSOR FOR SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(@vw) AND c.name NOT IN ('id') ORDER BY c.column_id;
  OPEN fc; FETCH NEXT FROM fc INTO @n;
  WHILE @@FETCH_STATUS = 0 BEGIN
    SET @i += 10;
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES (@pc, @n, @n, N'文本', NULL, NULL, NULL, NULL, N'detail', @i, CASE WHEN @isStats = 1 THEN 120 ELSE 130 END, 1, 0, 0, 1);
    FETCH NEXT FROM fc INTO @n;
  END
  CLOSE fc; DEALLOCATE fc;
  FETCH NEXT FROM pc INTO @pc, @vw, @isStats;
END
CLOSE pc; DEALLOCATE pc;
GO

-- ════════ §5 自检 ════════
SELECT COUNT(*) AS v_views FROM sys.views WHERE name LIKE 'v[_]%';
SELECT p.panel_code, CASE WHEN OBJECT_ID(p.line_table) IS NULL THEN N'❌视图缺失' ELSE N'OK' END AS st
FROM yj_panel p WHERE p.line_table LIKE 'v[_]%' AND OBJECT_ID(p.line_table) IS NULL;
SELECT panel_code, COUNT(*) AS fields FROM yj_field WHERE panel_code IN
('DISPATCH_DETAIL','DISPATCH_STATS','PURCHASE_IN_DETAIL','PURCHASE_IN_STATS','SALES_ORDER_DETAIL','SALES_ORDER_STATS') GROUP BY panel_code;
SELECT COUNT(*) AS dispatch_fields FROM yj_field WHERE panel_code='DISPATCH';
SELECT N'bl_dispatch 形态: ' + CASE WHEN COL_LENGTH('dbo.bl_dispatch',N'工序编码') IS NOT NULL THEN N'中文列 OK' ELSE N'❌仍是英文列' END AS r;
PRINT N'fix-db-restore-20260915 完成';
GO
