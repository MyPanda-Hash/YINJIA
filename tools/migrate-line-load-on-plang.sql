/* migrate-line-load-on-plang.sql(2026-10-07):产线排产负荷 v_line_load 改挂 plang(弃用旧 MANU_ORDER 体系)
 *
 * 背景(用户口径「行修改,不要使用旧体系」):
 *   原 v_line_load 的数据源是 v_manu_schedule → 读的是**已废弃的生产加工单体系 bd_manu_order/bl_manu_order**。
 *   系统 2026-09-26 已单轨到 plang(转工单只写 plang),旧表仅剩 13 行历史数据且全部"已作废"⇒
 *   负荷面板的 今日负荷/D1..D13/合计负荷 **恒为 0**(实测)。
 *
 * 本脚本:
 *   ① 重建 dbo.v_line_load:数据源换 **plang**(未作废·未结案·已指派产线·排产数量>0),
 *      每条工单行的排产数量按 [计划开工日(空=转单日) .. 交期] 均摊到每天,区间夹在今天..今天+13;
 *      列与顺序**完全保持不变**(生产线/生产车间/日产能/今日负荷/D1..D13/合计负荷/id/asp_cancel),
 *      面板元数据无需改;口径与「快速排产」页顶部产线下拉的当日负荷同源(同为 plang 现算)。
 *   ② 清理 LINE_LOAD 面板的**重复字段登记**:每列被登记了两份(小数 place=query,detail + 文本 place=detail)
 *      ⇒ 面板渲染出 36 列(18×2)。保留 place=query,detail 的那份,删掉 detail-only 的重复份。
 *   ③ 视图中文注明 + 自检。
 *
 * 幂等(CREATE OR ALTER / 条件删除);两个账套均执行(先 HSDZ_MES 后 HSDZ_MES_TEST)。
 */
SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.v_line_load', N'V') IS NULL
  EXEC sp_executesql N'CREATE VIEW dbo.v_line_load AS SELECT CAST(NULL AS nvarchar(50)) AS 生产线';
GO

