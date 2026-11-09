SET NOCOUNT ON;
UPDATE dbo.qc_proc_insp_head SET 产品编码 = N'B-92-25' WHERE 单据编号 = N'ZC-2026-10-0033' AND 产品编码 = N'T270';
SELECT @@ROWCOUNT AS updated;
SELECT 单据编号, 产品编码 FROM dbo.qc_proc_insp_head WHERE 单据编号 = N'ZC-2026-10-0033';
