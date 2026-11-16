/* ============================================================================
   migrate-print-task-cache-20261116.sql
   自动打印「打印缓存(离线补打)」—— 建表 yj_print_task       2026-11-16

   【需求来源·用户原话】
     「能在自动打印里面做个打印缓存吗，就是在打印代理掉了后，重新连接这个打印缓存，
       会将这期间打印的补回来。」

   【为什么必须落库，而不是继续放内存】
     改造前队列是 `PrintStationController.QUEUE`(ConcurrentLinkedDeque)+ 5 分钟 TTL，
     两个硬伤正好卡在这个需求上：
       ① 入队时只算**在线**站点(`onlineStations()`)，代理掉线的那台**根本不会成为目标**
          ⇒ 掉线期间手机点的打印，压根没地方留，事后也补不回来；
       ② 队列只在内存里，服务端一重启(每次部署都重启)就清空。
     ⇒ 任务落库 + 目标站点按"**配置**"(开关开 + 勾了该类型)算，不按"在线"算；
       代理回来第一条 `/pending` 就能把积压的单子一条条领走。

   【表设计口径】
     · `payload_json` 存**整条任务载荷**(与 `/pending` 下发的一致)：二维码图(dataURL)、
       明细、以及 2026-11-18 起的 表头/部门标签/签名 等可变文案全在里面 ——
       以后再加打印字段**不用改表**，这是刻意的(打印载荷结构变动很频繁)。
     · `task_type` / `title` / `slip_no` / `wo_no` 是**冗余列**，只给面板列表显示与过滤用，
       真值仍在 `payload_json` 里(单一真源)。
     · `targets` / `delivered` = 逗号分隔的**站点名**：入队那一刻算好目标，
       每投给一个站点就往 delivered 追加一次(同名站点只投一次，防止重复出纸)。
     · 状态机：PENDING(有站点还没拿到) → SENT(已发给全部目标、等回执) →
       DONE / FAILED(代理回执) / EXPIRED(超过保留时长没等到代理)。
     · 纸型不在表里：纸张是**站点级**配置(`print.station.<名字>.paper`)，
       在派单那一刻塞进任务下发，同一张单发给两台电脑可以一张 A5 一张 A4。

   【保留时长】默认 **3 天 = 72 小时**(`yj_app_setting.print.cache_hours`；用户口径 2026-11-16「补打印保留3天」)；
     到期标 EXPIRED 而不是直接删，现场还能在缓存列表里看到"这单没补上"。

   ⚠ 两账套都要跑(先 HSDZ_MES 后 HSDZ_MES_TEST)，已登记 tools/db-migrations.txt。
   ⚠ 已登记 docs/development/数据库表清单.md §0.1 与 tools/db-inuse-tables.txt。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @db sysname = DB_NAME();

/* ══════════════════════════════════════════════════════════════════════
   1) 表 yj_print_task(自动打印任务缓存；一行 = 一条待补打/已打过回执的打印任务)
   ══════════════════════════════════════════════════════════════════════ */
IF OBJECT_ID('yj_print_task') IS NULL
BEGIN
    CREATE TABLE yj_print_task (
        id           bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT pk_yj_print_task PRIMARY KEY CLUSTERED,
        task_type    nvarchar(40)  NOT NULL,
        title        nvarchar(100) NULL,
        slip_no      nvarchar(50)  NULL,
        wo_no        nvarchar(50)  NULL,
        payload_json nvarchar(max) NOT NULL,
        targets      nvarchar(500) NOT NULL,
        delivered    nvarchar(500) NULL,
        state        nvarchar(10)  NOT NULL,
        fail_reason  nvarchar(200) NULL,
        created_at   datetime2     NOT NULL,
        expires_at   datetime2     NOT NULL,
        done_at      datetime2     NULL,
        asp_user1    nvarchar(50)  NULL,
        asp_time1    datetime2     NULL,
        asp_time2    datetime2     NULL
    );

    /* 取任务只按 state 过滤(几千行量级；CHARINDEX 过滤站点名用不上索引，别乱加) */
    CREATE NONCLUSTERED INDEX ix_yj_print_task_state ON yj_print_task (state, id);
END
ELSE
BEGIN
    /* 幂等：表已存在但补上索引(被别人手工建过表的情况) */
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_yj_print_task_state'
                   AND object_id = OBJECT_ID('yj_print_task'))
        CREATE NONCLUSTERED INDEX ix_yj_print_task_state ON yj_print_task (state, id);
    PRINT N'[SKIP] yj_print_task 已存在';
END

/* ══════════════════════════════════════════════════════════════════════
   2) 注明(AGENTS.md：新建表必须带中文注明；英文列名逐列注明)
   ══════════════════════════════════════════════════════════════════════ */
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID('yj_print_task') AND minor_id = 0
             AND class = 1 AND name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
        N'自动打印·任务缓存(2026-11-16)。一行=一条手机端发起的打印任务：代理掉线时留在这里，代理回来第一次轮询即按 id 顺序补打；目标站点按"开关开+勾了该类型"算，不看在线与否。状态机 PENDING→SENT→DONE/FAILED，超保留时长(默认 3 天) EXPIRED。',
        'SCHEMA', 'dbo', 'TABLE', 'yj_print_task';
