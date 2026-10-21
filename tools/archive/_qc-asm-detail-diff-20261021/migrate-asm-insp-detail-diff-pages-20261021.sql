/* =============================================================================
   组装成品检验单明细「目数」雷同行 → 分批差异化改写（2026-10-21）

   用户口径（2026-10-21）：「针对其他的也进行部分修改，主要选取第一页即可，
   后续的随机进行修改即可。后续的一页可以分布修改10份左右即可。」

   选取（按列表页 50 条/页的顺序，第 1 页全选；第 2~8 页各随机 10 张）：
     · 第 1 页 50 张（其中 ZJ-2026-10-0135 已在上一脚本改过，本脚本会自动跳过）；
     · 第 2~8 页各 10 张，共 120 张选取（实际有存活目数行的 119 张）。
     · 随机种子 20261021（固定种子 = 可复现；要重抽改 seed 即可）。

   每张目标单：作废「目数%」行 → 写入 外观/尺寸/重量 + 一条轮换性能项
   （尺寸测量值按规格 a*b*c 解析，性能项按 head.id % 4 轮换）。
   默认 apply=0 只干跑；确认计划后把 #cfg.apply 改成 1 再执行。
   ============================================================================= */
SET NOCOUNT ON;



IF OBJECT_ID('tempdb..#cfg') IS NOT NULL DROP TABLE #cfg;
CREATE TABLE #cfg (apply bit NOT NULL, docNo nvarchar(100) NULL, mark nvarchar(100) NOT NULL);
INSERT INTO #cfg (apply, docNo, mark)
VALUES (0, NULL, N'qc-asm-detail-diff-pages-20261021');

