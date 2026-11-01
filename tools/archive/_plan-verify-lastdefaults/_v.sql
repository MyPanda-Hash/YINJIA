SET NOCOUNT ON;
-- A) 条39:按物料编码取最近一次工单工艺路线(派生表一次扫描 plang;计划写进 PENDING_FROM 的形态)
SELECT TOP 8 h.dm, h.上次工艺路线, h.上次工单号, h.上次日期
FROM (SELECT p.dm, p.[工艺路线] AS 上次工艺路线, p.pl_no AS 上次工单号,
             CONVERT(varchar(10), p.pl_date, 120) AS 上次日期,
             ROW_NUMBER() OVER (PARTITION BY p.dm ORDER BY p.pl_date DESC, p.id DESC) AS rn
      FROM dbo.plang p
      WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.[工艺路线],N'') <> N'') h
WHERE h.rn = 1 ORDER BY h.上次日期 DESC;
-- A2) 命中面:有路线历史的物料数 / 档案物料数
SELECT (SELECT COUNT(DISTINCT dm) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([工艺路线],N'')<>N'') AS 有路线历史物料数,
       (SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y') AS 档案物料数;
-- B) 条7:按(物料编码,工序)取最近一次预排/实际产线(wo_process_line 未作废,经 工单行id→plang.id 取 dm+pl_date)
SELECT TOP 12 t.dm, t.工序, t.上次生产线, t.上次工单号, t.上次日期
FROM (SELECT p.dm, wl.工序,
             COALESCE(NULLIF(wl.实际生产线,N''), wl.计划生产线) AS 上次生产线,
             p.pl_no AS 上次工单号, CONVERT(varchar(10), p.pl_date, 120) AS 上次日期,
             ROW_NUMBER() OVER (PARTITION BY p.dm, wl.工序 ORDER BY p.pl_date DESC, wl.id DESC) AS rn
      FROM dbo.wo_process_line wl
      JOIN dbo.plang p ON p.id = wl.工单行id AND ISNULL(p.asp_cancel,'N') <> 'Y'
      WHERE ISNULL(wl.asp_cancel,'N') <> 'Y'
        AND COALESCE(NULLIF(wl.实际生产线,N''), wl.计划生产线, N'') <> N'') t
WHERE t.rn = 1 ORDER BY t.dm, t.工序;
-- B2) 台账关联完整度(未作废台账行:工单行id 非空 / 能关联上 plang 的占比)
SELECT COUNT(*) AS 台账行,
       SUM(CASE WHEN wl.工单行id IS NOT NULL THEN 1 ELSE 0 END) AS 有行id,
       SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) AS 能关联plang
FROM dbo.wo_process_line wl LEFT JOIN dbo.plang p ON p.id = wl.工单行id
WHERE ISNULL(wl.asp_cancel,'N') <> 'Y';
-- C) 排序键复核:plang.pl_date 填充与跨度(勘察:100% 填充、2026-09-02~10-20、无回填污染)
SELECT CONVERT(varchar(10), MIN(pl_date),120) AS pl_date起, CONVERT(varchar(10), MAX(pl_date),120) AS pl_date止,
       SUM(CASE WHEN pl_date IS NULL THEN 1 ELSE 0 END) AS pl_date空, COUNT(*) AS 总行
FROM dbo.plang;
