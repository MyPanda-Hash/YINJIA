SET NOCOUNT ON;
PRINT N'=== E. WH 面板字段的 label_en 现状 ===';
SELECT col_name, label_en FROM yj_field WHERE panel_code = N'WH' ORDER BY seq;
GO
PRINT N'=== F. yj_translation scope=field 的消费方式抽样(仓库编码 全语言) ===';
SELECT locale, text, source FROM yj_translation WHERE scope='field' AND ref_key=N'仓库编码' ORDER BY locale;
GO
