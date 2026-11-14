SELECT TOP 6 id, 单据编号, 单据日期, 审核人, 单据状态, asp_user1, asp_time1 FROM qc_line_patrol_head ORDER BY id DESC;

SELECT 单据编号, COUNT(*) AS n, MIN(行号) AS minRow, MAX(行号) AS maxRow FROM qc_line_patrol_detail GROUP BY 单据编号 ORDER BY 单据编号;

SELECT 单据编号, 行号, 巡线时间, 车间, 编号1, 型号1, 长度标准1, 长度实测1, 内径标准1, 内径实测1, 重量标准1, 重量实测1
FROM qc_line_patrol_detail ORDER BY 单据编号, 行号;

SELECT 单据编号, 行号, 编号2, 型号2, 长度标准2, 长度实测2, 内径标准2, 内径实测2, 重量标准2, 重量实测2, 两液密度, 表面状态, 跌落强度, 抗压强度, 结果判定, 巡线人员
FROM qc_line_patrol_detail ORDER BY 单据编号, 行号;
