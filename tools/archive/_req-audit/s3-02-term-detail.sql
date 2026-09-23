SET NOCOUNT ON;
GO
SELECT N'=== A. yj_plan_term 行数(表存在与否分列) ===' AS hdr;
GO
SELECT CASE WHEN OBJECT_ID('yj_plan_term') IS NULL THEN N'表不存在' ELSE N'表存在' END AS tbl,
       (SELECT COUNT(*) FROM yj_plan_term) AS total_rows;
GO
SELECT N'=== A2. yj_plan_term state 分布 ===' AS hdr;
GO
SELECT RTRIM(state) AS state, COUNT(*) AS cnt FROM yj_plan_term GROUP BY state;
GO
SELECT N'=== A3. yj_plan_term 全部列 ===' AS hdr;
GO
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS len, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_plan_term' ORDER BY ORDINAL_POSITION;
GO
SELECT N'=== B. yj_form_approval 列定义 ===' AS hdr;
GO
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS len, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_form_approval' ORDER BY ORDINAL_POSITION;
GO
SELECT N'=== B2. yj_form_approval 行数 ===' AS hdr;
GO
SELECT COUNT(*) AS total_rows FROM yj_form_approval;
GO
SELECT N'=== B3. yj_form_approval 列名探测:列出前3行 ===' AS hdr;
GO
SELECT TOP 3 * FROM yj_form_approval ORDER BY 1 DESC;
GO
SELECT N'=== D. 终止相关表清单(名含 term/stop/terminate/end) ===' AS hdr;
GO
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%term%' OR TABLE_NAME LIKE '%stop%'
ORDER BY TABLE_NAME;
GO
SELECT N'=== D2. 等级相关表清单(名含 level/grade/rank/class/等级) ===' AS hdr;
GO
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%level%' OR TABLE_NAME LIKE '%grade%' OR TABLE_NAME LIKE '%rank%'
   OR TABLE_NAME LIKE '%class%' OR TABLE_NAME LIKE '%dict%'
ORDER BY TABLE_NAME;
GO
