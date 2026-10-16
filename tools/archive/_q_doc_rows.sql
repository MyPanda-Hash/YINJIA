SET NOCOUNT ON;
SELECT 表区, COUNT(*) AS 行数 FROM dbo.qc_proc_insp_detail
WHERE 单据编号 = N'ZC-2026-10-0001' GROUP BY 表区;
SELECT id, 行号, 表区, 检验项目, LEFT(ISNULL(检验要求,''), 18) AS 检验要求, LEFT(ISNULL(检验方法,''), 14) AS 检验方法,
       ISNULL(asp_cancel, N'') AS 作废
FROM dbo.qc_proc_insp_detail WHERE 单据编号 = N'ZC-2026-10-0001' ORDER BY id;
