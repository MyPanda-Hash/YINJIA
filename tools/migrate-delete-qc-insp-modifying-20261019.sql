/* ============================================================
   migrate-delete-qc-insp-modifying-20261019.sql
   删除「修改申请中」的来料检验单（默认只报告，不修改）

   现场（2026-10-19）：来料检验单 IJ-2026-10-0002 停在「修改申请中」
   （yj_doc_status.modify_state='R'，已审核 → 10-19 12:24 申请修改），
   用户在界面上删不掉（已审核单不允许直接删除），要求清掉。

   处置 = **作废**（asp_cancel='Y'）三处，而不是物理 DELETE：
     ① qc_insp        单据头
     ② qc_insp_detail 明细行
     ③ yj_doc_status  canceled='Y' 且清掉 modify_state / pending（状态推导里
        「修改申请中」优先级高于「已作废」，不清理会继续显示修改申请中）
   留痕 asp_user2='删除(修改申请中)', asp_time2=GETDATE()，可回滚。

   用法：① 直接跑 = dry-run；② 核对后把 @apply 改 1 再跑（幂等）。
   ============================================================ */
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.qc_insp', N'U') IS NULL
BEGIN PRINT N'[跳过] 无 qc_insp 表'; RETURN; END

DECLARE @apply bit = 0;   -- 0 = 只报告 / 1 = 真作废

-- 候选：来料检验单里状态为「修改申请中」且未作废的
DECLARE @docs TABLE (doc_no nvarchar(50) PRIMARY KEY);
INSERT INTO @docs (doc_no)
SELECT s.doc_no
  FROM dbo.yj_doc_status s
 WHERE s.panel_code = N'QC_INSP'
   AND ISNULL(s.modify_state,'') = 'R'
   AND ISNULL(s.canceled,'N') <> 'Y';

SELECT 单据编号 = h.单据编号, 单据日期 = CONVERT(varchar(10), h.单据日期, 120),
       供应商代码 = ISNULL(h.供应商代码,N''), 采购订单号 = ISNULL(h.采购订单号,N''),
       暂收单号 = ISNULL(h.暂收单号,N''),
       有效明细 = (SELECT COUNT(*) FROM dbo.qc_insp_detail d
                    WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N') <> 'Y')
  FROM dbo.qc_insp h JOIN @docs x ON x.doc_no = h.单据编号
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
 ORDER BY h.单据编号;

DECLARE @n int = (SELECT COUNT(*) FROM @docs);
PRINT N'候选「修改申请中」来料检验单: ' + CAST(@n AS nvarchar(10)) + N' 张';
IF @n = 0 BEGIN PRINT N'[PASS] 没有需要删除的'; RETURN; END
IF @apply = 0
BEGIN
    PRINT N'[DRY-RUN] @apply=0，未修改任何数据。核对后把 @apply 改成 1 再跑。';
    RETURN;
END

UPDATE h SET h.asp_cancel='Y', h.asp_user2=N'删除(修改申请中)', h.asp_time2=GETDATE()
  FROM dbo.qc_insp h JOIN @docs x ON x.doc_no=h.单据编号
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y';
PRINT N'作废 来料检验单头: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张';

UPDATE d SET d.asp_cancel='Y', d.asp_user2=N'删除(修改申请中)', d.asp_time2=GETDATE()
  FROM dbo.qc_insp_detail d JOIN @docs x ON x.doc_no=d.单据编号
 WHERE ISNULL(d.asp_cancel,'N') <> 'Y';
PRINT N'作废 来料检验单明细: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

UPDATE s SET s.canceled='Y', s.modify_state=NULL, s.pending=NULL, s.update_at=GETDATE()
  FROM dbo.yj_doc_status s JOIN @docs x ON x.doc_no=s.doc_no
 WHERE s.panel_code = N'QC_INSP';
PRINT N'撤销 单据状态: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张';

-- 自检
DECLARE @left int = (
    SELECT COUNT(*) FROM dbo.qc_insp h JOIN @docs x ON x.doc_no=h.单据编号
     WHERE ISNULL(h.asp_cancel,'N') <> 'Y');
DECLARE @st int = (
    SELECT COUNT(*) FROM dbo.yj_doc_status s JOIN @docs x ON x.doc_no=s.doc_no
     WHERE s.panel_code=N'QC_INSP' AND ISNULL(s.canceled,'N')<>'Y');
IF @left = 0 AND @st = 0 PRINT N'[PASS] 已删除（头/明细/状态 均已作废）'
ELSE PRINT N'[FAIL] 仍有 头 ' + CAST(@left AS nvarchar(10)) + N' / 状态 ' + CAST(@st AS nvarchar(10)) + N' 未作废';
