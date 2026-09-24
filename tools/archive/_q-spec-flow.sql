SET NOCOUNT ON;
PRINT '== ① 规格型号字段行(5 面板) ==';
SELECT panel_code, col_name, place, hidden, visible FROM yj_field
 WHERE col_name IN (N'规格型号', N'型号') AND panel_code IN ('PU_ORDER','QC_RECV','QC_INSP','PURCHASE_IN','QC_RETURN')
 ORDER BY panel_code;
PRINT '== ② 规格型号数据填充率(全量) ==';
SELECT 'bl_pu_order' AS t, COUNT(*) AS 总, SUM(CASE WHEN ISNULL(规格型号,'')<>'' THEN 1 ELSE 0 END) AS 有值 FROM bl_pu_order
UNION ALL SELECT 'sl_recv_detail', COUNT(*), SUM(CASE WHEN ISNULL(规格型号,'')<>'' THEN 1 ELSE 0 END) FROM sl_recv_detail
UNION ALL SELECT 'qc_insp_detail', COUNT(*), SUM(CASE WHEN ISNULL(规格型号,'')<>'' THEN 1 ELSE 0 END) FROM qc_insp_detail
UNION ALL SELECT 'bl_purchase_in', COUNT(*), SUM(CASE WHEN ISNULL(规格型号,'')<>'' THEN 1 ELSE 0 END) FROM bl_purchase_in;
PRINT '== ③ 最近 8 行暂收明细(看断流起点) ==';
SELECT TOP 8 单据编号, 物料编码, 规格型号, 数量 FROM sl_recv_detail ORDER BY id DESC;
PRINT '== ④ 最近 8 行检验明细 ==';
SELECT TOP 8 单据编号, 物料编码, 规格型号, 送检数量 FROM qc_insp_detail ORDER BY id DESC;
PRINT '== ⑤ 最近 8 行入库明细 ==';
SELECT TOP 8 单据编号, 存货编码, 规格型号, 实收数量 FROM bl_purchase_in ORDER BY id DESC;
GO
