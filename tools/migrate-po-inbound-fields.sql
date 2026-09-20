-- migrate-po-inbound-fields.sql — 采购入库三字段 + 商品档案检验方式
-- ① 采购入库头:采购订单号已有列,面板补注册显示(选单回填/手工填)
-- ② 商品档案:商品类型列正名为 检验方式(存金蝶 check_type 原值),面板字段+译名同步
-- ③ 采购入库行:是否来料检验(本地MES维护,转ERP不推——金蝶按商品档案 check_type 自行判断)
SET NOCOUNT ON;
GO

-- ══ 1) 采购入库头:采购订单号 面板注册(列已存在,选单时回填) ══
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'采购订单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'采购订单号', N'采购订单号', N'文本', N'query,header', 205, 140, 1, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单号' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单号', 'en', N'PO No.', 'manual');

-- ══ 2) 商品档案:商品类型 → 检验方式(列改名+面板字段改名+译名) + 派生列 是否来料检验 ══
IF COL_LENGTH('dbo.bs_inv', N'商品类型') IS NOT NULL AND COL_LENGTH('dbo.bs_inv', N'检验方式') IS NULL
  EXEC sp_rename N'dbo.bs_inv.商品类型', N'检验方式', N'COLUMN';
-- 计算列:是否来料检验 = 检验方式'1'→是(否则否);存货参照带回同名自动带出(无需同义词)
IF COL_LENGTH('dbo.bs_inv', N'是否来料检验') IS NULL
  ALTER TABLE dbo.bs_inv ADD [是否来料检验] AS CASE WHEN RTRIM(ISNULL(检验方式,'')) = '1' THEN N'是' ELSE N'否' END;
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否来料检验')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('INV', N'是否来料检验', N'是否来料检验', N'文本', N'header', 45, 90, 0, 0, 1, 1);
UPDATE yj_field SET col_name = N'检验方式', label = N'检验方式'
WHERE panel_code='INV' AND col_name = N'商品类型';
UPDATE yj_field SET dict_sql = N'SELECT DISTINCT RTRIM(检验方式) FROM bs_inv WHERE ISNULL(检验方式,'''')<>'''' ORDER BY 1',
  data_type = N'下拉框'
WHERE panel_code='INV' AND col_name = N'检验方式' AND ISNULL(dict_sql,'')='';
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验方式' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验方式', 'en', N'Inspection Type', 'manual');

-- ══ 3) 采购入库行:是否来料检验(本地维护;列可手填,默认按商品档案检验方式带出) ══
IF COL_LENGTH('dbo.bl_purchase_in', N'是否来料检验') IS NULL
  ALTER TABLE dbo.bl_purchase_in ADD [是否来料检验] nvarchar(10) NULL;
GO
UPDATE bl_purchase_in SET 是否来料检验 = CASE WHEN i.检验方式 = '1' THEN N'是' ELSE N'否' END
FROM bl_purchase_in l LEFT JOIN bs_inv i ON RTRIM(i.存货编码) = RTRIM(l.存货编码)
WHERE l.是否来料检验 IS NULL;
GO
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'是否来料检验')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
  VALUES ('PURCHASE_IN', N'是否来料检验', N'是否来料检验', N'下拉框',
          N'SELECT N''是'' AS v UNION ALL SELECT N''否''', N'detail', 300, 90, 1, 0, 0, 1);
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否来料检验' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否来料检验', 'en', N'Incoming Inspection', 'manual');

-- 列注明
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bl_purchase_in')
  AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bl_purchase_in'),N'是否来料检验','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'是否来料检验(本地MES维护;金蝶按商品档案检验方式自行触发,不推接口)',
       N'schema',N'dbo',N'table',N'bl_purchase_in',N'column',N'是否来料检验';
GO

-- 自检
SELECT N'头·采购订单号' AS item, (SELECT COUNT(*) FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'采购订单号') AS n
UNION ALL SELECT N'商品·检验方式', (SELECT COUNT(*) FROM yj_field WHERE panel_code='INV' AND col_name=N'检验方式')
UNION ALL SELECT N'行·是否来料检验', (SELECT COUNT(*) FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'是否来料检验');
SELECT TOP 5 l.存货编码, l.是否来料检验 FROM bl_purchase_in l WHERE l.是否来料检验 IS NOT NULL;
PRINT N'采购入库三字段+商品检验方式 完成';
GO
