/* ============================================================================
   cleanup-empty-draft-docs-20261016.sql — 清掉 3 张「单头在、明细零行」的空草稿

   【背景】2026-10-16 拉取远端抢修(明细被批量作废)后,顺手跑全库审计
   `tools/archive/_stock-month-close/q-11-all-doc-empty-detail-audit.sql`,模式②「明细零行」
   命中 3 张,逐张查明**都不是**事故形态,是从来没填过内容的空草稿:
     · SO2608310001       销售订单 SO_ORDER  —— 2026-08-31 17:00 admin 建,草稿、无客户、0 明细
                            **正式库与测试库各 1 张(同一张的历史快照)**
     · LXA-2026-10-0016   立项申请 RD_APPROVAL —— 2026-10-16 14:18 cp 建,0 明细(测试残留,**仅测试库**)
   用户口径(2026-10-16):「清掉」。

   ⚠ 两条红线:
     ① **禁止登记进 tools/db-migrations.txt** —— 登记 = DbSync 每次同步都对两账套重放删除,
        与 cleanup-rd-testledger-20261016.sql / migrate-rd-cleanup.sql 同款先例
        (db-migrations.txt 第 171 行有红线注释)。
     ② 本脚本两个账套都可执行(正式库只命中 SO 那张),所以**不加库名硬闸门**,改为
        「对象必须仍是空草稿」的强谓词闸门:一旦有人往这两张单里填过明细、或单已提交/归档/作废,
        脚本**整段拒绝执行**(第一段 RAISERROR 后 RETURN,连事务都不开)。

   【幂等】第二次执行:闸门通过(对象已不存在 ⇒ 明细 0、状态 NULL),删除 0 行,自检残留 0,正常提交。
   【执行】cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run cleanup-empty-draft-docs-20261016.sql
     $env:YINJIA_SQL_DB="HSDZ_MES_TEST"; 同上(先正式、后测试)
   ============================================================================ */
SET NOCOUNT ON;

/* ══ ⓪ 闸门:目标必须仍是「空草稿」,否则拒绝 ══ */
DECLARE @soLines int = (SELECT COUNT(*) FROM bl_so_order       WHERE [单据编号] = N'SO2608310001');
DECLARE @soState nvarchar(50) = (SELECT [单据状态] FROM bd_so_order WHERE [单据编号] = N'SO2608310001');
DECLARE @lxLines int = (SELECT COUNT(*) FROM rd_approval_detail WHERE [单据编号] = N'LXA-2026-10-0016');
DECLARE @lxFlow  int = (SELECT COUNT(*) FROM yj_doc_status
                        WHERE panel_code = N'RD_APPROVAL' AND doc_no = N'LXA-2026-10-0016'
                          AND (ISNULL(pending,N'N') = N'Y' OR ISNULL(archived,N'N') = N'Y'
                               OR ISNULL(canceled,N'N') = N'Y' OR ISNULL(stopped,N'N') = N'Y'));
IF @soLines > 0 OR (@soState IS NOT NULL AND @soState != N'草稿') OR @lxLines > 0 OR @lxFlow > 0
BEGIN
    RAISERROR(N'[ABORT] 目标单据已不是空草稿(SO明细 %d 行 / SO状态 %s / LXA明细 %d 行 / LXA已流转 %d 条),拒绝删除',
              16, 1, @soLines, @soState, @lxLines, @lxFlow);
    RETURN;
END
-- 用 RAISERROR(…,10,1) 而不是 PRINT:DbSync 只回显消息(code≠0),PRINT(code 0)会被吞掉
RAISERROR(N'[闸门] 通过:SO2608310001 明细 %d 行 / 状态 %s;LXA-2026-10-0016 明细 %d 行 / 已流转 %d 条',
          10, 1, @soLines, @soState, @lxLines, @lxFlow);
GO

BEGIN TRANSACTION;

/* ══ ① 关联行:按单号先清(单据删掉后就查不到了) ══ */
DECLARE @n int, @log nvarchar(max) = N'';

