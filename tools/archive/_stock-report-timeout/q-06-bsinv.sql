/* q-06-bsinv.sql — 复刻 migrate-bs-inv-inspection-align-20261015.sql 的自检,逐条给数(只读) */
SET NOCOUNT ON;
GO
SELECT N'① 物理列' AS item,
       COL_LENGTH('dbo.bs_inv', N'来料检验') AS 来料检验_len,
       COL_LENGTH('dbo.bs_inv', N'是否来料检验') AS 旧列是否还在;
GO
SELECT N'② 列定义' AS item, c.name, t.name AS typ, c.max_length/2 AS len, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.bs_inv') AND c.name = N'来料检验';
GO
SELECT N'③ 面板字段' AS item, id, panel_code, col_name, label, data_type, place, seq, editable, hidden, visible
FROM yj_field WHERE panel_code = 'INV' AND (col_name IN (N'来料检验', N'是否来料检验', N'检验方式', N'商品类型'))
ORDER BY seq;
GO
SELECT N'④ 译名' AS item, ref_key, COUNT(*) AS n FROM yj_translation
WHERE scope = 'field' AND ref_key IN (N'来料检验', N'商品类型') GROUP BY ref_key;
GO
SELECT N'⑤ 列注明' AS item, LEN(LTRIM(RTRIM(CAST(ep.value AS nvarchar(400))))) AS 注明长度
FROM sys.extended_properties ep
WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bs_inv')
  AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_inv'), N'来料检验', 'ColumnId') AND ep.name = N'MS_Description';
GO
SELECT N'⑥ 列数' AS item, COUNT(*) AS bs_inv_列数 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bs_inv');
GO
