SET NOCOUNT ON;
SELECT 'sl_recv' t, COUNT(*) rows_, COUNT(DISTINCT 单据编号) distinct_ FROM sl_recv;
SELECT 单据编号, COUNT(*) n FROM sl_recv GROUP BY 单据编号 HAVING COUNT(*)>1;
SELECT 'qc_insp' t, COUNT(*) rows_, COUNT(DISTINCT 单据编号) distinct_ FROM qc_insp;
SELECT 单据编号, COUNT(*) n FROM qc_insp GROUP BY 单据编号 HAVING COUNT(*)>1;
SELECT id, 单据编号, 单据日期, 单据状态, 供应商, asp_time1 FROM qc_insp WHERE id > 355 ORDER BY id;
SELECT 工艺路线编码, COUNT(*) n FROM bs_route GROUP BY 工艺路线编码 HAVING COUNT(*)>1;
