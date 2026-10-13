/* ============================================================
   migrate-plang-ja-stale-autoclose-20261015.sql — 2026-10-15
   清掉「旧口径:报工达标即自动结案」留下的脏 ja(**完工却被显示成结案**)

   用户报障(2026-10-15):「当前修改错误,把完工状态改成结案了」。

   根因:旧口径下 ProcessTaskService 把"报工达标"直接等同于结案
     (`ja = prodDone ? "Y" : …`) ⇒ 一批工单行在**只做完报工、货还没入库、成品检验还没做**时
     就被写上了 ja='Y'。而 2026-10-15 起「生产状态」的「已结案」改由 plang.ja 驱动(此前按 入库≥排产 判),
     这些行于是从「完工」变成显示「已结案」。
   实测正式库命中 **1 行**:GD-2026-10-0003 行1(产线 装箱2(新厂),排产 421,入库 0,完工状态=生产完工,ja=Y)。

   处置(**范围收到最小,只清这一类的脏值**):把满足**新完工条件**但不满足**新结案条件**的行 ja 置 'N'。
     新完工条件 = 完工状态 ∈ (生产完工, 已完工)
     新结案条件 = 组装成品检验单**已审核通过** 且 入库数量 ≥ 排产数量
     ⇒ 只动"确实做完了、但还没入库/没检验"却被标结案的行。
   ⚠ **不动**参考库时代真实结过的历史单(GD2608xxxxx 那批:完工状态=未开工、无产线、ja='T')——
     它们界面上因无产线显示「未排产」,且是当年真结的单,不属于本次脏值。

   ⚠ 组装成品检验的匹配必须**要求批次号非空**:老检验单(工单行号=0)按批次兜底时,
     若两边批次都是空串,`'' = ''` 会**误命中任意一张无行号无批次的旧检验单** ⇒ 错误结案。
     (这个坑同时存在于代码 ProcessTaskService.syncCloseState,已一并加守卫。)

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.plang', N'U') IS NULL BEGIN PRINT N'[跳过] 无 plang 表'; RETURN; END
GO
DECLARE @n int = 0;
;WITH asm AS (   -- 每行:该工单行是否有「已审核」的组装成品检验单
    SELECT p.id,
           CASE WHEN EXISTS (
                SELECT 1 FROM dbo.qc_asm_insp_head h
                  JOIN dbo.yj_doc_status s ON s.panel_code='QC_ASM_INSP' AND s.doc_no = h.[单据编号]
                 WHERE h.[工单号] = p.pl_no AND ISNULL(h.asp_cancel,'N') <> 'Y'
                   AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y' AND ISNULL(s.stopped,'N') <> 'Y'
                   AND (ISNULL(h.[工单行号],0) = ISNULL(p.pl_xc,0)
                        -- 老检验单(无行号)按批次兜底,**批次必须非空**才允许匹配(否则 '' = '' 误命中)
                        OR (ISNULL(h.[工单行号],0) = 0 AND ISNULL(h.[批次号],N'') <> N''
                            AND ISNULL(h.[批次号],N'') = ISNULL(p.[批次号],N'')))
           ) THEN 1 ELSE 0 END AS 检验已审
      FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
)
UPDATE p SET p.ja = 'N', p.asp_user2 = N'migration', p.asp_time2 = GETDATE()
  FROM dbo.plang p JOIN asm a ON a.id = p.id
 WHERE ISNULL(p.ja,'N') IN ('Y','T')
   AND ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工')          -- 新完工条件成立
   AND NOT (a.检验已审 = 1 AND ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0));  -- 新结案条件不成立
SET @n = @@ROWCOUNT;
PRINT N'已清理「完工却被标结案」的脏 ja:' + CAST(@n AS nvarchar(10)) + N' 行';
GO
-- 自检:不应再有「完工状态=生产完工 且 ja=Y 但入库<排产」的行
DECLARE @bad int = (
    SELECT COUNT(*) FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.ja,'N') IN ('Y','T')
       AND ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工')
       AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0)));
IF @bad > 0 RAISERROR(N'仍残留 %d 行「完工却标结案」', 16, 1, @bad);
ELSE PRINT N'自检通过:无「完工却标结案」的行';
GO
