SET NOCOUNT ON;
-- ① 本轮页面验证提交出来的混料单:两行、标记 Y、计划/实际/批号齐
SELECT id, 单据编号 AS docno, 工单号 AS wono, 工单行号 AS line, 序号 AS seq,
       物料编号 AS mat, 物料批次 AS batch, 计划用量 AS planqty, 实际用量 AS actualqty,
       标记 AS mark, asp_print AS printcnt, asp_user1 AS usr
  FROM dbo.wo_mixing_list WHERE 单据编号 = N'PL2611170001' ORDER BY id;
GO
SET NOCOUNT ON;
-- ② 该工单行不应留下未提交的草稿(round-07/08 的验证数据已撤回)
SELECT COUNT(*) AS draft_left FROM dbo.wo_mixing_list
 WHERE 工单号 = N'GD-2026-11-0015' AND 工单行号 = 1 AND 标记 = N'N' AND ISNULL(asp_cancel,'N') <> 'Y';
GO
SET NOCOUNT ON;
-- ③ 全表分布(应有 12 行 Y / 1 行 N,与开工前一致)
SELECT 标记 AS mark, COUNT(*) AS rows_ FROM dbo.wo_mixing_list GROUP BY 标记;
