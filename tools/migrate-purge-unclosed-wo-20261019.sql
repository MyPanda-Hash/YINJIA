/* ============================================================
   migrate-purge-unclosed-wo-20261019.sql
   清掉「未完工 / 未结案」的生产工单行及其残留单据（默认只报告，不修改）

   背景（2026-10-19 用户口径）：
     「把上面那些未完工未能结案的数据都删除吧，修复完号池问题先」
   这些行是 2026-10-19 由参考库/小程序直写进 plang 的**未排产/未入库**工单行
   （客户 C-78/D-01/B-47…，入库=0，ja=N），MES 里既没排产也没报工完成，
   留着只会继续和真单抢号、在看板上占位。

   处置 = **作废**（asp_cancel='Y'）+ 留痕，不是物理 DELETE：
     作废后 MES 各处（列表/待排产池/排产/报工/追溯）本来就过滤作废行，效果等同删除；
     但保留可回滚，也不会让报工/检验记录变孤儿。

   范围（严格按「未作废 且 ja 不在 T/Y」取，逐行锚 id，不按单号整单删）：
     ① plang / plang_pc
     ② scjl（报工行：先按 gd_id→plang_pc.plang_id，再按 工单号+行号 兜底）
     ③ wo_progress（工单行id）
     ④ qc_asm_insp_head / qc_asm_insp_detail（工单号+工单行号）
     ⑤ bd_finish_in / bl_finish_in（加工单号+工单行号；入库=0 时通常为空）
     ⑥ form_flow_link（占用链，改 link_status='CANCELLED'）
   ⚠ 号池 s_allno **只增不删**（删号 = 重发号，项目铁律），故本脚本不动号池。

   用法：① 直接跑 = dry-run；② 核对后把 @apply 改 1 再跑（幂等）。
   ============================================================ */
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.plang', N'U') IS NULL
BEGIN PRINT N'[跳过] 无 plang 表'; RETURN; END

DECLARE @apply bit = 0;   -- 0 = 只报告 / 1 = 真作废

DECLARE @p TABLE (id bigint PRIMARY KEY, pl_no nvarchar(50), xc int);
INSERT INTO @p (id, pl_no, xc)
SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0)
  FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
   AND ISNULL(p.ja,'N') NOT IN (N'T', N'Y');   -- 未结案

DECLARE @pc TABLE (id bigint PRIMARY KEY);
INSERT INTO @pc (id) SELECT pc.id FROM dbo.plang_pc pc JOIN @p x ON x.id = pc.plang_id;

-- 候选清单（前 50 行）
SELECT 工单号 = p.pl_no, 工单行号 = x.xc, 客户 = ISNULL(p.khdm,''), 批次 = ISNULL(p.[批次号],''),
       排产 = ISNULL(p.pl_sl,0), 入库 = ISNULL(p.rk_sl,0), 完工状态 = ISNULL(p.[完工状态],''),
       建单人 = ISNULL(p.asp_user1,''), 建单时间 = CONVERT(varchar(19), p.asp_time1, 120)
  FROM dbo.plang p JOIN @p x ON x.id = p.id
 ORDER BY p.pl_no, x.xc;

DECLARE @nP int = (SELECT COUNT(*) FROM @p);
DECLARE @nPc int = (SELECT COUNT(*) FROM @pc);
DECLARE @nRep int = (SELECT COUNT(*) FROM dbo.scjl s WHERE ISNULL(s.asp_cancel,'N')<>'Y'
    AND (s.gd_id IN (SELECT id FROM @pc)
         OR EXISTS (SELECT 1 FROM @p x WHERE x.pl_no=s.gldh AND x.xc=ISNULL(s.[工单行号],0))));
DECLARE @nProg int = (SELECT COUNT(*) FROM dbo.wo_progress w WHERE ISNULL(w.asp_cancel,'N')<>'Y'
    AND w.[工单行id] IN (SELECT id FROM @p));
DECLARE @nQc int = (SELECT COUNT(*) FROM dbo.qc_asm_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
    AND EXISTS (SELECT 1 FROM @p x WHERE x.pl_no=h.工单号 AND x.xc=ISNULL(h.[工单行号],0)));
DECLARE @nFi int = (SELECT COUNT(*) FROM dbo.bd_finish_in f WHERE ISNULL(f.asp_cancel,'N')<>'Y'
    AND EXISTS (SELECT 1 FROM @p x WHERE x.pl_no=f.加工单号 AND x.xc=ISNULL(f.工单行号,0)));
DECLARE @nLink int = (SELECT COUNT(*) FROM dbo.form_flow_link l WHERE l.link_status='ACTIVE'
    AND EXISTS (SELECT 1 FROM @p x WHERE x.pl_no=l.target_form_no
                AND l.target_line_key = x.pl_no + N'#' + CONVERT(nvarchar(20), x.xc)));

PRINT N'候选: 工单行 ' + CAST(@nP AS nvarchar(10)) + N' / 排产 ' + CAST(@nPc AS nvarchar(10))
    + N' / 报工 ' + CAST(@nRep AS nvarchar(10)) + N' / 进度 ' + CAST(@nProg AS nvarchar(10))
    + N' / 组装检验单 ' + CAST(@nQc AS nvarchar(10)) + N' / 入库单 ' + CAST(@nFi AS nvarchar(10))
    + N' / 占用链 ' + CAST(@nLink AS nvarchar(10));

IF @nP = 0 BEGIN PRINT N'[PASS] 没有「未完工/未结案」的工单行'; RETURN; END
IF @apply = 0
BEGIN
    PRINT N'[DRY-RUN] @apply=0，未修改任何数据。核对后把 @apply 改成 1 再跑。';
    RETURN;
END

