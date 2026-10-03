SET NOCOUNT ON;
GO
PRINT '=== 测试账套:探针批次号残留的送料暂收单 ===';
SELECT r.单据编号, r.批次号, ISNULL(r.asp_cancel,'N') AS asp_cancel,
       ISNULL(s.canceled,'N') AS canceled, ISNULL(s.deleting,'N') AS deleting,
       (SELECT ISNULL(SUM(数量),0) FROM sl_recv_detail d WHERE d.单据编号 = r.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 数量合计
FROM sl_recv r LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_RECV' AND s.doc_no = r.单据编号
WHERE r.批次号 IN (N'HDN-20261003', N'隔离-20261003', N'弹窗改-20261003', N'对话框改-20261003')
ORDER BY r.id DESC;
GO
PRINT '=== 同批次号在正式账套(应无)===';
SELECT COUNT(*) AS 条数 FROM HSDZ_MES.dbo.sl_recv WHERE 批次号 LIKE N'隔离-%' OR 批次号 LIKE N'弹窗改-%' OR 批次号 LIKE N'对话框改-%';
GO
