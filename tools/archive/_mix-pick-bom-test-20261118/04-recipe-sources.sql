-- 04-recipe-sources.sql —— 烧结/X烧结配方表列与样例(只读)
SET NOCOUNT ON;

PRINT '--- A. 表列名(逗号串) ---';
SELECT t.name AS 表名,
       STUFF((SELECT N',' + c.name FROM sys.columns c
              WHERE c.object_id = t.object_id ORDER BY c.column_id
              FOR XML PATH('')), 1, 1, N'') AS 列
FROM sys.tables t
WHERE t.name IN (N'rd_mold_proc_head', N'rd_mold_proc_detail', N'rd_x_sinter_head',
                 N'rd_x_sinter_detail', N'mix_record', N'mix_record_detail', N'mate')
ORDER BY t.name;

PRINT '--- B. 行数 ---';
SELECT N'rd_mold_proc_head' AS 表, COUNT(*) AS 行数 FROM rd_mold_proc_head
UNION ALL SELECT N'rd_mold_proc_detail', COUNT(*) FROM rd_mold_proc_detail
UNION ALL SELECT N'rd_x_sinter_head', COUNT(*) FROM rd_x_sinter_head
UNION ALL SELECT N'rd_x_sinter_detail', COUNT(*) FROM rd_x_sinter_detail
UNION ALL SELECT N'mix_record', COUNT(*) FROM mix_record
UNION ALL SELECT N'mix_record_detail', COUNT(*) FROM mix_record_detail;

PRINT '--- C. rd_mold_proc_head 前 8 行(看产品键) ---';
SELECT TOP 8 * FROM rd_mold_proc_head;

PRINT '--- D. rd_mold_proc_detail 前 12 行 ---';
SELECT TOP 12 * FROM rd_mold_proc_detail;

PRINT '--- E. rd_x_sinter_detail 前 12 行 ---';
SELECT TOP 12 * FROM rd_x_sinter_detail;

PRINT '--- F. mix_record / mix_record_detail 全量 ---';
SELECT * FROM mix_record;
SELECT * FROM mix_record_detail;
