/* ============================================================
   migrate-enable-rcsi-20261018.sql
   打开数据库的 **READ_COMMITTED_SNAPSHOT(RCSI)** —— 让「读」不再被「写锁」挡住

   为什么需要(2026-10-18 现场):
     · 手机端小程序/参考库**直连同一个库**写 plang/scjl;那边事务没提交时,行锁一直在;
     · MES 的默认隔离级别是 READ COMMITTED ⇒ 列表查询扫到被锁的行就**停住等**,
       实测锁 1 行就让「生产工单」整页卡 42.7 秒(见 docs/development/扫码报工卡住-根因与处置.md §1);
     · 打开 RCSI 后,**读走行版本快照**,不再等写锁 ⇒ 外部程序锁着数据时,MES 页面照样秒开。
       (MES 侧已同时加了 lockTimeout=8000 兜底,两者互补:一个防读被挡,一个防本身是写操作时无限等。)

   影响与代价(如实登记):
     · 读一致性更强(语句级快照),不再出现"读到一半别人改了"的混合结果;
     · tempdb 增加行版本存储/清理开销 —— 本库规模(几百张业务表、工单 424 行级)可忽略;
     · 少数依赖"读会被写阻塞"的旧行为没有;本项目**没有**用 `UPDLOCK/HOLDLOCK` 做读写互斥的关键路径
       (`SELECT ... WITH (UPDLOCK)` 全仓 grep 无命中),因此风险低。
     · 切换需要**短暂独占**(WITH ROLLBACK IMMEDIATE 会踢掉现有连接):8090 的 Hikari 会自动重连,
       但**正在看的页面会报一次错**,建议停业/无人时执行。

   用法(手工,不登记迁移链 —— 这是库级开关,不该被 DbSync 自动改):
     ① 先看现状:`SELECT name, is_read_committed_snapshot_on FROM sys.databases;`
     ② 把下面 @apply 改 1,在**正式库**执行一次(再对 HSDZ_MES_TEST 执行一次);
     ③ 执行后**立即生效,不需要重启 MES**;
     ④ 回退:`ALTER DATABASE ... SET READ_COMMITTED_SNAPSHOT OFF WITH ROLLBACK IMMEDIATE;`
   ============================================================ */
SET NOCOUNT ON;
GO

DECLARE @apply bit = 0;   -- ← 改成 1 才真正切换

SELECT DB_NAME() AS 当前库, is_read_committed_snapshot_on AS 已开启RCSI,
       snapshot_isolation_state_desc AS 快照隔离状态
  FROM sys.databases WHERE name = DB_NAME();

IF @apply = 0
    PRINT N'[DRY-RUN] @apply=0:只报告现状。确认无人使用后把 @apply 改成 1 再执行(会短暂独占该库)。';
ELSE
BEGIN
    -- 动态 SQL:ALTER DATABASE 不允许参数化库名,这里用 QUOTENAME 防注入(库名来自 DB_NAME())
    DECLARE @sql nvarchar(400) = N'ALTER DATABASE ' + QUOTENAME(DB_NAME())
        + N' SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;';
    PRINT N'执行:' + @sql;
    EXEC (@sql);
    PRINT N'完成。RCSI 已开启(立即生效,无需重启)。';
END
GO

-- 自检
SELECT DB_NAME() AS 当前库, is_read_committed_snapshot_on AS 已开启RCSI
  FROM sys.databases WHERE name = DB_NAME();
GO
