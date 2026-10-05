SET NOCOUNT ON;
-- 诊断 v2:按**旧视图口径的仓库键**比对历史单据净额 与 kucun
-- 仓库键 = 单据自身仓库编码 → bs_wh 按名称兜底 → '#'+名称(与 migrate-inv-report-fields.sql 一致)
IF OBJECT_ID('tempdb..#hist') IS NOT NULL DROP TABLE #hist;

;WITH raw AS (
  SELECT 1 AS src, CAST(l.仓库编码 AS nvarchar(200)) AS 自编码, CAST(l.仓库 AS nvarchar(200)) AS 仓名,
         CAST(l.存货编码 AS nvarchar(200)) AS 存货编码, CAST(l.实收数量 AS decimal(18,4)) AS 入, CAST(0 AS decimal(18,4)) AS 出,
         h.单据日期, l.单据编号
    FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
   WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
     AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C'
          OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='PURCHASE_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
  UNION ALL
  SELECT 5, CAST(l.仓库编码 AS nvarchar(200)), CAST(l.仓库 AS nvarchar(200)),
         CAST(l.存货编码 AS nvarchar(200)), CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4)),
         h.单据日期, l.单据编号
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
  INTO #hist
  FROM raw r
  OUTER APPLY (SELECT TOP 1 仓库编码 FROM bs_wh WHERE RTRIM(仓库名称) = RTRIM(r.仓名) ORDER BY id) w
 GROUP BY CASE WHEN r.自编码 IS NOT NULL AND RTRIM(r.自编码)<>N'' THEN RTRIM(r.自编码)
               WHEN w.仓库编码 IS NOT NULL THEN RTRIM(w.仓库编码)
               ELSE N'#' + ISNULL(RTRIM(r.仓名), N'(未填仓库)') END,
          ISNULL(NULLIF(RTRIM(r.存货编码),N''), N'(未填存货)');
GO
SELECT '--- 历史净额 vs kucun 总量 ---' AS x;
SELECT (SELECT COUNT(*) FROM #hist) AS 历史键数,
       (SELECT CAST(SUM(入) AS decimal(18,4)) FROM #hist) AS 历史入,
       (SELECT CAST(SUM(出) AS decimal(18,4)) FROM #hist) AS 历史出,
       (SELECT CAST(SUM(入-出) AS decimal(18,4)) FROM #hist) AS 历史净额,
       (SELECT CAST(SUM(yl) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun余量;
GO
IF OBJECT_ID('tempdb..#kc') IS NOT NULL DROP TABLE #kc;
SELECT RTRIM(CAST(ckdm AS nvarchar(200))) AS 仓库键, RTRIM(CAST(wzdm AS nvarchar(200))) AS 存货编码,
       CAST(SUM(yl) AS decimal(18,4)) AS 余量
  INTO #kc FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ckdm, wzdm;
GO
SELECT '--- 键匹配情形 ---' AS x;
SELECT N'双方都有' AS 情形, COUNT(*) AS 键数 FROM #hist h JOIN #kc k ON k.仓库键=h.仓库键 AND k.存货编码=h.存货编码
UNION ALL SELECT N'仅历史有', COUNT(*) FROM #hist h WHERE NOT EXISTS (SELECT 1 FROM #kc k WHERE k.仓库键=h.仓库键 AND k.存货编码=h.存货编码)
UNION ALL SELECT N'仅kucun有', COUNT(*) FROM #kc k WHERE NOT EXISTS (SELECT 1 FROM #hist h WHERE h.仓库键=k.仓库键 AND h.存货编码=k.存货编码);
GO
SELECT '--- 双方都有的键:历史净额 vs kucun余量 ---' AS x;
SELECT TOP 20 h.仓库键, h.存货编码, CAST(h.入 AS decimal(18,4)) AS 入, CAST(h.出 AS decimal(18,4)) AS 出,
       CAST(h.入-h.出 AS decimal(18,4)) AS 历史净额, k.余量 AS kucun余量,
       CAST((h.入-h.出) - k.余量 AS decimal(18,4)) AS 差
  FROM #hist h JOIN #kc k ON k.仓库键=h.仓库键 AND k.存货编码=h.存货编码
 ORDER BY ABS((h.入-h.出) - k.余量) DESC;
GO
SELECT '--- 仅历史有 的键(前 15) ---' AS x;
SELECT TOP 15 h.仓库键, h.存货编码, CAST(h.入 AS decimal(18,4)) AS 入, CAST(h.出 AS decimal(18,4)) AS 出, CAST(h.入-h.出 AS decimal(18,4)) AS 净额
  FROM #hist h WHERE NOT EXISTS (SELECT 1 FROM #kc k WHERE k.仓库键=h.仓库键 AND k.存货编码=h.存货编码)
 ORDER BY ABS(h.入-h.出) DESC;
GO
