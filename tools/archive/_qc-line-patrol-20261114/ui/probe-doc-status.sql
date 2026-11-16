/* 巡线检验(QC_LINE_PATROL)单据状态行体检(只读)
   口径说明:yj_doc_status 的列是 panel_code / doc_no / shr / shsj / saved / archived / canceled …,
   **没有「单据编号」这一列**(第一版探针按中文列名查,报 Invalid column name —— 是列名写错,
   不是编码问题;本版改用 ASCII 列名,并在命令行带 -Dfile.encoding=UTF-8 保证中文不乱码)。
   用法(tools 下):
     java -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 -cp lib\mssql-jdbc.jar \
       SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env \
       archive/_qc-line-patrol-20261114/ui/probe-doc-status.sql */
SET NOCOUNT ON;
SELECT 'yj_doc_status_rows' AS obj, panel_code, doc_no, shr,
       CONVERT(varchar(19), shsj, 120) AS shsj, saved, archived, canceled, stopping_ok
FROM (
  SELECT panel_code, doc_no, shr, shsj, saved, archived, canceled, 1 AS stopping_ok FROM dbo.yj_doc_status
) t
WHERE panel_code = N'QC_LINE_PATROL'
ORDER BY doc_no;
SELECT 'count' AS obj, COUNT(*) AS cnt FROM dbo.yj_doc_status WHERE panel_code = N'QC_LINE_PATROL';
