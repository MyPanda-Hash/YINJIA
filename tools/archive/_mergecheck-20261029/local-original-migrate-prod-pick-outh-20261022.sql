/* ============================================================================
   migrate-prod-pick-outh-20261022.sql
   生产领料只读报表面板(PROD_PICK_LIST)注册 —— 迁移链补登记(补写于 2026-10-25)。

   为什么现在才补这个脚本
   ─────────────────────
   该面板 2026-10-22 上线(frontend/src/business/menus.js:195-197 注释即指名本脚本),
   但全仓(git 历史 / tools/db-migrations.txt / yj_schema_log.script_name)三处都找不到
   这份脚本 —— 当时是链外手工执行、脚本遗失,迁移链从此无法重现这个面板。
   取证:tools/archive/_prod-pick-mig-20261025/recon1-*.out、recon2-*.out
   (两账套 yj_panel/yj_field/视图定义/授权/译名逐行导出,本脚本所有值照抄现役实况)。

   面板口径(与「混料记录」WO_MIXING_LIST 同款只读报表,menus.js:196)
   ────────────────────────────────────────────────────────
   · 数据源 dbo.outh 的 src=6 段(材料出库生成)且 asp_cancel<>'Y' 的流水行,
     经只读视图 dbo.v_prod_pick_list 暴露(flat 查询强依赖 id 列 ⇒ 直取 outh.id);
     源表 outh 是遗留在用表,本脚本**只读消费、一个字节不改**。
   · flat + category=报表 + module_group='WMS管理系统',不开放新增/保存/删除/审核。
   · 授权 view,query,export(只读);面板名译名 en/ja 已在两账套(yj_translation)。

   幂等范围与两账套现况
   ────────────────────
   · 本脚本 = INSERT-if-missing 型补登记:两账套(HSDZ_MES / HSDZ_MES_TEST)面板、
     视图、18 字段、译名、授权**均已链外存在**,重放除视图中文注明对齐外为 no-op;
   · 授权补授仅在「本面板 0 授权」的全新库上发生(按当时全部角色授只读)。
     现役实况保持原样:HSDZ_MES = 12 角色授 4(admin/user/xiaoshou/ckgl),
     HSDZ_MES_TEST = 7 角色授 7 —— 遗失脚本授予的是**执行当时**存在的角色,
     之后新建的角色不追授,本脚本不改动这笔账;
   · 前置:dbo.outh 及其中文业务列存在;缺失时 [SKIP] 退出(RESULT: SKIPPED-NO-SOURCE),
     绝不凭空造表。

   执行:DbSync run migrate-prod-pick-outh-20261022.sql(两账套)
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;

DECLARE @panel     sysname       = N'PROD_PICK_LIST';
DECLARE @panelName nvarchar(120) = N'生产领料';
DECLARE @panelEn   nvarchar(400) = N'Production Picking';
DECLARE @panelJa   nvarchar(400) = N'生産材料出庫';
DECLARE @viewDesc  nvarchar(600) = N'生产领料只读视图：dbo.outh 中 src=6（材料出库）且未删除的出库流水行，字段与「生产领料」面板(PROD_PICK_LIST)一一对应；源表 outh 不做任何改动。';

/* 前置:dbo.outh(遗留出库流水表)存在且含面板所需中文列 */
IF OBJECT_ID(N'dbo.outh', N'U') IS NULL
   OR EXISTS (SELECT 1 FROM (VALUES (N'单据编号'), (N'单据类型'), (N'单据日期'), (N'物料编码'),
                                      (N'物料名称'), (N'规格型号'), (N'计量单位'), (N'仓库编码'),
                                      (N'仓库名称'), (N'批号'), (N'数量'), (N'成本单价'),
                                      (N'成本金额'), (N'经手人'), (N'asp_user1'), (N'asp_user3'),
                                      (N'asp_time3'), (N'asp_cancel')) AS need(c)
               WHERE NOT EXISTS (SELECT 1 FROM sys.columns x
                                  WHERE x.object_id = OBJECT_ID(N'dbo.outh') AND x.name = need.c))
   OR NOT EXISTS (SELECT 1 FROM sys.columns x
                   WHERE x.object_id = OBJECT_ID(N'dbo.outh') AND x.name = N'src')
    GOTO skip_no_source;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ── 1. 只读视图:缺失才建(定义 = 2026-10-22 链外脚本原文,自两账套 sys.sql_modules 取证)── */
    IF OBJECT_ID(N'dbo.v_prod_pick_list', N'V') IS NULL
    BEGIN
        EXEC (N'CREATE VIEW dbo.v_prod_pick_list AS
SELECT o.id,
       o.[单据编号], o.[单据类型], o.[单据日期],
       o.[物料编码], o.[物料名称], o.[规格型号], o.[计量单位],
       o.[仓库编码], o.[仓库名称], o.[批号], o.[数量],
       o.[成本单价], o.[成本金额], o.[经手人],
       o.asp_user1, o.[单据日期] AS asp_time1, o.asp_user3, o.asp_time3
  FROM dbo.outh o
 WHERE o.src = 6
   AND ISNULL(o.asp_cancel, N''N'') <> N''Y'';');
    END

    /* 视图中文注明(幂等:有则更新无则加;两账套现役文本一致,此处对齐) */
    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.v_prod_pick_list')
                 AND minor_id = 0 AND name = N'MS_Description')
        EXEC sys.sp_updateextendedproperty N'MS_Description', @viewDesc,
             N'SCHEMA', N'dbo', N'VIEW', N'v_prod_pick_list';
    ELSE
        EXEC sys.sp_addextendedproperty N'MS_Description', @viewDesc,
             N'SCHEMA', N'dbo', N'VIEW', N'v_prod_pick_list';

    /* ── 2. 面板行(实况值;已存在不动 —— 现役行就是本脚本的参照源) ───────────── */
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = @panel)
        INSERT INTO dbo.yj_panel
          (panel_code, panel_name, category, mode, line_table, head_table, group_col,
           pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
        VALUES (@panel, @panelName, N'报表', 'flat', N'v_prod_pick_list', NULL, NULL,
                N'id', NULL, NULL, N'单据日期', 50, N'items', N'WMS管理系统', @panelEn);

    /* ── 3. 字段(18 行,逐列照抄两账套现役实况;INSERT-if-missing,已存在不覆盖)── */
    DECLARE @fields TABLE (
        col sysname PRIMARY KEY, label nvarchar(120), en nvarchar(400),
        dtype nvarchar(40), place nvarchar(60), seq int, width int, visible bit);
    INSERT INTO @fields (col, label, en, dtype, place, seq, width, visible) VALUES
        (N'单据编号',  N'单据编号',  N'Document No.',   N'文本',   N'query,detail',  10, 210, 1),
        (N'单据日期',  N'单据日期',  N'Document Date',  N'日期',   N'query,detail',  20, 110, 1),
        (N'单据类型',  N'单据类型',  N'Document Type',  N'文本',   N'detail',        30, 110, 0),
        (N'物料编码',  N'物料编码',  N'Material Code',  N'文本',   N'query,detail',  40, 150, 1),
        (N'物料名称',  N'物料名称',  N'Material Name',  N'文本',   N'query,detail',  50, 220, 1),
        (N'规格型号',  N'规格型号',  N'Spec / Model',   N'文本',   N'detail',        60, 200, 1),
        (N'计量单位',  N'计量单位',  N'UOM',            N'文本',   N'detail',        70,  90, 1),
        (N'仓库编码',  N'仓库编码',  N'Warehouse Code', N'文本',   N'detail',        80, 110, 0),
        (N'仓库名称',  N'仓库名称',  N'Warehouse',      N'文本',   N'query,detail',  90, 160, 1),
        (N'批号',      N'批号',      N'Lot No.',        N'文本',   N'query,detail', 100, 140, 1),
        (N'数量',      N'数量',      N'Quantity',       N'小数',   N'detail',       110, 110, 1),
        (N'成本单价',  N'成本单价',  N'Cost Price',     N'小数',   N'detail',       120, 110, 1),
        (N'成本金额',  N'成本金额',  N'Cost Amount',    N'小数',   N'detail',       130, 120, 1),
        (N'经手人',    N'经手人',    N'Handler',        N'文本',   N'detail',       140, 100, 0),
        (N'asp_user1', N'创建人',    N'Created By',     N'文本',   N'query,detail', 150, 100, 1),
        (N'asp_time1', N'创建时间',  N'Created At',     N'日期',   N'query,detail', 160, 170, 1),
        (N'asp_user3', N'审核人',    N'Auditor',        N'文本',   N'detail',       170, 100, 0),
        (N'asp_time3', N'审核时间',  N'Audit Time',     N'日期时间', N'detail',     180, 170, 0);

    INSERT INTO dbo.yj_field
      (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
       display_field, place, seq, width, editable, required, hidden, visible)
    SELECT @panel, s.col, s.label, s.en, s.dtype, NULL, NULL, NULL,
           NULL, s.place, s.seq, s.width, 0, 0, 0, s.visible
      FROM @fields s
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_field f
                       WHERE f.panel_code = @panel AND f.col_name = s.col);

    /* ── 4. 译名(多语言强制规范;INSERT-if-missing,现役已有 = no-op) ─────────── */
    INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
    SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
      FROM (VALUES ('panel', @panelName, 'en', @panelEn),
                   ('panel', @panelName, 'ja', @panelJa)) v (scope, ref_key, locale, text)
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                       WHERE x.scope = v.scope AND x.ref_key = v.ref_key AND x.locale = v.locale);

    /* 字段标签 en 兜底(同一中文标签全局共享;两账套 18 个标签 en 均已存在 ⇒ no-op) */
    INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
    SELECT DISTINCT 'field', s.label, 'en', s.en, 'manual'
      FROM @fields s
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                       WHERE x.scope = 'field' AND x.ref_key = s.label AND x.locale = 'en');

    /* ── 5. 授权:只在「本面板 0 授权」的全新库上按全部角色补授只读;现役授权不动 ── */
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code = @panel)
        INSERT INTO dbo.yj_role_panel (role_id, panel_code, perms, can_approve)
        SELECT r.id, @panel, 'view,query,export', 'N'
          FROM dbo.yj_role r;

    /* ── 6. 收尾守卫(结构自检;任一不过 = 本批回滚,不写 yj_schema_log) ────────── */
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel
                    WHERE panel_code = @panel AND mode = 'flat'
                      AND line_table = N'v_prod_pick_list' AND pk_col = N'id')
        THROW 51000, N'PROD_PICK_LIST 面板行缺失或形态不对（flat/v_prod_pick_list/id）。', 1;

    DECLARE @nfields int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = @panel);
    IF @nfields <> 18
    BEGIN
        DECLARE @msg nvarchar(500) = N'PROD_PICK_LIST 字段数应为 18，实际 '
                                   + CAST(@nfields AS nvarchar(10)) + N'。';
        THROW 51000, @msg, 1;
    END

    IF EXISTS (SELECT 1 FROM dbo.yj_field f
                WHERE f.panel_code = @panel
                  AND NOT EXISTS (SELECT 1 FROM sys.columns c
                                  WHERE c.object_id = OBJECT_ID(N'dbo.v_prod_pick_list')
                                    AND c.name = f.col_name))
        THROW 51000, N'PROD_PICK_LIST 存在视图上不存在的列，请核对 v_prod_pick_list。', 1;

    IF EXISTS (SELECT 1 FROM dbo.yj_field f
                WHERE f.panel_code = @panel AND (f.editable <> 0 OR f.required <> 0 OR f.hidden <> 0))
        THROW 51000, N'PROD_PICK_LIST 存在可写/必填/隐藏字段，只读报表不允许。', 1;

    IF EXISTS (SELECT 1 FROM dbo.yj_role_panel
                WHERE panel_code = @panel
                  AND (perms NOT IN ('view,query', 'view,query,export') OR perms IS NULL
                       OR ISNULL(can_approve, 'N') <> 'N'))
        THROW 51000, N'PROD_PICK_LIST 存在非只读授权。', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                    WHERE scope = 'panel' AND ref_key = @panelName AND locale = 'en' AND LEN(text) > 0)
        THROW 51000, N'生产领料面板 en 译名缺失。', 1;

    /* 冒烟:后端 queryFlat 同形态 SQL(id/列名/排序任一不对这里就炸) */
    DECLARE @smoke nvarchar(max) =
        N'SELECT TOP 5 t.id AS __id, t.[单据编号] AS [单据编号], t.[单据日期] AS [单据日期], '
      + N't.[物料编码] AS [物料编码], t.[数量] AS [数量] FROM dbo.v_prod_pick_list t '
      + N'ORDER BY t.[单据日期] DESC, t.id DESC;';
    EXEC sp_executesql @smoke;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ── 7. 结果自述(结果集而非 PRINT:SqlRunner/DbSync 只回显结果集) ───────────── */
SELECT p.panel_code, p.panel_name, p.mode, p.line_table, p.category, p.module_group,
       p.date_col, p.page_size,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = p.panel_code) AS 字段数,
       (SELECT COUNT(*) FROM dbo.yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权角色数,
       (SELECT COUNT(*) FROM dbo.yj_translation t
         WHERE t.scope = 'panel' AND t.ref_key = p.panel_name) AS 面板译名语言数
  FROM dbo.yj_panel p WHERE p.panel_code = @panel;
SELECT N'RESULT: PROD_PICK_LIST-READY' AS 结果;
GOTO done;

skip_no_source:
    SELECT N'RESULT: SKIPPED-NO-SOURCE' AS 结果,
           N'未找到 dbo.outh 或其面板所需列 —— 本脚本未创建任何对象、未改动任何数据。' AS 说明,
           N'SELECT name, type_desc FROM sys.objects WHERE name LIKE N''%outh%'';' AS 自查SQL,
           N'确认源表后重跑(DbSync run migrate-prod-pick-outh-20261022.sql)。' AS 下一步;

done:
    SET NOCOUNT OFF;
