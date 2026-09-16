-- migrate-erp-push-button.sql — 转ERP按钮:字段+面板注册+按钮组
-- 新增字段:ERP单号(金蝶生成的)、转ERP操作人、转ERP时间
-- 按钮:仅已审核且未转过的单可点击
SET NOCOUNT ON;

-- ══ 1) 物理列 ══
-- 是否已转ERP:推送状态闸门(ButtonService 过滤 ISNULL(是否已转ERP,'否')<>'是',弃审回置'否');
-- 2026-09-16 合并补遗:原稿漏建此列(开发库手工建过),正式迁移补齐;存量行 NULL=未转,无需回填
IF COL_LENGTH('dbo.bd_purchase_in', N'是否已转ERP') IS NULL
  ALTER TABLE dbo.bd_purchase_in ADD [是否已转ERP] nvarchar(10) NULL;
IF COL_LENGTH('dbo.bd_sale_out', N'是否已转ERP') IS NULL
  ALTER TABLE dbo.bd_sale_out ADD [是否已转ERP] nvarchar(10) NULL;

IF COL_LENGTH('dbo.bd_purchase_in', N'ERP单号') IS NULL
  ALTER TABLE dbo.bd_purchase_in ADD [ERP单号] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bd_purchase_in', N'转ERP操作人') IS NULL
  ALTER TABLE dbo.bd_purchase_in ADD [转ERP操作人] nvarchar(50) NULL;
IF COL_LENGTH('dbo.bd_purchase_in', N'转ERP时间') IS NULL
  ALTER TABLE dbo.bd_purchase_in ADD [转ERP时间] nvarchar(30) NULL;

IF COL_LENGTH('dbo.bd_sale_out', N'ERP单号') IS NULL
  ALTER TABLE dbo.bd_sale_out ADD [ERP单号] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bd_sale_out', N'转ERP操作人') IS NULL
  ALTER TABLE dbo.bd_sale_out ADD [转ERP操作人] nvarchar(50) NULL;
IF COL_LENGTH('dbo.bd_sale_out', N'转ERP时间') IS NULL
  ALTER TABLE dbo.bd_sale_out ADD [转ERP时间] nvarchar(30) NULL;

-- ══ 2) 面板字段(表头,只读) ══
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'ERP单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'ERP单号', N'ERP单号', N'文本', N'header', 200, 120, 0, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'转ERP操作人')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'转ERP操作人', N'转ERP操作人', N'文本', N'header', 201, 100, 0, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'转ERP时间')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'转ERP时间', N'转ERP时间', N'文本', N'header', 202, 130, 0, 0, 0, 1);

IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'ERP单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALE_OUT', N'ERP单号', N'ERP单号', N'文本', N'header', 200, 120, 0, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'转ERP操作人')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALE_OUT', N'转ERP操作人', N'转ERP操作人', N'文本', N'header', 201, 100, 0, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'转ERP时间')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('SALE_OUT', N'转ERP时间', N'转ERP时间', N'文本', N'header', 202, 130, 0, 0, 0, 1);

-- ══ 3) 译名 ══
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'ERP单号' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'ERP单号', 'en', 'ERP Bill No', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'转ERP操作人' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'转ERP操作人', 'en', 'Pushed By', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'转ERP时间' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'转ERP时间', 'en', 'Pushed At', 'manual');

GO
PRINT N'转ERP字段+面板注册完成';
GO
