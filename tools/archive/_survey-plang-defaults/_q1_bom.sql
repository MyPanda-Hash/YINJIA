SET NOCOUNT ON;
-- A. 产线档案 bs_prod_line(排产看板产线下拉的来源,ScheduleBoardService ~L566)
SELECT 生产线, 生产车间, 产线分组, 停用, 排序 FROM bs_prod_line ORDER BY ISNULL(排序,999), 生产线;
-- B. plang 工艺路线非空样例(最近 10 条)
SELECT TOP 10 id, pl_no, dm, scx, [工艺路线], [当前工序], pl_date, asp_time1, asp_time2
FROM plang WHERE [工艺路线] IS NOT NULL AND LTRIM(RTRIM([工艺路线]))<>N'' ORDER BY id DESC;
-- C. plang.工艺路线 取值分布
SELECT ISNULL(NULLIF(LTRIM(RTRIM([工艺路线])),N''),N'(null)') AS v, COUNT(*) cnt
FROM plang GROUP BY [工艺路线] ORDER BY cnt DESC;
-- D. plang_pc 最近 8 行(看时间列实况)
SELECT TOP 8 id, pl_no, dm, scx, plang_id, pl_date, jh_date, asp_time1, asp_time2
FROM plang_pc ORDER BY id DESC;
-- E. plang_pc 时间列空置率与跨度
SELECT COUNT(*) total,
 SUM(CASE WHEN pl_date IS NULL THEN 1 ELSE 0 END) pl_date_null,
 SUM(CASE WHEN jh_date IS NULL THEN 1 ELSE 0 END) jh_date_null,
 SUM(CASE WHEN asp_time1 IS NULL THEN 1 ELSE 0 END) asp_time1_null,
 SUM(CASE WHEN asp_time2 IS NULL THEN 1 ELSE 0 END) asp_time2_null,
 MIN(pl_date) min_pl_date, MAX(pl_date) max_pl_date,
 MIN(asp_time1) min_asp1, MAX(asp_time1) max_asp1
FROM plang_pc;
-- E2. plang 时间列空置率 + 工艺路线空置率
SELECT COUNT(*) total,
 SUM(CASE WHEN pl_date IS NULL THEN 1 ELSE 0 END) pl_date_null,
 SUM(CASE WHEN asp_time1 IS NULL THEN 1 ELSE 0 END) asp_time1_null,
 SUM(CASE WHEN asp_time2 IS NULL THEN 1 ELSE 0 END) asp_time2_null,
 SUM(CASE WHEN [工艺路线] IS NULL THEN 1 ELSE 0 END) route_null,
 MIN(pl_date) min_pl_date, MAX(pl_date) max_pl_date
FROM plang;
-- F. 同物料→最近一次(排产侧):取历史行数最多的 3 个物料,展示全历史 + 最新一条
;WITH h AS (
  SELECT pc.dm, pc.id, pc.pl_no, pc.scx, p.[工艺路线], pc.pl_date, pc.asp_time1,
         ROW_NUMBER() OVER (PARTITION BY pc.dm ORDER BY ISNULL(pc.asp_time1, pc.pl_date) DESC, pc.id DESC) rn,
         COUNT(*) OVER (PARTITION BY pc.dm) cnt
  FROM plang_pc pc LEFT JOIN plang p ON p.id = pc.plang_id
  WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N''
)
SELECT dm, cnt AS hist_rows, rn, id, pl_no, scx AS last_line, [工艺路线], pl_date, asp_time1
FROM h WHERE dm IN (SELECT TOP 3 dm FROM h WHERE rn=1 AND cnt>=3 GROUP BY dm, cnt ORDER BY cnt DESC)
ORDER BY dm, rn;
-- F2. 同物料→最近一次(工单侧,条39 用):取历史行数最多的 3 个物料
;WITH h2 AS (
  SELECT dm, id, pl_no, scx, [工艺路线], pl_date, asp_time1,
         ROW_NUMBER() OVER (PARTITION BY dm ORDER BY ISNULL(asp_time1, pl_date) DESC, id DESC) rn,
         COUNT(*) OVER (PARTITION BY dm) cnt
  FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([工艺路线],N'')<>N''
)
SELECT dm, cnt AS hist_rows, rn, id, pl_no, scx, [工艺路线], pl_date, asp_time1
FROM h2 WHERE dm IN (SELECT TOP 3 dm FROM h2 WHERE rn=1 AND cnt>=2 GROUP BY dm, cnt ORDER BY cnt DESC)
ORDER BY dm, rn;
-- G. 命中率:存货档案总数 vs 有排产/工单历史的物料数
SELECT (SELECT COUNT(*) FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y') AS inv_total,
       (SELECT COUNT(DISTINCT dm) FROM plang_pc) AS pc_dm_distinct,
       (SELECT COUNT(DISTINCT dm) FROM plang) AS plang_dm_distinct,
       (SELECT COUNT(*) FROM (SELECT DISTINCT pc.dm FROM plang_pc pc JOIN bs_inv i ON i.存货编码=pc.dm WHERE ISNULL(i.asp_cancel,'N')<>'Y') x) AS pc_dm_in_inv;
-- H. plang_pc→plang 关联完整度(plang_id 是否可靠)
SELECT COUNT(*) pc_rows,
 SUM(CASE WHEN pc.plang_id IS NULL THEN 1 ELSE 0 END) plang_id_null,
 SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) no_match
FROM plang_pc pc LEFT JOIN plang p ON p.id = pc.plang_id;
