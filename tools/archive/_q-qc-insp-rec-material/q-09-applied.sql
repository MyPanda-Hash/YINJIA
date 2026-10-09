-- q-09-applied.sql — 核实 migrate-qc-insp-rec-material-ref-20261009.sql 是否已在本账套落地
-- 用法(两账套各跑一遍):
--   cd tools && java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env archive\_q-qc-insp-rec-material\q-09-applied.sql
SET NOCOUNT ON;

SELECT DB_NAME() AS db;

PRINT N'【1】QC_INSP_REC 物料两列元数据(应 4 行:参照 / INV / ref_field 对应)';
SELECT place, seq, col_name, data_type, ref_panel, ref_field, display_field
  FROM yj_field
 WHERE panel_code = N'QC_INSP_REC' AND col_name IN (N'物料名称', N'物料编码')
 ORDER BY place, seq, id;

DECLARE @ok int = (SELECT COUNT(*) FROM yj_field
                    WHERE panel_code = N'QC_INSP_REC' AND col_name IN (N'物料名称', N'物料编码')
                      AND data_type = N'参照' AND ref_panel = N'INV'
                      AND ((col_name = N'物料编码' AND ref_field = N'存货编码')
                        OR (col_name = N'物料名称' AND ref_field = N'存货名称')));
PRINT N'【2】自检:参照/INV 且 ref_field 正确 = ' + CAST(@ok AS nvarchar(10)) + N'/4';

PRINT N'【3】迁移登记(yj_schema_log 里这条脚本的记录/时间)';
SELECT TOP 5 script_name, applied_at FROM yj_schema_log
 WHERE script_name LIKE N'%qc-insp-rec-material%'
 ORDER BY applied_at DESC;
