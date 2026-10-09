-- 诊断:四处差异字段在两账套的 yj_field 行(2026-10-08)
SET NOCOUNT ON;
PRINT '=== PURCHASE_IN「结算金额本位币」类字段 ===';
GO
SELECT RTRIM(col_name) AS 列名, label, place, seq, hidden, visible, id FROM yj_field
WHERE RTRIM(panel_code) = 'PURCHASE_IN' AND col_name LIKE N'%结算金额%' ORDER BY seq;
GO
PRINT '=== QC_RETURN 查询区 采购订单号/批次号 的 seq 与 id(顺序并列看 id) ===';
GO
SELECT RTRIM(col_name) AS 列名, place, seq, id FROM yj_field
WHERE RTRIM(panel_code) = 'QC_RETURN' AND col_name IN (N'采购订单号', N'批次号') ORDER BY seq, id;
GO
PRINT '=== PURCHASE_IN 明细页签 place 分布(尾 6 行,看 seq 并列) ===';
GO
SELECT RTRIM(col_name) AS 列名, place, seq, id FROM yj_field
WHERE RTRIM(panel_code) = 'PURCHASE_IN' AND place LIKE '%detail%' ORDER BY seq DESC, id DESC;
GO