DELETE FROM yj_usage_log      WHERE doc_no IN (N'SO2608310001', N'LXA-2026-10-0016');
SET @n = @@ROWCOUNT; SET @log = @log + N'使用日志 ' + CAST(@n AS nvarchar(10)) + N'; ';

DELETE FROM yj_doc_annotation WHERE doc_no IN (N'SO2608310001', N'LXA-2026-10-0016');
SET @n = @@ROWCOUNT; SET @log = @log + N'批注 ' + CAST(@n AS nvarchar(10)) + N'; ';

DELETE FROM yj_doc_modify_log WHERE doc_no IN (N'SO2608310001', N'LXA-2026-10-0016');
SET @n = @@ROWCOUNT; SET @log = @log + N'修改记录 ' + CAST(@n AS nvarchar(10)) + N'; ';

DELETE FROM yj_plan_term     WHERE doc_no IN (N'SO2608310001', N'LXA-2026-10-0016');
SET @n = @@ROWCOUNT; SET @log = @log + N'终止申请 ' + CAST(@n AS nvarchar(10)) + N'; ';

DELETE FROM yj_form_approval WHERE form_no IN (N'SO2608310001', N'LXA-2026-10-0016');
SET @n = @@ROWCOUNT; SET @log = @log + N'审批痕迹 ' + CAST(@n AS nvarchar(10)) + N'; ';

DELETE FROM yj_attachment    WHERE doc_no IN (N'SO2608310001', N'LXA-2026-10-0016');
SET @n = @@ROWCOUNT; SET @log = @log + N'附件 ' + CAST(@n AS nvarchar(10)) + N'; ';

DELETE FROM form_flow_link   WHERE source_form_no IN (N'SO2608310001', N'LXA-2026-10-0016')
                                OR target_form_no IN (N'SO2608310001', N'LXA-2026-10-0016');
SET @n = @@ROWCOUNT; SET @log = @log + N'流转链接 ' + CAST(@n AS nvarchar(10)) + N'; ';

DELETE FROM yj_doc_status    WHERE doc_no IN (N'SO2608310001', N'LXA-2026-10-0016');
SET @n = @@ROWCOUNT; SET @log = @log + N'单据状态 ' + CAST(@n AS nvarchar(10)) + N'; ';

/* ══ ② 明细(闸门已保证为 0,这里只作竞态兜底)与单头 ══ */
DELETE FROM bl_so_order        WHERE [单据编号] = N'SO2608310001';
DELETE FROM rd_approval_detail WHERE [单据编号] = N'LXA-2026-10-0016';

DELETE FROM bd_so_order  WHERE [单据编号] = N'SO2608310001'  AND ISNULL([单据状态], N'') = N'草稿';
SET @n = @@ROWCOUNT; SET @log = @log + N'销售订单单头 ' + CAST(@n AS nvarchar(10)) + N'; ';

DELETE FROM rd_approval  WHERE [单据编号] = N'LXA-2026-10-0016';
SET @n = @@ROWCOUNT; SET @log = @log + N'立项申请单头 ' + CAST(@n AS nvarchar(10)) + N';';

RAISERROR(N'[删除] %s', 10, 1, @log);

/* ══ ③ 自检:两张单在两处(单头表 + 状态表)都必须查不到 ══ */
DECLARE @left int =
      (SELECT COUNT(*) FROM bd_so_order  WHERE [单据编号] = N'SO2608310001')
    + (SELECT COUNT(*) FROM rd_approval  WHERE [单据编号] = N'LXA-2026-10-0016')
    + (SELECT COUNT(*) FROM yj_doc_status WHERE doc_no IN (N'SO2608310001', N'LXA-2026-10-0016'));
IF @left != 0
BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] 清理后仍能查到 %d 行,已整段回滚', 16, 1, @left);
    RETURN;
END
COMMIT TRANSACTION;
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[OK] %s:3 张空草稿已清除(自检残留 0)', 10, 1, @dbn);
GO
