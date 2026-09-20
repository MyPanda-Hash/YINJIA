SET NOCOUNT ON;
SELECT h.单据编号, COUNT(l.id) AS 行数 FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON l.单据编号=h.单据编号
WHERE h.单据编号 IN ('TCGRK-PO-001','PI-2026-09-0009','PI-2026-09-0010') GROUP BY h.单据编号;
GO
