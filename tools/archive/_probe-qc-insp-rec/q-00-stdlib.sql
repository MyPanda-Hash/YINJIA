-- q-00-stdlib.sql — 标准库现状:lib_code 清单 / 表结构 / 已有条目样例
SET NOCOUNT ON;
SELECT 'A.yj_std_lib 列' AS k, name, max_length FROM sys.columns WHERE object_id = OBJECT_ID('yj_std_lib') ORDER BY column_id;
SELECT 'B.现有库码' AS k, lib_code, COUNT(*) AS n FROM yj_std_lib GROUP BY lib_code ORDER BY lib_code;
SELECT TOP 15 'C.样例条目' AS k, lib_code, item_code, content, seq, enabled FROM yj_std_lib ORDER BY lib_code, seq, id;
GO
