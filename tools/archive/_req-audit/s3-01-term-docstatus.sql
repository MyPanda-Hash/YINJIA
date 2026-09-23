SET NOCOUNT ON;
GO
PRINT N'===== A. yj_plan_term 全部行(前50) =====';
GO
IF OBJECT_ID('yj_plan_term') IS NULL
  PRINT N'!! yj_plan_term 不存在';
ELSE
  SELECT * FROM yj_plan_term ORDER BY id;
GO
PRINT N'===== A2. yj_plan_term 行数 + state 分布 =====';
GO
IF OBJECT_ID('yj_plan_term') IS NOT NULL
  SELECT COUNT(*) AS total_rows FROM yj_plan_term;
GO
IF OBJECT_ID('yj_plan_term') IS NOT NULL
  SELECT state, COUNT(*) AS cnt FROM yj_plan_term GROUP BY state;
GO
PRINT N'===== A3. yj_plan_term 列定义 =====';
GO
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_plan_term' ORDER BY ORDINAL_POSITION;
GO
PRINT N'===== B. 表名含 term/terminate/stop/end/approve/audit/flow 的表 =====';
GO
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%term%' OR TABLE_NAME LIKE '%stop%' OR TABLE_NAME LIKE '%approv%'
   OR TABLE_NAME LIKE '%audit%' OR TABLE_NAME LIKE '%flow%' OR TABLE_NAME LIKE '%level%'
   OR TABLE_NAME LIKE '%grade%' OR TABLE_NAME LIKE '%rank%'
ORDER BY TABLE_NAME;
GO
PRINT N'===== B2. 所有 yj_ 开头表 =====';
GO
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 'yj\_%' ESCAPE '\' ORDER BY TABLE_NAME;
GO
PRINT N'===== C. yj_doc_status 列定义 =====';
GO
IF OBJECT_ID('yj_doc_status') IS NULL
  PRINT N'!! yj_doc_status 不存在';
ELSE
  SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_doc_status' ORDER BY ORDINAL_POSITION;
GO
PRINT N'===== C2. yj_doc_status 行数 =====';
GO
IF OBJECT_ID('yj_doc_status') IS NOT NULL
  SELECT COUNT(*) AS total_rows FROM yj_doc_status;
GO
