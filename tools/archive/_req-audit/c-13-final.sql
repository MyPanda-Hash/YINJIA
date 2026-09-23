SET NOCOUNT ON;
-- 1) 全库任何表含"库位"或"预设"列(主库)
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE N'%库位%' OR COLUMN_NAME LIKE N'%预设%' OR COLUMN_NAME LIKE N'%preset%';
GO
-- 2) yj_field 含 库位/预设 的字段(全库)
SELECT panel_code, col_name, label, place, hidden, visible FROM yj_field
WHERE col_name LIKE N'%库位%' OR label LIKE N'%库位%' OR col_name LIKE N'%预设%' OR label LIKE N'%预设%';
GO
-- 3) 含"特采"的字段或字典
SELECT panel_code, col_name, label, dict_sql FROM yj_field WHERE label LIKE N'%特采%' OR col_name LIKE N'%特采%' OR dict_sql LIKE N'%特采%';
GO
-- 4) 单据数据量
SELECT 'sl_recv' AS t, COUNT(*) AS n FROM sl_recv
UNION ALL SELECT 'qc_recv', COUNT(*) FROM qc_recv
UNION ALL SELECT 'qc_insp', COUNT(*) FROM qc_insp
UNION ALL SELECT 'qc_return', COUNT(*) FROM qc_return
UNION ALL SELECT 'qc_tc', COUNT(*) FROM qc_tc
UNION ALL SELECT 'qc_jjf', COUNT(*) FROM qc_jjf
UNION ALL SELECT 'bd_purchase_in', COUNT(*) FROM bd_purchase_in
UNION ALL SELECT 'bd_pu_order', COUNT(*) FROM bd_pu_order
UNION ALL SELECT 'yj_role_panel', COUNT(*) FROM yj_role_panel
UNION ALL SELECT 'yj_user', COUNT(*) FROM yj_user
UNION ALL SELECT 'yj_doc_batch', COUNT(*) FROM yj_doc_batch;
GO
-- 5) 检验单总结论取值分布(真实用过哪些)
SELECT 总结论, COUNT(*) AS n FROM qc_insp GROUP BY 总结论;
GO
SELECT 处置方式, COUNT(*) AS n FROM qc_insp_detail GROUP BY 处置方式;
GO
-- 6) 送料暂收单 到货日期 是否有自动填
SELECT TOP 5 单据编号, 单据日期, 到货日期, 采购订单号, 批次号 FROM sl_recv ORDER BY id DESC;
GO
