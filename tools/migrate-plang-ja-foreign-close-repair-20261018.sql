/* ============================================================
   migrate-plang-ja-foreign-close-repair-20261018.sql
   「外部程序把生产工单批量写成已结案」的**回正脚本**(默认只报告,不修改)

   背景(2026-10-18 用户报障):
     「我原先将所有工单都取消结案了,但扫码报工后就出现了都是已结案。」
   查证结论:
     · 生产工单页的「已结案」只认 plang.ja ∈ ('T','Y');
     · MES 自己置 ja='Y' 只有两条路 —— 页面「结案」按钮(要求入库≥排产,且写 yj_usage_log)
       和 ProcessTaskService.syncCloseState(组装成品检验已审核 + 入库≥排产);
     · 事发当天 yj_usage_log 里**没有任何「结案」动作**(424 条全是用户自己的「取消结案」),
       且这些行入库数量为 0 ⇒ 那批 ja='Y' 不可能来自 MES 正常结案;
     · 手机端小程序/参考库是**直连同一个库**写 plang 的 ⇒ 只能来自那边(批量 UPDATE 漏工单号条件的典型后果)。

   本脚本的处置口径(**范围收到最小,只清外部误写的**):
     候选 = 未作废 且 ja ∈ ('T','Y')
            且 **不满足** MES 的结案条件:
               (入库数量 ≥ 排产数量 > 0) **且** 有一张「已审核」的组装成品检验单(行号/批次对齐)
     ⇒ 把这些行的 ja 置 'N',并写 asp_user2='ja回正(外部误结案)',asp_time2=GETDATE() 留痕。
     ⚠ 不满足条件的行(真的入库+检验齐全的)一行都不动;
     ⚠ 参考库时代人工结的历史单(GD2608xxxxx)若入库/检验齐全同样不动;
     ⚠ 组装成品检验的匹配**批次必须非空**,否则两边都是空串时 '' = '' 会误命中任意老检验单
       (细节见 migrate-plang-ja-stale-autoclose-20261015.sql 头部)。

   用法:
     ① 先跑一遍:本脚本默认 @apply = 0 ⇒ **只打印候选清单与计数**,不改数据;
     ② 核对清单没问题,把文件里 `DECLARE @apply bit = 0;` 改成 1,再跑一次(或手工执行第 3 段的 UPDATE)。
   幂等可重跑;建议先正式库、再测试库。
   ============================================================ */
SET NOCOUNT ON;
GO

DECLARE @apply bit = 0;   -- 0 = 只报告 / 1 = 真回正

IF OBJECT_ID(N'dbo.plang', N'U') IS NULL BEGIN PRINT N'[跳过] 无 plang 表'; RETURN; END
GO

-- ① 候选清单(只读)
DECLARE @apply bit = 0;
;WITH cand AS (
    SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0) AS pl_xc, ISNULL(p.[批次号],N'') AS 批次号,
           ISNULL(p.scx,N'') AS scx, ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.rk_sl,0) AS rk_sl,
           ISNULL(p.ja,N'') AS ja, ISNULL(p.asp_user2,N'') AS asp_user2,
           CONVERT(varchar(19), p.asp_time2, 120) AS asp_time2,
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
)
SELECT 工单号 = pl_no, 工单行号 = pl_xc, 批次号, 生产线 = scx, 排产数量 = pl_sl, 入库数量 = rk_sl,
       ja, 已审检验单数, 最后修改人 = asp_user2, 最后修改时间 = asp_time2
  FROM cand
 WHERE NOT (pl_sl > 0 AND rk_sl >= pl_sl AND 已审检验单数 > 0)
 ORDER BY pl_no, pl_xc;
GO

-- ② 计数:候选多少行
DECLARE @apply bit = 0;
DECLARE @bad int = (
    SELECT COUNT(*) FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
       AND ISNULL(p.ja,'N') IN (N'T', N'Y')
       AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))
       AND NOT EXISTS (
            SELECT 1 FROM dbo.qc_asm_insp_head h
              JOIN dbo.yj_doc_status ds ON ds.panel_code = N'QC_ASM_INSP' AND ds.doc_no = h.[单据编号]
             WHERE h.[工单号] = p.pl_no AND ISNULL(h.asp_cancel,'N') <> 'Y'
               AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N') <> 'Y' AND ISNULL(ds.stopped,'N') <> 'Y'
               AND (ISNULL(h.[工单行号],0) = ISNULL(p.pl_xc,0)
                    OR (ISNULL(h.[工单行号],0) = 0 AND ISNULL(h.[批次号],N'') <> N''
                        AND ISNULL(h.[批次号],N'') = ISNULL(p.[批次号],N'')))));
PRINT N'候选(ja=Y 但不满足 MES 结案条件):' + CAST(@bad AS nvarchar(10)) + N' 行';
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
           AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))
           AND NOT EXISTS (
                SELECT 1 FROM dbo.qc_asm_insp_head h
                  JOIN dbo.yj_doc_status ds ON ds.panel_code = N'QC_ASM_INSP' AND ds.doc_no = h.[单据编号]
                 WHERE h.[工单号] = p.pl_no AND ISNULL(h.asp_cancel,'N') <> 'Y'
                   AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N') <> 'Y' AND ISNULL(ds.stopped,'N') <> 'Y'
                   AND (ISNULL(h.[工单行号],0) = ISNULL(p.pl_xc,0)
                        OR (ISNULL(h.[工单行号],0) = 0 AND ISNULL(h.[批次号],N'') <> N''
                            AND ISNULL(h.[批次号],N'') = ISNULL(p.[批次号],N''))))
    )
    UPDATE p SET p.ja = 'N', p.asp_user2 = N'ja回正(外部误结案)', p.asp_time2 = GETDATE()
      FROM dbo.plang p JOIN cand c ON c.id = p.id;
    SET @n = @@ROWCOUNT;
    PRINT N'已回正 ja=N:' + CAST(@n AS nvarchar(10)) + N' 行';
END
GO

-- ④ 自检:回正后不应再有「未入库却 ja=Y」的行
DECLARE @left int = (
    SELECT COUNT(*) FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
       AND ISNULL(p.ja,'N') IN (N'T', N'Y')
       AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))
       AND NOT EXISTS (
            SELECT 1 FROM dbo.qc_asm_insp_head h
              JOIN dbo.yj_doc_status ds ON ds.panel_code = N'QC_ASM_INSP' AND ds.doc_no = h.[单据编号]
             WHERE h.[工单号] = p.pl_no AND ISNULL(h.asp_cancel,'N') <> 'Y'
               AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N') <> 'Y' AND ISNULL(ds.stopped,'N') <> 'Y'
               AND (ISNULL(h.[工单行号],0) = ISNULL(p.pl_xc,0)
                    OR (ISNULL(h.[工单行号],0) = 0 AND ISNULL(h.[批次号],N'') <> N''
                        AND ISNULL(h.[批次号],N'') = ISNULL(p.[批次号],N'')))));
IF @left > 0 PRINT N'[提示] 仍有 ' + CAST(@left AS nvarchar(10)) + N' 行待处理(若刚才 @apply=0,这是预期)';
ELSE PRINT N'[PASS] 无「未入库却已结案」的行';
GO
