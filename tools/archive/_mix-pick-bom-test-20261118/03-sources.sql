-- 03-sources.sql —— 找「半成品该领什么料」的可用数据源(只读)
SET NOCOUNT ON;

PRINT '--- A. 全库唯一一个有自己清单的半成品是谁、长什么样 ---';
SELECT TOP 20 b.单据编号, b.产品编码, b.产品名称, b.工序, b.版本号, b.子件编码, b.子件名称, b.计量单位, b.标准用量
FROM bs_asm_bom b
WHERE UPPER(ISNULL(b.产品编码,N'')) LIKE N'%**TB'
  AND ISNULL(b.asp_cancel,'N') <> 'Y'
ORDER BY b.产品编码, ISNULL(b.行序,0);

PRINT '--- B. bs_asm_bom 列清单 ---';
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'bs_asm_bom'
ORDER BY ORDINAL_POSITION;

PRINT '--- C. mate(物料清单)有没有数据、什么形状 ---';
SELECT COUNT(*) AS mate行数 FROM mate;
SELECT TOP 10 * FROM mate;

PRINT '--- D. 烧结工艺清单行表(配方)有哪些候选表 ---';
SELECT t.name AS 表名, (SELECT SUM(row_count) FROM sys.dm_db_partition_stats s
                         WHERE s.object_id = t.object_id AND s.index_id IN (0,1)) AS 行数
FROM sys.tables t
WHERE t.name LIKE N'%mold_proc%' OR t.name LIKE N'%sinter%' OR t.name LIKE N'%recipe%'
   OR t.name LIKE N'%formula%' OR t.name LIKE N'%mix%'
ORDER BY t.name;

PRINT '--- E. 烧结工艺清单(rd_mold_proc)明细列 ---';
SELECT TOP 0 * FROM rd_mold_proc_detail;
