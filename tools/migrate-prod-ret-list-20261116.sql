/* ============================================================================
   migrate-prod-ret-list-20261116.sql
   两件事，一次做完（同一个用户口径）：

   ① 面板改名：「生产领料」→「生产领料明细表」(PROD_PICK_LIST, 只改显示名，数据源不动)
   ② 新增面板：「生产退料明细表」(PROD_RET_LIST) —— 与生产领料明细表成对，挂在
      WMS 管理 · 库存核算 · 单据组里，紧跟「生产领料明细表」。

   用户口径（2026-11-16）：
   「还有这个改成生产领料明细表，再加一个生产退料明细表
     （其实生产退料只用记录生成到生产退料单上的就行，不是每个单都有退料单的）。记录手机里面的单据。」

   ── 为什么退料明细表以 bd_material_ret / bl_material_ret 为源，而不是像领料那张读流水 ──
   生产领料明细表(PROD_PICK_LIST)读的是**出库流水** dbo.outh 的 src=6 段（材料出库流水）。
   退料这边**不能照抄这个套路去读全部领料单**，因为（用户原话）「不是每个单都有退料单的」：

   MobilePickController 2026-10-30 第三轮已把「生单时预生成一张 0 数量的退料草稿」废弃
   （历史空草稿由 migrate-wo-pick-return-20261030.sql 统一作废），改成**现场真退料时才按需生成**：
   点开一张已完成的领料单 → 扫码 → 填退料数量 → submitReturn 才 INSERT 一张生产退料单。
   所以「生产退料」这件事的**事实来源就是生产退料单本身**（bd_material_ret 头 + bl_material_ret 行），
   不是领料单、也不是流水段 —— 没有退料动作就没有这张单，天然满足「只记录生成到退料单上的」。
   ⇒ 本视图直接 SELECT 这两张表，**不 join 领料单**、不造行、不补 0。

   顺带把手机端最要紧的追溯键带出来：**工单号**（头表「加工单号」）。手机扫码是「扫工单号」起手的，
   2026-11-13 的 submitReturn 已把工单号 + 工单行号写到退料单上（用户口径「生产退料要有工单号和工单行号」），
   明细表不带这一列就等于把手机单据的来路抹掉 —— 故本面板比领料那张多一列「工单号」。

   面板字段（登记 19 列，其中 5 列按设计隐藏 ⇒ 列表展示 14 列）
   ─────────────────────────────────────────────
     可见：单据编号、单据日期、**工单号**、物料编码、物料名称、规格型号、计量单位、仓库名称、
           批号、数量、成本单价、成本金额、创建人(asp_user1)、创建时间(asp_time1)
     隐藏(登记但 visible=0，列设置里可放开)：单据类型（恒「生产退料」）、仓库编码（仓库名称已够辨仓）、
           经手人（头表「领用人」）、审核人 / 审核时间（手机端 submitReturn 提交即审核，恒有值但不常看）
   默认排序 = 单据日期 DESC, id DESC（QueryService.queryFlat 的「最新在最上面」口径）。
   成本单价/成本金额取行上的「单价/金额」（2026-11-13 起 submitReturn 按领料行的出库单价回填）；
   不是成本重算口径 —— 与生产领料明细表读流水同形同义。

   权限：只读 view,query[,export] —— 按现役「生产退料单明细表」MATERIAL_RET_DETAIL
         的可见角色等价补授（哪个角色能看那张，就能看这张），有 export 的才给 export；
         不授 add/modify/del/modlog/print，can_approve='N'。

   幂等范围：包装视图(CREATE OR ALTER)、PROD_PICK_LIST 显示名、本面板(yj_panel/yj_field)、
             译名(yj_translation)、角色授权(yj_role_panel)。
             已存在字段保留界面上的 alias/visible 手工调整（同 migrate-prod-pick-outh-20261022.sql 口径）。

   前置：dbo.bd_material_ret / dbo.bl_material_ret 存在且列齐（缺列直接报错，不凭空造表）。
         这两张表由 migrate-return-docs-20261113.sql 建立。
   执行：两个账套都要跑（先正式 HSDZ_MES、后测试 HSDZ_MES_TEST）
         cd tools && java -cp lib\mssql-jdbc.jar DbSync.java run migrate-prod-ret-list-20261116.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;

DECLARE @pickPanel   sysname       = N'PROD_PICK_LIST';
DECLARE @pickName    nvarchar(120) = N'生产领料明细表';
DECLARE @pickEn      nvarchar(400) = N'Production Picking Details';

DECLARE @panel       sysname       = N'PROD_RET_LIST';
DECLARE @panelName   nvarchar(120) = N'生产退料明细表';
DECLARE @panelEn     nvarchar(400) = N'Production Return Details';
DECLARE @line        sysname       = N'v_prod_ret_list';

BEGIN TRY
    BEGIN TRANSACTION;

    /* ═════════════════ ① 改名：生产领料 → 生产领料明细表 ═════════════════ */
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = @pickPanel)
        THROW 51000, N'找不到面板 PROD_PICK_LIST（生产领料明细表的前身）。请先确认 migrate-prod-pick-outh-20261022.sql 已执行。', 1;

    UPDATE dbo.yj_panel
       SET panel_name = @pickName, panel_name_en = @pickEn
     WHERE panel_code = @pickPanel;
    IF @@ROWCOUNT <> 1 THROW 51000, N'生产领料明细表改名时 yj_panel 行数异常。', 1;

    /* ═════════════════ ② 前置校验：两张源表必须在、要用的列必须齐 ═════════════════ */
    IF OBJECT_ID(N'dbo.bd_material_ret', N'U') IS NULL OR OBJECT_ID(N'dbo.bl_material_ret', N'U') IS NULL
        THROW 51000, N'找不到 dbo.bd_material_ret / dbo.bl_material_ret（生产退料单头/行表，由 migrate-return-docs-20261113.sql 建立）。', 1;

    DECLARE @need TABLE (tbl sysname, col sysname, PRIMARY KEY (tbl, col));
    INSERT INTO @need (tbl, col) VALUES
        (N'bd_material_ret', N'id'), (N'bd_material_ret', N'单据编号'), (N'bd_material_ret', N'单据日期'),
        (N'bd_material_ret', N'业务类型'), (N'bd_material_ret', N'加工单号'), (N'bd_material_ret', N'领用人'),
        (N'bd_material_ret', N'审核人'), (N'bd_material_ret', N'审核时间'),
        (N'bd_material_ret', N'asp_user1'), (N'bd_material_ret', N'asp_time1'), (N'bd_material_ret', N'asp_cancel'),
        (N'bl_material_ret', N'id'), (N'bl_material_ret', N'单据编号'), (N'bl_material_ret', N'材料编码'),
        (N'bl_material_ret', N'材料名称'), (N'bl_material_ret', N'规格型号'), (N'bl_material_ret', N'计量单位'),
        (N'bl_material_ret', N'仓库编码'), (N'bl_material_ret', N'仓库'), (N'bl_material_ret', N'批号'),
        (N'bl_material_ret', N'数量'), (N'bl_material_ret', N'单价'), (N'bl_material_ret', N'金额');

    -- ⚠ 两个账套兼容级别都是 100 ⇒ 不能用 STRING_AGG（110+ 才有），用 FOR XML PATH
    DECLARE @missing nvarchar(400) = (
        SELECT STUFF((SELECT N', ' + n.tbl + N'.' + n.col FROM @need n
                       WHERE COL_LENGTH(N'dbo.' + n.tbl, n.col) IS NULL
                       ORDER BY n.tbl, n.col FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N''));
    IF @missing IS NOT NULL
        THROW 51000, N'生产退料单源表缺少本面板要读的列（请先核对服务器表结构）。', 1;

    /* ═════════════════ ③ 只读包装视图：头 join 行，只留未删除 ═════════════════ */
    -- id 用 ROW_NUMBER 造（平表查询要 t.id 做分页与去重主键，与 v_material_ret_detail 同口径）。
    -- 不 join 领料单、不补 0 行：没有生产退料单的动作就不出现在这里（用户的「不是每个单都有退料单的」）。
    DECLARE @viewSql nvarchar(max) = N'
CREATE OR ALTER VIEW dbo.v_prod_ret_list
AS
SELECT ROW_NUMBER() OVER (ORDER BY h.id DESC, l.id) AS id,
       h.asp_cancel,
       h.[单据编号],
       h.[单据日期],
       h.[加工单号]        AS [工单号],
       h.[业务类型]        AS [单据类型],
       l.[材料编码]        AS [物料编码],
       l.[材料名称]        AS [物料名称],
       l.[规格型号],
       l.[计量单位],
       l.[仓库编码],
       l.[仓库]            AS [仓库名称],
       l.[批号],
       l.[数量],
       l.[单价]            AS [成本单价],
       l.[金额]            AS [成本金额],
       h.[领用人]          AS [经手人],
       h.asp_user1,
       h.asp_time1,
       h.[审核人],
       h.[审核时间]
  FROM dbo.bd_material_ret h
  LEFT JOIN dbo.bl_material_ret l ON l.[单据编号] = h.[单据编号]
 WHERE ISNULL(h.asp_cancel, N''N'') <> N''Y'';';
    EXEC sys.sp_executesql @viewSql;

    -- 视图中文注明（AGENTS：新增对象必须有 MS_Description）
    DECLARE @viewCmt nvarchar(400) =
        N'生产退料明细表只读视图：生产退料单(bd_material_ret)头 join 行表(bl_material_ret)，'
      + N'未删除的退料单逐行展开；字段与「生产退料明细表」面板(PROD_RET_LIST)一一对应。'
      + N'只列真实存在的退料单（手机扫码只在现场真退料时才生成退料单），源表不做任何改动。';
    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.v_prod_ret_list') AND minor_id = 0
                 AND name = N'MS_Description')
        EXEC sys.sp_updateextendedproperty N'MS_Description', @viewCmt,
            N'SCHEMA', N'dbo', N'VIEW', N'v_prod_ret_list';
    ELSE
        EXEC sys.sp_addextendedproperty N'MS_Description', @viewCmt,
            N'SCHEMA', N'dbo', N'VIEW', N'v_prod_ret_list';

    /* ═════════════════ ④ 面板行：flat + 报表 + WMS管理，数据源=包装视图 ═════════════════ */
    DECLARE @fresh bit = CASE WHEN EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = @panel) THEN 0 ELSE 1 END;

    IF @fresh = 1
        INSERT INTO dbo.yj_panel
          (panel_code, panel_name, category, mode, line_table, head_table, group_col,
           pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
        VALUES (@panel, @panelName, N'报表', 'flat', @line, NULL, NULL,
                N'id', NULL, NULL, N'单据日期', 50, N'items', N'WMS管理', @panelEn);

    -- module_group 用现役口径 N'WMS管理'（2026-10-20 由「WMS管理系统」改名后全库统一）
    UPDATE dbo.yj_panel
       SET panel_name = @panelName, panel_name_en = @panelEn, category = N'报表', mode = 'flat',
           line_table = @line, head_table = NULL, group_col = NULL, pk_col = N'id',
           code_col = NULL, prefix = NULL, date_col = N'单据日期', page_size = 50,
           detail_key = N'items', module_group = N'WMS管理', config = NULL, config_at = NULL
     WHERE panel_code = @panel;
    IF @@ROWCOUNT <> 1 THROW 51000, N'目标面板行数异常（yj_panel）。', 1;

    /* ═════════════════ ⑤ 字段：19 个显式声明（排法照生产领料明细表） ═════════════════ */
    -- ⚠ 列在不在列表里看的是 **visible**，不是 hidden：
    --   PanelConfigService.buildGridColumns 只按 visible 过滤（hidden 是编辑表格/表单那侧的开关，
    --   对平表列表不生效 —— 2026-10-22 实测：hidden=1 的列照旧出现在 gridTabs.columns 里）。
    -- visible 只在**首次插入**时按下面给的值落库；之后重跑不动 visible，用户在「列设置」里勾的显隐要留住。
    DECLARE @fields TABLE (
        seq int, col sysname, label nvarchar(120), dtype nvarchar(40),
        width int, place nvarchar(60), en nvarchar(400), shown bit, PRIMARY KEY (col));
    INSERT INTO @fields (seq, col, label, dtype, width, place, en, shown) VALUES
        ( 10, N'单据编号',  N'单据编号',  N'文本',     210, N'query,detail', N'Document No.',   1),
        ( 20, N'单据日期',  N'单据日期',  N'日期',     110, N'query,detail', N'Document Date',  1),
        ( 30, N'工单号',    N'工单号',    N'文本',     180, N'query,detail', N'Work Order No.', 1),
        ( 40, N'单据类型',  N'单据类型',  N'文本',     110, N'detail',       N'Document Type',  0),
        ( 50, N'物料编码',  N'物料编码',  N'文本',     150, N'query,detail', N'Material Code',  1),
        ( 60, N'物料名称',  N'物料名称',  N'文本',     220, N'query,detail', N'Material Name',  1),
        ( 70, N'规格型号',  N'规格型号',  N'文本',     200, N'detail',       N'Spec / Model',   1),
        ( 80, N'计量单位',  N'计量单位',  N'文本',      90, N'detail',       N'UOM',            1),
        ( 90, N'仓库编码',  N'仓库编码',  N'文本',     110, N'detail',       N'Warehouse Code', 0),
        (100, N'仓库名称',  N'仓库名称',  N'文本',     160, N'query,detail', N'Warehouse',      1),
        (110, N'批号',      N'批号',      N'文本',     140, N'query,detail', N'Lot No.',        1),
        (120, N'数量',      N'数量',      N'小数',     110, N'detail',       N'Quantity',       1),
        (130, N'成本单价',  N'成本单价',  N'小数',     110, N'detail',       N'Cost Price',     1),
        (140, N'成本金额',  N'成本金额',  N'小数',     120, N'detail',       N'Cost Amount',    1),
        (150, N'经手人',    N'经手人',    N'文本',     100, N'detail',       N'Handler',        0),
        (160, N'asp_user1', N'创建人',    N'文本',     100, N'query,detail', N'Created By',     1),
        (170, N'asp_time1', N'创建时间',  N'日期时间', 170, N'query,detail', N'Created At',     1),
        (180, N'审核人',    N'审核人',    N'文本',     100, N'detail',       N'Auditor',        0),
        (190, N'审核时间',  N'审核时间',  N'日期时间', 170, N'detail',       N'Audit Time',     0);

    -- 已存在→更新（**不动 visible**，保留用户在「列设置」里改的显隐与 alias）；缺失→插入；多余→清理
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

    /* ═════════════════ ⑥ 译名（多语言强制规范：新增/改名面板必须带译名，10 语） ═════════════════ */
    DECLARE @tr TABLE (scope varchar(20), ref_key nvarchar(400), locale varchar(10), text nvarchar(1000));

    -- ① 改名后的「生产领料明细表」
    INSERT INTO @tr VALUES
        ('panel', @pickName, 'en',    @pickEn),
        ('panel', @pickName, 'ja',    N'生産材料払出明細表'),
        ('panel', @pickName, 'ko',    N'생산 자재 출고 세부 목록'),
        ('panel', @pickName, 'zh-TW', N'生產領料明細表'),
        ('panel', @pickName, 'de',    N'Produktionsentnahme Details'),
        ('panel', @pickName, 'es',    N'Detalles de retirada de producción'),
        ('panel', @pickName, 'fr',    N'Détails du prélèvement de production'),
        ('panel', @pickName, 'ru',    N'Детали выдачи в производство'),
        ('panel', @pickName, 'th',    N'รายละเอียดการเบิกวัสดุการผลิต'),
        ('panel', @pickName, 'vi',    N'Chi tiết xuất vật tư sản xuất');

    -- ② 新面板「生产退料明细表」
    INSERT INTO @tr VALUES
        ('panel', @panelName, 'en',    @panelEn),
        ('panel', @panelName, 'ja',    N'生産材料返却明細表'),
        ('panel', @panelName, 'ko',    N'생산 자재 반납 세부 목록'),
        ('panel', @panelName, 'zh-TW', N'生產退料明細表'),
        ('panel', @panelName, 'de',    N'Produktionsrückgabe Details'),
        ('panel', @panelName, 'es',    N'Detalles de devolución de producción'),
        ('panel', @panelName, 'fr',    N'Détails du retour de production'),
        ('panel', @panelName, 'ru',    N'Детали возврата в производство'),
        ('panel', @panelName, 'th',    N'รายละเอียดการคืนวัสดุการผลิต'),
        ('panel', @panelName, 'vi',    N'Chi tiết trả vật tư sản xuất');

    -- ③ 字段标签：已登记过的（数量/批号/仓库…）不重复插；这里只补真正缺的（工单号等）
    INSERT INTO @tr (scope, ref_key, locale, text)
    SELECT DISTINCT 'field', s.label, 'en', s.en FROM @fields s;

    INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
    SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
      FROM @tr t
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                       WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);

    /* ═════════════════ ⑦ 角色授权：按「生产退料单明细表」等价补授，只读 ═════════════════ */
    INSERT INTO dbo.yj_role_panel (role_id, panel_code, perms, can_approve)
    SELECT r.id, @panel,
           CASE WHEN r.is_admin = 'Y' OR EXISTS (
                     SELECT 1 FROM dbo.yj_role_panel s
                      WHERE s.role_id = r.id AND s.panel_code = N'MATERIAL_RET_DETAIL'
                        AND ',' + REPLACE(ISNULL(s.perms, ''), ' ', '') + ',' LIKE '%,export,%')
                THEN 'view,query,export' ELSE 'view,query' END,
           'N'
      FROM dbo.yj_role r
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel t
                       WHERE t.role_id = r.id AND t.panel_code = @panel)
       AND (r.is_admin = 'Y' OR EXISTS (
                SELECT 1 FROM dbo.yj_role_panel s
                 WHERE s.role_id = r.id AND s.panel_code = N'MATERIAL_RET_DETAIL'
                   AND ',' + REPLACE(ISNULL(s.perms, ''), ' ', '') + ',' LIKE '%,view,%'));

    UPDATE dbo.yj_role_panel
       SET perms = CASE WHEN ',' + REPLACE(ISNULL(perms, ''), ' ', '') + ',' LIKE '%,export,%'
                        THEN 'view,query,export' ELSE 'view,query' END,
           can_approve = 'N'
     WHERE panel_code = @panel;

    /* ═════════════════ ⑧ 收尾守卫 ═════════════════ */
    IF (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = @panel) <> 19
        THROW 51000, N'生产退料明细表应登记 19 个只读字段。', 1;

    IF EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = @pickPanel AND panel_name <> @pickName)
        THROW 51000, N'生产领料明细表改名未生效。', 1;

    -- 只读口径：不可写、不必填、不走 hidden 隐藏；列都在视图上。
    -- ⚠ 这里**故意不校验 visible**：visible 是用户「列设置」的开关，放开/关掉都合法。
    IF EXISTS (SELECT 1 FROM dbo.yj_field f
                WHERE f.panel_code = @panel
                  AND (f.editable <> 0 OR f.required <> 0 OR f.hidden <> 0
                       OR COL_LENGTH(N'dbo.' + @line, f.col_name) IS NULL))
        THROW 51000, N'生产退料明细表字段配置异常（可写/必填/hidden/视图上不存在）。', 1;

    IF EXISTS (SELECT 1 FROM dbo.yj_role_panel
                WHERE panel_code = @panel
                  AND (perms NOT IN ('view,query', 'view,query,export') OR perms IS NULL
                       OR ISNULL(can_approve, 'N') <> 'N'))
        THROW 51000, N'生产退料明细表存在非只读授权。', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                    WHERE scope = 'panel' AND ref_key = @panelName AND locale = 'en' AND LEN(text) > 0)
        THROW 51000, N'生产退料明细表 en 译名缺失。', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                    WHERE scope = 'panel' AND ref_key = @pickName AND locale = 'en' AND LEN(text) > 0)
        THROW 51000, N'生产领料明细表 en 译名缺失。', 1;

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

/* ── ⑨ 结果自述（结果集而非 PRINT：SqlRunner/DbSync 只回显结果集） ────────── */
SELECT p.panel_code, p.panel_name, p.mode, p.category, p.line_table, p.module_group,
       p.date_col, p.page_size,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = p.panel_code) AS 字段数,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = p.panel_code AND f.visible = 1) AS 展示列数,
       (SELECT COUNT(*) FROM dbo.yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权角色数
  FROM dbo.yj_panel p WHERE p.panel_code IN (@pickPanel, @panel) ORDER BY p.panel_code;

SELECT N'视图行数=' + CAST(COUNT(*) AS nvarchar(20)) + N', 退料单数='
     + CAST(COUNT(DISTINCT 单据编号) AS nvarchar(20)) + N', 手机单据(有工单号)='
     + CAST(COUNT(DISTINCT CASE WHEN ISNULL(工单号, N'') <> N'' THEN 单据编号 END) AS nvarchar(20))
  FROM dbo.v_prod_ret_list;

SELECT N'RESULT: PROD-RET-LIST-READY' AS 结果;
