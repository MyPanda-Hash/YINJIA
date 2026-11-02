/* ============================================================================
   migrate-wo-mixing-list-20261022.sql   (v3 —— 直连表，正式库/测试库同一份)
   混料记录（面板码 WO_MIXING_LIST）—— 生产过程下的**只读报表**面板，
   呈现形态对齐现役「报工记录」WO_REPORT_LIST：flat + 类别报表，
   一行一条记录、同表展开、按页查询、可筛选、可导出/打印。

   用户口径（2026-10-22）：「直接开始重新实现，并且将正式库也要实现，要做到直连这个表」。
   ⇒ 本脚本做三件事，**面板 line_table 就是 dbo.wo_mixing_list 本身**（不建包装视图、不复制数据）：
      ① 表不存在就按服务器真实结构建出来（两账套同 DDL，带中文表/列注明）；
      ② 建/更新面板 WO_MIXING_LIST，19 个字段**显式声明**（标题/顺序/宽度/查询条/类型），
         不再"按列自适应猜"——列清单来自服务器现役表（见下）；
      ③ 补 en 译名 + 按「报工记录」等价补授只读权限。

   源表真实结构（2026-10-22 从服务器 36.140.66.163/HSDZ_MES 与其
   HSDZ_MES-manual-20261021-184953.bak 双向核对，27 列 / 8 行）
   ───────────────────────────────────────────────────────────────
     id bigint IDENTITY PK、
     单据编号 nvarchar(60)、工单号 nvarchar(60)、工单行id bigint、工单行号 int、
     配方单号 nvarchar(60)、配方版本 nvarchar(30)、序号 nvarchar(20)、
     物料种类 nvarchar(50)、物料编号 nvarchar(60)、物料名称 nvarchar(100)、
     配料比 / 单支物料含量 / 设计添加量 / 计划用量 / 实际用量  decimal(18,8)、
     标记 nvarchar(30)（保存前=N / 保存后=Y）、
     asp_user1..4 nvarchar(20)、asp_time1..4 datetime、asp_cancel varchar(1)、asp_print int
   表注释（服务器原话）：「混料时通过电子称自动获取的实际用量」

   面板字段 = 上面 27 列里的 19 列（技术列 id / 工单行id / 修改人 / 修改时间 / 删除人 /
   删除时间 / 删除标记 / 打印次数 不进面板）；默认按「创建时间」(asp_time1) 倒序。

   幂等范围：本表（仅在缺失时创建）、本面板(yj_panel/yj_field)、本面板译名(yj_translation)、
             本面板角色授权(yj_role_panel)。已存在的表结构/数据/别名/显隐一律不动。

   执行：DbSync run migrate-wo-mixing-list-20261022.sql（两个账套都要跑）
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;

DECLARE @panel      sysname       = N'WO_MIXING_LIST';
DECLARE @panelName  nvarchar(120) = N'混料记录';
DECLARE @panelEn    nvarchar(400) = N'Mixing Records';
DECLARE @line       sysname       = N'wo_mixing_list';

BEGIN TRY
    BEGIN TRANSACTION;

    /* ── 1. 表：不存在才建（服务器上早就有了 ⇒ 这里什么都不做） ───────────── */
    IF OBJECT_ID(N'dbo.wo_mixing_list', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.wo_mixing_list (
            id             bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_mixing_list PRIMARY KEY,
            单据编号       nvarchar(60)  NULL,
            工单号         nvarchar(60)  NULL,
            工单行id       bigint        NULL,
            工单行号       int           NULL,
            配方单号       nvarchar(60)  NULL,
            配方版本       nvarchar(30)  NULL,
            序号           nvarchar(20)  NULL,
            物料种类       nvarchar(50)  NULL,
            物料编号       nvarchar(60)  NULL,
            物料名称       nvarchar(100) NULL,
            配料比         decimal(18,8) NULL CONSTRAINT DF_wo_mixing_list_配料比    DEFAULT ((0)),
            单支物料含量   decimal(18,8) NULL,
            设计添加量     decimal(18,8) NULL CONSTRAINT DF_wo_mixing_list_设计添加量 DEFAULT ((0)),
            计划用量       decimal(18,8) NULL CONSTRAINT DF_wo_mixing_list_计划用量  DEFAULT ((0)),
            实际用量       decimal(18,8) NULL CONSTRAINT DF_wo_mixing_list_实际用量  DEFAULT ((0)),
            标记           nvarchar(30)  NULL,
            asp_user1      nvarchar(20)  NULL CONSTRAINT DF_wo_mixing_list_asp_user1 DEFAULT (N''),
            asp_time1      datetime      NULL CONSTRAINT DF_wo_mixing_list_asp_time1_1 DEFAULT (GETDATE()),
            asp_user2      nvarchar(20)  NULL CONSTRAINT DF_wo_mixing_list_asp_user2 DEFAULT (N''),
            asp_time2      datetime      NULL,
            asp_user3      nvarchar(20)  NULL CONSTRAINT DF_wo_mixing_list_asp_user3 DEFAULT (N''),
            asp_time3      datetime      NULL,
            asp_cancel     varchar(1)    NULL CONSTRAINT DF_wo_mixing_list_asp_cancel DEFAULT ('N'),
            asp_user4      nvarchar(20)  NULL CONSTRAINT DF_wo_mixing_list_asp_user4 DEFAULT (N''),
            asp_time4      datetime      NULL,
            asp_print      int           NULL CONSTRAINT DF_wo_mixing_list_asp_print DEFAULT ((0))
        );

        -- 中文注明（AGENTS：新建表必须带 MS_Description）
        EXEC sys.sp_addextendedproperty N'MS_Description',
            N'混料时通过电子称自动获取的实际用量', N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list';
    END
    ELSE
    BEGIN
        -- 表已存在（服务器）：只补/校正表注释，不动结构、不动数据
        IF EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_mixing_list') AND minor_id = 0
                     AND name = N'MS_Description')
            EXEC sys.sp_updateextendedproperty N'MS_Description',
                N'混料时通过电子称自动获取的实际用量', N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list';
        ELSE
            EXEC sys.sp_addextendedproperty N'MS_Description',
                N'混料时通过电子称自动获取的实际用量', N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list';
    END

    -- 列级中文注明（幂等；已存在只更新）
    DECLARE @colCmt TABLE (col sysname PRIMARY KEY, cmt nvarchar(200));
    INSERT INTO @colCmt (col, cmt) VALUES
        (N'id', N'主键'), (N'单据编号', N'混料单号'), (N'工单号', N'生产工单号'),
        (N'工单行id', N'生产工单物理行主键(plang.id)'), (N'工单行号', N'工单行显示序号'),
        (N'配方单号', N'成型配方/工艺清单单号'), (N'配方版本', N'配方版本'),
        (N'序号', N'单内物料行号'), (N'物料种类', N'物料种类'),
        (N'物料编号', N'配方物料编号'), (N'物料名称', N'物料名称'),
        (N'配料比', N'归一化配料比,百分比输入已换算为小数'),
        (N'单支物料含量', N'每支产品的物料含量'),
        (N'设计添加量', N'配方设计添加量'),
        (N'计划用量', N'按混料数量与配方口径计算的计划投料量'),
        (N'实际用量', N'电子称自动获取的实际用量'),
        (N'标记', N'保存前=N，保存后=Y'),
        (N'asp_user1', N'创建人'), (N'asp_time1', N'创建时间'),
        (N'asp_user2', N'最后修改人'), (N'asp_time2', N'最后修改时间'),
        (N'asp_user3', N'审核人'), (N'asp_time3', N'审核时间'),
        (N'asp_cancel', N'删除标记'), (N'asp_user4', N'删除人'),
        (N'asp_time4', N'删除时间'), (N'asp_print', N'打印次数');
    DECLARE @c sysname, @m nvarchar(200);
    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, cmt FROM @colCmt;
    OPEN cur; FETCH NEXT FROM cur INTO @c, @m;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF COL_LENGTH(N'dbo.wo_mixing_list', @c) IS NOT NULL
        BEGIN
            IF EXISTS (SELECT 1 FROM sys.extended_properties
                       WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_mixing_list')
                         AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_mixing_list'), @c, 'ColumnId')
                         AND name = N'MS_Description')
                EXEC sys.sp_updateextendedproperty N'MS_Description', @m,
                    N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list', N'COLUMN', @c;
            ELSE
                EXEC sys.sp_addextendedproperty N'MS_Description', @m,
                    N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list', N'COLUMN', @c;
        END
        FETCH NEXT FROM cur INTO @c, @m;
    END
    CLOSE cur; DEALLOCATE cur;

    /* ── 2. 直连前置校验：面板要的列必须都在（缺一列直接报，不静默降级） ──────── */
    DECLARE @need TABLE (col sysname PRIMARY KEY);
    INSERT INTO @need (col) VALUES
        (N'id'), (N'单据编号'), (N'工单号'), (N'工单行号'), (N'配方单号'), (N'配方版本'),
        (N'序号'), (N'物料种类'), (N'物料编号'), (N'物料名称'), (N'配料比'),
        (N'单支物料含量'), (N'设计添加量'), (N'计划用量'), (N'实际用量'), (N'标记'),
        (N'asp_user1'), (N'asp_time1'), (N'asp_user3'), (N'asp_time3');
    DECLARE @missing nvarchar(400) = (
        SELECT STRING_AGG(n.col, N', ') FROM @need n
         WHERE COL_LENGTH(N'dbo.wo_mixing_list', n.col) IS NULL);
    IF @missing IS NOT NULL
        THROW 51000, N'wo_mixing_list 缺少本面板要直连的列（请先核对服务器表结构）。', 1;

    /* ── 3. 面板行：flat + 报表 + 生产过程，直连表 ────────────────────────── */
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = @panel)
        INSERT INTO dbo.yj_panel
          (panel_code, panel_name, category, mode, line_table, head_table, group_col,
           pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
        VALUES (@panel, @panelName, N'报表', 'flat', @line, NULL, NULL,
                N'id', NULL, NULL, N'asp_time1', 100, N'items', N'生产过程', @panelEn);

    UPDATE dbo.yj_panel
       SET panel_name = @panelName, panel_name_en = @panelEn, category = N'报表', mode = 'flat',
           line_table = @line, head_table = NULL, group_col = NULL, pk_col = N'id',
           code_col = NULL, prefix = NULL, date_col = N'asp_time1', page_size = 100,
           detail_key = N'items', module_group = N'生产过程', config = NULL, config_at = NULL
     WHERE panel_code = @panel;
    IF @@ROWCOUNT <> 1 THROW 51000, N'目标面板行数异常（yj_panel）。', 1;

    /* ── 4. 字段：19 个显式声明（顺序/宽度/是否进查询条=照「报工记录」的排法） ── */
    DECLARE @fields TABLE (
        seq int, col sysname, label nvarchar(120), dtype nvarchar(40),
        width int, place nvarchar(60), en nvarchar(400), PRIMARY KEY (col));
    INSERT INTO @fields (seq, col, label, dtype, width, place, en) VALUES
        ( 10, N'单据编号',     N'单据编号',     N'文本',     150, N'query,detail', N'Document No.'),
        ( 20, N'工单号',       N'工单号',       N'文本',     160, N'query,detail', N'Work Order No.'),
        ( 30, N'工单行号',     N'工单行号',     N'整数',      90, N'query,detail', N'WO Line No.'),
        ( 40, N'配方单号',     N'配方单号',     N'文本',     150, N'query,detail', N'Recipe No.'),
        ( 50, N'配方版本',     N'配方版本',     N'文本',      90, N'detail',       N'Recipe Version'),
        ( 60, N'序号',         N'序号',         N'文本',      70, N'detail',       N'Seq'),
        ( 70, N'物料种类',     N'物料种类',     N'文本',     110, N'detail',       N'Material Type'),
        ( 80, N'物料编号',     N'物料编号',     N'文本',     150, N'query,detail', N'Material Code'),
        ( 90, N'物料名称',     N'物料名称',     N'文本',     200, N'query,detail', N'Material Name'),
        (100, N'配料比',       N'配料比',       N'小数',     110, N'detail',       N'Ratio'),
        (110, N'单支物料含量', N'单支物料含量', N'小数',     130, N'detail',       N'Content per Piece'),
        (120, N'设计添加量',   N'设计添加量',   N'小数',     120, N'detail',       N'Design Addition'),
        (130, N'计划用量',     N'计划用量',     N'小数',     110, N'detail',       N'Planned Qty'),
        (140, N'实际用量',     N'实际用量',     N'小数',     110, N'detail',       N'Actual Qty'),
        (150, N'标记',         N'标记',         N'文本',      80, N'detail',       N'Flag'),
        (160, N'asp_user1',    N'创建人',       N'文本',     100, N'query,detail', N'Created By'),
        (170, N'asp_time1',    N'创建时间',     N'日期时间', 170, N'query,detail', N'Created At'),
        (180, N'asp_user3',    N'审核人',       N'文本',     100, N'detail',       N'Auditor'),
        (190, N'asp_time3',    N'审核时间',     N'日期时间', 170, N'detail',       N'Audit Time');

    -- 已存在→更新（保留用户在「列设置」里改的 alias/visible）；缺失→插入；多余→清理
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
    SELECT DISTINCT 'field', s.label, 'en', s.en FROM @fields s;

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

    /* ── 7. 收尾守卫：字段只读且落在表上、译名齐、授权只读、flat 查询能跑 ──── */
    IF (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = @panel) <> 19
        THROW 51000, N'混料记录应登记 19 个只读字段。', 1;

    IF EXISTS (SELECT 1 FROM dbo.yj_field f
                WHERE f.panel_code = @panel
                  AND (f.editable <> 0 OR f.required <> 0 OR f.hidden <> 0 OR f.visible <> 1
                       OR COL_LENGTH(N'dbo.wo_mixing_list', f.col_name) IS NULL))
        THROW 51000, N'混料记录字段配置异常（可写/必填/隐藏/表上不存在）。', 1;

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
          FROM @fields s ORDER BY s.seq FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
    DECLARE @smoke nvarchar(max) =
        N'SELECT TOP 5 t.id AS __id, ' + @collist + N' FROM dbo.' + QUOTENAME(@line) + N' t WHERE '
        + N'ISNULL(t.asp_cancel, N''N'') <> N''Y'''
        + N' ORDER BY t.asp_time1 DESC, t.id DESC;';
    EXEC sp_executesql @smoke;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ── 8. 结果自述（结果集而非 PRINT：SqlRunner/DbSync 只回显结果集） ────────── */
SELECT p.panel_code, p.panel_name, p.mode, p.line_table, p.category, p.module_group,
       p.date_col, p.page_size,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = p.panel_code) AS 字段数,
       (SELECT COUNT(*) FROM dbo.yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权角色数,
       (SELECT COUNT(*) FROM dbo.wo_mixing_list) AS 表行数
  FROM dbo.yj_panel p WHERE p.panel_code = @panel;
SELECT N'RESULT: WO_MIXING_LIST-READY' AS 结果;
