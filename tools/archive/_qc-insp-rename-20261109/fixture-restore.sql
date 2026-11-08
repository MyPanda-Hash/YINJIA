SET NOCOUNT ON;
UPDATE dbo.qc_proc_insp_head SET 产品编码 = N'T270' WHERE 单据编号 = N'ZC-2026-10-0033' AND 产品编码 = N'C-23-11';
SELECT @@ROWCOUNT AS restored;
SELECT 单据编号, 产品编码 FROM dbo.qc_proc_insp_head WHERE 单据编号 = N'ZC-2026-10-0033';
