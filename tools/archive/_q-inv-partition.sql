-- _q-inv-partition.sql — 决定性测量:移动加权分区键用 (仓库,存货) 还是 (仓库,存货,批号)?
-- 结论:批次级 225 分区中 114 个"只出无进"(51%) → 批次级做成本不可用;批号只能当明细列。
SET NOCOUNT ON;

;WITH mov AS (
  SELECT ISNULL(NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N''), w.仓库编码) AS 仓库键,
         ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''), N'(未填存货)') AS 存货编码,
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)') AS 批号,
         CAST(l.实收数量 AS decimal(18,4)) AS 收入数量, CAST(0 AS decimal(18,4)) AS 发出数量
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
  LEFT JOIN dbo.bs_wh w ON w.仓库名称 = l.仓库
  WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
    AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C')
  UNION ALL
  SELECT ISNULL(NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N''), w.仓库编码),
         ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''), N'(未填存货)'),
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)'),
         CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4))
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
  LEFT JOIN dbo.bs_wh w ON w.仓库名称 = l.仓库
  WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
    AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C')
),
flag AS (
  SELECT m.*,
         CASE WHEN m.批号 = N'(未填批号)' AND m.发出数量 > 0 THEN 1 ELSE 0 END AS 是空批号销售,
         CASE WHEN m.批号 = N'(未填批号)' AND m.发出数量 > 0
               AND EXISTS (SELECT 1 FROM mov p
                           WHERE p.仓库键 = m.仓库键 AND p.存货编码 = m.存货编码
                             AND p.批号 <> N'(未填批号)' AND p.收入数量 > 0)
              THEN 1 ELSE 0 END AS 该存货本有入库
  FROM mov m
)
SELECT SUM(是空批号销售) AS 空批号销售行,
       SUM(该存货本有入库) AS 其中存货本有入库,
       SUM(CASE WHEN 批号 = N'(未填批号)' AND 收入数量 > 0 THEN 1 ELSE 0 END) AS 空批号采购行
FROM flag;
GO

-- 仓库键解析效果:编码直接有 / 名称兜底到编码 / 都无(只能 #名称)
;WITH r AS (
  SELECT NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N'') AS 自身编码, w.仓库编码 AS 兜底编码
  FROM bl_purchase_in l LEFT JOIN dbo.bs_wh w ON w.仓库名称 = l.仓库 WHERE ISNULL(l.asp_cancel,'N')<>'Y'
  UNION ALL
  SELECT NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N''), w.仓库编码
  FROM bl_sale_out l LEFT JOIN dbo.bs_wh w ON w.仓库名称 = l.仓库 WHERE ISNULL(l.asp_cancel,'N')<>'Y')
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN 自身编码 IS NOT NULL THEN 1 ELSE 0 END) AS 自身编码有值,
       SUM(CASE WHEN 自身编码 IS NULL AND 兜底编码 IS NOT NULL THEN 1 ELSE 0 END) AS 靠名称兜底,
       SUM(CASE WHEN 自身编码 IS NULL AND 兜底编码 IS NULL THEN 1 ELSE 0 END) AS 全无只能按名称
FROM r;
GO

-- 兜底前后分区数变化(兜底是否真的把同一仓库合并了)
;WITH m AS (
  SELECT l.仓库 AS 名称, NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N'') AS 编码,
         ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''),N'?') AS 存货
  FROM bl_purchase_in l WHERE ISNULL(l.asp_cancel,'N')<>'Y'
  UNION ALL
  SELECT l.仓库, NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N''), ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''),N'?')
  FROM bl_sale_out l WHERE ISNULL(l.asp_cancel,'N')<>'Y')
SELECT COUNT(DISTINCT 名称 + '|' + 存货) AS 按名称分区,
       COUNT(DISTINCT ISNULL(编码, N'#' + ISNULL(名称,N'')) + '|' + 存货) AS 只按自身编码分区
FROM m;
GO

-- bs_wh 是否 名称↔编码 一对一(不一对一则兜底会扩行)
SELECT COUNT(*) AS bs_wh行数, COUNT(DISTINCT 仓库名称) AS distinct名称, COUNT(DISTINCT 仓库编码) AS distinct编码
FROM dbo.bs_wh;
GO
