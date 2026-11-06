-- 独立复核用「负向测试」脚本(故意失败):只发 severity 16 错误,不做任何 DML/DDL。
-- 目的:证明 package 内 DbSync 对该脚本判 FAIL(exit 1)且不写 yj_schema_log。
RAISERROR(N'[FAIL] independent-verify negative test: deliberate severity 16', 16, 1);
GO
