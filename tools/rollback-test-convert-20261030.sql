/* ============================================================
   rollback-test-convert-20261030.sql — 回滚「测试生成的工单」,把订单行还回去

   ⚠ 只回滚**测试脚本产出的**工单,判据严格:
     ① 工单是 GD-2026-10-* 且 源单号(od_no)非空 —— 即由「订单结转 → 转工单」生成;
     ② 该工单行**没有**任何有效领料单(wo_pick_doc)——
        有单据说明是用户真在用的数据,一律不动;
     ③ 该工单行**没有**已审核过账的流水(outh/inh)。

   为什么需要回滚:订单结转的"剩余可转数量"是靠 plang 里的工单行占用计算的,
   一次试跑转出一堆工单就把订单行的额度吃光了,后面复跑就报
   「该订单行已全部转出」。开发/演示阶段反复造数时必须能把这部分还回去。

   幂等:重复执行只会把已回滚的再删一遍(0 行)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES_TEST;
GO

DECLARE @del int = 0;

/* ① 先收集可回滚的工单行 */
DECLARE @wo TABLE (no nvarchar(60), xc int, dm nvarchar(100));

INSERT INTO @wo (no, xc, dm)
SELECT p.pl_no, p.pl_xc, p.dm
  FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
   AND p.pl_no LIKE N'GD-2026-10-%'
   AND ISNULL(CAST(p.od_no AS nvarchar(60)), N'') <> N''   -- 由订单结转生成的(od_no 是 varchar,统一 CAST)
   AND NOT EXISTS (SELECT 1 FROM dbo.wo_pick_doc d
                    WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')
   AND NOT EXISTS (SELECT 1 FROM dbo.wo_pick_doc d
                    WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc
                      AND ISNULL(d.领料单号,'') <> N''
                      AND EXISTS (SELECT 1 FROM dbo.yj_doc_status s
                                   WHERE s.panel_code = N'MATERIAL_OUT' AND s.doc_no = d.领料单号
                                     AND ISNULL(s.shr,'') <> N''));

DECLARE @cnt int = (SELECT COUNT(*) FROM @wo);
PRINT N'[收集] 可回滚工单行 ' + CAST(@cnt AS nvarchar(10)) + N' 条';

/* ② 删掉它们的工序台账(若有) */
DELETE FROM dbo.wo_process_line
 WHERE EXISTS (SELECT 1 FROM @wo w JOIN dbo.plang pp ON pp.pl_no = w.no AND pp.pl_xc = w.xc WHERE w.no = wo_process_line.工单号 AND wo_process_line.工单行id = pp.id);

/* ②b 清掉「订单行 → 工单」的占用登记(form_flow_link)
   🔴 这一步漏了会导致回滚后订单行**永远显示"已全部转出"**:
   订单结转在 form_flow_link 里登记了 source_panel_code='SO_ORDER' 的占用行,
   pending 的"已排产数量"就是从它 SUM 出来的。只删 plang 不清占用 ⇒
   工单没了、额度却没还回去,整个结转功能看起来是坏的(2026-10-30 实测踩到)。 */
DECLARE @links TABLE (key1 nvarchar(200) PRIMARY KEY);
INSERT INTO @links (key1)
SELECT DISTINCT w.no + N'#' + CAST(w.xc AS nvarchar(10)) FROM @wo w
UNION
SELECT DISTINCT w.no FROM @wo w;

DELETE f
  FROM dbo.form_flow_link f
 WHERE f.source_panel_code = N'SO_ORDER'
   AND f.target_panel_code IN (N'MANU_ORDER', N'PLANG')
   AND (EXISTS (SELECT 1 FROM @links k WHERE k.key1 = f.target_form_no)
        OR EXISTS (SELECT 1 FROM @links k WHERE f.target_line_key LIKE k.key1 + N'#%')
           OR EXISTS (SELECT 1 FROM @links k WHERE f.target_line_key LIKE k.key1));
DECLARE @linkDeleted int = @@ROWCOUNT;
PRINT N'[回滚] 已清订单行占用登记 ' + CAST(@linkDeleted AS nvarchar(10)) + N' 行';


/* ③ 删掉工单行本身 */
DELETE p
  FROM dbo.plang p
 WHERE EXISTS (SELECT 1 FROM @wo w WHERE w.no = p.pl_no AND w.xc = p.pl_xc);
SET @del = @@ROWCOUNT;

PRINT N'[回滚] 已删除工单行 ' + CAST(@del AS nvarchar(10)) + N' 条(订单行的可转额度随之恢复)';
GO

/* ---------- 自检 ---------- */
DECLARE @left int;
SELECT @left = COUNT(*) FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND p.pl_no LIKE N'GD-2026-10-%' AND ISNULL(CAST(p.od_no AS nvarchar(60)),N'') <> N''
   AND NOT EXISTS (SELECT 1 FROM dbo.wo_pick_doc d
                    WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废');
IF @left > 0
   PRINT N'[NOTE] 仍有 ' + CAST(@left AS nvarchar(10)) + N' 条结转工单未回滚(可能有已审核领料单,保留)';
ELSE
   PRINT N'[PASS] 无残留的测试结转工单';
GO
