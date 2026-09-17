-- migrate-qc-insp-sync-cols.sql — 来料检验单明细补齐 SL_RECV 联动列(幂等)
-- 背景:ButtonService.syncInspFromSlRecv / 生采购入库 / 生暂收退料 三条链路的 SQL
--       引用 qc_insp_detail 的列,与建表迁移(migrate-qc-8sheets)列名存在差异,补齐对齐:
--  ① 行级同步 UPDATE:d.物料描述/箱数/日期/结案/部门/部门名称 ← sl_recv_detail 同名列
--  ② 入库单号回填:生采购入库后 UPDATE qc_insp_detail SET 入库单号=...,作废释放时置 NULL
--  ③ 退料生单 SELECT:不良数量(=不合格数量 只读别名,用计算列恒同步免维护)
SET NOCOUNT ON;

-- ══ 1) 物理列 ══
IF COL_LENGTH('dbo.qc_insp_detail', N'物料描述') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [物料描述] nvarchar(1000) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'箱数') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [箱数] float NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'日期') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [日期] nvarchar(40) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'结案') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [结案] nvarchar(20) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'部门') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [部门] nvarchar(200) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'部门名称') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [部门名称] nvarchar(200) NULL;
IF COL_LENGTH('dbo.qc_insp_detail', N'入库单号') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [入库单号] nvarchar(50) NULL;
-- 不良数量:只读计算列(代码只 SELECT,永无写入)恒等于 不合格数量
IF COL_LENGTH('dbo.qc_insp_detail', N'不良数量') IS NULL
  ALTER TABLE dbo.qc_insp_detail ADD [不良数量] AS [不合格数量];

-- ══ 2) 面板字段注册(QC_INSP 明细区,接 批号280 之后) ══
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'物料描述')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'物料描述', N'物料描述', N'文本', N'detail', 290, 160, 1, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'箱数')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'箱数', N'箱数', N'小数', N'detail', 300, 80, 1, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'日期')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'日期', N'日期', N'文本', N'detail', 310, 100, 1, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'结案')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'结案', N'结案', N'文本', N'detail', 320, 80, 1, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'部门')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'部门', N'部门', N'文本', N'detail', 330, 100, 1, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'部门名称')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'部门名称', N'部门名称', N'文本', N'detail', 340, 100, 1, 0, 0, 1);
-- 入库单号:系统回填簿记列,默认隐藏(表格调整可再显)
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'入库单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'入库单号', N'入库单号', N'文本', N'detail', 350, 130, 0, 0, 1, 1);

-- ══ 3) 译名(en;部门/部门名称/日期/入库单号/备注 全局已有) ══
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料描述' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料描述', 'en', N'Material Description', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'箱数' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'箱数', 'en', N'Box Qty', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结案' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结案', 'en', N'Closed', 'manual');

-- ══ 4) 列注明(中文扩展属性,幂等) ══
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),N'物料描述','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'物料描述(送料暂收单同步)', N'schema',N'dbo',N'table',N'qc_insp_detail',N'column',N'物料描述';
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),N'箱数','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'箱数(送料暂收单同步)', N'schema',N'dbo',N'table',N'qc_insp_detail',N'column',N'箱数';
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),N'入库单号','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'生成的采购入库单号(审核生单回填,作废释放置空)', N'schema',N'dbo',N'table',N'qc_insp_detail',N'column',N'入库单号';
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'),N'不良数量','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'不良数量(计算列=不合格数量,退料生单只读)', N'schema',N'dbo',N'table',N'qc_insp_detail',N'column',N'不良数量';

PRINT N'qc_insp_detail 联动列补齐完成';
