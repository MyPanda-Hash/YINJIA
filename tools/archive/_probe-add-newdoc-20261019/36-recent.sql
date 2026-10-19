SET NOCOUNT ON;
SELECT TOP 8 id, 单据编号, 单据日期, 单据状态, 供应商, asp_user1, asp_time1 FROM sl_recv ORDER BY id DESC;
SELECT TOP 8 id, 单据编号, 单据日期, 单据状态, 供应商, asp_user1, asp_time1 FROM qc_insp ORDER BY id DESC;
SELECT MAX(CAST(RIGHT(dh,4) AS int)) sl_pool FROM s_allno WHERE lb='SL' AND ny='2026-10';
SELECT MAX(CAST(RIGHT(dh,4) AS int)) ij_pool FROM s_allno WHERE lb='IJ' AND ny='2026-10';
