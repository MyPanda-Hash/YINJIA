SELECT TOP 6 id, 单据编号, 工单号, 单据日期, 单据状态, asp_user1, asp_time1 FROM qc_first_insp_head ORDER BY id DESC;

SELECT 单据编号, COUNT(*) AS n FROM qc_first_insp_detail WHERE 单据编号 IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011') GROUP BY 单据编号;

SELECT d.检验列, d.样品序号, d.实测数值, d.标准, d.行类型
FROM qc_first_insp_detail d
WHERE d.单据编号='SJ-2026-11-0011' AND d.实测数值 IS NOT NULL AND LTRIM(RTRIM(d.实测数值)) <> ''
ORDER BY d.检验列, d.样品序号;

SELECT d.检验列, d.样品序号, d.实测数值
FROM qc_first_insp_detail d
WHERE d.单据编号='SJ-2026-11-0011' AND d.检验列 IN ('outer','drop','compress')
ORDER BY d.检验列, d.样品序号;
