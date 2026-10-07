SET NOCOUNT ON;
-- 86 个历史键里,有多少的 存货/仓库 至今仍在档案里(即在用) —— 决定"历史缺口"会不会咬到将来
IF OBJECT_ID('tempdb..#h') IS NOT NULL DROP TABLE #h;
;WITH raw AS (
  SELECT CAST(l.仓库编码 AS nvarchar(200)) AS 自编码, CAST(l.仓库 AS nvarchar(200)) AS 仓名,
         CAST(l.存货编码 AS nvarchar(200)) AS 存货编码, CAST(l.实收数量 AS decimal(18,4)) AS 入, CAST(0 AS decimal(18,4)) AS 出
    FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
   WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
     AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C'
          OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='PURCHASE_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
  UNION ALL
  SELECT CAST(l.仓库编码 AS nvarchar(200)), CAST(l.仓库 AS nvarchar(200)),
         CAST(l.存货编码 AS nvarchar(200)), CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4))
    FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
   WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
     AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C'
          OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='SALE_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
)
SELECT CASE WHEN r.自编码 IS NOT NULL AND RTRIM(r.自编码)<>N'' THEN RTRIM(r.自编码)
            WHEN w.仓库编码 IS NOT NULL THEN RTRIM(w.仓库编码)
            ELSE N'#' + ISNULL(RTRIM(r.仓名), N'(未填仓库)') END AS 仓库键,
       ISNULL(NULLIF(RTRIM(r.存货编码),N''), N'(未填存货)') AS 存货编码,
       SUM(r.入) AS 入, SUM(r.出) AS 出
  INTO #h
  FROM raw r
  OUTER APPLY (SELECT TOP 1 仓库编码 FROM bs_wh WHERE RTRIM(仓库名称) = RTRIM(r.仓名) ORDER BY id) w
 GROUP BY CASE WHEN r.自编码 IS NOT NULL AND RTRIM(r.自编码)<>N'' THEN RTRIM(r.自编码)
               WHEN w.仓库编码 IS NOT NULL THEN RTRIM(w.仓库编码)
               ELSE N'#' + ISNULL(RTRIM(r.仓名), N'(未填仓库)') END,
          ISNULL(NULLIF(RTRIM(r.存货编码),N''), N'(未填存货)');
GO
SELECT '--- 86 个历史键的"是否还有档案"分布 ---' AS x;
SELECT
  SUM(CASE WHEN EXISTS(SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货编码)=h.存货编码) THEN 1 ELSE 0 END) AS 存货仍在档案,
  SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货编码)=h.存货编码) THEN 1 ELSE 0 END) AS 存货已无档案,
  SUM(CASE WHEN EXISTS(SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库编码)=h.仓库键) THEN 1 ELSE 0 END) AS 仓库仍在档案,
  SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库编码)=h.仓库键) THEN 1 ELSE 0 END) AS 仓库已无档案
FROM #h h;
GO
SELECT '--- 只在历史、不在 kucun,且档案仍在的键(将来会被咬到的) ---' AS x;
SELECT COUNT(*) AS 键数, CAST(SUM(h.入-h.出) AS decimal(18,4)) AS 缺失的期初净额
FROM #h h
WHERE NOT EXISTS (SELECT 1 FROM kucun k WHERE ISNULL(k.asp_cancel,'N')<>'Y'
                    AND RTRIM(CAST(k.ckdm AS nvarchar(200)))=h.仓库键 AND RTRIM(CAST(k.wzdm AS nvarchar(200)))=h.存货编码)
  AND EXISTS (SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货编码)=h.存货编码)
  AND EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库编码)=h.仓库键);
GO
SELECT '--- 仓库键取值分布 ---' AS x;
SELECT 仓库键, COUNT(*) AS 键数, CAST(SUM(入-出) AS decimal(18,4)) AS 净额 FROM #h GROUP BY 仓库键 ORDER BY 键数 DESC;
GO
