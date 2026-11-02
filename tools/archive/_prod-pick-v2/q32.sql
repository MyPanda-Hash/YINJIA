SET NOCOUNT ON;
SELECT '退料单作废' k, CAST(ISNULL(canceled,'N') AS nvarchar) a FROM yj_doc_status WHERE doc_no='OI-2026-10-0003'
UNION ALL SELECT '退料行软删', CAST(COUNT(*) AS nvarchar) FROM bl_other_in WHERE 单据编号='OI-2026-10-0003' AND ISNULL(asp_cancel,'N')='N'
UNION ALL SELECT '领料审核人', ISNULL(shr,'') FROM yj_doc_status WHERE doc_no='LL-2026-10-0005';
GO
SELECT 存货编码, 仓库, 现存量 FROM v_stock_pick WHERE 存货编码 IN ('YJ-ZZ-001','YJ-KBL-012') AND 仓库='恒亿仓';
GO
SELECT TOP 3 单据编号, COUNT(*) 行 FROM (SELECT 单据编号 FROM outh WHERE 单据编号='LL-2026-10-0005') t GROUP BY 单据编号;
