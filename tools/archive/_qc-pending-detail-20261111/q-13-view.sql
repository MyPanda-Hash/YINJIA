SET NOCOUNT ON;
PRINT N'=== A. 视图前 8 行(横向看链) ===';
SELECT TOP 8 单据日期, 检验数据记录单号, 来料检验单号, 来料检验单行号, 检验状态, 是否合格,
       物料编码, 物料批次, 采购订单号, 采购订单行号, 送料暂收单号, 送料暂收单行号, 采购入库单号, 采购入库单行号
FROM v_qc_insp_rec_detail ORDER BY id;

PRINT N'=== B. 链条解析率 ===';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(来料检验单行号,N'')<>N'' THEN 1 ELSE 0 END) AS 有检验单行号,
       SUM(CASE WHEN ISNULL(检验状态,N'')<>N'' THEN 1 ELSE 0 END) AS 有检验状态,
       SUM(CASE WHEN ISNULL(采购订单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有采购订单号,
       SUM(CASE WHEN ISNULL(送料暂收单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有暂收单号,
       SUM(CASE WHEN ISNULL(采购入库单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有入库单号,
       SUM(CASE WHEN ISNULL(目录行id,'')<>'' THEN 1 ELSE 0 END) AS 有目录行
FROM v_qc_insp_rec_detail;

PRINT N'=== C. 检验状态分布 ===';
SELECT ISNULL(检验状态,N'(空)') AS st, COUNT(*) n FROM v_qc_insp_rec_detail GROUP BY 检验状态;
