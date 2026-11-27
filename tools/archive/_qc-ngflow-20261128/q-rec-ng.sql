-- 取该检验数据记录回填的不合格品处理单号
SELECT ISNULL(r.不合格品处理单号, N'') AS ngNo FROM qc_insp_rec r WHERE r.单据编号 = N'JYSJ-2026-11-0021';
