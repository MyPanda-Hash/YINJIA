/* _baseline-samples.sql — 把「生产过程中七张单据补样例数据」标记为已执行(**不插入演示单据**)
   理由:
     · 正式库(HSDZ_MES):上线纪律要求正式账干净,演示数据不落正式账;
     · 测试库(HSDZ_MES_TEST):快照陈旧,mix_record_detail 缺「物料名称」列 ⇒ 脚本本身跑不过
       (这是测试库结构漂移,按 AGENTS.md 属于"补迁移修不好"的那一类)。
   两账套登记为已执行,使迁移链得以继续(否则它后面的 migrate-stock-balance-warn 永远轮不到)。
   若日后确实要补这些样例:删掉登记再跑(先确保目标库列齐)
     DELETE FROM yj_schema_log WHERE script_name = N'migrate-proc-process-samples-20261018.sql'
     java -cp lib\mssql-jdbc.jar DbSync.java run migrate-proc-process-samples-20261018.sql
   注:RAISERROR 的替换参数只能是常量/变量,不能写表达式(DB_NAME() 也会报「附近有语法错误」)。
*/
SET NOCOUNT ON;
DECLARE @db sysname = DB_NAME();
IF @db NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    RAISERROR(N'[FAIL] 本脚本只允许在两账套登记(当前 %s)', 16, 1, @db);
INSERT INTO yj_schema_log (script_name, content_hash)
SELECT N'migrate-proc-process-samples-20261018.sql', N'cfadb6b344bdc4d6a14a07fd6e16fd8722c253d95361fe8a8046a4b8f00c9845'
WHERE NOT EXISTS (SELECT 1 FROM yj_schema_log WHERE script_name = N'migrate-proc-process-samples-20261018.sql');
PRINT N'[OK] migrate-proc-process-samples-20261018.sql 已登记(baseline,未执行)@ ' + @db;