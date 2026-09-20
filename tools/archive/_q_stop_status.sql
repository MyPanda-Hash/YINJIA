SET NOCOUNT ON;
PRINT '── PU_ORDER 按推导状态分布(已作废>已中止>...>已审核>草稿)──';
SELECT CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废'
            WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止'
            WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中'
            WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 推导状态,
       COUNT(*) AS 单数
FROM bd_pu_order h LEFT JOIN yj_doc_status s ON s.panel_code='PU_ORDER' AND s.doc_no=h.单据编号
GROUP BY CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废'
              WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止'
              WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中'
              WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END;
GO
PRINT '── 已中止的采购订单:stop_by 是否为空(空=同步置的,非空=MES 用户点中止)──';
SELECT TOP 15 h.单据编号, h.单据日期, h.供应商, ISNULL(h.单据状态,N'(表内空)') AS 表内单据状态,
       ISNULL(s.stopped,N'-') AS stopped, ISNULL(s.stop_by,N'(空)') AS stop_by, s.stop_at, ISNULL(s.shr,N'(空)') AS 审核人
FROM bd_pu_order h JOIN yj_doc_status s ON s.panel_code='PU_ORDER' AND s.doc_no=h.单据编号
WHERE ISNULL(s.stopped,'N')='Y' ORDER BY h.单据编号 DESC;
GO
PRINT '── 已中止单数 / 其中 stop_by 为空(同步来源)──';
SELECT COUNT(*) AS 已中止总数, SUM(CASE WHEN s.stop_by IS NULL THEN 1 ELSE 0 END) AS 同步置的, SUM(CASE WHEN s.stop_by IS NOT NULL THEN 1 ELSE 0 END) AS MES用户中止
FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND ISNULL(s.stopped,'N')='Y';
GO
