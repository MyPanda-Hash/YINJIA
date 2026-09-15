-- 探针4:yj_field 列结构 + KHDA 样例行 + 翻译现状 + bd_pu_order 供应商侧列名
SET NOCOUNT ON;
SELECT c.name + N' ' + t.name + CASE WHEN c.is_nullable=1 THEN N' NULL' ELSE N' NOT NULL' END
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_field') ORDER BY c.column_id;
GO
SELECT N'== SAMPLE KHDA row ==' AS m;
SELECT TOP 2 panel_code, col_name, label, seq, place, data_type, required, ref_panel, ref_field, display_field, visible, width, alias FROM yj_field WHERE panel_code='KHDA' ORDER BY seq;
GO
SELECT N'== LOCALES ==' AS m;
SELECT locale FROM yj_locale ORDER BY locale;
GO
SELECT N'== TRANS existing? ==' AS m;
SELECT scope + N' :: ' + ref_key + N' :: ' + locale + N' :: ' + text FROM yj_translation
WHERE (scope='field' AND ref_key IN (N'客户编码',N'供应商编码',N'供应商名称',N'供应商级别',N'到货地址',N'联系人',N'业务员编码',N'业务员名称',N'仓库编码',N'客户名称',N'仓库名称',N'业务员'))
   OR (scope='panel' AND ref_key IN (N'厂商档案',N'供应商档案',N'客户档案',N'业务员档案',N'仓库档案'))
ORDER BY ref_key, locale;
GO
SELECT N'== bd_pu_order supplier cols ==' AS m;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('bd_pu_order') AND c.name IN (N'供应商',N'供应商编码',N'币种',N'汇率',N'到货地址',N'交货日期');
GO
SELECT N'== dm_kh lxr? ==' AS m;
SELECT COUNT(1) AS cnt FROM sys.columns WHERE object_id=OBJECT_ID('dm_kh') AND name=N'lxr';
GO
