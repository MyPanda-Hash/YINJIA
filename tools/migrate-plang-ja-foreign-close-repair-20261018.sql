/* ============================================================
   migrate-plang-ja-foreign-close-repair-20261018.sql
   「外部程序把生产工单批量写成已结案」的**回正脚本**(默认只报告,不修改)

   背景(2026-10-18 用户报障):
     「我原先将所有工单都取消结案了,但扫码报工后就出现了都是已结案。」
   2026-10-19 复核(正式库):
     · 页面「结案异常」标 19 行、体检端点 38 行 —— 两份判据不等价,已收口(见下);
     · 38 行共同点:ja='Y'、**入库全是 0**、排产全 >0,其中 29 行是当天 12:30~17:17 新建的未排产行;
     · MES 自己置 ja='Y' 只有两条路 —— 页面「结案」按钮(要求入库≥排产)和
       ProcessTaskService.syncCloseState(组装成品检验已审核 + 入库≥排产),**都要求入库达标**;
     · ⇒ 入库没达标却写着 ja='Y' 的行,一定不是 MES 结的(手机端小程序/参考库直连同一个库写 plang)。

   🔴 处置口径(2026-10-19 收窄,与 PlangClose.anomaly / 页面「结案异常」/ closeAudit / 巡检**同一份**):
     候选 = 未作废 且 ja ∈ ('T','Y') 且 **不满足**「排产数量 > 0 且 入库数量 ≥ 排产数量」
            (GD2608* 参考库时代历史单豁免)
     ⇒ ja 置 'N',写 asp_user2='ja回正(外部误结案)'、asp_time2=GETDATE() 留痕。
     ⚠ 为什么不再要求"有已审组装成品检验单":
       ① 人工结案(生产工单页「结案」按钮)本来就只要求入库≥排产,不要求检验单 ——
          拿检验单当条件会把**正经的手工结案**判成异常,连自愈都会把它们误回正;
       ② 旧判据与列表页不等价(一个「且」一个「都满足才不标」),点「结案回正」会改掉页面没标红的行。
     ⚠ 入库达标的行**一行都不动**(哪怕没有检验单 —— 那是人工结案的正常形态)。
     ⚠ 候选清单里仍会列出「已审检验单数」供核对,但它**不参与**筛选。

   用法:
     ① 先跑一遍:本脚本默认 @apply = 0 ⇒ **只打印候选清单与计数**,不改数据;
     ② 核对清单没问题,把文件里 `DECLARE @apply bit = 0;` 改成 1,再跑一次
        (或直接用生产工单页的「结案回正」按钮,同一份判据、同一份留痕)。
   幂等可重跑;建议先正式库、再测试库。
   ============================================================ */
SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.plang', N'U') IS NULL BEGIN PRINT N'[跳过] 无 plang 表'; RETURN; END
GO

-- ① 候选清单(只读)
DECLARE @apply bit = 0;
;WITH cand AS (
    SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0) AS pl_xc, ISNULL(p.[批次号],N'') AS 批次号,
           ISNULL(p.scx,N'') AS scx, ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.rk_sl,0) AS rk_sl,
           ISNULL(p.ja,N'') AS ja, ISNULL(p.asp_user2,N'') AS asp_user2,
           CONVERT(varchar(19), p.asp_time2, 120) AS asp_time2,
           -- 仅供参考,不参与筛选(人工结案本来就不要求检验单)
           (SELECT COUNT(*) FROM dbo.qc_asm_insp_head h
              JOIN dbo.yj_doc_status ds ON ds.panel_code = N'QC_ASM_INSP' AND ds.doc_no = h.[单据编号]
             WHERE h.[工单号] = p.pl_no AND ISNULL(h.asp_cancel,'N') <> 'Y'
               AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N') <> 'Y' AND ISNULL(ds.stopped,'N') <> 'Y'
               AND (ISNULL(h.[工单行号],0) = ISNULL(p.pl_xc,0)
                    OR (ISNULL(h.[工单行号],0) = 0 AND ISNULL(h.[批次号],N'') <> N''
                        AND ISNULL(h.[批次号],N'') = ISNULL(p.[批次号],N'')))) AS 已审检验单数
      FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
       AND ISNULL(p.ja,'N') IN (N'T', N'Y')
       AND p.pl_no NOT LIKE N'GD2608%'
)
SELECT 工单号 = pl_no, 工单行号 = pl_xc, 批次号, 生产线 = scx, 排产数量 = pl_sl, 入库数量 = rk_sl,
       ja, 已审检验单数, 最后修改人 = asp_user2, 最后修改时间 = asp_time2
  FROM cand
 WHERE NOT (pl_sl > 0 AND rk_sl >= pl_sl)
 ORDER BY pl_no, pl_xc;
GO

-- ② 计数:候选多少行
DECLARE @apply bit = 0;
DECLARE @bad int = (
    SELECT COUNT(*) FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
       AND ISNULL(p.ja,'N') IN (N'T', N'Y')
       AND p.pl_no NOT LIKE N'GD2608%'
       AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0)));
PRINT N'候选(ja=Y 但入库没达标 ⇒ 不可能是 MES 结的):' + CAST(@bad AS nvarchar(10)) + N' 行';
IF @bad = 0 PRINT N'[PASS] 没有需要回正的行';
GO

-- ③ 回正(默认不执行;把 @apply 改 1 才真正 UPDATE)
DECLARE @apply bit = 0;   -- ← 改成 1 执行
IF @apply = 0
    PRINT N'[DRY-RUN] @apply=0,只报告不修改。核对上面的清单后把 @apply 改成 1 再跑。';
ELSE
BEGIN
    DECLARE @n int = 0;
    ;WITH cand AS (
        SELECT p.id
          FROM dbo.plang p
         WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
           AND ISNULL(p.ja,'N') IN (N'T', N'Y')
           AND p.pl_no NOT LIKE N'GD2608%'
           AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))
    )
    UPDATE p SET p.ja = 'N', p.asp_user2 = N'ja回正(外部误结案)', p.asp_time2 = GETDATE()
      FROM dbo.plang p JOIN cand c ON c.id = p.id;
    SET @n = @@ROWCOUNT;
    PRINT N'已回正 ja=N:' + CAST(@n AS nvarchar(10)) + N' 行';
END
GO

-- ④ 自检:回正后不应再有「入库没达标却 ja=Y」的行
DECLARE @left int = (
    SELECT COUNT(*) FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
       AND ISNULL(p.ja,'N') IN (N'T', N'Y')
       AND p.pl_no NOT LIKE N'GD2608%'
       AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0)));
IF @left = 0 PRINT N'[PASS] 已无「外部写入的已结案」(页面「结案异常」应为 0 行)';
ELSE PRINT N'[FAIL] 仍有 ' + CAST(@left AS nvarchar(10)) + N' 行 — 可能被外部程序又写回来了,看 logs/backend.log 的 [结案巡检]';
GO
