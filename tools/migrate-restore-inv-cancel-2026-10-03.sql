-- migrate-restore-inv-cancel-2026-10-03.sql
-- 背景(2026-10-03 19:2x 排查,事故发生在当天 19:07:10):用户报「商品的数据只剩一行了」。
--   证据链:正式库 HSDZ_MES.dbo.bs_inv 共 3874 行,其中 3873 行的 asp_cancel='Y'、
--   asp_user2='admin'、asp_time2 = 2026-10-03 19:07:10.163(同一条 UPDATE 写下,批次唯一);
--   存档留痕 yj_archive_change_log id=8 同一时刻记录
--   {"removedRows":3873,"changedRows":1} —— 即「商品」面板一次保存把 3873 行当成"缺席行"软删了。
--   机制:档案面板保存语义 = 全量 upsert(缺席行=已删除,ButtonService.saveArchive);
--   当时列表处于筛选/非全量加载状态,前端把子集当整档提交 ⇒ 未加载的 3873 行被软删。
--   ⚠ 金蝶同步不会自愈:jdy-sync 按 外部指纹 跳过未变更商品,已软删的行不会再被写回 asp_cancel='N'。
-- 本脚本:把这一批误删行恢复为存活(asp_cancel='N');只动本次批次,其它历史作废行一律不碰。
--   留痕保留(asp_user2/asp_time2 仍是那次保存的时间),便于事后追溯。
-- 幂等:恢复后这些行不再满足 asp_cancel='Y',重跑影响 0 行。
-- 范围:两个账套都执行(测试库为快照,预期 0 行)。
SET NOCOUNT ON;

DECLARE @before_total int = (SELECT COUNT(*) FROM dbo.bs_inv);
DECLARE @before_live  int = (SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @batch        int = (SELECT COUNT(*) FROM dbo.bs_inv
                             WHERE ISNULL(asp_cancel,'N') = 'Y'
                               AND asp_user2 = N'admin'
                               AND asp_time2 >= '2026-10-03 19:07:10'
                               AND asp_time2 <  '2026-10-03 19:07:11');
PRINT N'[' + DB_NAME() + N'] 恢复前:总行 ' + CAST(@before_total AS nvarchar(20))
    + N' / 存活 ' + CAST(@before_live AS nvarchar(20))
    + N' / 本批待恢复 ' + CAST(@batch AS nvarchar(20));

-- 只按「批次时间戳 + 操作人 + 当前为作废」三条件恢复,避免连带复活用户此前有意删除的行
UPDATE dbo.bs_inv
   SET asp_cancel = N'N'
 WHERE ISNULL(asp_cancel,'N') = 'Y'
   AND asp_user2 = N'admin'
   AND asp_time2 >= '2026-10-03 19:07:10'
   AND asp_time2 <  '2026-10-03 19:07:11';

DECLARE @after_live int = (SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N') <> 'Y');
PRINT N'[' + DB_NAME() + N'] 恢复后存活 ' + CAST(@after_live AS nvarchar(20))
    + N'(本批恢复 ' + CAST(@after_live - @before_live AS nvarchar(20)) + N' 行)';
GO
