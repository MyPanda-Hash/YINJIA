-- migrate-material-inspection-field.sql — 商品·来料检验(金蝶自定义字段)接线 + check_type 语义纠正
-- 背景:金蝶商品自定义字段「来料检验」(沙箱键 custom_field__1__62jiaob3z7yj97,值 是/否)已实证 API 可读;
--      官方文档:check_type=商品类型(1普通/2套装/3服务)——此前误更名"检验方式",本次纠正回 商品类型。
SET NOCOUNT ON;
GO

-- ══ 1) bs_inv:检验方式 → 商品类型(纠正);删计算列,建真实列 来料检验 ══
IF COL_LENGTH('dbo.bs_inv', N'检验方式') IS NOT NULL AND COL_LENGTH('dbo.bs_inv', N'商品类型') IS NULL
  EXEC sp_rename N'dbo.bs_inv.检验方式', N'商品类型', N'COLUMN';
IF COL_LENGTH('dbo.bs_inv', N'是否来料检验') IS NOT NULL
  ALTER TABLE dbo.bs_inv DROP COLUMN [是否来料检验];
IF COL_LENGTH('dbo.bs_inv', N'来料检验') IS NULL
  ALTER TABLE dbo.bs_inv ADD [来料检验] nvarchar(10) NULL;
GO

-- ══ 2) INV 面板字段:检验方式→商品类型(去字典),是否来料检验→来料检验(真实列,只读) ══
UPDATE yj_field SET col_name = N'商品类型', label = N'商品类型', data_type = N'文本', dict_sql = NULL
WHERE panel_code='INV' AND col_name = N'检验方式';
UPDATE yj_field SET col_name = N'来料检验', label = N'来料检验', place = N'detail', seq = 44, editable = 0
WHERE panel_code='INV' AND col_name = N'是否来料检验';

-- ══ 3) 采购入库行·是否来料检验:来源语义不变(商品联动),值由 bs_inv.来料检验 提供(脚本回填) ══

-- ══ 4) 译名 ══
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'商品类型' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'商品类型', 'en', N'Item Type', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'来料检验' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'来料检验', 'en', N'Incoming Inspection', 'manual');

-- ══ 5) 列注明 ══
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.bs_inv')
  AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.bs_inv'),N'来料检验','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'来料检验(金蝶商品自定义字段同步,值 是/否;金蝶界面维护,MES只读)',
       N'schema',N'dbo',N'table',N'bs_inv',N'column',N'来料检验';
GO

-- 自检
SELECT N'列' AS k, N'来料检验' AS v, CASE WHEN COL_LENGTH('dbo.bs_inv', N'来料检验') IS NOT NULL THEN 1 ELSE 0 END AS ok
UNION ALL SELECT N'列', N'商品类型', CASE WHEN COL_LENGTH('dbo.bs_inv', N'商品类型') IS NOT NULL THEN 1 ELSE 0 END
UNION ALL SELECT N'字段', N'INV·来料检验', (SELECT COUNT(*) FROM yj_field WHERE panel_code='INV' AND col_name=N'来料检验')
UNION ALL SELECT N'字段', N'INV·商品类型', (SELECT COUNT(*) FROM yj_field WHERE panel_code='INV' AND col_name=N'商品类型');
PRINT N'商品·来料检验接线(库侧)完成';
GO
