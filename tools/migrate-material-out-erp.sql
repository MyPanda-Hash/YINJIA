-- migrate-material-out-erp.sql — 材料出库单(MATERIAL_OUT)开通转ERP:回写四列 + 字段注册(2026-09-28)
-- ═════════════════════════════════════════════════════════════════════════════════
-- 用户口径:「材料出库单这个表要转ERP的」——此前转ERP只支持 采购订单/采购入库/销售出库
-- (推 pur_order / pur_inbound / sal_out_bound),本次给材料出库单开通:
--   · KingdeePushService.pushDocument 增 MATERIAL_OUT 分支 → 推金蝶「生产领料单」/jdy/v2/scm/inv_pick;
--   · ButtonService 转ERP / 查询可转ERP / 弃审清标记 三处放行 MATERIAL_OUT;
--   · PanelConfigService MATERIAL_OUT 工具栏加 转ERP 组。
--
-- 为什么是「生产领料单」:金蝶真实账套只读实测(2026-09-28,deploy/_probe-matout.mjs)——
--   /jdy/v2/scm/inv_pick(生产领料单)**4801 张**,是真实在用的料件出库单;
--   同族对照:pur_inbound 3266 张、sal_out_bound 5084 张、inv_other_out(其他出库单)1130 张。
--   其余候选路径(/jdy/v2/pm/*、material_out、inv_out…)一律 519 无此接口。
--
-- 本脚本:bd_material_out 补 是否已转ERP/ERP单号/转ERP操作人/转ERP时间 四列(对齐 bd_purchase_in 口径)
--   + yj_field 注册(display=1,与 PURCHASE_IN/SALE_OUT 现有可见状态一致,便于列表直接看转ERP结果)。
-- 幂等:COL_LENGTH 判存;字段 NOT EXISTS。自检:四列齐 + 四字段行齐。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO
IF COL_LENGTH('dbo.bd_material_out', N'是否已转ERP') IS NULL ALTER TABLE bd_material_out ADD [是否已转ERP] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bd_material_out', N'ERP单号')    IS NULL ALTER TABLE bd_material_out ADD [ERP单号] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bd_material_out', N'转ERP操作人') IS NULL ALTER TABLE bd_material_out ADD [转ERP操作人] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bd_material_out', N'转ERP时间')  IS NULL ALTER TABLE bd_material_out ADD [转ERP时间] nvarchar(60) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bd_material_out') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bd_material_out'),N'是否已转ERP','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:是/否(空=否);弃审自动清', N'SCHEMA',N'dbo',N'TABLE',N'bd_material_out',N'COLUMN',N'是否已转ERP';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bd_material_out') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bd_material_out'),N'ERP单号','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:金蝶生成的生产领料单号(SCLL-…)', N'SCHEMA',N'dbo',N'TABLE',N'bd_material_out',N'COLUMN',N'ERP单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bd_material_out') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bd_material_out'),N'转ERP操作人','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:操作人账号', N'SCHEMA',N'dbo',N'TABLE',N'bd_material_out',N'COLUMN',N'转ERP操作人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bd_material_out') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bd_material_out'),N'转ERP时间','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:时间(YYYY-MM-DD HH:mm:ss)', N'SCHEMA',N'dbo',N'TABLE',N'bd_material_out',N'COLUMN',N'转ERP时间';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, N'文本', v.place, v.seq, 130, 0, 0, 0, 1
FROM (VALUES
  ('MATERIAL_OUT', N'ERP单号',     N'ERP单号',     N'header', 270, 1),
  ('MATERIAL_OUT', N'转ERP操作人',  N'转ERP操作人',  N'header', 280, 1),
  ('MATERIAL_OUT', N'转ERP时间',   N'转ERP时间',   N'header', 290, 1),
  ('MATERIAL_OUT', N'是否已转ERP',  N'是否已转ERP',  N'header', 300, 1)
) v(panel_code, col_name, label, place, seq, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name);
PRINT N'[matout-erp] 字段注册: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(首次 4,复跑 0)';
GO
-- 译名:四个标签在 采购入库/销售出库 已有 en,这里补齐缺失(不覆盖已有译名)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', v.k, 'en', v.t, 'manual'
FROM (VALUES
  (N'是否已转ERP', N'Pushed to ERP'), (N'ERP单号', N'ERP Bill No'),
  (N'转ERP操作人', N'ERP Push Operator'), (N'转ERP时间', N'ERP Push Time')
) v(k, t)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope='field' AND x.ref_key=v.k AND x.locale='en');
GO
DECLARE @c int = (SELECT COUNT(*) FROM (VALUES (N'是否已转ERP'),(N'ERP单号'),(N'转ERP操作人'),(N'转ERP时间')) t(c)
                   WHERE COL_LENGTH('dbo.bd_material_out', c) IS NULL);
DECLARE @f int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='MATERIAL_OUT'
                   AND col_name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间'));
IF @c <> 0 OR @f <> 4
    RAISERROR(N'[matout-erp] 自检失败:缺列 %d(应0)/缺字段行 %d(应4)', 16, 1, @c, @f);
ELSE
    PRINT N'[matout-erp] 自检通过:四列四字段齐备,MATERIAL_OUT 转ERP 链路就绪';
GO
