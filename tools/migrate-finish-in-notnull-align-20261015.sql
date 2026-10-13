/* ============================================================
   migrate-finish-in-notnull-align-20261015.sql — 2026-10-15
   把 bd_finish_in 的 NOT NULL 口径**在两账套对齐**(此前测试库允许 NULL,掩盖了生产报错)

   背景(用户报障 2026-10-15):
     组装成品检验单 审批通过/审核 → 自动生成产成品入库单时报
       `Cannot insert the value NULL into column '业务类型', table 'HSDZ_MES.dbo.bd_finish_in'`
   实测两账套**结构不一致**:
     · 正式库 HSDZ_MES      : [业务类型] NOT NULL、[单据日期] NOT NULL
     · 测试库 HSDZ_MES_TEST : 两列都**允许 NULL**
   ⇒ 自动生单代码漏写 业务类型 时,测试账套**跑得通**,只有正式库报错 —— 探针永远抓不到。
   (这正是文档里「测试库是某个时间点的快照、同名对象可能与正式库结构不同源」那类漂移;
     同类事故还坑过 bl_dispatch 的英文列。)

   处置:把**测试库**这两列对齐成与正式库一致的 NOT NULL(正式库已是,幂等跳过);
   先回填存量 NULL(业务类型 → '产成品入库'、单据日期 → 当天),再加约束。
   ⚠ 正式库不改(本来就已是 NOT NULL);本脚本的作用是**让测试账套能复现正式库的约束**,
     从而回归探针真的能拦住这类"漏写必填列"的 bug。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NULL BEGIN PRINT N'[跳过] 无 bd_finish_in 表'; RETURN; END
GO
-- ① 回填存量 NULL(仅当该列允许 NULL 时才可能有 NULL 行)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bd_finish_in')
           AND name = N'业务类型' AND is_nullable = 1)
BEGIN
    UPDATE dbo.bd_finish_in SET [业务类型] = N'产成品入库'
     WHERE [业务类型] IS NULL;
    PRINT N'业务类型 存量 NULL 已回填:' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
END
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bd_finish_in')
           AND name = N'单据日期' AND is_nullable = 1)
BEGIN
    UPDATE dbo.bd_finish_in SET [单据日期] = CAST(GETDATE() AS date)
     WHERE [单据日期] IS NULL;
    PRINT N'单据日期 存量 NULL 已回填:' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
END
GO
-- ② 对齐为 NOT NULL(已是则跳过)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bd_finish_in')
           AND name = N'业务类型' AND is_nullable = 1)
BEGIN
    ALTER TABLE dbo.bd_finish_in ALTER COLUMN [业务类型] nvarchar(50) NOT NULL;
    PRINT N'业务类型 已对齐为 NOT NULL';
END
ELSE PRINT N'业务类型 已是 NOT NULL(跳过)';
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bd_finish_in')
           AND name = N'单据日期' AND is_nullable = 1)
BEGIN
    ALTER TABLE dbo.bd_finish_in ALTER COLUMN [单据日期] date NOT NULL;
    PRINT N'单据日期 已对齐为 NOT NULL';
END
ELSE PRINT N'单据日期 已是 NOT NULL(跳过)';
GO
-- ③ 自检:两列都必须 NOT NULL
DECLARE @bad int = (SELECT COUNT(*) FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'dbo.bd_finish_in')
                      AND name IN (N'业务类型', N'单据日期') AND is_nullable = 1);
IF @bad > 0 RAISERROR(N'仍有 %d 列允许 NULL(未对齐)', 16, 1, @bad);
ELSE PRINT N'bd_finish_in 必填列已与正式库口径一致(幂等)';
GO
