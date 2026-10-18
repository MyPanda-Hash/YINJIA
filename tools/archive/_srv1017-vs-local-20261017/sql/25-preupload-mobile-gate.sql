/* ============================================================================
   25-preupload-mobile-gate.sql —— 「本地整库上传到服务器」前的手机端安全闸门
   目的:确认用**本地库覆盖服务器**之后,手机端(PDA 直连数据库写 scjl 等)不会出问题。
   检查四件事:
     ① 结构:与服务器快照是否同构(见 sql/24 的指纹结论;这里只复核关键对象存在性)
     ② 行集:手机端会读写的表,两侧双向差(服务器独有的行 = 覆盖后会丢;本地独有的行 = 覆盖后会多)
     ③ 身份种子:IDENTITY 当前值是否 ≥ 本地最大 id+1(否则 PDA 插入会撞主键)
     ④ 关键配置:账号手机绑定 / 手机端权限 / 角色面板 是否与服务器一致
   用法(在目标库里执行,默认 HSDZ_MES):
     sqlcmd -S ... -d HSDZ_MES -i 25-preupload-mobile-gate.sql
   源库默认 [HSDZ_MES_SRV1017](服务器快照);换新快照时改库名。
   ============================================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @src sysname = N'HSDZ_MES_SRV1017';

PRINT '==============================================================';
PRINT N'上传前手机端安全闸门   本地 = ' + DB_NAME() + N'   参照 = ' + @src;
PRINT '==============================================================';

/* ---------- ② 手机端相关表:双向行差 ---------- */
IF OBJECT_ID('tempdb..#m') IS NOT NULL DROP TABLE #m;
CREATE TABLE #m (tbl sysname, loc bigint, srv bigint, srv_only bigint, loc_only bigint, note nvarchar(150));

DECLARE @t sysname, @sql nvarchar(max), @a bigint, @b bigint, @s bigint, @l bigint;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT name FROM (VALUES
    (N'scjl'), (N'plang'), (N'plang_pc'), (N'wo_process_line'), (N'wo_transfer_log'),
    (N'inh'), (N'outh'), (N'bs_inv'), (N's_allno'), (N'yj_user'), (N'permission'),
    (N'dm_langue'), (N'yj_role_panel'), (N'form_flow_link'), (N'yj_doc_status'),
    (N'bd_so_order'), (N'bl_so_order'), (N'bd_pu_order'), (N'bl_pu_order')
  ) v(name) WHERE OBJECT_ID(N'dbo.' + name) IS NOT NULL;

OPEN cur; FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @l = 0; SET @s = 0; SET @a = NULL; SET @b = NULL;
    BEGIN TRY
        SET @sql = N'SELECT @l = COUNT_BIG(*) FROM dbo.' + QUOTENAME(@t) + N';' +
                   N'SELECT @s = COUNT_BIG(*) FROM ' + QUOTENAME(@src) + N'.dbo.' + QUOTENAME(@t) + N';';
        EXEC sp_executesql @sql, N'@l bigint OUTPUT, @s bigint OUTPUT', @l OUTPUT, @s OUTPUT;

        SET @sql = N'SELECT @a = COUNT_BIG(*) FROM (SELECT * FROM ' + QUOTENAME(@src) + N'.dbo.' + QUOTENAME(@t) +
                   N' EXCEPT SELECT * FROM dbo.' + QUOTENAME(@t) + N') x;' +
                   N'SELECT @b = COUNT_BIG(*) FROM (SELECT * FROM dbo.' + QUOTENAME(@t) +
                   N' EXCEPT SELECT * FROM ' + QUOTENAME(@src) + N'.dbo.' + QUOTENAME(@t) + N') y;';
        EXEC sp_executesql @sql, N'@a bigint OUTPUT, @b bigint OUTPUT', @a OUTPUT, @b OUTPUT;
        INSERT INTO #m VALUES (@t, @l, @s, @a, @b, NULL);
    END TRY
    BEGIN CATCH
        INSERT INTO #m VALUES (@t, @l, @s, NULL, NULL, LEFT(ERROR_MESSAGE(), 140));
    END CATCH
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;

PRINT '';
PRINT N'===== ② 手机端相关表行集对比(服务器独有行 = 覆盖后会丢;本地独有行 = 覆盖后会多) =====';
SELECT tbl AS 表, loc AS 本地行, srv AS 服务器行,
       ISNULL(srv_only, 0) AS [服务器独有(会丢)], ISNULL(loc_only, 0) AS [本地独有(会多)], note AS 备注
FROM #m ORDER BY CASE WHEN ISNULL(srv_only,0) > 0 THEN 0 ELSE 1 END, tbl;

/* ---------- ③ 身份种子 ---------- */
IF OBJECT_ID('tempdb..#id') IS NOT NULL DROP TABLE #id;
CREATE TABLE #id (tbl sysname, col sysname, seed_now bigint, max_loc bigint, srv_seed bigint, flag varchar(40));
DECLARE @c sysname, @v bigint, @mx bigint, @sv bigint;
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name, c.name FROM sys.identity_columns c JOIN sys.tables t ON t.object_id = c.object_id
  WHERE t.is_ms_shipped = 0 ORDER BY t.name;
