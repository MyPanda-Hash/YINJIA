/* ============================================================================
   finish-in-wo-summary.sql —— 产成品入库单「加工单号」补齐**结果汇总**（只读）
   按 yj_usage_log 的留痕分档统计（M1 全覆盖 / M2 产品对上·时间合理 /
   M3 产品对上·工单晚于入库 / M4 无产品依据·按时间最近），并给出总量与末行结果。
   末行 RESULT: SUMMARY-OK
   ============================================================================ */
SET NOCOUNT ON;

SELECT N'=== 一、总量 ===' AS 段;
SELECT (SELECT COUNT(*) FROM dbo.bd_finish_in) AS 入库单总数,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') <> N'') AS 已有加工单号,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'') AS 仍为空;
GO

SELECT N'=== 二、按档位（有效留痕，未回滚）===' AS 段;
SELECT CASE WHEN action_name LIKE N'%M2)%' THEN N'M2 产品对上·时间合理'
            WHEN action_name LIKE N'%M3)%' THEN N'M3 产品对上·工单晚于入库'
            WHEN action_name LIKE N'%M4)%' THEN N'M4 无产品依据·按时间最近'
            ELSE N'M1 全覆盖（第一轮 strict）' END AS 档位,
       COUNT(*) AS 单数
  FROM dbo.yj_usage_log
 WHERE panel_name = N'产成品入库单' AND action_name LIKE N'数据修复·补齐加工单号(%'
   AND action_name NOT LIKE N'%（已回滚）%'
 GROUP BY CASE WHEN action_name LIKE N'%M2)%' THEN N'M2 产品对上·时间合理'
               WHEN action_name LIKE N'%M3)%' THEN N'M3 产品对上·工单晚于入库'
               WHEN action_name LIKE N'%M4)%' THEN N'M4 无产品依据·按时间最近'
               ELSE N'M1 全覆盖（第一轮 strict）' END
 ORDER BY 档位;
GO

SELECT N'=== 三、按工单号（前 30，一张工单挂了几张入库单）===' AS 段;
SELECT TOP 30 h.加工单号, COUNT(*) AS 入库单数,
       MIN(h.单据日期) AS 最早入库, MAX(h.单据日期) AS 最晚入库
  FROM dbo.bd_finish_in h
 WHERE ISNULL(h.加工单号, N'') <> N''
 GROUP BY h.加工单号
 ORDER BY COUNT(*) DESC, h.加工单号;
GO

SELECT N'=== 四、M4（无产品依据）的时间接近度 ===' AS 段;
SELECT 接近度, COUNT(DISTINCT 单据编号) AS 单数 FROM (
  SELECT h.单据编号,
         CASE WHEN ABS(DATEDIFF(day, CAST(p.pl_date AS date), CAST(h.单据日期 AS date))) <= 7 THEN N'1 ≤7 天'
              WHEN ABS(DATEDIFF(day, CAST(p.pl_date AS date), CAST(h.单据日期 AS date))) <= 30 THEN N'2 8~30 天'
              WHEN ABS(DATEDIFF(day, CAST(p.pl_date AS date), CAST(h.单据日期 AS date))) <= 60 THEN N'3 31~60 天'
              ELSE N'4 >60 天' END AS 接近度
    FROM dbo.bd_finish_in h
    JOIN dbo.yj_usage_log l ON l.doc_no = h.单据编号 AND l.panel_name = N'产成品入库单'
         AND l.action_name LIKE N'%M4)%' AND l.action_name NOT LIKE N'%（已回滚）%'
    JOIN dbo.plang p ON p.pl_no = h.加工单号 AND p.pl_xc = 1
) t GROUP BY 接近度 ORDER BY 接近度;
GO

SELECT N'RESULT: SUMMARY-OK' AS 结果;
