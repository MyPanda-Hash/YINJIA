WITH want(n, col) AS (SELECT * FROM (VALUES
 (1,N'检验时间'),(2,N'工单行号'),(3,N'报工单号'),(4,N'生产线'),(5,N'生产车间'),(6,N'报工数量'),
 (7,N'检验数量'),(8,N'文件编码'),(9,N'执行标准'),(10,N'处理方式'),(11,N'审核人'),(12,N'审核时间'),(13,N'单据状态')) v(n,col))
SELECT w.n AS idx,
       CASE WHEN f.id IS NULL THEN 'MISSING' ELSE 'exists' END AS state,
       ISNULL(CAST(f.hidden AS varchar(3)),'-') AS hidden,
       ISNULL(f.place,'-') AS place
FROM want w LEFT JOIN yj_field f
  ON f.panel_code=N'QC_PROC_INSP' AND f.col_name=w.col
ORDER BY w.n;

WITH keep(n, col) AS (SELECT * FROM (VALUES
 (1,N'单据编号'),(2,N'单据日期'),(3,N'检验类别'),(4,N'工单号'),(5,N'工序'),(6,N'批次号'),(7,N'客户名称'),
 (8,N'产品编码'),(9,N'产品名称'),(10,N'规格型号'),(11,N'抽检总量'),(12,N'检验员'),(13,N'检验日期'),
 (14,N'总结论'),(15,N'检验方案')) v(n,col))
SELECT k.n AS idx,
       CASE WHEN f.id IS NULL THEN 'MISSING' ELSE 'exists' END AS state,
       ISNULL(CAST(f.hidden AS varchar(3)),'-') AS hidden
FROM keep k LEFT JOIN yj_field f
  ON f.panel_code=N'QC_PROC_INSP' AND f.col_name=k.col
ORDER BY k.n;