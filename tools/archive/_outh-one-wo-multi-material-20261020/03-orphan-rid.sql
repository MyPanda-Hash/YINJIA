/* 只读取证:src=6 的 outh 里,rid 不落在 bl_material_out 上的行 —— 那就是"另一个写入方"的痕迹 */
SET NOCOUNT ON;

PRINT N'== A. src=6 总行数 / 命中 bl_material_out 的行数 / 孤儿行数 ==';
SELECT COUNT(*) AS src6总行,
       SUM(CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END) AS 命中bl行,
       SUM(CASE WHEN b.id IS NULL THEN 1 ELSE 0 END) AS 孤儿行
  FROM dbo.outh o LEFT JOIN dbo.bl_material_out b ON b.id = o.rid
 WHERE o.src = 6;

PRINT N'== B. 孤儿行样本(看它们像谁写的:用户/单据编号/物料/工单号)==';
SELECT TOP 30 o.id, o.src, o.rid, o.单据编号, o.单据类型, CONVERT(varchar(10),o.单据日期,120) AS 日期,
       o.物料编码, o.仓库编码, o.批号, o.数量, o.工单号, o.工单项次,
       o.asp_user1 AS 创建人, CONVERT(varchar(19),o.asp_time1,120) AS 创建时间, o.asp_cancel AS 作废,
       (SELECT COUNT(*) FROM dbo.plang_pc p WHERE p.id = o.rid) AS 命中plang_pc,
       (SELECT COUNT(*) FROM dbo.plang p WHERE p.id = o.rid) AS 命中plang
  FROM dbo.outh o LEFT JOIN dbo.bl_material_out b ON b.id = o.rid
 WHERE o.src = 6 AND b.id IS NULL ORDER BY o.id DESC;

PRINT N'== C. src=6 按创建人统计 ==';
SELECT asp_user1 AS 创建人, COUNT(*) AS 行数, MIN(CONVERT(varchar(19),asp_time1,120)) AS 最早, MAX(CONVERT(varchar(19),asp_time1,120)) AS 最晚
  FROM dbo.outh WHERE src = 6 GROUP BY asp_user1 ORDER BY 行数 DESC;

PRINT N'== D. 有工单号的行(src=6)==';
SELECT COUNT(*) AS 带工单号行数 FROM dbo.outh WHERE src = 6 AND ISNULL(工单号,N'') <> N'';

PRINT N'== E. 同一 (src,rid) 多行(现状,索引挡着应为 0)==';
SELECT COUNT(*) AS 重复组合 FROM (SELECT src, rid FROM dbo.outh WHERE rid IS NOT NULL GROUP BY src, rid HAVING COUNT(*) > 1) t;