IF OBJECT_ID('tempdb..#pick') IS NOT NULL DROP TABLE #pick;
CREATE TABLE #pick (pageNo int NOT NULL, 单据编号 nvarchar(100) NOT NULL PRIMARY KEY);
INSERT INTO #pick (pageNo, 单据编号) VALUES
( 1, N'ZJ-2026-10-0135' ), ( 1, N'ZJ-2026-10-0134' ), ( 1, N'ZJ-2026-10-0133' ), ( 1, N'ZJ-2026-10-0132' ),
  ( 1, N'ZJ-2026-10-0131' ), ( 1, N'ZJ-2026-10-0130' ), ( 1, N'ZJ-2026-10-0129' ), ( 1, N'ZJ-2026-10-0128' ),
  ( 1, N'ZJ-2026-10-0127' ), ( 1, N'ZJ-2026-10-0126' ), ( 1, N'ZJ-2026-10-0125' ), ( 1, N'ZJ-2026-10-0124' ),
  ( 1, N'ZJ-2026-10-0123' ), ( 1, N'ZJ-2026-10-0122' ), ( 1, N'ZJ-2026-10-0121' ), ( 1, N'ZJ-2026-10-0120' ),
  ( 1, N'ZJ-2026-10-0119' ), ( 1, N'ZJ-2026-10-0118' ), ( 1, N'ZJ-2026-10-0117' ), ( 1, N'ZJ-2026-10-0116' ),
  ( 1, N'ZJ-2026-10-0115' ), ( 1, N'ZJ-2026-10-0114' ), ( 1, N'ZJ-2026-10-0113' ), ( 1, N'ZJ-2026-10-0112' ),
  ( 1, N'ZJ-2026-10-0111' ), ( 1, N'ZJ-2026-10-0110' ), ( 1, N'ZJ-2026-10-0109' ), ( 1, N'ZJ-2026-10-0108' ),
  ( 1, N'ZJ-2026-10-0107' ), ( 1, N'ZJ-2026-10-0106' ), ( 1, N'ZJ-2026-10-0105' ), ( 1, N'ZJ-2026-10-0104' ),
  ( 1, N'ZJ-2026-10-0103' ), ( 1, N'ZJ-2026-10-0102' ), ( 1, N'ZJ-2026-10-0101' ), ( 1, N'ZJ-2026-10-0100' ),
  ( 1, N'ZJ-2026-10-0099' ), ( 1, N'ZJ-2026-10-0098' ), ( 1, N'ZJ-2026-10-0097' ), ( 1, N'ZJ-2026-10-0096' ),
  ( 1, N'ZJ-2026-10-0095' ), ( 1, N'ZJ-2026-10-0094' ), ( 1, N'ZJ-2026-10-0093' ), ( 1, N'ZJ-2026-10-0092' ),
  ( 1, N'ZJ-2026-10-0091' ), ( 1, N'ZJ-2026-10-0090' ), ( 1, N'ZJ-2026-10-0089' ), ( 1, N'ZJ-2026-10-0088' ),
  ( 1, N'ZJ-2026-10-0087' ), ( 1, N'ZJ-2026-10-0086' ), ( 2, N'ZJ-2026-10-0051' ), ( 2, N'ZJ-2026-10-0061' ),
  ( 2, N'ZJ-2026-10-0048' ), ( 2, N'ZJ-2026-10-0085' ), ( 2, N'ZJ-2026-10-0039' ), ( 2, N'ZJ-2026-10-0060' ),
  ( 2, N'ZJ-2026-10-0065' ), ( 2, N'ZJ-2026-10-0045' ), ( 2, N'ZJ-2026-10-0071' ), ( 2, N'ZJ-2026-10-0055' ),
  ( 3, N'ZJ-2026-09-0295' ), ( 3, N'ZJ-2026-09-0271' ), ( 3, N'ZJ-2026-10-0037' ), ( 3, N'ZJ-2026-10-0023' ),
  ( 3, N'ZJ-2026-10-0036' ), ( 3, N'ZJ-2026-10-0034' ), ( 3, N'ZJ-2026-09-0277' ), ( 3, N'ZJ-2026-09-0281' ),
  ( 3, N'ZJ-2026-09-0283' ), ( 3, N'ZJ-2026-09-0280' ), ( 4, N'ZJ-2026-09-0267' ), ( 4, N'ZJ-2026-09-0263' ),
  ( 4, N'ZJ-2026-09-0241' ), ( 4, N'ZJ-2026-09-0244' ), ( 4, N'ZJ-2026-09-0265' ), ( 4, N'ZJ-2026-09-0264' ),
  ( 4, N'ZJ-2026-09-0251' ), ( 4, N'ZJ-2026-09-0254' ), ( 4, N'ZJ-2026-09-0259' ), ( 4, N'ZJ-2026-09-0261' ),
  ( 5, N'ZJ-2026-09-0211' ), ( 5, N'ZJ-2026-09-0213' ), ( 5, N'ZJ-2026-09-0179' ), ( 5, N'ZJ-2026-09-0217' ),
  ( 5, N'ZJ-2026-09-0172' ), ( 5, N'ZJ-2026-09-0174' ), ( 5, N'ZJ-2026-09-0204' ), ( 5, N'ZJ-2026-09-0210' ),
  ( 5, N'ZJ-2026-09-0198' ), ( 5, N'ZJ-2026-09-0220' ), ( 6, N'ZJ-2026-09-0132' ), ( 6, N'ZJ-2026-09-0135' ),
  ( 6, N'ZJ-2026-09-0147' ), ( 6, N'ZJ-2026-09-0153' ), ( 6, N'ZJ-2026-09-0137' ), ( 6, N'ZJ-2026-09-0164' ),
  ( 6, N'ZJ-2026-09-0161' ), ( 6, N'ZJ-2026-09-0125' ), ( 6, N'ZJ-2026-09-0151' ), ( 6, N'ZJ-2026-09-0141' ),
  ( 7, N'ZJ-2026-09-0114' ), ( 7, N'ZJ-2026-09-0113' ), ( 7, N'ZJ-2026-09-0083' ), ( 7, N'ZJ-2026-09-0106' ),
  ( 7, N'ZJ-2026-09-0072' ), ( 7, N'ZJ-2026-09-0094' ), ( 7, N'ZJ-2026-09-0078' ), ( 7, N'ZJ-2026-09-0071' ),
  ( 7, N'ZJ-2026-09-0095' ), ( 7, N'ZJ-2026-09-0092' ), ( 8, N'ZJ-2026-09-0056' ), ( 8, N'ZJ-2026-09-0069' ),
  ( 8, N'ZJ-2026-09-0059' ), ( 8, N'ZJ-2026-09-0048' ), ( 8, N'ZJ-2026-09-0052' ), ( 8, N'ZJ-2026-09-0049' ),
  ( 8, N'ZJ-2026-09-0046' ), ( 8, N'ZJ-2026-09-0045' ), ( 8, N'ZJ-2026-09-0050' ), ( 8, N'ZJ-2026-09-0042' );

