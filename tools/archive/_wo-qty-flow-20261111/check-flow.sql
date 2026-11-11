-- 工单工序「按量流转」只读体检（2026-11-11）
-- 判据：任何工单行，后道的「已审报工折成品」不得超过前道的「已审报工折成品」——超过即为负在制。
-- 跑法（tools 目录）：
--   java -cp lib\mssql-jdbc.jar archive\_Query.java "<jdbcUrl>" yinjia <pass> "<本文件内容>"
-- 期望：0 行。

-- ① 负在制行（应为 0 行）
WITH r AS (
  SELECT p.id AS pid, p.pl_no, p.pl_xc, ISNULL(p.pl_sl,0) AS pl_sl,
         rt.工序名称 AS op, ISNULL(rt.加工顺序,999) AS seq, ISNULL(rt.换算率,1) AS rate,
         ISNULL((SELECT SUM(ISNULL(s.sl,0)) FROM dbo.scjl s
                  WHERE s.gldh = p.pl_no AND s.gxdm = rt.工序名称
                    AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'
                    AND EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = p.id)),0) AS done
  FROM dbo.plang p
  JOIN dbo.bs_route rt ON rt.工艺路线编码 = ISNULL(p.[工艺路线],N'') AND ISNULL(rt.asp_cancel,'N')<>'Y'
  WHERE ISNULL(p.asp_cancel,'N')<>'Y'
)
SELECT a.pl_no AS 工单号, a.pl_xc AS 行号, a.op AS 前道, a.done AS 前道已审,
       b.op AS 后道, b.done AS 后道已审
FROM r a JOIN r b ON b.pid = a.pid AND b.seq = a.seq + 1
WHERE a.rate > 0 AND b.rate > 0
  AND (b.done / b.rate) > (a.done / a.rate) + 0.0001
ORDER BY a.pl_no;

-- ② 台账状态分布（计划 / 已落实 / 已完工）
SELECT ISNULL(状态,N'(空)') AS 状态, COUNT(*) AS 行数
FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY ISNULL(状态,N'(空)') ORDER BY 行数 DESC;
