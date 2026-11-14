SET NOCOUNT ON;
SELECT ISNULL(总结论,N'(空)') AS 总结论, COUNT(*) AS 单数 FROM dbo.qc_insp GROUP BY 总结论;
SELECT ISNULL(处置方式,N'(空)') AS 处置方式, COUNT(*) AS 行数 FROM dbo.qc_insp_detail GROUP BY 处置方式;
SELECT ISNULL(检验状态,N'(空)') AS 检验状态, ISNULL(是否合格,N'(空)') AS 是否合格, COUNT(*) AS 行数
  FROM dbo.qc_catalog_detail GROUP BY 检验状态, 是否合格;
SELECT COUNT(*) AS 目录行, SUM(CASE WHEN ISNULL(批次号,N'')<>N'' THEN 1 ELSE 0 END) AS 有批次,
       SUM(CASE WHEN ISNULL(物料编码,N'')<>N'' THEN 1 ELSE 0 END) AS 有物料编码
  FROM dbo.qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y';
