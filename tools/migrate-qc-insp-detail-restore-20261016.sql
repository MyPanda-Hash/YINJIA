/* migrate-qc-insp-detail-restore-20261016.sql — 恢复被批量作废的来料检验单明细(2026-10-16)
 *
 * 【现象】用户报「IJ-2026-10-0011 起明细是空的,这些是从采购订单→暂收单→来料检验单流转过来的数据,不该为空」。
 * 【实查】明细行**都在**,但 `asp_cancel = 'Y'`:
 *   · 单头 qc_insp:全部 `asp_cancel='N'`(草稿,单据日期 2026-09-15 ~ 2026-10-13) —— **没被作废**;
 *   · 明细 qc_insp_detail:`IJ-2026-10-0011` 起 **10 张单 / 12 行**全部作废,
 *     作废时间集中在 **2026-10-15 11:23:14~17**(admin,一次批量操作);0010 及更早(11:11 写入)有效。
 *   面板与取数对明细都过滤 `asp_cancel='Y'` ⇒ 界面显示为空 ⇒ 看起来像"没流转过来"。
 * 【本脚本】把这批**单头仍有效**的作废明细恢复为有效(`asp_cancel='N'`),并写 `asp_user2='restore:20261016'`
 *   便于**回退**(要撤销:`UPDATE qc_insp_detail SET asp_cancel='Y' WHERE asp_user2='restore:20261016'`)。
 *   只动 `单据编号 >= 'IJ-2026-10-0011'` 且**单头有效**的行,不碰其它作废数据。
 * 【幂等】第二次执行更新 0 行。两账套都执行。
 */
SET NOCOUNT ON;
GO
DECLARE @n int;
UPDATE d SET d.asp_cancel = 'N', d.asp_user2 = N'restore:20261016', d.asp_time2 = GETDATE()
FROM qc_insp_detail d
WHERE ISNULL(d.asp_cancel, 'N') = 'Y'
  AND d.单据编号 >= N'IJ-2026-10-0011'
  AND EXISTS (SELECT 1 FROM qc_insp h WHERE h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel, 'N') <> 'Y');
SET @n = @@ROWCOUNT;
PRINT N'[恢复] 来料检验单明细复效 ' + CAST(@n AS nvarchar(10)) + N' 行';
GO
DECLARE @bad int = 0;
DECLARE @left int = (SELECT COUNT(*) FROM qc_insp_detail d
                     WHERE ISNULL(d.asp_cancel,'N') = 'Y' AND d.单据编号 >= N'IJ-2026-10-0011'
                       AND EXISTS (SELECT 1 FROM qc_insp h WHERE h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel,'N') <> 'Y'));
IF @left > 0 SET @bad = @bad + 1;
DECLARE @ok int = (SELECT COUNT(*) FROM qc_insp_detail d WHERE d.单据编号 >= N'IJ-2026-10-0011' AND ISNULL(d.asp_cancel,'N') <> 'Y');
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:该区间有效明细 %d 行;仍作废 %d 行(应 0);不符项 %d 条', 10, 1, @dbn, @ok, @left, @bad);
IF @bad = 0 RAISERROR(N'[OK] 来料检验单明细已复效(界面明细不再为空)', 10, 1);
ELSE RAISERROR(N'[FAIL] 复效自检未过', 16, 1);
GO