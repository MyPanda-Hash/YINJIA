/* ============================================================================
   migrate-prod-pick-outh-20261022.sql
   生产领料（面板码 PROD_PICK_LIST）—— WMS 管理系统 · 库存核算下的**只读报表**面板，
   呈现形态对齐现役「混料记录」WO_MIXING_LIST：flat + 类别报表，
   一行一条记录、同表展开、按页查询、可筛选、可导出，不显示单据导航，
   不开放新增/保存/删除/审核。

   用户口径（2026-10-22）：「在库存核算里面加一个生产领料的查看面版与混料记录一样，
   面版实现和打包成一个压缩包。把 outh 里面的材料出库单据显示出来。」

   为什么以 outh 为数据源、并且加一层视图
   ────────────────────────────────────────
   dbo.outh 是**库存出库流水表**（与 v_stock_movement 的 src 同口径），
   src 段号：5 销售出库 / 6 材料出库 / 7 其他出库 / 8 委外发料（另见 10 / 12）。
   「材料出库单据」= src = 6 的行 —— 实测正式库 2094 行 / 487 张单，单据日期
   2026-09-01 ~ 2026-10-14，单据编号全部是 SCLL-YYYYMMDD-000NN（SCLL=生产领料），
   单据类型列恒为「材料出库单」；同 (rid, 物料编码, 批号) 无重复行。

   ⇒ 面板**不能直连 outh**（那样会把销售出库/其他出库一起列出来），
     故建一张**只读包装视图** dbo.v_prod_pick_list：
       SELECT <面板要的列> FROM dbo.outh WHERE src = 6 AND ISNULL(asp_cancel,'N') <> 'Y'
     源表 outh **一个字节都不改**（不建表、不加列、不复制数据），
     与「混料记录直连业务表」是同一条思路的两种落法：那条表本身就是单一口径，
     这张表是多段口径的表，靠视图筛段。

   面板字段（登记 18 列，其中 5 列按设计隐藏 ⇒ 列表展示 13 列）
   ─────────────────────────────────────────────
     可见：单据编号、单据日期、物料编码、物料名称、规格型号、计量单位、仓库名称、批号、
           数量、成本单价、成本金额、创建人/创建时间(asp_user1/asp_time1)
     隐藏(登记但 hidden=1，列设置里可放开)：单据类型（恒「材料出库单」）、仓库编码
           （仓库名称已足够辨仓）、经手人 / 审核人 / 审核时间（实测 2094 行全 NULL）
   默认排序 = 单据日期 DESC, id DESC（queryFlat 的「最新在最上面」口径）。
   asp_cancel / asp_user4 / asp_time4 / 备用1..20 等列不进面板（技术列或全空预留列）。

   权限：只读 view,query[,export] —— 按现役「材料出库单明细表」MATERIAL_OUT_DETAIL
         的可见角色等价补授（哪个角色能看那张明细表，就能看这张生产领料），
         有 export 的才给 export；不授 add/modify/del/modlog/print，can_approve='N'。

   幂等范围：包装视图（CREATE OR ALTER）、本面板(yj_panel/yj_field)、
             本面板译名(yj_translation)、本面板角色授权(yj_role_panel)。
             已存在的字段保留界面上的 alias/visible 手工调整。

   前置：dbo.outh 存在且带本周面板要的列。缺失时**直接报错**（不凭空造表）。
   执行：DbSync run migrate-prod-pick-outh-20261022.sql（两个账套都要跑）
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;

DECLARE @panel      sysname       = N'PROD_PICK_LIST';
DECLARE @panelName  nvarchar(120) = N'生产领料';
DECLARE @panelEn    nvarchar(400) = N'Production Picking';
DECLARE @panelJa    nvarchar(400) = N'生産材料出庫';
DECLARE @src        sysname       = N'outh';
DECLARE @line       sysname       = N'v_prod_pick_list';
DECLARE @srcSeg     int           = 6;   -- 6 = 材料出库（outh.src 段号）

BEGIN TRY
    BEGIN TRANSACTION;

    /* ── 1. 前置校验：源表必须在、要用的列必须齐（缺一列直接报，不静默降级） ─── */
    IF OBJECT_ID(N'dbo.outh', N'U') IS NULL
        THROW 51000, N'找不到 dbo.outh（库存出库流水表）。本面板的数据源就是它，不做任何凭空造表。', 1;

    DECLARE @need TABLE (col sysname PRIMARY KEY);
    INSERT INTO @need (col) VALUES
        (N'id'), (N'src'), (N'单据编号'), (N'单据类型'), (N'单据日期'),
        (N'物料编码'), (N'物料名称'), (N'规格型号'), (N'计量单位'),
        (N'仓库编码'), (N'仓库名称'), (N'批号'), (N'数量'),
        (N'成本单价'), (N'成本金额'), (N'经手人'),
        (N'asp_user1'), (N'asp_time1'), (N'asp_user3'), (N'asp_time3'), (N'asp_cancel');
    -- ⚠ 两个账套的兼容级别都是 100 ⇒ 不能用 STRING_AGG（110+ 才有），改 FOR XML PATH
    DECLARE @missing nvarchar(400) = (
        SELECT STUFF((SELECT N', ' + n.col FROM @need n
                       WHERE COL_LENGTH(N'dbo.outh', n.col) IS NULL
                       ORDER BY n.col FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N''));
    IF @missing IS NOT NULL
        THROW 51000, N'dbo.outh 缺少本面板要读的列（请先核对服务器表结构）。', 1;

    /* ── 2. 只读包装视图：只留 src=6（材料出库）且未删除的行 ───────────────── */
    DECLARE @viewSql nvarchar(max) = N'
CREATE OR ALTER VIEW dbo.v_prod_pick_list
AS
SELECT o.id,
       o.[单据编号], o.[单据类型], o.[单据日期],
       o.[物料编码], o.[物料名称], o.[规格型号], o.[计量单位],
       o.[仓库编码], o.[仓库名称], o.[批号], o.[数量],
       o.[成本单价], o.[成本金额], o.[经手人],
       o.asp_user1, o.asp_time1, o.asp_user3, o.asp_time3
  FROM dbo.outh o
 WHERE o.src = ' + CONVERT(nvarchar(10), @srcSeg) + N'
   AND ISNULL(o.asp_cancel, N''N'') <> N''Y'';';
    EXEC sys.sp_executesql @viewSql;

    -- 视图中文注明（AGENTS：对象必须有 MS_Description）
    DECLARE @viewCmt nvarchar(400) =
        N'生产领料只读视图：dbo.outh 中 src=6（材料出库）且未删除的出库流水行，'
      + N'字段与「生产领料」面板(PROD_PICK_LIST)一一对应；源表 outh 不做任何改动。';
    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.v_prod_pick_list') AND minor_id = 0
                 AND name = N'MS_Description')
        EXEC sys.sp_updateextendedproperty N'MS_Description', @viewCmt,
            N'SCHEMA', N'dbo', N'VIEW', N'v_prod_pick_list';
    ELSE
        EXEC sys.sp_addextendedproperty N'MS_Description', @viewCmt,
            N'SCHEMA', N'dbo', N'VIEW', N'v_prod_pick_list';

    /* ── 3. 面板行：flat + 报表 + WMS管理系统，数据源=包装视图 ──────────────── */
    -- @fresh：本次是不是**首次安装**（面板行此前不存在）。列的默认显隐只在首次安装时落库，
    -- 之后重跑不动 visible —— 用户在「列设置」里的勾选必须留住。
    DECLARE @fresh bit = CASE WHEN EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = @panel) THEN 0 ELSE 1 END;

    IF @fresh = 1
        INSERT INTO dbo.yj_panel
          (panel_code, panel_name, category, mode, line_table, head_table, group_col,
           pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
        VALUES (@panel, @panelName, N'报表', 'flat', @line, NULL, NULL,
                N'id', NULL, NULL, N'单据日期', 50, N'items', N'WMS管理系统', @panelEn);

    UPDATE dbo.yj_panel
       SET panel_name = @panelName, panel_name_en = @panelEn, category = N'报表', mode = 'flat',
           line_table = @line, head_table = NULL, group_col = NULL, pk_col = N'id',
           code_col = NULL, prefix = NULL, date_col = N'单据日期', page_size = 50,
           detail_key = N'items', module_group = N'WMS管理系统', config = NULL, config_at = NULL
     WHERE panel_code = @panel;
    IF @@ROWCOUNT <> 1 THROW 51000, N'目标面板行数异常（yj_panel）。', 1;

    /* ── 4. 字段：18 个显式声明（顺序/宽度/查询条=照「材料出库单明细表」的排法） ─ */
    -- ⚠ 列在不在列表里看的是 **visible**，不是 hidden：
    --   PanelConfigService.buildGridColumns 只按 `visible` 过滤（hidden 是编辑表格/表单那侧的开关，
    --   对平表列表不生效，2026-10-22 实测：hidden=1 的列照旧出现在 gridTabs.columns 里）。
    -- 本面板默认关掉 5 列（实测 2094 行全空/恒值，见脚本头注）：单据类型（恒「材料出库单」）、
    -- 仓库编码（仓库名称已足够辨仓）、经手人 / 审核人 / 审核时间（全 NULL）。
    -- visible 只在**首次插入**时按下面给的值落库；之后重跑本脚本不动 visible ——
    -- 用户在「列设置」里勾选的显隐不会被覆盖。
    DECLARE @fields TABLE (
        seq int, col sysname, label nvarchar(120), dtype nvarchar(40),
        width int, place nvarchar(60), en nvarchar(400), shown bit, PRIMARY KEY (col));
    INSERT INTO @fields (seq, col, label, dtype, width, place, en, shown) VALUES
        ( 10, N'单据编号',    N'单据编号',    N'文本',     210, N'query,detail', N'Document No.',      1),
        ( 20, N'单据日期',    N'单据日期',    N'日期',     110, N'query,detail', N'Document Date',     1),
        ( 30, N'单据类型',    N'单据类型',    N'文本',     110, N'detail',       N'Document Type',     0),
        ( 40, N'物料编码',    N'物料编码',    N'文本',     150, N'query,detail', N'Material Code',     1),
        ( 50, N'物料名称',    N'物料名称',    N'文本',     220, N'query,detail', N'Material Name',     1),
        ( 60, N'规格型号',    N'规格型号',    N'文本',     200, N'detail',       N'Spec / Model',      1),
        ( 70, N'计量单位',    N'计量单位',    N'文本',      90, N'detail',       N'UOM',               1),
        ( 80, N'仓库编码',    N'仓库编码',    N'文本',     110, N'detail',       N'Warehouse Code',    0),
        ( 90, N'仓库名称',    N'仓库名称',    N'文本',     160, N'query,detail', N'Warehouse',         1),
        (100, N'批号',        N'批号',        N'文本',     140, N'query,detail', N'Lot No.',           1),
        (110, N'数量',        N'数量',        N'小数',     110, N'detail',       N'Quantity',          1),
        (120, N'成本单价',    N'成本单价',    N'小数',     110, N'detail',       N'Cost Price',        1),
        (130, N'成本金额',    N'成本金额',    N'小数',     120, N'detail',       N'Cost Amount',       1),
        (140, N'经手人',      N'经手人',      N'文本',     100, N'detail',       N'Handler',           0),
        (150, N'asp_user1',   N'创建人',      N'文本',     100, N'query,detail', N'Created By',        1),
        (160, N'asp_time1',   N'创建时间',    N'日期时间', 170, N'query,detail', N'Created At',        1),
        (170, N'asp_user3',   N'审核人',      N'文本',     100, N'detail',       N'Auditor',           0),
        (180, N'asp_time3',   N'审核时间',    N'日期时间', 170, N'detail',       N'Audit Time',        0);

    -- 已存在→更新（**不动 visible**，保留用户在「列设置」里改的显隐与 alias）；缺失→插入；多余→清理
    -- （首次安装时 yj_field 也一定是空的 ⇒ 下面这条 UPDATE 实际不命中，默认显隐由 INSERT 落地）
    UPDATE f
       SET f.label = s.label, f.label_en = s.en, f.data_type = s.dtype,
           f.place = s.place, f.seq = s.seq, f.width = s.width,
           f.editable = 0, f.required = 0, f.hidden = 0,
           f.visible = CASE WHEN @fresh = 1 THEN s.shown ELSE f.visible END
      FROM dbo.yj_field f
      JOIN @fields s ON s.col = f.col_name
     WHERE f.panel_code = @panel;

    INSERT INTO dbo.yj_field
      (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
       display_field, place, seq, width, editable, required, hidden, visible)
    SELECT @panel, s.col, s.label, s.en, s.dtype, NULL, NULL, NULL,
           NULL, s.place, s.seq, s.width, 0, 0, 0, s.shown
      FROM @fields s
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_field f
                       WHERE f.panel_code = @panel AND f.col_name = s.col);

    DELETE f FROM dbo.yj_field f
     WHERE f.panel_code = @panel
       AND NOT EXISTS (SELECT 1 FROM @fields s WHERE s.col = f.col_name);

    /* ── 5. 译名（多语言强制规范：新增面板/字段必须带译名） ───────────────── */
    DECLARE @tr TABLE (scope varchar(20), ref_key nvarchar(400), locale varchar(10), text nvarchar(1000));
    INSERT INTO @tr VALUES ('panel', @panelName, 'en', @panelEn),
                           ('panel', @panelName, 'ja', @panelJa);
    INSERT INTO @tr (scope, ref_key, locale, text)
    SELECT DISTINCT 'field', s.label, 'en', s.en FROM @fields s;

    INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
    SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
      FROM @tr t
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                       WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);

    /* ── 6. 角色授权：按「材料出库单明细表」等价补授，只读 ──────────────────── */
    INSERT INTO dbo.yj_role_panel (role_id, panel_code, perms, can_approve)
    SELECT r.id, @panel,
           CASE WHEN r.is_admin = 'Y' OR EXISTS (
                     SELECT 1 FROM dbo.yj_role_panel s
                      WHERE s.role_id = r.id AND s.panel_code = N'MATERIAL_OUT_DETAIL'
                        AND ',' + REPLACE(ISNULL(s.perms, ''), ' ', '') + ',' LIKE '%,export,%')
                THEN 'view,query,export' ELSE 'view,query' END,
           'N'
      FROM dbo.yj_role r
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel t
                       WHERE t.role_id = r.id AND t.panel_code = @panel)
       AND (r.is_admin = 'Y' OR EXISTS (
                SELECT 1 FROM dbo.yj_role_panel s
                 WHERE s.role_id = r.id AND s.panel_code = N'MATERIAL_OUT_DETAIL'
                   AND ',' + REPLACE(ISNULL(s.perms, ''), ' ', '') + ',' LIKE '%,view,%'));

    UPDATE dbo.yj_role_panel
       SET perms = CASE WHEN ',' + REPLACE(ISNULL(perms, ''), ' ', '') + ',' LIKE '%,export,%'
                        THEN 'view,query,export' ELSE 'view,query' END,
           can_approve = 'N'
     WHERE panel_code = @panel;

    /* ── 7. 收尾守卫：字段只读且落在视图上、译名齐、授权只读、flat 查询能跑 ── */
    IF (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = @panel) <> 18
        THROW 51000, N'生产领料应登记 18 个只读字段。', 1;

    -- 只读口径：不可写、不必填、不走 hidden 隐藏；列都在视图上。
    -- ⚠ 这里**故意不校验 visible**：visible 是用户「列设置」的开关（面板默认关 5 列，见 §4），
    --   用户放开/关掉都是合法操作，重跑脚本不该因此报错。
    IF EXISTS (SELECT 1 FROM dbo.yj_field f
                WHERE f.panel_code = @panel
                  AND (f.editable <> 0 OR f.required <> 0 OR f.hidden <> 0
                       OR COL_LENGTH(N'dbo.' + @line, f.col_name) IS NULL))
        THROW 51000, N'生产领料字段配置异常（可写/必填/hidden/视图上不存在）。', 1;

    IF EXISTS (SELECT 1 FROM dbo.yj_role_panel
                WHERE panel_code = @panel
                  AND (perms NOT IN ('view,query', 'view,query,export') OR perms IS NULL
                       OR ISNULL(can_approve, 'N') <> 'N'))
        THROW 51000, N'生产领料存在非只读授权。', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                    WHERE scope = 'panel' AND ref_key = @panelName AND locale = 'en' AND LEN(text) > 0)
        THROW 51000, N'生产领料面板 en 译名缺失。', 1;

    -- 用后端 queryFlat 的同一条 SQL 形态做冒烟（id/列名/排序/日期列任一不对这里就炸）
    DECLARE @collist nvarchar(max) = STUFF((
        SELECT N', t.[' + s.col + N'] AS [' + s.label + N']'
          FROM @fields s ORDER BY s.seq FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
    DECLARE @smoke nvarchar(max) =
        N'SELECT TOP 5 t.id AS __id, ' + @collist + N' FROM dbo.' + QUOTENAME(@line) + N' t'
      + N' ORDER BY t.[单据日期] DESC, t.id DESC;';
    EXEC sp_executesql @smoke;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ── 8. 结果自述（结果集而非 PRINT：SqlRunner/DbSync 只回显结果集） ────────── */
SELECT p.panel_code, p.panel_name, p.mode, p.category, p.line_table, p.module_group,
       p.date_col, p.page_size,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = p.panel_code) AS 字段数,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = p.panel_code AND f.visible = 1) AS 展示列数,
       (SELECT COUNT(*) FROM dbo.yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权角色数,
       (SELECT COUNT(*) FROM dbo.v_prod_pick_list) AS 视图行数,
       (SELECT COUNT(DISTINCT 单据编号) FROM dbo.v_prod_pick_list) AS 领料单数
  FROM dbo.yj_panel p WHERE p.panel_code = @panel;
SELECT N'RESULT: PROD_PICK_LIST-READY' AS 结果;
