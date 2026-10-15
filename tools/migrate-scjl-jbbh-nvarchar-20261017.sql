/* migrate-scjl-jbbh-nvarchar-20261017.sql — scjl.jbbh 由 text 改为 nvarchar(250)(对齐服务器快照)
 *
 * 【为什么】逐列比对「本地正式库 HSDZ_MES」与「服务器快照 HSDZ_MES_SRV1015」(2026-10-15 23:15 整库备份),
 *   scjl 是本批 100 列里**唯一有类型差异**的列:
 *     本地 = text     ,服务器 = nvarchar(250)。
 *   根因:本地这张 scjl 不是服务器那表的副本 —— 2026-10-03 的 migrate-legacy-plang-scjl-tables.sql 按
 *   参考库结构**补建**(该脚本头注明「本机两账套从未存在过」),第 447 行就是 `[jbbh] text NULL`(旧定义);
 *   服务器现网版后来改成了 nvarchar(250)。
 *   ⚠ text 在新版 SQL Server 已弃用,且**不能参与** `=` 比较 / ORDER BY / DISTINCT / EXISTS / EXCEPT / UNION。
 *
 * 【怎么改】text 不能直接 ALTER COLUMN,走标准三步(同一事务内,失败整体回滚):
 *   ① 加新列 jbbh_tmp_nvarchar nvarchar(250) → ② 搬数据 CAST(... AS nvarchar(250)) → ③ 删旧列 → sp_rename 改名
 *   ④ 补回列级中文注明(班别)—— 删列会连带丢掉扩展属性。
 *
 * 【安全性(2026-10-17 实测)】jbbh 当前**无任何引用**:
 *   · yj_field 里 col_name='jbbh' 或 label='班别' 的字段行 = 0;
 *   · 无视图/存储过程/函数引用它(引用 scjl 的 4 个视图 v_wo_completion_detail / v_wo_process_progress /
 *     v_wo_next_process / View_od_cost3 都不含 jbbh);
 *   · 无外键、无索引、无默认约束(scjl 只有 PK_scjl(comm,id))。
 *   ⇒ 改类型对面板/报表零影响。
 *
 * 【幂等】仅当 jbbh 当前是 text 时才动;已是 nvarchar 直接跳过。残留的临时列会被清掉后再建。
 * 【两账套】先正式后测试,均执行。
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

IF COL_LENGTH(N'dbo.scjl', N'jbbh') IS NULL
    PRINT N'[SKIP] scjl 或 jbbh 不存在,无需处理';
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.scjl')
                  AND name = N'jbbh' AND system_type_id = 35)   -- 35 = text
BEGIN
    BEGIN TRAN;
    /* 清掉上次失败留下的临时列 */
    IF COL_LENGTH(N'dbo.scjl', N'jbbh_tmp_nvarchar') IS NOT NULL
        ALTER TABLE dbo.scjl DROP COLUMN jbbh_tmp_nvarchar;
    /* ① 加新列 */
    ALTER TABLE dbo.scjl ADD jbbh_tmp_nvarchar nvarchar(250) NULL;
    /* ② 搬数据(text 不能直接赋值给 nvarchar,须 CAST) */
    EXEC (N'UPDATE dbo.scjl SET jbbh_tmp_nvarchar = CAST(jbbh AS nvarchar(250))');
    /* ③ 删旧列 + 改名 */
    ALTER TABLE dbo.scjl DROP COLUMN jbbh;
    EXEC sp_rename N'dbo.scjl.jbbh_tmp_nvarchar', N'jbbh', N'COLUMN';
    COMMIT;
    PRINT N'[OK] scjl.jbbh:text → nvarchar(250)(数据已搬运,列序回到末位)';
END
ELSE
    PRINT N'[SKIP] scjl.jbbh 已是 nvarchar,无需处理';
GO

/* ④ 列级中文注明(与服务器快照一致) */
IF COL_LENGTH(N'dbo.scjl', N'jbbh') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                    WHERE ep.major_id = OBJECT_ID(N'dbo.scjl') AND ep.name = N'MS_Description'
                      AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'jbbh', 'ColumnId'))
    EXEC sp_addextendedproperty N'MS_Description', N'班别', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'jbbh';
GO

/* 自检 */
DECLARE @bad int = 0, @msg nvarchar(200) = N'', @dbn sysname = DB_NAME();
IF COL_LENGTH(N'dbo.scjl', N'jbbh') IS NULL
BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'jbbh 不存在 '; END
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.scjl') AND name = N'jbbh' AND system_type_id = 35)
BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'jbbh 仍是 text '; END
ELSE IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.scjl') AND name = N'jbbh'
                      AND system_type_id = 231 AND max_length = 500)     -- 231 = nvarchar,500 字节 = 250 字符
BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'jbbh 不是 nvarchar(250) '; END
IF COL_LENGTH(N'dbo.scjl', N'jbbh_tmp_nvarchar') IS NOT NULL
BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'残留临时列 '; END
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                WHERE ep.major_id = OBJECT_ID(N'dbo.scjl') AND ep.name = N'MS_Description'
                  AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'jbbh', 'ColumnId'))
BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'缺中文注明 '; END
RAISERROR(N'[自检] %s:scjl.jbbh 类型/临时列/注明,不符项 %d %s', 10, 1, @dbn, @bad, @msg);
IF @bad = 0 RAISERROR(N'[OK] scjl.jbbh 已对齐服务器快照:nvarchar(250) + 注明「班别」', 10, 1);
ELSE RAISERROR(N'[FAIL] scjl.jbbh 对齐未完成(见上一行)', 16, 1);
GO
