-- migrate-po-push-erp.sql — 采购订单(PU_ORDER)开通转ERP:回写四列 + 隐藏字段注册(2026-09-23)
-- ═════════════════════════════════════════════════════════════════════════════════
-- 用户口径:「把采购订单 YJ-20260909-01 传到测试沙箱的采购订单里去」——此前转ERP只支持
-- 采购入库/销售出库(推 pur_inbound/sal_out_bound),本次给采购订单开直推(推 pur_order):
--   · KingdeePushService.pushDocument 增 PU_ORDER 分支(物料编码/数量/单价/单位,不推仓库/批号/src,
--     目标账套同号订单已存在则拒,防重复落单);
--   · ButtonService 转ERP/查询可转ERP/弃审清标记 三处放行 PU_ORDER;
--   · PanelConfigService PU_ORDER 工具栏加 转ERP 组。
-- 本脚本:bd_pu_order 补 是否已转ERP/ERP单号/转ERP操作人/转ERP时间 四列(对齐 bd_purchase_in 口径)
--   + yj_field 注册 hidden=1(仅落库回写,不进表单/列表,与 采购入库 的同名字段同口径;标签全局共享译名)。
-- 幂等:COL_LENGTH 判存;字段 NOT EXISTS。自检:四列齐 + 四字段行齐。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO
IF COL_LENGTH('dbo.bd_pu_order', N'是否已转ERP') IS NULL ALTER TABLE bd_pu_order ADD [是否已转ERP] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bd_pu_order', N'ERP单号')    IS NULL ALTER TABLE bd_pu_order ADD [ERP单号] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bd_pu_order', N'转ERP操作人') IS NULL ALTER TABLE bd_pu_order ADD [转ERP操作人] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bd_pu_order', N'转ERP时间')  IS NULL ALTER TABLE bd_pu_order ADD [转ERP时间] nvarchar(60) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bd_pu_order') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bd_pu_order'),N'是否已转ERP','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:是/否(空=否);弃审自动清', N'SCHEMA',N'dbo',N'TABLE',N'bd_pu_order',N'COLUMN',N'是否已转ERP';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bd_pu_order') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bd_pu_order'),N'ERP单号','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:金蝶生成的采购订单号', N'SCHEMA',N'dbo',N'TABLE',N'bd_pu_order',N'COLUMN',N'ERP单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bd_pu_order') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bd_pu_order'),N'转ERP操作人','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:操作人账号', N'SCHEMA',N'dbo',N'TABLE',N'bd_pu_order',N'COLUMN',N'转ERP操作人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bd_pu_order') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bd_pu_order'),N'转ERP时间','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:时间(YYYY-MM-DD HH:mm:ss)', N'SCHEMA',N'dbo',N'TABLE',N'bd_pu_order',N'COLUMN',N'转ERP时间';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, N'文本', v.place, v.seq, 120, 0, 0, 1, 0
FROM (VALUES
  ('PU_ORDER', N'是否已转ERP', N'是否已转ERP', N'header', 401, 1),
  ('PU_ORDER', N'ERP单号',     N'ERP单号',     N'header', 402, 1),
  ('PU_ORDER', N'转ERP操作人',  N'转ERP操作人',  N'header', 403, 1),
  ('PU_ORDER', N'转ERP时间',   N'转ERP时间',   N'header', 404, 1)
) v(panel_code, col_name, label, place, seq, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name);
PRINT N'[po-push-erp] 字段注册: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(首次 4,复跑 0)';
GO
DECLARE @c int = (SELECT COUNT(*) FROM (VALUES (N'是否已转ERP'),(N'ERP单号'),(N'转ERP操作人'),(N'转ERP时间')) t(c)
                   WHERE COL_LENGTH('dbo.bd_pu_order', c) IS NULL);
DECLARE @f int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='PU_ORDER'
                   AND col_name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间') AND hidden = 1);
IF @c <> 0 OR @f <> 4
    RAISERROR(N'[po-push-erp] 自检失败:缺列 %d(应0)/缺字段行 %d(应4)', 16, 1, @c, @f);
ELSE
    PRINT N'[po-push-erp] 自检通过:四列四字段齐备,PU_ORDER 转ERP 链路就绪';
GO
