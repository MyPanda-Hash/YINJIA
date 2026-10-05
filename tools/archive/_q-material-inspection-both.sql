-- 临时探针:两账套「商品·来料检验」接线现状(schema/面板字段/译名) — 两个库各跑一次
SET NOCOUNT ON;
SELECT DB_NAME() AS 库,
       CASE WHEN COL_LENGTH('dbo.bs_inv', N'来料检验') IS NOT NULL THEN N'有' ELSE N'无' END AS bs_inv来料检验列,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'INV' AND col_name = N'来料检验') AS INV字段行,
       (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'来料检验') AS 译名行数,
       (SELECT COUNT(*) FROM bs_inv WHERE 来料检验 IS NOT NULL AND LTRIM(RTRIM(来料检验)) <> N'') AS 已有值行数,
       (SELECT COUNT(*) FROM bs_inv) AS bs_inv总行数;

SELECT place, seq, col_name, label, editable, hidden, visible
FROM yj_field WHERE panel_code = N'INV' AND col_name IN (N'来料检验', N'商品类型') ORDER BY col_name;

SELECT locale, text, source FROM yj_translation WHERE scope = N'field' AND ref_key = N'来料检验' ORDER BY locale;