IF OBJECT_ID('tempdb..#targets') IS NOT NULL DROP TABLE #targets;
CREATE TABLE #targets (
  单据编号 nvarchar(100) NOT NULL PRIMARY KEY,
  产品编码 nvarchar(100), 产品名称 nvarchar(400), 规格型号 nvarchar(400),
  合格数量 decimal(18,4), headId bigint
);
INSERT INTO #targets (单据编号, 产品编码, 产品名称, 规格型号, 合格数量, headId)
SELECT h.单据编号, MAX(h.产品编码), MAX(h.产品名称), MAX(h.规格型号), MAX(h.合格数量), MAX(h.id)
FROM qc_asm_insp_head h
WHERE EXISTS (SELECT 1 FROM qc_asm_insp_detail d
               WHERE d.单据编号 = h.单据编号 AND d.检验项目 LIKE N'目数%' AND ISNULL(d.asp_cancel, N'N') <> N'Y')
  AND h.单据编号 IN (SELECT 单据编号 FROM #pick)
GROUP BY h.单据编号;

IF OBJECT_ID('tempdb..#newRows') IS NOT NULL DROP TABLE #newRows;
CREATE TABLE #newRows (
  单据编号 nvarchar(100), sort int, 检验类型 nvarchar(100), 检验项目 nvarchar(200),
  检验要求 nvarchar(400), 检验方法 nvarchar(2000), 测量值1 decimal(18,4), 测量值2 decimal(18,4),
  测量值3 decimal(18,4), 检验结果 nvarchar(400), 结果判断 nvarchar(40), 合格数量 decimal(18,4)
);

/* 基础三类：外观 / 尺寸 / 重量（QP-ASM-00） */
INSERT INTO #newRows
SELECT t.单据编号, s.sort,
       CASE s.code WHEN N'ASM-WEIGHT' THEN N'出货重量' ELSE i.检验内容 END,
       i.项目名称, i.检验标准, i.检验方法,
       CASE WHEN s.code = N'ASM-DIMENSION' THEN d.od ELSE NULL END,
       CASE WHEN s.code = N'ASM-DIMENSION' THEN d.idia ELSE NULL END,
       CASE WHEN s.code = N'ASM-DIMENSION' THEN d.len ELSE NULL END,
       N'合格', N'合格', t.合格数量
FROM #targets t
JOIN (SELECT N'ASM-APPEARANCE' AS code, 1 AS sort
      UNION ALL SELECT N'ASM-DIMENSION', 2
      UNION ALL SELECT N'ASM-WEIGHT', 3) s ON 1 = 1
JOIN bs_qc_item i ON i.项目编码 = s.code AND ISNULL(i.asp_cancel, N'N') <> N'Y'
OUTER APPLY (
  SELECT
    CASE WHEN LEN(x.dims) - LEN(REPLACE(x.dims, N'.', N'')) = 2 THEN PARSENAME(x.dims, 3) END AS od_s,
    CASE WHEN LEN(x.dims) - LEN(REPLACE(x.dims, N'.', N'')) = 2 THEN PARSENAME(x.dims, 2) END AS id_s,
    CASE WHEN LEN(x.dims) - LEN(REPLACE(x.dims, N'.', N'')) = 2 THEN PARSENAME(x.dims, 1) END AS len_s
  FROM (SELECT REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(t.规格型号, N''), N'*', N'.'), N'×', N'.'), N'x', N'.'), N'X', N'.') AS dims) x
) p
OUTER APPLY (
  SELECT CASE WHEN ISNUMERIC(p.od_s) = 1 AND ISNUMERIC(p.id_s) = 1 AND ISNUMERIC(p.len_s) = 1
              THEN CAST(p.od_s AS decimal(18,4)) END AS od,
         CASE WHEN ISNUMERIC(p.od_s) = 1 AND ISNUMERIC(p.id_s) = 1 AND ISNUMERIC(p.len_s) = 1
              THEN CAST(p.id_s AS decimal(18,4)) END AS idia,
         CASE WHEN ISNUMERIC(p.od_s) = 1 AND ISNUMERIC(p.id_s) = 1 AND ISNUMERIC(p.len_s) = 1
              THEN CAST(p.len_s AS decimal(18,4)) END AS len
) d;

