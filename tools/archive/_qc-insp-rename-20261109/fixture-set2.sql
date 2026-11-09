SET NOCOUNT ON;
UPDATE dbo.qc_proc_insp_head SET 产品编码 = N'C-23-11' WHERE 单据编号 = N'ZC-2026-10-0033';
SELECT @@ROWCOUNT AS updated;