ALTER VIEW dbo.v_line_load AS
WITH base AS (
    -- 数据源 = plang(工单单轨):未作废 · 未结案 · 已指派产线 · 排产数量 > 0
    SELECT ISNULL(p.scx, N'') AS 生产线, ISNULL(p.pl_sl, 0) AS q,
           CASE WHEN p.cp_date IS NULL THEN COALESCE(p.st_date, p.pl_date) ELSE p.cp_date END AS e,
           CASE WHEN p.st_date IS NULL THEN COALESCE(p.cp_date, p.pl_date) ELSE p.st_date END AS s
    FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
      AND ISNULL(p.ja,'N') NOT IN ('T','Y')
      AND ISNULL(p.scx, N'') <> N''
      AND ISNULL(p.pl_sl, 0) > 0
),
clamped AS (
    SELECT 生产线, q,
           CASE WHEN s IS NULL THEN NULL
                WHEN e < CAST(GETDATE() AS date) THEN CAST(GETDATE() AS date)
                WHEN e > DATEADD(day, 13, CAST(GETDATE() AS date)) THEN DATEADD(day, 13, CAST(GETDATE() AS date))
                ELSE e END AS e2,
           CASE WHEN s IS NULL THEN NULL
                WHEN s < CAST(GETDATE() AS date) THEN CAST(GETDATE() AS date) ELSE s END AS s2
    FROM base
),
perday AS (
    SELECT d.生产线, dd.di AS idx, SUM(d.q * 1.0 / (DATEDIFF(day, d.s2, d.e2) + 1)) AS v
    FROM clamped d
    CROSS APPLY (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13)) dd(di)
    WHERE d.s2 IS NOT NULL AND dd.di <= DATEDIFF(day, d.s2, d.e2)
    GROUP BY d.生产线, dd.di
),
k AS (
    SELECT 生产线, 生产车间, 日产能, CAST(NULL AS int) AS idx, CAST(NULL AS decimal(18,4)) AS v
    FROM (SELECT 生产线, 生产车间, ISNULL(日产能,0) AS 日产能 FROM bs_prod_line
          WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(停用,0) = 0) c
    UNION ALL
    -- 负荷行仅保留启用档案线(档案外脏值线一并排除)
    SELECT p.生产线, p.生产车间, NULL, pd.idx, pd.v
    FROM perday pd JOIN bs_prod_line p ON p.生产线 = pd.生产线
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.停用,0) = 0
)
SELECT 生产线,
       MAX(生产车间) AS 生产车间,
       MAX(日产能) AS 日产能,
       CAST(ISNULL(MAX(CASE WHEN idx = 0 THEN v END), 0) AS decimal(18,2)) AS [今日负荷],
       CAST(ISNULL(MAX(CASE WHEN idx = 1  THEN v END), 0) AS decimal(18,2)) AS [D1],
       CAST(ISNULL(MAX(CASE WHEN idx = 2  THEN v END), 0) AS decimal(18,2)) AS [D2],
       CAST(ISNULL(MAX(CASE WHEN idx = 3  THEN v END), 0) AS decimal(18,2)) AS [D3],
       CAST(ISNULL(MAX(CASE WHEN idx = 4  THEN v END), 0) AS decimal(18,2)) AS [D4],
       CAST(ISNULL(MAX(CASE WHEN idx = 5  THEN v END), 0) AS decimal(18,2)) AS [D5],
       CAST(ISNULL(MAX(CASE WHEN idx = 6  THEN v END), 0) AS decimal(18,2)) AS [D6],
       CAST(ISNULL(MAX(CASE WHEN idx = 7  THEN v END), 0) AS decimal(18,2)) AS [D7],
       CAST(ISNULL(MAX(CASE WHEN idx = 8  THEN v END), 0) AS decimal(18,2)) AS [D8],
       CAST(ISNULL(MAX(CASE WHEN idx = 9  THEN v END), 0) AS decimal(18,2)) AS [D9],
       CAST(ISNULL(MAX(CASE WHEN idx = 10 THEN v END), 0) AS decimal(18,2)) AS [D10],
       CAST(ISNULL(MAX(CASE WHEN idx = 11 THEN v END), 0) AS decimal(18,2)) AS [D11],
       CAST(ISNULL(MAX(CASE WHEN idx = 12 THEN v END), 0) AS decimal(18,2)) AS [D12],
       CAST(ISNULL(MAX(CASE WHEN idx = 13 THEN v END), 0) AS decimal(18,2)) AS [D13],
       CAST(ISNULL(SUM(v), 0) AS decimal(18,2)) AS [合计负荷],
       CAST(ROW_NUMBER() OVER (ORDER BY 生产线) AS int) AS id,
       CAST(NULL AS char(1)) AS asp_cancel
FROM k GROUP BY 生产线;
GO

/* ② LINE_LOAD 面板重复字段:保留 place=query,detail 的一份,删掉 detail-only 的重复份 */
DELETE f FROM yj_field f
WHERE f.panel_code = N'LINE_LOAD' AND f.place = N'detail'
  AND EXISTS (SELECT 1 FROM yj_field g
              WHERE g.panel_code = f.panel_code AND g.col_name = f.col_name AND g.place = N'query,detail');
GO

/* ③ 视图中文注明 */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.v_line_load') AND ep.minor_id = 0 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'产线排产负荷(数据源=plang 工单单轨):各启用产线在 今天..今天+13 的当日负荷,= 该线在制工单排产数量按[计划开工日..交期]均摊;D1=明天,D13=今天+13;合计负荷=区间合计',
       N'SCHEMA', N'dbo', N'VIEW', N'v_line_load';
GO

/* ④ 自检 */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.v_line_load', N'V') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.v_line_load', N'D13') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_line_load', N'V') IS NOT NULL
   AND OBJECT_DEFINITION(OBJECT_ID(N'dbo.v_line_load')) LIKE N'%v_manu_schedule%' SET @bad = @bad + 1;   -- 不得再挂旧体系
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'LINE_LOAD' AND place = N'detail') > 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'产线排产负荷改造:自检失败', 16, 1);
ELSE PRINT N'产线排产负荷就绪:v_line_load 挂 plang + LINE_LOAD 面板字段去重';
GO

SELECT TOP 5 生产线, 生产车间, 日产能, 今日负荷, D1, D7, D13, 合计负荷 FROM dbo.v_line_load ORDER BY 合计负荷 DESC;
GO