/* 性能项：按 headId % 4 轮换（强度 / 初始流速 / 压降 / 余氯去除率） */
INSERT INTO #newRows
SELECT t.单据编号, 4, N'性能', i.项目名称, i.检验标准, i.检验方法,
       CASE p.code
         WHEN N'ASM-STRENGTH' THEN 30 + (t.headId % 5)
         WHEN N'ASM-FLOW'     THEN 8 + (t.headId % 5)
         WHEN N'ASM-PRESSURE' THEN 10 + (t.headId % 5)
         WHEN N'ASM-CHLORINE' THEN 98 + (t.headId % 2)
       END,
       NULL, NULL, N'合格', N'合格', t.合格数量
FROM #targets t
CROSS APPLY (SELECT CASE t.headId % 4
                      WHEN 0 THEN N'ASM-STRENGTH'
                      WHEN 1 THEN N'ASM-FLOW'
                      WHEN 2 THEN N'ASM-PRESSURE'
                      ELSE N'ASM-CHLORINE' END AS code) p
JOIN bs_qc_item i ON i.项目编码 = p.code AND ISNULL(i.asp_cancel, N'N') <> N'Y';
GO

/* ── 干跑/执行前先看计划（单独一批，保证结果集能打印出来） ── */
SELECT c.apply, c.docNo, c.mark,
       (SELECT COUNT(*) FROM #pick) AS 选取单数,
       (SELECT COUNT(*) FROM #targets) AS 目标单数,
       (SELECT COUNT(*) FROM #newRows) AS 计划行数
FROM #cfg c;

SELECT TOP (30) 单据编号, sort AS 序号, 检验类型, 检验项目, 检验要求,
       CAST(测量值1 AS nvarchar(20)) AS 测量值1,
       CAST(测量值2 AS nvarchar(20)) AS 测量值2,
       CAST(测量值3 AS nvarchar(20)) AS 测量值3,
       检验结果
FROM #newRows ORDER BY 单据编号, sort;
GO

/* ── 真正写库：只由 #cfg.apply 控制 ── */
DECLARE @apply bit = (SELECT apply FROM #cfg);
DECLARE @mark nvarchar(100) = (SELECT mark FROM #cfg);
DECLARE @targets int = (SELECT COUNT(*) FROM #targets);
DECLARE @rows int = (SELECT COUNT(*) FROM #newRows);

IF @apply = 0
BEGIN
  PRINT N'[DRY-RUN] 未写库。确认计划后把 #cfg 的 apply 改为 1 再执行。目标单 ' + CAST(@targets AS nvarchar(10))
      + N' 张，计划新行 ' + CAST(@rows AS nvarchar(10)) + N' 行。';
  RETURN;
END
IF @targets = 0 OR @rows = 0
BEGIN
  PRINT N'[SKIP] 没有目标单或计划行（可能已改写或单号不存在）。';
  RETURN;
END

BEGIN TRAN;

UPDATE d
   SET asp_cancel = N'Y', asp_user2 = @mark, asp_time2 = SYSDATETIME()
  FROM qc_asm_insp_detail d
  JOIN #targets t ON t.单据编号 = d.单据编号
 WHERE d.检验项目 LIKE N'目数%' AND ISNULL(d.asp_cancel, N'N') <> N'Y';
PRINT N'[ok] 作废目数行：' + CAST(@@ROWCOUNT AS nvarchar(10));

INSERT INTO qc_asm_insp_detail
  (单据编号, 行号, 检验类型, 检验项目, 检验要求, 检验方法, 测量值1, 测量值2, 测量值3,
   检验结果, 结果判断, 合格数量, 不合格数量, asp_user1, asp_time1)
SELECT n.单据编号,
       ISNULL((SELECT MAX(d.行号) FROM qc_asm_insp_detail d WHERE d.单据编号 = n.单据编号), 0) + n.sort,
       n.检验类型, n.检验项目, n.检验要求, n.检验方法, n.测量值1, n.测量值2, n.测量值3,
       n.检验结果, n.结果判断, n.合格数量, 0, @mark, SYSDATETIME()
FROM #newRows n;
PRINT N'[ok] 新增差异化明细：' + CAST(@@ROWCOUNT AS nvarchar(10));

COMMIT;

PRINT N'[done] 已改写 ' + CAST(@targets AS nvarchar(10)) + N' 张单（' + CAST(@rows AS nvarchar(10)) + N' 行）。';
