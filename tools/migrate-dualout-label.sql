-- migrate-dualout-label.sql — 直销数量标签统一(去括号后缀,表单键/标签一致才落库)
SET NOCOUNT ON;
UPDATE yj_field SET label = N'直销数量' WHERE panel_code = 'WO_REPORT' AND col_name = N'直销数量' AND label <> N'直销数量';
DELETE FROM yj_translation WHERE scope = 'field' AND ref_key = N'直销数量(切炭)' AND locale = 'en';
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'直销数量' AND locale = 'en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'直销数量', 'en', N'Direct-sale Qty', 'manual');
GO
PRINT N'migrate-dualout-label 完成';
GO
