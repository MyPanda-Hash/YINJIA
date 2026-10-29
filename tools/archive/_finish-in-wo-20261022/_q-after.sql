SET NOCOUNT ON;
SELECT COUNT(*) AS 头, SUM(CASE WHEN ISNULL(加工单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有加工单号,
       SUM(CASE WHEN ISNULL(加工单号,N'')=N'' THEN 1 ELSE 0 END) AS 空加工单号 FROM dbo.bd_finish_in;
SELECT TOP 40 h.单据编号, h.单据日期, h.加工单号, h.工单行号,
       (SELECT COUNT(DISTINCT l.产品编码) FROM dbo.bl_finish_in l WHERE l.单据编号=h.单据编号) AS 产品数
  FROM dbo.bd_finish_in h WHERE ISNULL(h.加工单号,N'')<>N'' ORDER BY h.单据编号 DESC;
SELECT COUNT(*) AS 留痕行 FROM dbo.yj_usage_log WHERE panel_name=N'产成品入库单' AND action_name LIKE N'数据修复·补齐加工单号(%';
SELECT TOP 3 action_name, doc_no, 工单行号, created_at FROM dbo.yj_usage_log WHERE panel_name=N'产成品入库单' ORDER BY id DESC;
