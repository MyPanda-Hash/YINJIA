SET NOCOUNT ON;
SELECT id, 单据编号, 单据日期, 单据状态, 供应商, asp_user1, asp_time1 FROM qc_insp WHERE id > 350 ORDER BY id;