ELSE
    EXEC sp_addextendedproperty N'MS_Description',
        N'自动打印·任务缓存(2026-11-16)。一行=一条手机端发起的打印任务：代理掉线时留在这里，代理回来第一次轮询即按 id 顺序补打；目标站点按"开关开+勾了该类型"算，不看在线与否。状态机 PENDING→SENT→DONE/FAILED，超保留时长(默认 3 天) EXPIRED。',
        'SCHEMA', 'dbo', 'TABLE', 'yj_print_task';

DECLARE @colComments TABLE (col sysname, txt nvarchar(500));
INSERT INTO @colComments VALUES
 ('task_type',    N'打印类型 code(与 PrintStationController.PRINT_TYPES 一致：PICK_SLIP=生产领料单 / OTHER_PICK_SLIP=其他领料单 / OTHER_RET_SLIP=其他退料单 / MAT_RET_SLIP=生产退料单 / MIX_SLIP=混料单)'),
 ('title',        N'纸面标题(任务里的「标题」，如「生产领料单」)；冗余列，仅供面板列表显示'),
 ('slip_no',      N'单号(领料单号优先，没有则工单号)；冗余列，仅供面板列表显示与过滤'),
 ('wo_no',        N'工单号；冗余列，仅供面板列表显示'),
 ('payload_json', N'整条任务载荷 JSON(与 /pending 下发的一致)：二维码内容/二维码图(dataURL)/明细/表头/部门标签/签名等全在这里 ⇒ 以后加打印字段不用改表结构'),
 ('targets',      N'目标站点(逗号分隔的站点名)。入队时按「开关开 + 勾了该打印类型」算，**不看在不在线** —— 这正是"掉线期间也能攒着、回来补打"的关键'),
 ('delivered',    N'已投递站点(逗号分隔)。取任务时追加，同一站点只投一次防重复出纸；全部投完 state 转 SENT'),
 ('state',        N'状态：PENDING=还有站点没拿到 / SENT=已发给全部目标等回执 / DONE=代理回执已出纸 / FAILED=回执失败 / EXPIRED=超保留时长没等到代理'),
 ('fail_reason',  N'失败原因(代理回执 ok=false 时带回来的 error 文案)'),
 ('created_at',   N'入队时间(补打顺序按 id 升序，也就是入队先后)'),
 ('expires_at',   N'过期时间(默认入队后 3 天 = 72 小时，见 yj_app_setting.print.cache_hours)；超过即不再派单，state 转 EXPIRED'),
 ('done_at',      N'回执时间(出纸成功/失败的时刻)'),
 ('asp_user1',    N'发起人(手机端登录账号)'),
 ('asp_time1',    N'创建时间(与 created_at 同值，按项目审计列口径保留)'),
 ('asp_time2',    N'最后更新时间(更新 delivered/state 时刷新)');

DECLARE @c sysname, @t nvarchar(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, txt FROM @colComments;
OPEN cur;
FETCH NEXT FROM cur INTO @c, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('yj_print_task')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('yj_print_task'), @c, 'ColumnId')
                 AND class = 1 AND name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', @t,
            'SCHEMA', 'dbo', 'TABLE', 'yj_print_task', 'COLUMN', @c;
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', @t,
            'SCHEMA', 'dbo', 'TABLE', 'yj_print_task', 'COLUMN', @c;
    FETCH NEXT FROM cur INTO @c, @t;
END
CLOSE cur; DEALLOCATE cur;

/* ══════════════════════════════════════════════════════════════════════
   3) 自检：表在 / 关键列齐 / 索引在 / 列级注明 15 条
   ══════════════════════════════════════════════════════════════════════ */
DECLARE @cols int =
      CASE WHEN COL_LENGTH('yj_print_task', N'payload_json') IS NOT NULL THEN 1 ELSE 0 END
    + CASE WHEN COL_LENGTH('yj_print_task', N'targets')      IS NOT NULL THEN 1 ELSE 0 END
    + CASE WHEN COL_LENGTH('yj_print_task', N'delivered')    IS NOT NULL THEN 1 ELSE 0 END
    + CASE WHEN COL_LENGTH('yj_print_task', N'state')        IS NOT NULL THEN 1 ELSE 0 END
    + CASE WHEN COL_LENGTH('yj_print_task', N'expires_at')   IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @idx int = CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_yj_print_task_state'
                          AND object_id = OBJECT_ID('yj_print_task')) THEN 1 ELSE 0 END;
DECLARE @desc int = (SELECT COUNT(*) FROM sys.extended_properties
                     WHERE major_id = OBJECT_ID('yj_print_task') AND class = 1 AND name = N'MS_Description');

PRINT N'[DB] ' + @db;
PRINT N'[OK] yj_print_task 关键列 ' + CAST(@cols AS nvarchar(5)) + N'/5，索引 ' + CAST(@idx AS nvarchar(5))
    + N'/1，注明 ' + CAST(@desc AS nvarchar(5)) + N' 条';

IF @cols <> 5 OR @idx <> 1 OR @desc < 15
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:yj_print_task 结构/注明未齐备，已回滚', 16, 1, @db);
    RETURN;
END

COMMIT TRAN;
PRINT N'[SELF-CHECK OK] 自动打印任务缓存表 yj_print_task 就绪';
