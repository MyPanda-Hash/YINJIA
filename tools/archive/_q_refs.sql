-- _q_refs.sql — 采购链上已有的参照类链接字段(避免重复造字段)
SET NOCOUNT ON;
PRINT '── SL_RECV / QC_INSP / PURCHASE_IN 的全部字段(含参照去向) ──';
SELECT panel_code, place, seq, col_name, label, data_type, ref_panel, ref_field, display_field, editable, hidden, visible
FROM yj_field
WHERE panel_code IN ('SL_RECV','QC_INSP','PURCHASE_IN')
ORDER BY panel_code, place, seq, col_name;
GO
PRINT '── SL_RECV 已生成单据的 采购单号/订单号 取值(看是否在用) ──';
SELECT TOP 5 单据编号, 物料编码, 采购单号, 订单号, 数量 FROM sl_recv_detail ORDER BY id DESC;
GO
SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(采购单号,'')<>'' THEN 1 ELSE 0 END) AS 采购单号有值,
       SUM(CASE WHEN ISNULL(订单号,'')<>'' THEN 1 ELSE 0 END) AS 订单号有值 FROM sl_recv_detail;
GO
