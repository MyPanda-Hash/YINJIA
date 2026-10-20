SET NOCOUNT ON;
SELECT r.id, r.单据编号, r.单据日期, r.单据状态, r.供应商, r.采购订单号, r.批次号, r.备注, r.asp_user1, r.asp_time1,
       (SELECT COUNT(*) FROM sl_recv_detail d WHERE d.单据编号 = r.单据编号) AS 明细行总数
FROM sl_recv r
WHERE r.单据编号 IN (SELECT 单据编号 FROM sl_recv GROUP BY 单据编号 HAVING COUNT(*)>1)
ORDER BY r.单据编号 DESC, r.id;
