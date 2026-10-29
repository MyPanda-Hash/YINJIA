SET NOCOUNT ON;
SELECT '=== 留痕按档位统计（有效：未回滚） ===' AS s;
SELECT CASE WHEN action_name LIKE N'%M2)%' THEN N'M2 产品对上·时间合理'
            WHEN action_name LIKE N'%M3)%' THEN N'M3 产品对上·工单晚于入库'
            WHEN action_name LIKE N'%M4)%' THEN N'M4 无产品依据·按时间最近'
            ELSE N'M1 全覆盖(第一轮 strict)' END AS 档位,
       COUNT(*) AS 单数
  FROM dbo.yj_usage_log
 WHERE panel_name = N'产成品入库单' AND action_name LIKE N'数据修复·补齐加工单号(%'
   AND action_name NOT LIKE N'%（已回滚）%'
 GROUP BY CASE WHEN action_name LIKE N'%M2)%' THEN N'M2 产品对上·时间合理'
               WHEN action_name LIKE N'%M3)%' THEN N'M3 产品对上·工单晚于入库'
               WHEN action_name LIKE N'%M4)%' THEN N'M4 无产品依据·按时间最近'
               ELSE N'M1 全覆盖(第一轮 strict)' END
 ORDER BY 档位;
GO
SELECT '=== M4 的"时间接近度"分布 ===' AS s;
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
