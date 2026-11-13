-- q-04-data.sql — 品质流程监控看板:单据状态分布与链路关联率(只读)
SET NOCOUNT ON;
PRINT N'=== 1. 三单状态分布 ===';
SELECT N'送料暂收单' AS 单据, ISNULL(单据状态, N'(空)') AS 状态, COUNT(*) AS 单数
  FROM dbo.sl_recv WHERE ISNULL(asp_cancel, 'N') <> 'Y' GROUP BY 单据状态
UNION ALL
SELECT N'来料检验单', ISNULL(单据状态, N'(空)'), COUNT(*)
  FROM dbo.qc_insp WHERE ISNULL(asp_cancel, 'N') <> 'Y' GROUP BY 单据状态
UNION ALL
SELECT N'采购入库单', ISNULL(单据状态, N'(空)'), COUNT(*)
  FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel, 'N') <> 'Y' GROUP BY 单据状态
ORDER BY 单据, 状态;

PRINT N'=== 2. 链路行数 ===';
SELECT
  (SELECT COUNT(*) FROM dbo.sl_recv_detail d WHERE ISNULL(d.asp_cancel,'N') <> 'Y') AS 暂收单行,
  (SELECT COUNT(*) FROM dbo.sl_recv h WHERE ISNULL(h.asp_cancel,'N') <> 'Y') AS 暂收单头,
  (SELECT COUNT(*) FROM dbo.qc_insp h WHERE ISNULL(h.asp_cancel,'N') <> 'Y') AS 检验单头,
  (SELECT COUNT(*) FROM dbo.qc_insp_detail d WHERE ISNULL(d.asp_cancel,'N') <> 'Y') AS 检验单行,
  (SELECT COUNT(*) FROM dbo.bd_purchase_in h WHERE ISNULL(h.asp_cancel,'N') <> 'Y') AS 入库单头,
  (SELECT COUNT(*) FROM dbo.bl_purchase_in d WHERE ISNULL(d.asp_cancel,'N') <> 'Y') AS 入库单行;

PRINT N'=== 3. 暂收单 → 检验单 关联(按 qc_insp.暂收单号) ===';
SELECT COUNT(*) AS 检验单数,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.sl_recv r WHERE r.单据编号 = i.暂收单号) THEN 1 ELSE 0 END) AS 能对上暂收单,
       SUM(CASE WHEN ISNULL(i.暂收单号, N'') = N'' THEN 1 ELSE 0 END) AS 暂收单号为空
  FROM dbo.qc_insp i WHERE ISNULL(i.asp_cancel,'N') <> 'Y';

PRINT N'=== 4. 检验单 → 入库单 关联三条路径命中率 ===';
SELECT COUNT(*) AS 检验单数,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.qc_insp_detail d WHERE d.单据编号 = i.单据编号
                              AND ISNULL(d.入库单号, N'') <> N'') THEN 1 ELSE 0 END) AS 检验行有入库单号,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.bd_purchase_in b WHERE b.来源单号 = i.单据编号) THEN 1 ELSE 0 END) AS 入库按来源单号=检验单号,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.bd_purchase_in b WHERE b.来源单号 = i.暂收单号) THEN 1 ELSE 0 END) AS 入库按来源单号=暂收单号
  FROM dbo.qc_insp i WHERE ISNULL(i.asp_cancel,'N') <> 'Y';

PRINT N'=== 5. 采购入库单 来源 字段取值样例 ===';
SELECT TOP 20 单据编号, 单据日期, ISNULL(单据状态, N'(空)') AS 单据状态, 来源单据, 来源单号, 匹配来源单号, 采购订单号, 批次号, 是否已转ERP
  FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel,'N') <> 'Y'
 ORDER BY id DESC;
