/* _probe-plangpc-scjl-join.sql — 只读：把代码里现役的三种 JOIN 口径逐条跑一遍,看哪个还活着 */
SET NOCOUNT ON;

-- ① 快速排产看板口径(ScheduleBoardService.scheduled/trace):comm+pl_no+pl_xc 冗余键
SELECT '① 看板口径 comm+pl_no+pl_xc' AS 口径,
       '命中行数=' + CAST(COUNT(*) AS varchar(10)) AS 结果
FROM dbo.plang_pc pc JOIN dbo.plang p
  ON p.comm = pc.comm AND p.pl_no = pc.pl_no AND p.pl_xc = pc.pl_xc
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(p.asp_cancel,'N')<>'Y';

-- ② 工单列表/追溯口径:plang.id 直连
SELECT '② plang_pc.plang_id = plang.id' AS 口径,
       '命中行数=' + CAST(COUNT(*) AS varchar(10)) AS 结果
FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id = pc.plang_id;

-- ③ 报工审核口径(WoReportService.complete 的 TOP 1):pc JOIN plang ON pc.plang_id=p.id
SELECT '③ 报工审核锚定(plang_id 链)' AS 口径,
       '命中行数=' + CAST(COUNT(*) AS varchar(10)) AS 结果
FROM dbo.plang_pc pc
JOIN dbo.plang p ON pc.plang_id = p.id AND ISNULL(p.asp_cancel,'N')<>'Y'
WHERE pc.pl_no = 'GD-2026-10-0007' AND ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N''
  AND ISNULL(p.ja,'N') NOT IN ('T','Y');

-- ④ 报工 → 工单行(scjl.gd_id → plang_pc.plang_id → plang.id)
SELECT '④ 报工→工单行(gd_id 链)' AS 口径,
       'scjl 行数=' + CAST(COUNT(*) AS varchar(10))
       + ' 其中能解到 plang 行的=' + CAST(SUM(CASE WHEN p.id IS NULL THEN 0 ELSE 1 END) AS varchar(10)) AS 结果
FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id
LEFT JOIN dbo.plang p ON p.id = pc.plang_id
WHERE ISNULL(s.asp_cancel,'N')<>'Y';

-- ⑤ 报工审核的兜底口径(resolveRowIdForReport ②:工单号+批次号恰命中 1 行才认)
SELECT '⑤ 工单号+批次号兜底' AS 口径,
       'plang 命中行数=' + CAST(COUNT(*) AS varchar(10)) + '(≠1 时兜底失效)' AS 结果
FROM dbo.plang WHERE pl_no='GD-2026-10-0007' AND ISNULL([批次号],N'')='20261014' AND ISNULL(asp_cancel,'N')<>'Y';

-- ⑥ 镜像字段是否"活值"还是"报工时刻快照":pl_sl / scx 三表对照
SELECT '⑥ 三表字段对照' AS 口径;
SELECT CAST(s.id AS varchar(10)) + ' 报工单=' + ISNULL(s.报工单号,'-')
       + ' || pl_sl: scjl=' + CAST(ISNULL(s.pl_sl,0) AS varchar(20)) + ' plang_pc=' + CAST(ISNULL(pc.pl_sl,0) AS varchar(20)) + ' plang=' + CAST(ISNULL(p.pl_sl,0) AS varchar(20))
       + ' || scx: scjl=' + ISNULL(s.scx,'-') + ' plang_pc=' + ISNULL(pc.scx,'-') + ' plang=' + ISNULL(p.scx,'-')
       + ' || 批次号: scjl=' + ISNULL(s.批次号,'-') + ' plang_pc=' + ISNULL(pc.批次号,'-') + ' plang=' + ISNULL(p.批次号,'-') AS 对照
FROM dbo.scjl s
LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id
LEFT JOIN dbo.plang p ON p.comm = pc.comm AND p.pl_no = pc.pl_no AND p.pl_xc = pc.pl_xc
ORDER BY s.id DESC;
