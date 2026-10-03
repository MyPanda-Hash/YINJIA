-- 临时探针:采购入库单行「是否来料检验」当前取值来源(=生单判定 还是 商品档案联动)
SET NOCOUNT ON;
SELECT panel_code, place, seq, col_name, ISNULL(alias, N'') AS alias, ISNULL(ref_panel, N'') AS ref_panel,
       ISNULL(ref_field, N'') AS ref_field, ISNULL(display_field, N'') AS display_field, editable, hidden
FROM yj_field
WHERE col_name = N'是否来料检验' ORDER BY panel_code, place, seq;

SELECT 是否来料检验, COUNT(*) AS 行数 FROM bl_purchase_in GROUP BY 是否来料检验;
