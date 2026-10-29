/* 只读:有没有「只写流水、没有单据」的行(小程序直写 outh 的特征),以及流水/结存各自谁在动 */
SET NOCOUNT ON;

PRINT N'== A. outh 里 单据编号 在 bd_material_out 找不到的行(材料出库段)==';
SELECT COUNT(*) AS 孤儿流水行,
       COUNT(DISTINCT 单据编号) AS 孤儿单号数,
       MIN(CAST(单据日期 AS date)) AS 最早,
       MAX(CAST(单据日期 AS date)) AS 最晚
  FROM dbo.outh o
 WHERE o.src = 6
   AND ISNULL(o.asp_cancel, 'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM dbo.bd_material_out h WHERE h.单据编号 = o.单据编号);

PRINT N'== B. 这些孤儿行长什么样(前 10)==';
SELECT TOP 10 o.id, o.src, o.rid, o.单据编号, o.单据类型, CONVERT(varchar(10), o.单据日期, 120) AS 日期,
       o.物料编码, o.仓库编码, o.批号, o.数量, o.工单号, o.工单项次, o.asp_user1 AS 创建人,
       o.asp_user3 AS 审核人, CONVERT(varchar(19), o.asp_time1, 120) AS 创建时间
  FROM dbo.outh o
 WHERE o.src = 6 AND ISNULL(o.asp_cancel,'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM dbo.bd_material_out h WHERE h.单据编号 = o.单据编号)
 ORDER BY o.id DESC;

PRINT N'== C. 流水的 工单号/工单项次 填充率(src=6)==';
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(工单号, N'') <> N'' THEN 1 ELSE 0 END) AS 带工单号,
       SUM(CASE WHEN 工单项次 IS NOT NULL THEN 1 ELSE 0 END) AS 带工单项次
  FROM dbo.outh WHERE src = 6 AND ISNULL(asp_cancel,'N') <> 'Y';

PRINT N'== D. 四张单据表 vs 流水:谁在动(单据数 / 流水行数)==';
SELECT N'material_out 单据' AS 口径, COUNT(*) AS 值 FROM dbo.bd_material_out
UNION ALL SELECT N'material_out 明细行', COUNT(*) FROM dbo.bl_material_out
UNION ALL SELECT N'outh src=6 流水行', COUNT(*) FROM dbo.outh WHERE src = 6 AND ISNULL(asp_cancel,'N') <> 'Y'
UNION ALL SELECT N'kucun 结存行', COUNT(*) FROM dbo.kucun WHERE ISNULL(asp_cancel,'N') <> 'Y';

PRINT N'== E. 最近 10 条 kucun 变动(看结存是谁在动、有没有 MES 之外的写入)==';
SELECT TOP 10 wzdm, ckdm, lot_no, yl, ISNULL(asp_user1,N'') AS 创建人, ISNULL(asp_user2,N'') AS 修改人,
       CONVERT(varchar(19), update_date, 120) AS 变动时间, CONVERT(varchar(19), asp_time2, 120) AS 最后改时间
  FROM dbo.kucun ORDER BY update_date DESC;
