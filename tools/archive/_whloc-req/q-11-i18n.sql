SET NOCOUNT ON;
PRINT N'=== 改名后 与 WHLOC/WH 相关的英/日语译名(终态) ===';
SELECT ref_key, locale, text FROM yj_translation
WHERE scope IN ('panel','field')
  AND ref_key IN (N'仓位', N'仓位编码', N'仓位地址', N'仓库', N'仓库编码')
  AND locale IN ('en','ja','zh-TW')
ORDER BY ref_key, locale;
GO
PRINT N'=== WHLOC 面板 6 字段的 label 与 en 译名对照 ===';
SELECT f.col_name, f.label, ISNULL(t.text, N'(缺 en)') AS en
FROM yj_field f
LEFT JOIN yj_translation t ON t.scope='field' AND t.ref_key=f.label AND t.locale='en'
WHERE f.panel_code='WHLOC' ORDER BY f.seq, f.id;
GO
PRINT N'=== WH 面板 仓位 字段的 en 译名 ===';
SELECT f.col_name, f.label, ISNULL(t.text, N'(缺 en)') AS en
FROM yj_field f
LEFT JOIN yj_translation t ON t.scope='field' AND t.ref_key=f.label AND t.locale='en'
WHERE f.panel_code='WH' AND f.label IN (N'仓位', N'启用仓位管理');
GO
