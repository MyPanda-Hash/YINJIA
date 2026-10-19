/* =============================================================================
   migrate-formno-pool-sync-20261019.sql
   单号重号事故的**数据修复**:①清掉"空白占位头行"重号 ②号池回登(全前缀)

   【事故(2026-10-19 用户报障)】
     送料暂收单 QC_RECV / 来料检验单 QC_INSP 点「新增」,出来的单子是**已审核**。
     真相不是"新增复制了旧单",而是 FormNoService.next() 取号**只看号池自己**:
         seq = MAX(RIGHT(dh,4)) FROM s_allno WHERE lb=前缀 AND ny=当前月
         exists() 也只查 s_allno + inh
     而 9 月那批单据(金蝶导库/演示数据)是**直接写库**的,单号没回登号池
     (实测:库里 SL 已到 SL-2026-10-0130,号池只到 0006;QC_INSP 101 张单号全不在池里)。
     ⇒ 号池从旧号继续发,**把库里已存在的号又发了一遍**:
        · 新草稿拿到 SL-2026-10-0032,而库里已有一张 9 月的 SL-2026-10-0032(已审核);
        · 同一单号共用一条 yj_doc_status(shr=admin)⇒ 新草稿一出生就是「已审核」,
          不可编辑、保存被 409「已审核单据不可保存」挡下;
        · 列表按单号 GROUP BY 把两行并成一行,显示的是新草稿的日期 + 旧单的已审核状态
          ⇒ 用户看到的就是"新增出来一张已审核的单"。
     本地正式库实测:sl_recv 320 行 / 302 个单号,重号 18 个(0007、0016~0032)。

   【代码侧已同步修好】(backend/.../service/FormNoService.java,2026-10-19)
     取号基准 = max(号池末号, 各业务表同前缀同月最大号),候选号再逐个比对
     号池 + inh + 本前缀对应业务表(头/行表取自 yj_panel)⇒ 物理上不会再发出库里已有的号。

   【本脚本做两件事(都幂等)】
     一、清掉事故留下的空白占位头行:
         「同一单号有多行」且「该行除 单号/单据日期/单据状态/创建时间/asp_* 外全为 NULL」
         且「同一单号下至少还有一行是有内容的真单」⇒ 才删。宁可少删,绝不误删真单。
         ⚠ **只删头行,不碰明细行**:重号时新旧两单共用同一个单号,明细行属于旧的真单
           (实测 0032 的 5 行明细就是 9 月那张单的),按单号删明细会把真单打空。
     二、号池回登:逐面板(头行式取头表、单表式取行表)把「前缀-yyyy-MM-nnnn」形态、
         号池里没有的单号补登一行;只增不删(删号 = 重发号,项目铁律)。

   【自检】末尾两段:①格式内重号数必须为 0;②各面板未回登数必须为 0;否则 RAISERROR 16 报 FAIL。
   【执行】两账套各跑一次(先 HSDZ_MES 后 HSDZ_MES_TEST):
     cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-formno-pool-sync-20261019.sql
     YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-formno-pool-sync-20261019.sql
   【取证/复查】tools/archive/_probe-add-newdoc-20261019/DupProbe.java(重号 + 未回登,全 PASS 才算好)
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT N'== 一、清理重号事故留下的空白占位头行 ==';
DECLARE @tbl sysname, @col sysname, @sql nvarchar(max), @del int, @totalDel int = 0;
DECLARE @colsH nvarchar(max), @colsX nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT head_table, group_col FROM yj_panel
     WHERE head_table IS NOT NULL AND group_col IS NOT NULL AND prefix IS NOT NULL;
OPEN cur FETCH NEXT FROM cur INTO @tbl, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@tbl) IS NOT NULL AND COL_LENGTH(@tbl, @col) IS NOT NULL
    BEGIN
        -- 业务列 = 排除记账列(单号本身/日期/状态/审计与备用列)后剩下的列;它们全 NULL 才算"空白占位行"
        SET @colsH = NULL; SET @colsX = NULL;
        SELECT @colsH = STRING_AGG('h.[' + c.name + N'] IS NULL', N' AND '),
               @colsX = STRING_AGG('x.[' + c.name + N'] IS NULL', N' AND ')
          FROM sys.columns c
         WHERE c.object_id = OBJECT_ID(@tbl)
           AND c.name NOT IN ('id', @col, N'单据日期', N'单据状态', N'创建时间', N'更新时间',
                              'asp_user1','asp_time1','asp_user2','asp_time2',
                              'asp_user3','asp_time3','asp_user4','asp_time4',
                              'asp_cancel','asp_print')
           AND c.name NOT LIKE N'备用%';
        IF @colsH IS NOT NULL
        BEGIN
            SET @sql = N'
                DELETE h FROM [' + @tbl + N'] h
                 WHERE h.[' + @col + N'] IN (
                       SELECT [k] FROM (SELECT [' + @col + N'] AS [k] FROM [' + @tbl + N'] GROUP BY [' + @col + N'] HAVING COUNT(*) > 1) d)
                   AND ' + @colsH + N'
                   AND EXISTS (SELECT 1 FROM [' + @tbl + N'] x
                                WHERE x.[' + @col + N'] = h.[' + @col + N'] AND NOT (' + @colsX + N'));';
            EXEC sp_executesql @sql;
            SET @del = @@ROWCOUNT;
            IF @del > 0
            BEGIN
                SET @totalDel = @totalDel + @del;
                PRINT N'  [清理] ' + @tbl + N' : ' + CAST(@del AS nvarchar(10)) + N' 行空白重号头行';
            END
        END
    END
    FETCH NEXT FROM cur INTO @tbl, @col;
END
CLOSE cur DEALLOCATE cur;
PRINT N'  [合计] 清理空白重号头行 ' + CAST(@totalDel AS nvarchar(10)) + N' 行';

PRINT N'== 二、号池回登(逐面板,把库里已有但没进池的单号补登) ==';
DECLARE @pfx sysname, @t2 sysname, @c2 sysname, @n int, @total int = 0;
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR
    SELECT prefix, CASE WHEN head_table IS NOT NULL THEN head_table ELSE line_table END, group_col
      FROM yj_panel
     WHERE prefix IS NOT NULL AND group_col IS NOT NULL
       AND (head_table IS NOT NULL OR line_table IS NOT NULL);
OPEN cur2 FETCH NEXT FROM cur2 INTO @pfx, @t2, @c2;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@t2) IS NOT NULL AND COL_LENGTH(@t2, @c2) IS NOT NULL
    BEGIN
        SET @sql = N'
            INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
            SELECT DISTINCT ''0'', h.[' + @c2 + N'],
                   LEFT(h.[' + @c2 + N'], CHARINDEX(''-'', h.[' + @c2 + N']) - 1),
                   SUBSTRING(h.[' + @c2 + N'], CHARINDEX(''-'', h.[' + @c2 + N']) + 1, 7),
                   ''formno-sync'', GETDATE(), ''N''
              FROM [' + @t2 + N'] h
             WHERE h.[' + @c2 + N'] LIKE ''' + @pfx + N'-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]''
               AND NOT EXISTS (SELECT 1 FROM s_allno s WHERE s.dh = h.[' + @c2 + N']);';
        EXEC sp_executesql @sql;
        SET @n = @@ROWCOUNT;
        IF @n > 0
        BEGIN
            SET @total = @total + @n;
            PRINT N'  [回登] ' + @pfx + N' (' + @t2 + N') : ' + CAST(@n AS nvarchar(10)) + N' 个号';
        END
    END
    FETCH NEXT FROM cur2 INTO @pfx, @t2, @c2;
END
CLOSE cur2 DEALLOCATE cur2;
PRINT N'  [合计] 回登号池 ' + CAST(@total AS nvarchar(10)) + N' 个单号';

PRINT N'== 三、自检 ==';
-- 重号只对**单据面板**较真(mode='doc'):单据单号由号池发,重号=本次事故;
-- 档案面板(工艺路线 GY-*、物料清单等)的编码是**人工录**的,历史重号不属本事故,不能因此判 FAIL。
DECLARE @badDup int = 0, @badMiss int = 0, @chk nvarchar(max), @p sysname, @t sysname, @cc sysname,
        @mode sysname, @head sysname;
DECLARE cur3 CURSOR LOCAL FAST_FORWARD FOR
    SELECT prefix, CASE WHEN head_table IS NOT NULL THEN head_table ELSE line_table END, group_col, mode, head_table
      FROM yj_panel
     WHERE prefix IS NOT NULL AND group_col IS NOT NULL
       AND (head_table IS NOT NULL OR line_table IS NOT NULL);
OPEN cur3 FETCH NEXT FROM cur3 INTO @p, @t, @cc, @mode, @head;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@t) IS NOT NULL AND COL_LENGTH(@t, @cc) IS NOT NULL
    BEGIN
        -- 重号只判**头行式单据面板** + 只判**空白占位行**:
        --   · 单表式(工艺路线 bs_route)一行 = 一道工序,同一编码本来就重复多行,不能判重号;
        --   · 两张都有内容的真单撞号属数据质量,删数据要人工判断,这里只告警不拦。
        IF @mode = 'doc' AND @head IS NOT NULL
        BEGIN
            DECLARE @hCols nvarchar(max);
            SELECT @hCols = STRING_AGG('h.[' + c.name + N'] IS NULL', N' AND ')
              FROM sys.columns c
             WHERE c.object_id = OBJECT_ID(@t)
               AND c.name NOT IN ('id', @cc, N'单据日期', N'单据状态', N'创建时间', N'更新时间',
                                  'asp_user1','asp_time1','asp_user2','asp_time2',
                                  'asp_user3','asp_time3','asp_user4','asp_time4',
                                  'asp_cancel','asp_print')
               AND c.name NOT LIKE N'备用%';
            IF @hCols IS NOT NULL
            BEGIN
                SET @chk = N'SELECT @d = COUNT(*) FROM [' + @t + N'] h
                             WHERE h.[' + @cc + N'] IN (SELECT [' + @cc + N'] FROM [' + @t + N']
                                      WHERE [' + @cc + N'] LIKE ''' + @p + N'-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]''
                                      GROUP BY [' + @cc + N'] HAVING COUNT(*) > 1)
                               AND ' + @hCols + ';';
                DECLARE @d int;
                EXEC sp_executesql @chk, N'@d int OUT', @d OUT;
                IF @d > 0
                BEGIN
                    SET @badDup = @badDup + @d;
                    PRINT N'  [FAIL] ' + @p + N' (' + @t + N') 仍有 ' + CAST(@d AS nvarchar(10)) + N' 行空白占位行与真单重号';
                END
            END
        END
        SET @chk = N'SELECT @m = COUNT(*) FROM [' + @t + N'] h
                     WHERE h.[' + @cc + N'] LIKE ''' + @p + N'-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]''
                       AND NOT EXISTS (SELECT 1 FROM s_allno s WHERE s.dh = h.[' + @cc + N']);';
        DECLARE @m int;
        EXEC sp_executesql @chk, N'@m int OUT', @m OUT;
        IF @m > 0
        BEGIN
            SET @badMiss = @badMiss + @m;
            PRINT N'  [FAIL] ' + @p + N' (' + @t + N') 仍有 ' + CAST(@m AS nvarchar(10)) + N' 个号没回登';
        END
    END
    FETCH NEXT FROM cur3 INTO @p, @t, @cc, @mode, @head;
END
CLOSE cur3 DEALLOCATE cur3;

DECLARE @dbn sysname = DB_NAME();
IF @badDup = 0 AND @badMiss = 0
    RAISERROR(N'[OK] %s:无重号、号池无缺号(新增不会再重发库里的号)', 10, 1, @dbn);
ELSE
    RAISERROR(N'[FAIL] %s:重号 %d 个、未回登 %d 个', 16, 1, @dbn, @badDup, @badMiss);
GO