-- ① 报工行
UPDATE s SET s.asp_cancel='Y', s.asp_user2=N'清理未完工未结案', s.asp_time2=GETDATE()
  FROM dbo.scjl s
 WHERE ISNULL(s.asp_cancel,'N')<>'Y'
   AND (s.gd_id IN (SELECT id FROM @pc)
        OR EXISTS (SELECT 1 FROM @p x WHERE x.pl_no=s.gldh AND x.xc=ISNULL(s.[工单行号],0)));
PRINT N'作废 报工行: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

-- ② 工序进度
UPDATE w SET w.asp_cancel='Y', w.asp_user2=N'清理未完工未结案', w.asp_time2=GETDATE()
  FROM dbo.wo_progress w
 WHERE ISNULL(w.asp_cancel,'N')<>'Y' AND w.[工单行id] IN (SELECT id FROM @p);
PRINT N'作废 工序进度: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

-- ③ 组装成品检验单（头 + 明细 + 状态）
DECLARE @qc TABLE (doc_no nvarchar(50) PRIMARY KEY);
INSERT INTO @qc (doc_no)
SELECT h.[单据编号] FROM dbo.qc_asm_insp_head h
 WHERE ISNULL(h.asp_cancel,'N')<>'Y'
   AND EXISTS (SELECT 1 FROM @p x WHERE x.pl_no=h.工单号 AND x.xc=ISNULL(h.[工单行号],0));
UPDATE d SET d.asp_cancel='Y' FROM dbo.qc_asm_insp_detail d JOIN @qc q ON q.doc_no=d.[单据编号]
 WHERE ISNULL(d.asp_cancel,'N')<>'Y';
UPDATE h SET h.asp_cancel='Y', h.asp_user2=N'清理未完工未结案', h.asp_time2=GETDATE()
  FROM dbo.qc_asm_insp_head h JOIN @qc q ON q.doc_no=h.[单据编号];
UPDATE st SET st.canceled='Y', st.update_at=GETDATE()
  FROM dbo.yj_doc_status st JOIN @qc q ON q.doc_no=st.doc_no
 WHERE st.panel_code=N'QC_ASM_INSP' AND ISNULL(st.canceled,'N')<>'Y';
DECLARE @nQc2 int = (SELECT COUNT(*) FROM @qc);
PRINT N'作废 组装成品检验单: ' + CAST(@nQc2 AS nvarchar(10)) + N' 张';

-- ④ 产成品入库单（头 + 明细）
DECLARE @fi TABLE (doc_no nvarchar(50) PRIMARY KEY);
INSERT INTO @fi (doc_no)
SELECT f.[单据编号] FROM dbo.bd_finish_in f
 WHERE ISNULL(f.asp_cancel,'N')<>'Y'
   AND EXISTS (SELECT 1 FROM @p x WHERE x.pl_no=f.加工单号 AND x.xc=ISNULL(f.工单行号,0));
UPDATE d SET d.asp_cancel='Y' FROM dbo.bl_finish_in d JOIN @fi q ON q.doc_no=d.[单据编号]
 WHERE ISNULL(d.asp_cancel,'N')<>'Y';
UPDATE f SET f.asp_cancel='Y', f.asp_user2=N'清理未完工未结案', f.asp_time2=GETDATE()
  FROM dbo.bd_finish_in f JOIN @fi q ON q.doc_no=f.[单据编号];
UPDATE st SET st.canceled='Y', st.update_at=GETDATE()
  FROM dbo.yj_doc_status st JOIN @fi q ON q.doc_no=st.doc_no
 WHERE st.panel_code=N'FINISH_IN' AND ISNULL(st.canceled,'N')<>'Y';
DECLARE @nFi2 int = (SELECT COUNT(*) FROM @fi);
PRINT N'作废 产成品入库单: ' + CAST(@nFi2 AS nvarchar(10)) + N' 张';

-- ⑤ 占用链（订单结转的剩余量占用，撤销后才不会再挡同一订单行）
UPDATE l SET l.link_status='CANCELLED'
  FROM dbo.form_flow_link l
 WHERE l.link_status='ACTIVE'
   AND EXISTS (SELECT 1 FROM @p x WHERE x.pl_no=l.target_form_no
               AND l.target_line_key = x.pl_no + N'#' + CONVERT(nvarchar(20), x.xc));
PRINT N'撤销 占用链: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 条';

-- ⑥ 排产记录 + 工单行
UPDATE pc SET pc.asp_cancel='Y', pc.asp_user2=N'清理未完工未结案', pc.asp_time2=GETDATE()
  FROM dbo.plang_pc pc WHERE pc.id IN (SELECT id FROM @pc) AND ISNULL(pc.asp_cancel,'N')<>'Y';
UPDATE p SET p.asp_cancel='Y', p.asp_user2=N'清理未完工未结案', p.asp_time2=GETDATE()
  FROM dbo.plang p WHERE p.id IN (SELECT id FROM @p) AND ISNULL(p.asp_cancel,'N')<>'Y';
PRINT N'作废 工单行: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

-- ⑦ 自检
DECLARE @left int = (SELECT COUNT(*) FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') NOT IN (N'T',N'Y'));
DECLARE @dup int = (SELECT COUNT(*) FROM (SELECT p.pl_no, ISNULL(p.pl_xc,0) x FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N')<>'Y' GROUP BY p.pl_no, ISNULL(p.pl_xc,0) HAVING COUNT(*)>1) d);
IF @left = 0 PRINT N'[PASS] 已无「未完工/未结案」工单行'
ELSE PRINT N'[FAIL] 仍有 ' + CAST(@left AS nvarchar(10)) + N' 行未作废';
PRINT N'[参考] 全库「工单号+行号」重复组: ' + CAST(@dup AS nvarchar(10));
