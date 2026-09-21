USE HSDZ_MES; SET NOCOUNT ON;
-- 最早两次探针跑留下的**空白草稿**(产品编号/事由都为空,早期的清理脚本按事由匹配漏掉了)
DELETE FROM rd_change_detail WHERE 单据编号 IN (N'CHG-2026-09-0001', N'CHG-2026-09-0003');
DELETE FROM yj_doc_status WHERE panel_code = N'RD_CHANGE' AND doc_no IN (N'CHG-2026-09-0001', N'CHG-2026-09-0003');
DELETE FROM rd_change_head WHERE 单据编号 IN (N'CHG-2026-09-0001', N'CHG-2026-09-0003');
SELECT N'CHG 单据' AS k, CAST(COUNT(*) AS nvarchar(10)) AS n FROM rd_change_head;
GO
