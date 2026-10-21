/* ============================================================================
   migrate-wo-mixing-list-20261022.sql
   混料记录（面板码 WO_MIXING_LIST）—— 生产过程下的**只读报表**面板，
   呈现形态对齐现役「报工记录」WO_REPORT_LIST：flat + category=报表，
   一行一条记录、同表展开、按页查询，不显示单据导航，不开放新增/保存/删除/审核。

   为什么要以 wo_mixing_list 为数据源而不是复制事实
   ────────────────────────────────────────────────
   用户口径（2026-10-22）：「数据库里有 wo_mixing_list 这个表，做个和报工记录一样的
   对这个表的显示查询面板」。该表由服务端维护，MES 这边**只读**消费；
   复制数据会出现两套事实。

   列结构自适应（本脚本唯一的"聪明"处，也是它能直接丢给服务器 AI 跑的底气）
   ──────────────────────────────────────────────────────────────
   表/视图的真实列在服务器与本地不一定一致，写死列名必然翻车（列多了少列、中文列
   还是英文列都不知道）。所以本脚本**不写死列**，运行时：
     ① 读 dbo.wo_mixing_list 的真实列（表或视图都认）；
     ② 「工单号/混料数量/物料编号…」等已知列按 @map 里的中文标题、顺序、宽度、
        是否进查询条 登记，其余列**原样登记为字段**（中文列名本身即标题，
        英文列名退还英文，显示层由 TranslationService 机翻兜底）；
     ③ SQL 类型 → 面板类型：整数/小数/日期/日期时间/是否/文本；
     ④ flat 查询强依赖 `id` 列（QueryService.queryFlat 会拼 `SELECT t.id AS __id …
        ORDER BY t.id DESC`）：源对象没有 id 时，自动建只读包装视图
        dbo.v_wo_mixing_list（ROW_NUMBER() 生成 id），面板指向包装视图——
        源对象一个字节都不改。
   因此服务器上无论 wo_mixing_list 是宽表、窄表、中文列还是英文列，脚本都能装出
   能查能翻页的面板；日后源表加列，重跑本脚本即自动补字段（已存在的字段只更新、
   保留用户在「列设置」里改的别名与显隐）。

   幂等范围：仅本面板(yj_panel/yj_field)、本面板译名(yj_translation)、
             本面板角色授权(yj_role_panel)与包装视图；不触碰其他面板、不改源对象。

   前置：dbo.wo_mixing_list（表或视图）已存在。缺失时脚本**不创建**该对象，
         只打印 [SKIP] 并原样退出（RESULT: SKIPPED-NO-SOURCE）——
         绝不会凭空造一张同名表来"看起来装好了"。

   执行：DbSync run migrate-wo-mixing-list-20261022.sql
         （或 SqlRunner 直跑；两个账套都要跑）
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;

DECLARE @panel      sysname       = N'WO_MIXING_LIST';
DECLARE @panelName  nvarchar(120) = N'混料记录';
DECLARE @panelEn    nvarchar(400) = N'Mixing Records';
DECLARE @src        sysname       = NULL;

IF OBJECT_ID(N'dbo.wo_mixing_list', N'U') IS NOT NULL SET @src = N'wo_mixing_list';
ELSE IF OBJECT_ID(N'dbo.wo_mixing_list', N'V') IS NOT NULL SET @src = N'wo_mixing_list';

IF @src IS NULL GOTO skip_no_source;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ── 1. 决定面板的数据源：源对象有 id 就直接用，没有就包装一层只读视图 ──────
       flat 查询的 "SELECT t.id AS __id / ORDER BY t.id DESC" 是后端写死的，
       没有 id 列的面板一打开就报「列名 'id' 无效」，所以这一层必须兜住。       */
    DECLARE @line sysname = @src;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.' + @src) AND name = N'id')
    BEGIN
        DECLARE @orderCol sysname = (SELECT TOP 1 c.name FROM sys.columns c
            WHERE c.object_id = OBJECT_ID(N'dbo.' + @src)
              AND TYPE_NAME(c.user_type_id) IN (N'datetime2', N'datetime', N'date', N'smalldatetime')
            ORDER BY c.column_id);
        DECLARE @firstCol sysname = (SELECT TOP 1 c.name FROM sys.columns c
            WHERE c.object_id = OBJECT_ID(N'dbo.' + @src)
            ORDER BY c.column_id);
        IF @orderCol IS NULL SET @orderCol = @firstCol;

        DECLARE @mkView nvarchar(max) =
            N'CREATE OR ALTER VIEW dbo.v_wo_mixing_list AS SELECT ROW_NUMBER() OVER (ORDER BY '
            + QUOTENAME(@orderCol) + N' DESC, ' + QUOTENAME(@firstCol) + N') AS id, s.* FROM dbo.'
            + QUOTENAME(@src) + N' s;';
        EXEC (@mkView);
        SET @line = N'v_wo_mixing_list';

        IF EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.v_wo_mixing_list')
                     AND minor_id = 0 AND name = N'MS_Description')
            EXEC sys.sp_updateextendedproperty N'MS_Description',
                N'混料记录只读包装视图：源 wo_mixing_list 无 id 列，按日期倒序生成行号以适配 flat 列表；不复制事实。',
                N'SCHEMA', N'dbo', N'VIEW', N'v_wo_mixing_list';
        ELSE
            EXEC sys.sp_addextendedproperty N'MS_Description',
                N'混料记录只读包装视图：源 wo_mixing_list 无 id 列，按日期倒序生成行号以适配 flat 列表；不复制事实。',
                N'SCHEMA', N'dbo', N'VIEW', N'v_wo_mixing_list';
    END

    /* ── 2. 默认排序日期列：有就按日期倒序（最新在最上面），没有就退回 id 倒序 ── */
    DECLARE @dateCol sysname = NULL;
    DECLARE @dateCand TABLE (n int, col sysname);
    INSERT INTO @dateCand VALUES (1, N'单据日期'), (2, N'混料日期'), (3, N'报工日期'),
                                 (4, N'日期'), (5, N'创建时间'), (6, N'asp_time1'), (7, N'asp_time2');
    SELECT TOP 1 @dateCol = d.col FROM @dateCand d
    WHERE EXISTS (SELECT 1 FROM sys.columns c
                  WHERE c.object_id = OBJECT_ID(N'dbo.' + @line) AND c.name = d.col)
    ORDER BY d.n;
    -- 日期列若是 datetime 才适合做 ORDER BY 的 date_col（文本日期列同样可用）
    IF @dateCol IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.columns c
        WHERE c.object_id = OBJECT_ID(N'dbo.' + @line) AND c.name = @dateCol
          AND (TYPE_NAME(c.user_type_id) IN (N'date', N'datetime', N'datetime2', N'smalldatetime')
               OR c.user_type_id IN (SELECT user_type_id FROM sys.types WHERE name IN (N'nvarchar', N'varchar'))))
        SET @dateCol = NULL;

    /* ── 3. 面板行 ────────────────────────────────────────────────────────── */
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = @panel)
        INSERT INTO dbo.yj_panel
          (panel_code, panel_name, category, mode, line_table, head_table, group_col,
           pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
        VALUES (@panel, @panelName, N'报表', 'flat', @line, NULL, NULL,
                N'id', NULL, NULL, @dateCol, 100, N'items', N'生产过程', @panelEn);

    UPDATE dbo.yj_panel
       SET panel_name = @panelName, panel_name_en = @panelEn, category = N'报表', mode = 'flat',
           line_table = @line, head_table = NULL, group_col = NULL, pk_col = N'id',
           code_col = NULL, prefix = NULL, date_col = @dateCol, page_size = 100,
           detail_key = N'items', module_group = N'生产过程', config = NULL, config_at = NULL
     WHERE panel_code = @panel;
    IF @@ROWCOUNT <> 1 THROW 51000, N'目标面板行数异常（yj_panel）。', 1;

    /* ── 4. 字段：已知列给中文标题/顺序/宽度，未知列原样登记 ──────────────── */
    DECLARE @map TABLE (
        col sysname PRIMARY KEY, label nvarchar(120), dtype nvarchar(40),
        seq int, width int, qry bit, en nvarchar(400));
    INSERT INTO @map (col, label, dtype, seq, width, qry, en) VALUES
        (N'单据编号',     N'单据编号',     N'文本',     10, 160, 1, N'Document No.'),
        (N'混料单号',     N'混料单号',     N'文本',     12, 160, 1, N'Mixing No.'),
        (N'混料报工单号', N'混料报工单号', N'文本',     14, 160, 1, N'Mixing Report No.'),
        (N'单据日期',     N'单据日期',     N'日期',     20, 110, 1, N'Document Date'),
        (N'混料日期',     N'混料日期',     N'日期',     22, 110, 1, N'Mixing Date'),
        (N'工单号',       N'工单号',       N'文本',     30, 160, 1, N'Work Order No.'),
        (N'工单行号',     N'工单行号',     N'整数',     40,  90, 1, N'WO Line No.'),
        (N'批次号',       N'批次号',       N'文本',     45, 130, 1, N'Batch No.'),
        (N'混料批次号',   N'混料批次号',   N'文本',     47, 140, 1, N'Mixing Batch No.'),
        (N'产品编号',     N'产品编号',     N'文本',     50, 150, 1, N'Product Code'),
        (N'产品名称',     N'产品名称',     N'文本',     55, 200, 1, N'Product Name'),
        (N'配方单号',     N'配方单号',     N'文本',     60, 170, 1, N'Recipe No.'),
        (N'配方版本',     N'配方版本',     N'文本',     65,  90, 0, N'Recipe Version'),
        (N'混料数量',     N'混料数量',     N'小数',     70, 110, 0, N'Mixing Qty'),
        (N'单位',         N'单位',         N'文本',     75,  70, 0, N'Unit'),
        (N'状态',         N'状态',         N'文本',     80,  90, 1, N'Status'),
        (N'生产线',       N'生产线',       N'文本',     85, 120, 0, N'Production Line'),
        (N'序号',         N'序号',         N'文本',    200,  80, 0, N'Seq'),
        (N'物料种类',     N'物料种类',     N'文本',    210, 120, 0, N'Material Type'),
        (N'物料编号',     N'物料编号',     N'文本',    220, 150, 1, N'Material Code'),
        (N'物料名称',     N'物料名称',     N'文本',    230, 200, 1, N'Material Name'),
        (N'配料比',       N'配料比',       N'小数',    240, 100, 0, N'Ratio'),
        (N'单支物料含量', N'单支物料含量', N'小数',    250, 130, 0, N'Content per Piece'),
        (N'设计添加量',   N'设计添加量',   N'文本',    255, 120, 0, N'Design Addition'),
        (N'计划用量',     N'计划用量',     N'小数',    260, 110, 0, N'Planned Qty'),
        (N'实际用量',     N'实际用量',     N'小数',    270, 110, 0, N'Actual Qty'),
        (N'操作人',       N'操作人',       N'文本',    300, 100, 1, N'Operator'),
        (N'报工人',       N'报工人',       N'文本',    305, 100, 1, N'Reporter'),
        (N'创建人',       N'创建人',       N'文本',    310, 100, 0, N'Created By'),
        (N'创建时间',     N'创建时间',     N'日期时间', 320, 170, 0, N'Created At'),
        (N'备注',         N'备注',         N'文本',    330, 220, 0, N'Remark');

    -- 技术列不进面板：主键/外键/审计列（审计列仍可用于排序，见 @dateCol）
    DECLARE @fields TABLE (
        col sysname PRIMARY KEY, label nvarchar(120), dtype nvarchar(40),
        seq int, width int, place nvarchar(60), en nvarchar(400));

    INSERT INTO @fields (col, label, dtype, seq, width, place, en)
    SELECT c.name,
           CAST(ISNULL(m.label, c.name) AS nvarchar(120)),
           CAST(ISNULL(m.dtype, CASE
                WHEN TYPE_NAME(c.user_type_id) IN (N'tinyint', N'smallint', N'int', N'bigint') THEN N'整数'
                WHEN TYPE_NAME(c.user_type_id) IN (N'decimal', N'numeric', N'float', N'real',
                                                   N'money', N'smallmoney')                THEN N'小数'
                WHEN TYPE_NAME(c.user_type_id) = N'date'                                   THEN N'日期'
                WHEN TYPE_NAME(c.user_type_id) IN (N'datetime', N'datetime2',
                                                   N'smalldatetime', N'datetimeoffset')    THEN N'日期时间'
                WHEN TYPE_NAME(c.user_type_id) = N'bit'                                    THEN N'是否'
                WHEN TYPE_NAME(c.user_type_id) IN (N'nvarchar', N'varchar', N'nchar', N'char')
                     AND c.max_length > 400                                                THEN N'多行文本'
                ELSE N'文本' END) AS nvarchar(40)),
           ISNULL(m.seq, 900 + c.column_id),
           ISNULL(m.width, CASE
                WHEN TYPE_NAME(c.user_type_id) IN (N'datetime', N'datetime2',
                                                   N'smalldatetime', N'datetimeoffset')    THEN 170
                WHEN TYPE_NAME(c.user_type_id) = N'date'                                   THEN 110
                WHEN TYPE_NAME(c.user_type_id) IN (N'decimal', N'numeric', N'float', N'real',
                                                   N'money', N'smallmoney', N'tinyint',
                                                   N'smallint', N'int', N'bigint')         THEN 110
                WHEN c.max_length > 400                                                    THEN 220
                WHEN c.max_length > 200                                                    THEN 180
                ELSE 120 END),
           CASE WHEN ISNULL(m.qry, 0) = 1 THEN N'query,detail' ELSE N'detail' END,
           m.en
      FROM sys.columns c
      LEFT JOIN @map m ON m.col = c.name
     WHERE c.object_id = OBJECT_ID(N'dbo.' + @line)
       AND c.is_computed = 0
       AND c.name NOT IN (N'id', N'工单行id', N'混料头id',
                          N'asp_user1', N'asp_user2', N'asp_time1', N'asp_time2', N'asp_cancel');

    IF NOT EXISTS (SELECT 1 FROM @fields) THROW 51000, N'wo_mixing_list 没有任何可登记的业务列。', 1;

    -- 标题必须唯一（后端按 label 组装 SELECT 别名与 JSON 键，重名会互相覆盖）
    UPDATE f SET label = f.col
      FROM @fields f
     WHERE EXISTS (SELECT 1 FROM @fields g WHERE g.label = f.label AND g.col <> f.col);

    -- 一个查询字段都没有（列名完全不在 @map 里）时，把前 4 列提为查询条件，
    -- 否则列表顶部只剩一个关键字框，用起来像张死表
    IF NOT EXISTS (SELECT 1 FROM @fields WHERE place LIKE N'%query%')
        UPDATE @fields SET place = N'query,detail'
         WHERE col IN (SELECT TOP 4 col FROM @fields ORDER BY seq, col);

    /* 字段写回：已存在→更新（保留用户在「列设置」里的 alias/visible），缺失→插入，
       源表已删列→清理。这样重跑只补差异，不会把手工调整冲掉。 */
    UPDATE f
       SET f.label = s.label, f.label_en = s.en, f.data_type = s.dtype,
           f.place = s.place, f.seq = s.seq, f.width = s.width,
           f.editable = 0, f.required = 0, f.hidden = 0
      FROM dbo.yj_field f
      JOIN @fields s ON s.col = f.col_name
     WHERE f.panel_code = @panel;

    INSERT INTO dbo.yj_field
      (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
       display_field, place, seq, width, editable, required, hidden, visible)
    SELECT @panel, s.col, s.label, s.en, s.dtype, NULL, NULL, NULL,
           NULL, s.place, s.seq, s.width, 0, 0, 0, 1
      FROM @fields s
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_field f
                       WHERE f.panel_code = @panel AND f.col_name = s.col);

    DELETE f FROM dbo.yj_field f
     WHERE f.panel_code = @panel
       AND NOT EXISTS (SELECT 1 FROM @fields s WHERE s.col = f.col_name);

    /* ── 5. 译名（多语言强制规范：新增面板/字段必须带译名） ───────────────── */
    DECLARE @tr TABLE (scope varchar(20), ref_key nvarchar(400), locale varchar(10), text nvarchar(1000));
    INSERT INTO @tr VALUES ('panel', @panelName, 'en', @panelEn),
                           ('panel', @panelName, 'ja', N'混練記録');
    INSERT INTO @tr (scope, ref_key, locale, text)
    SELECT DISTINCT 'field', s.label, 'en', s.en
      FROM @fields s
     WHERE s.en IS NOT NULL AND LEN(s.en) > 0;

    INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
    SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
      FROM @tr t
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                       WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);

    /* ── 6. 角色授权：按「报工记录」等价补授，只读（view/query[/export]） ──── */
    INSERT INTO dbo.yj_role_panel (role_id, panel_code, perms, can_approve)
    SELECT r.id, @panel,
           CASE WHEN r.is_admin = 'Y' OR EXISTS (
                     SELECT 1 FROM dbo.yj_role_panel s
                      WHERE s.role_id = r.id AND s.panel_code = 'WO_REPORT_LIST'
                        AND ',' + REPLACE(ISNULL(s.perms, ''), ' ', '') + ',' LIKE '%,export,%')
                THEN 'view,query,export' ELSE 'view,query' END,
           'N'
      FROM dbo.yj_role r
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel t
                       WHERE t.role_id = r.id AND t.panel_code = @panel)
       AND (r.is_admin = 'Y' OR EXISTS (
                SELECT 1 FROM dbo.yj_role_panel s
                 WHERE s.role_id = r.id AND s.panel_code = 'WO_REPORT_LIST'
                   AND ',' + REPLACE(ISNULL(s.perms, ''), ' ', '') + ',' LIKE '%,view,%'));

    UPDATE dbo.yj_role_panel
       SET perms = CASE WHEN ',' + REPLACE(ISNULL(perms, ''), ' ', '') + ',' LIKE '%,export,%'
                        THEN 'view,query,export' ELSE 'view,query' END,
           can_approve = 'N'
     WHERE panel_code = @panel;

    /* ── 7. 收尾守卫：字段覆盖源列、译名齐、授权只读、面板能被 flat 查询取到 ── */
    IF EXISTS (SELECT 1 FROM dbo.yj_field f
                WHERE f.panel_code = @panel
                  AND (f.editable <> 0 OR f.required <> 0 OR f.hidden <> 0 OR f.visible <> 1))
        THROW 51000, N'混料记录字段存在可写/必填/隐藏配置，只读报表不允许。', 1;

    IF EXISTS (SELECT 1 FROM dbo.yj_field f
                WHERE f.panel_code = @panel
                  AND NOT EXISTS (SELECT 1 FROM sys.columns c
                                  WHERE c.object_id = OBJECT_ID(N'dbo.' + @line) AND c.name = f.col_name))
        THROW 51000, N'混料记录存在源对象上不存在的字段，请重跑本脚本。', 1;

    IF EXISTS (SELECT 1 FROM dbo.yj_role_panel
                WHERE panel_code = @panel
                  AND (perms NOT IN ('view,query', 'view,query,export') OR perms IS NULL
                       OR ISNULL(can_approve, 'N') <> 'N'))
        THROW 51000, N'混料记录存在非只读授权。', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                    WHERE scope = 'panel' AND ref_key = @panelName AND locale = 'en' AND LEN(text) > 0)
        THROW 51000, N'混料记录面板 en 译名缺失。', 1;

    -- 用后端 queryFlat 的同一条 SQL 形态做冒烟（id/列名/排序任一不对这里就炸）
    DECLARE @collist nvarchar(max) = STUFF((
        SELECT N', t.[' + s.col + N'] AS [' + s.label + N']'
          FROM @fields s ORDER BY s.seq, s.col FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
    DECLARE @hasCancel bit = CASE WHEN EXISTS (
        SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.' + @line) AND name = N'asp_cancel')
        THEN 1 ELSE 0 END;
    DECLARE @smoke nvarchar(max) =
        N'SELECT TOP 5 t.id AS __id, ' + @collist + N' FROM dbo.' + QUOTENAME(@line) + N' t WHERE '
        + CASE WHEN @hasCancel = 1 THEN N'ISNULL(t.asp_cancel, N''N'') <> N''Y''' ELSE N'1=1' END
        + N' ORDER BY ' + CASE WHEN @dateCol IS NOT NULL
              THEN N't.[' + @dateCol + N'] DESC, ' ELSE N'' END + N't.id DESC;';
    EXEC sp_executesql @smoke;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ── 8. 结果自述（用结果集而不是 PRINT：SqlRunner/DbSync 只回显结果集，PRINT 会丢） ── */
SELECT p.panel_code, p.panel_name, p.mode, p.line_table, p.category, p.module_group,
       p.date_col, p.page_size,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = p.panel_code) AS 字段数,
       (SELECT COUNT(*) FROM dbo.yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权角色数
  FROM dbo.yj_panel p WHERE p.panel_code = @panel;
SELECT CASE WHEN @line = @src THEN N'直连源对象' ELSE N'经包装视图 ' + @line END AS 数据源形态;
SELECT N'RESULT: WO_MIXING_LIST-READY' AS 结果;
GOTO done;

skip_no_source:
    SELECT N'RESULT: SKIPPED-NO-SOURCE' AS 结果,
           N'未找到 dbo.wo_mixing_list（表或视图）—— 本脚本未创建面板，也未改动任何数据。' AS 说明,
           N'SELECT name, type_desc FROM sys.objects WHERE name LIKE N''%mixing%'' ORDER BY name;' AS 自查SQL,
           N'确认服务器上的真实表名后重跑本脚本（DbSync run migrate-wo-mixing-list-20261022.sql）。' AS 下一步;

done:
    SET NOCOUNT OFF;
