-- _cleanup-samples.sql — 清理「生产过程」样例数据(2026-10-18)
--
-- ⚠ 这是**手动执行**的清理脚本,不登记进 tools/db-migrations.txt(否则 DbSync 会把它当迁移跑掉)。
-- 用途:全量恢复到服务器之前,把 migrate-proc-process-samples-20261018.sql 灌进去的样例单据清掉
--       (AGENTS.md 口径:正式库只录真实业务;全量恢复会把本地库连数据一起推上服务器)。
--
-- 用法(tools 目录):
--   java -cp lib\mssql-jdbc.jar DbSync.java run archive/_prod-process-audit/_cleanup-samples.sql
--   测试库加环境变量:YINJIA_SQL_DB=HSDZ_MES_TEST
--
-- 清理对象 = 本任务造的 7 张样例单据 + 2 张「补登历史单据头」的单据(TR/HH-2026-09-0001)。
-- ⚠ TR-2026-09-0001 / HH-2026-09-0001 原本是**孤儿明细**(单据头不存在),清理会把它们连同明细一起删掉,
--   即回到"孤儿明细"状态。若希望保留这两张用于演示,只跑 §1 的 7 张即可(注释掉 §2)。

SET NOCOUNT ON;

/* ═══ §1 本任务新造的 7 张样例单据 ═══ */
DELETE FROM day_report_detail    WHERE 单据编号 = N'RB-2026-10-0001';
DELETE FROM day_report           WHERE 单据编号 = N'RB-2026-10-0001';
DELETE FROM feed_confirm_detail  WHERE 单据编号 = N'TR-2026-10-0001';
DELETE FROM feed_confirm         WHERE 单据编号 = N'TR-2026-10-0001';
DELETE FROM mix_record_detail     WHERE 单据编号 = N'HH-2026-10-0001';
DELETE FROM mix_record            WHERE 单据编号 = N'HH-2026-10-0001';
DELETE FROM gran_record_detail   WHERE 单据编号 = N'LZ-2026-10-0001';
DELETE FROM gran_record          WHERE 单据编号 = N'LZ-2026-10-0001';
DELETE FROM wh_record_detail     WHERE 单据编号 = N'WB-2026-10-0001';
DELETE FROM wh_record            WHERE 单据编号 = N'WB-2026-10-0001';
DELETE FROM pack_confirm_detail  WHERE 单据编号 = N'FX-2026-10-0001';
DELETE FROM pack_confirm         WHERE 单据编号 = N'FX-2026-10-0001';
DELETE FROM bd_prod_abn          WHERE 单据编号 = N'YC-2026-10-0001';

/* 审核/留痕也要清:否则 yj_doc_status / yj_form_approval 里留下指向不存在单据的记录 */
DELETE FROM yj_doc_status     WHERE panel_code IN ('DAY_REPORT','FEED_CONFIRM','MIX_RECORD','GRAN_RECORD','WH_RECORD','PACK_CONFIRM','PROD_ABN')
                                AND doc_no IN (N'RB-2026-10-0001',N'TR-2026-10-0001',N'HH-2026-10-0001',N'LZ-2026-10-0001',
                                               N'WB-2026-10-0001',N'FX-2026-10-0001',N'YC-2026-10-0001');
DELETE FROM yj_form_approval  WHERE panel_code IN ('DAY_REPORT','FEED_CONFIRM','MIX_RECORD','GRAN_RECORD','WH_RECORD','PACK_CONFIRM','PROD_ABN')
                                AND form_no IN (N'RB-2026-10-0001',N'TR-2026-10-0001',N'HH-2026-10-0001',N'LZ-2026-10-0001',
                                                N'WB-2026-10-0001',N'FX-2026-10-0001',N'YC-2026-10-0001');

/* ═══ §2 补登的两张历史单据头(原为孤儿明细;不想要就注释掉本段) ═══ */
DELETE FROM feed_confirm_detail WHERE 单据编号 = N'TR-2026-09-0001';
DELETE FROM feed_confirm        WHERE 单据编号 = N'TR-2026-09-0001';
DELETE FROM mix_record_detail   WHERE 单据编号 = N'HH-2026-09-0001';
DELETE FROM mix_record          WHERE 单据编号 = N'HH-2026-09-0001';
DELETE FROM yj_doc_status     WHERE doc_no IN (N'TR-2026-09-0001',N'HH-2026-09-0001');
DELETE FROM yj_form_approval  WHERE form_no  IN (N'TR-2026-09-0001',N'HH-2026-09-0001');

/* ═══ 自检:七张单据应回到 0 行 ═══ */
DECLARE @left int =
      (SELECT COUNT(1) FROM day_report    WHERE 单据编号 LIKE N'RB-2026-10-%')
    + (SELECT COUNT(1) FROM feed_confirm  WHERE 单据编号 LIKE N'TR-2026-10-%')
    + (SELECT COUNT(1) FROM mix_record    WHERE 单据编号 LIKE N'HH-2026-10-%')
    + (SELECT COUNT(1) FROM gran_record   WHERE 单据编号 LIKE N'LZ-2026-10-%')
    + (SELECT COUNT(1) FROM wh_record     WHERE 单据编号 LIKE N'WB-2026-10-%')
    + (SELECT COUNT(1) FROM pack_confirm  WHERE 单据编号 LIKE N'FX-2026-10-%')
    + (SELECT COUNT(1) FROM bd_prod_abn   WHERE 单据编号 LIKE N'YC-2026-10-%');
IF @left > 0
    RAISERROR(N'[WARN] 仍有 %d 张样例单据残留,请手工核对', 10, 1, @left);
ELSE
    PRINT N'[OK] 样例数据清理完成,七张单据回到 0 行';
