-- ============================================================================
-- 清理 2026-10-21 开发验证产生的 5 张报工单(仅限下列单号,勿扩大范围)
--
-- 来源:调试「工序报工」面板时,在 GD-2026-10-0221 上反复提交形成的测试数据。
-- 影响:这 5 张挂在真实工单上,会让成型/切炭的工序进度虚高
--       (成型 15/100、切炭 5/100),需清掉并重算工单行状态。
--
-- 安全措施:
--   ① 单号写死,不按工单号批量删;
--   ② 先 COUNT 出命中行,行数与预期不符就整批 ROLLBACK;
--   ③ 先删明细(scjl)与流程链/状态,再重算 plang 的 当前工序/完工状态/完工时间。
--
-- 幂等:重复执行 = 命中 0 行,不报错。
-- ============================================================================

SET NOCOUNT ON;
BEGIN TRAN;

DECLARE @wo TABLE (id INT PRIMARY KEY);
INSERT INTO @wo (id) SELECT id FROM dbo.scjl
 WHERE [报工单号] IN (N'BG-2026-10-0001', N'BG-2026-10-0002', N'BG-2026-10-0003',
                      N'BG-2026-10-0004', N'BG-2026-10-0005');

DECLARE @hit INT = (SELECT COUNT(*) FROM @wo);
SELECT @hit AS 命中报工行数;

-- 只允许删这 5 张(行数 0~5);超过说明单号被别处复用,立刻停手
IF @hit > 5
BEGIN
    PRINT '[ABORT] 命中行数超过 5,可能有别的业务单据撞了这些单号,已回滚';
    ROLLBACK TRAN;
    RETURN;
END

-- ① 流程链(报工 → 检验单/入库单的占用关系)
DELETE FROM dbo.form_flow_link
 WHERE source_panel_code = N'WO_REPORT'
   AND source_form_no IN (N'BG-2026-10-0001', N'BG-2026-10-0002', N'BG-2026-10-0003',
                          N'BG-2026-10-0004', N'BG-2026-10-0005');

-- ② 单据状态
DELETE FROM dbo.yj_doc_status
 WHERE panel_code = N'WO_REPORT'
   AND doc_no IN (N'BG-2026-10-0001', N'BG-2026-10-0002', N'BG-2026-10-0003',
                  N'BG-2026-10-0004', N'BG-2026-10-0005');

-- ③ 报工行本身
DELETE s FROM dbo.scjl s JOIN @wo w ON w.id = s.id;
SELECT @@ROWCOUNT AS 已删报工行数;

-- ④ 重算工单行状态:该行已无任何已审核报工 ⇒ 回到未开工
UPDATE p SET p.[当前工序] = NULL, p.[完工状态] = NULL, p.[当前工序完工量] = 0,
             p.[完工时间] = NULL, p.asp_user2 = N'cleanup-20261021', p.asp_time2 = GETDATE()
  FROM dbo.plang p
 WHERE p.pl_no = N'GD-2026-10-0221' AND p.pl_xc = 1
   AND NOT EXISTS (
         SELECT 1 FROM dbo.scjl s
          WHERE s.gldh = p.pl_no AND ISNULL(s.asp_cancel,'N') <> 'Y' AND ISNULL(s.wgzt,'N') = 'Y'
       );
SELECT @@ROWCOUNT AS 已重算工单行数;

COMMIT TRAN;

-- ⑤ 自检
SELECT (SELECT COUNT(*) FROM dbo.scjl
         WHERE [报工单号] IN (N'BG-2026-10-0001',N'BG-2026-10-0002',N'BG-2026-10-0003',
                              N'BG-2026-10-0004',N'BG-2026-10-0005')) AS 残留报工行,
       (SELECT COUNT(*) FROM dbo.yj_doc_status
         WHERE panel_code = N'WO_REPORT'
           AND doc_no IN (N'BG-2026-10-0001',N'BG-2026-10-0002',N'BG-2026-10-0003',
                          N'BG-2026-10-0004',N'BG-2026-10-0005')) AS 残留单据状态;

SELECT pl_no, pl_xc, ISNULL([当前工序],N'(空)') AS 当前工序, ISNULL([完工状态],N'(空)') AS 完工状态
  FROM dbo.plang WHERE pl_no = N'GD-2026-10-0221' AND pl_xc = 1;