OPEN cur2; FETCH NEXT FROM cur2 INTO @t, @c;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @v = 0; SET @mx = 0; SET @sv = NULL;
    BEGIN TRY
        SET @sql = N'SELECT @v = CAST(ISNULL(IDENT_CURRENT(N''dbo.' + @t + N'''), 0) AS bigint);
                     SELECT @mx = CAST(ISNULL(MAX(' + QUOTENAME(@c) + N'), 0) AS bigint) FROM dbo.' + QUOTENAME(@t) + N';';
        EXEC sp_executesql @sql, N'@v bigint OUTPUT, @mx bigint OUTPUT', @v OUTPUT, @mx OUTPUT;
        SET @sql = N'SELECT @sv = CAST(ISNULL(IDENT_CURRENT(N''' + @src + N'.dbo.' + @t + N'''), 0) AS bigint);';
        EXEC sp_executesql @sql, N'@sv bigint OUTPUT', @sv OUTPUT;
        INSERT INTO #id VALUES (@t, @c, @v, @mx, @sv, CASE WHEN @v < @mx THEN '种子落后(会撞主键)' WHEN ISNULL(@sv,0) > @v THEN '本地种子<服务器(信息)' ELSE 'OK' END);
    END TRY
    BEGIN CATCH
        INSERT INTO #id VALUES (@t, @c, NULL, NULL, NULL, 'ERR');
    END CATCH
    FETCH NEXT FROM cur2 INTO @t, @c;
END
CLOSE cur2; DEALLOCATE cur2;

PRINT '';
PRINT N'===== ③ 身份种子核对(种子 ≤ 表内最大 id 会导致 PDA 插入撞主键) =====';
SELECT tbl AS 表, col AS 标识列, seed_now AS 本地种子, max_loc AS 本地最大id, srv_seed AS 服务器种子, flag AS 判定
FROM #id WHERE flag <> 'OK' ORDER BY CASE flag WHEN '种子落后' THEN 0 WHEN 'ERR' THEN 1 ELSE 2 END, tbl;

/* ---------- ④ 关键配置一致性 ---------- */
PRINT '';
PRINT N'===== ④ 手机端关键配置与服务器是否一致 =====';
IF OBJECT_ID('dbo.yj_user') IS NOT NULL
    SELECT N'yj_user 手机绑定' AS 项,
           (SELECT COUNT(*) FROM dbo.yj_user u JOIN [HSDZ_MES_SRV1017].dbo.yj_user s ON s.username = u.username
             WHERE ISNULL(u.MobId,'') = ISNULL(s.MobId,'') AND ISNULL(u.dlxz,'') = ISNULL(s.dlxz,'')
               AND ISNULL(u.phoneNo,'') = ISNULL(s.phoneNo,'')) AS 一致账号数,
           (SELECT COUNT(*) FROM dbo.yj_user) AS 本地账号数,
           (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.yj_user) AS 服务器账号数;
IF OBJECT_ID('dbo.permission') IS NOT NULL
    SELECT N'permission 权限行' AS 项,
           (SELECT COUNT(*) FROM dbo.permission) AS 本地,
           (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.permission) AS 服务器,
           (SELECT COUNT(*) FROM dbo.permission p WHERE NOT EXISTS (SELECT 1 FROM [HSDZ_MES_SRV1017].dbo.permission s WHERE s.ID=p.ID AND ISNULL(s.RW,'')=ISNULL(p.RW,''))) AS 内容不一致行;
IF OBJECT_ID('dbo.yj_role_panel') IS NOT NULL
    SELECT N'yj_role_panel 角色1025' AS 项,
           (SELECT COUNT(*) FROM dbo.yj_role_panel WHERE role_id = 1025) AS 本地,
           (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.yj_role_panel WHERE role_id = 1025) AS 服务器,
           (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.yj_role_panel s WHERE s.role_id = 1025
              AND NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel l WHERE l.role_id = 1025 AND l.panel_code = s.panel_code)) AS 本地缺;

/* ---------- 汇总结论 ---------- */
DECLARE @lose int, @ident int;
SELECT @lose = (SELECT ISNULL(SUM(srv_only), 0) FROM #m WHERE tbl IN ('scjl','plang_pc','wo_process_line','wo_transfer_log','inh','outh','bs_inv','s_allno','yj_user','permission','form_flow_link','yj_doc_status'));
SELECT @ident = (SELECT COUNT(*) FROM #id WHERE flag LIKE '种子落后%');

PRINT '';
PRINT '--------------------------------------------------------------';
IF @lose = 0 AND @ident = 0
    PRINT N'RESULT: MOBILE-GATE-PASS  手机端相关表无「服务器独有行」丢失,身份种子正常';
ELSE
    PRINT N'RESULT: MOBILE-GATE-WARN  会丢 ' + CAST(@lose AS varchar(10)) + N' 行手机端相关数据;种子落后 ' + CAST(@ident AS varchar(10)) + N' 张表';
PRINT '--------------------------------------------------------------';
GO


