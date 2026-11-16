/* 两账套收尾对账(只读):正式库 HSDZ_MES 必须清零;测试库 HSDZ_MES_TEST 保留走查证据数据。
   用法(tools 下,两个库各跑一次):
     java -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 -cp lib\mssql-jdbc.jar \
       SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=<DB>;encrypt=false" yinjia env \
       archive/_qc-line-patrol-20261114/ui/probe-both-dbs.sql */
SET NOCOUNT ON;
SELECT DB_NAME() AS db, 'head' AS obj, COUNT(*) AS cnt FROM dbo.qc_line_patrol_head;
SELECT DB_NAME() AS db, 'detail' AS obj, COUNT(*) AS cnt FROM dbo.qc_line_patrol_detail;
SELECT DB_NAME() AS db, 'doc_status' AS obj, COUNT(*) AS cnt FROM dbo.yj_doc_status WHERE panel_code = N'QC_LINE_PATROL';
SELECT DB_NAME() AS db, 'head_row' AS obj, 单据编号, 单据日期, 审核人 FROM dbo.qc_line_patrol_head;
SELECT DB_NAME() AS db, 'detail_row' AS obj, 单据编号, 行号, 巡线时间, 车间, 编号1, 型号1, 长度实测1, 两液密度, 表面状态, 结果判定, 巡线人员
FROM dbo.qc_line_patrol_detail ORDER BY 单据编号, 行号;
