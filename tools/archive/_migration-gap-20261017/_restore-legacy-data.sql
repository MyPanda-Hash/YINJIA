/* _restore-legacy-data.sql — 把服务器快照库的 6 张经典 HSDZ 遗留表**数据**回灌到当前账套
 *
 * 【为什么要单独一份、且故意不进 db-migrations.txt】
 *   这 6 张表共 7,936 行,其中 s_commdata.JSZ 是**真实手机号**、gscs 是公司电话。
 *   AGENTS.md 硬规矩「敏感信息不入库(.env、AK/密码 —— 提交前 git grep 扫一遍)」
 *   ⇒ 数据不能写进 git,只能本机从快照库一次性搬运。表结构由链上的
 *   tools/migrate-legacy-restore-20261017.sql 负责(那份是纯 DDL,可进 git)。
 *
 * 【幂等】① 快照库不存在 → 整段跳过;② 目标表已有数据 → 跳过该表(绝不重复灌、绝不覆盖);
 *         ③ 逐表开 IDENTITY_INSERT 保留快照原始 id(与快照逐行一致,不是重新编号)。
 *
 * 【用法】在 tools 目录下(两个账套各跑一次,先正式后测试):
 *   java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_RunSql.java archive\_migration-gap-20261017\_restore-legacy-data.sql HSDZ_MES
 *   java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_RunSql.java archive\_migration-gap-20261017\_restore-legacy-data.sql HSDZ_MES_TEST
 *
 * 【生成】2026-10-17,配合 migrate-legacy-restore-20261017.sql(同日)。
 */
SET NOCOUNT ON;
GO

IF DB_ID(N'HSDZ_MES_SRV1015') IS NULL
BEGIN
    RAISERROR(N'[SKIP] 本实例没有快照库 HSDZ_MES_SRV1015 —— 无法回灌数据(表结构仍在)', 10, 1);
    RETURN;
END
GO

DECLARE @src sysname = N'HSDZ_MES_SRV1015';
DECLARE @t sysname, @cols nvarchar(max), @sql nvarchar(max), @rows bigint, @dbn sysname = DB_NAME();
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT v FROM (VALUES (N'dm_langue'), (N'gscs'), (N'permission'),
                          (N's_commdata'), (N's_sys'), (N's_xtcs')) AS t(v);
OPEN cur;
FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dbo.' + @t, N'U') IS NULL
        RAISERROR(N'[SKIP] %s.%s 不存在 —— 先跑 migrate-legacy-restore-20261017.sql', 10, 1, @dbn, @t);
    ELSE IF EXISTS (SELECT 1 FROM sys.partitions p JOIN sys.objects o ON o.object_id = p.object_id
                     WHERE o.name = @t AND p.index_id IN (0, 1) AND p.rows > 0)
        RAISERROR(N'[SKIP] %s.%s 已有数据 —— 不覆盖(幂等)', 10, 1, @dbn, @t);
    ELSE
    BEGIN
        SELECT @cols = STUFF((
                 SELECT N', ' + QUOTENAME(c.name)
                   FROM sys.columns c
                  WHERE c.object_id = OBJECT_ID(N'dbo.' + @t)
                  ORDER BY c.column_id
                  FOR XML PATH(''), TYPE).value(N'.', N'nvarchar(max)'), 1, 2, N'');
        SET @sql = N'SET IDENTITY_INSERT dbo.' + QUOTENAME(@t) + N' ON; '
                 + N'INSERT INTO dbo.' + QUOTENAME(@t) + N' (' + @cols + N') '
                 + N'SELECT ' + @cols + N' FROM [' + @src + N'].dbo.' + QUOTENAME(@t) + N'; '
                 + N'SET IDENTITY_INSERT dbo.' + QUOTENAME(@t) + N' OFF;';
        EXEC sp_executesql @sql;
        SELECT @rows = SUM(p.rows) FROM sys.partitions p JOIN sys.objects o ON o.object_id = p.object_id
                        WHERE o.name = @t AND p.index_id IN (0, 1);
        RAISERROR(N'[OK] %s.%s 回灌 %I64d 行(与快照同 id)', 10, 1, @dbn, @t, @rows);
    END
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ===== 对账:当前账套 vs 快照库,逐表行数 ===== */
SELECT t.name AS 表名,
       SUM(p.rows) AS 当前账套,
       (SELECT SUM(p2.rows) FROM [HSDZ_MES_SRV1015].sys.partitions p2
         JOIN [HSDZ_MES_SRV1015].sys.objects o2 ON o2.object_id = p2.object_id
        WHERE o2.name = t.name AND p2.index_id IN (0, 1)) AS 快照库,
       CASE WHEN SUM(p.rows) = (SELECT SUM(p2.rows) FROM [HSDZ_MES_SRV1015].sys.partitions p2
                                 JOIN [HSDZ_MES_SRV1015].sys.objects o2 ON o2.object_id = p2.object_id
                                WHERE o2.name = t.name AND p2.index_id IN (0, 1))
            THEN N'一致' ELSE N'★不一致' END AS 判定
FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE t.name IN (N'dm_langue', N'gscs', N'permission', N's_commdata', N's_sys', N's_xtcs')
GROUP BY t.name ORDER BY t.name;
GO
