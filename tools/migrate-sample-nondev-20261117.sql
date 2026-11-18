/* ============================================================================
 * migrate-sample-nondev-20261117.sql —— 新增「外部-非开发样品申请单」
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-17，Excel 跟踪表序号 14 / 第 16 行）：
 *   「复制一份样品-外部开发样品单页面及入口，将名称改为外部-非开发样品申请单。
 *     1. 审批流程要求：销售有权限录单（刘磊或王光珍审核）
 *     2. 其他人有查阅权限但不能修改内容。」
 *
 * 做法：**整表复制**「外部开发样品申请单 RD_SAMPLE_EXT」的结构与字段，
 *   换 panel_code / 表名 / 单号前缀，其余列与字段逐列对齐 —— 这样前端版式
 *   （DocSheet 的 sampleExtSheetCfg）可以直接复用，不必再写一套纸面。
 *
 * 面板码：RD_SAMPLE_ND      单号前缀：SPN2（非开发 = Non-Dev）
 *   前缀取 SPN2 而不是 SPW2：与既有 SPW（外部开发）/SPN（内部开发）区分，
 *   且 3 字符前缀是 yj_panel.prefix 的既有习惯（见 migrate-sample-dev-panels）。
 *
 * 权限（第 2 段口径）：
 *   · 销售可录单（add/modify/view/print/export）
 *   · 审核人是「刘磊 / 王光珍」→ 审批权走 yj_role_panel.can_approve，
 *     由组织架构里给对应角色勾「审核」，本脚本不硬写具体账号
 *   · 其他人只读 → 默认只给 view（查阅）
 *   本脚本只**建立权限行骨架**（每个角色一行、默认 view），
 *   具体勾选留给组织架构页面（用户口径「防止到时候勾选不了权限」——
 *   只要 yj_panel 有行，权限矩阵里就一定会出现这一项）。
 *
 * 幂等：全部 IF NOT EXISTS / COL_LENGTH 守卫；重复执行 0 行。
 * 两账套都执行（先正式 HSDZ_MES、后 HSDZ_MES_TEST）。
 * ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---------- ① 头表：复制 rd_sample_ext_head 的列结构 ---------- */
IF OBJECT_ID(N'dbo.rd_sample_nondev_head') IS NULL
BEGIN
    -- 用 SELECT INTO 复制结构（不复制数据、不复制索引），
    -- 再补回主键 identity —— SELECT INTO 会保留 identity 属性，故直接可用。
    SELECT TOP 0 * INTO dbo.rd_sample_nondev_head FROM dbo.rd_sample_ext_head;
    PRINT N'① 已建 rd_sample_nondev_head（结构复制自 rd_sample_ext_head）';
END
ELSE PRINT N'① rd_sample_nondev_head 已存在，跳过';
GO

/* ---------- ② 明细表：复制 rd_sample_ext_detail ---------- */
IF OBJECT_ID(N'dbo.rd_sample_nondev_detail') IS NULL
BEGIN
    SELECT TOP 0 * INTO dbo.rd_sample_nondev_detail FROM dbo.rd_sample_ext_detail;
    PRINT N'② 已建 rd_sample_nondev_detail（结构复制自 rd_sample_ext_detail）';
END
ELSE PRINT N'② rd_sample_nondev_detail 已存在，跳过';
GO

/* ---------- ③ 表注明（规范：新增表必须带中文注明） ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.rd_sample_nondev_head') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'（外部）非开发样品申请单-头（研发管理·样品）。版式与「外部开发样品申请单」一致；销售录单、刘磊/王光珍审核、其他人只读。',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_sample_nondev_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.rd_sample_nondev_detail') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'（外部）非开发样品申请单-明细（研发管理·样品）。',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_sample_nondev_detail';
PRINT N'③ 表注明已写入';
GO

/* ---------- ④ 面板登记（关键：有了 yj_panel 行，组织架构权限矩阵才勾得到） ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'RD_SAMPLE_ND')
BEGIN
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table,
                          group_col, pk_col, code_col, prefix, date_col, page_size,
                          detail_key, module_group)
    VALUES (N'RD_SAMPLE_ND', N'外部-非开发样品申请单', N'单据', N'doc',
            N'rd_sample_nondev_detail', N'rd_sample_nondev_head',
            N'单据编号', N'id', N'单据编号', N'SPN2', N'单据日期', 20,
            N'items', N'研发管理');
    PRINT N'④ 面板 RD_SAMPLE_ND 已登记';
END
ELSE PRINT N'④ 面板 RD_SAMPLE_ND 已存在，跳过';
GO

/* ---------- ⑤ 字段：逐列复制 RD_SAMPLE_EXT 的 yj_field（表头） ---------- */
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                      editable, required, hidden, visible, dict_sql,
                      ref_panel, ref_field, display_field)
SELECT N'RD_SAMPLE_ND', f.col_name, f.label, f.data_type, f.place, f.seq,
       f.editable, f.required, f.hidden, f.visible, f.dict_sql,
       f.ref_panel, f.ref_field, f.display_field
FROM yj_field f
WHERE f.panel_code = N'RD_SAMPLE_EXT'
  AND NOT EXISTS (SELECT 1 FROM yj_field x
                  WHERE x.panel_code = N'RD_SAMPLE_ND' AND x.label = f.label);
PRINT N'⑤ 字段复制行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ⑥ 明细字段：复制 place='detail' 的那批（若与表头同源则上一步已含） ---------- */
-- RD_SAMPLE_EXT 的 yj_field 既有 header 也有 detail（明细列按 place 区分），
-- 上面那条按 label 去重复制，已把两种 place 都带过来；这里只做**校验**。
DECLARE @hdr INT = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'RD_SAMPLE_ND' AND place = N'header');
DECLARE @dtl INT = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'RD_SAMPLE_ND' AND place = N'detail');
PRINT N'⑥ 校验：表头字段 ' + CAST(@hdr AS nvarchar(10)) + N' 个，明细字段 ' + CAST(@dtl AS nvarchar(10)) + N' 个';
IF @hdr = 0
    RAISERROR(N'[sample-nondev] 表头字段为 0，复制失败（RD_SAMPLE_EXT 的字段是否还在？）', 16, 1);
GO

/* ---------- ⑦ 译名（多语言强制规范：新增面板 + 字段至少 en） ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'外部-非开发样品申请单' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'panel', N'外部-非开发样品申请单', N'en', N'External Non-Development Sample Request', N'manual');
PRINT N'⑦ 面板译名已写入';
GO

/* ---------- ⑧ 权限行骨架（每个角色一行，默认只读查阅） ----------
 * 用户口径：「销售有权限录单，其他人有查阅权限但不能修改内容」
 * 本脚本**不猜测哪个角色是"销售"** —— 角色是业务配置，由组织架构页面勾。
 * 这里只保证：每个已启用角色都有这一行（perms='view'），这样：
 *   · 权限矩阵一定能勾到本面板（不会出现"面板都没有，勾不了"）；
 *   · 默认全员只读，符合"其他人有查阅权限但不能修改"；
 *   · 给销售角色勾 add/modify 即完成"销售可录单"。
 * ⚠ perms 只填 'view'，can_approve 留 'N'（审核由刘磊/王光珍，属具体人员配置）。
 * --------------------------------------------------------------------------- */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'RD_SAMPLE_ND', N'N', N'view'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p
                  WHERE p.role_id = r.id AND p.panel_code = N'RD_SAMPLE_ND');
PRINT N'⑧ 权限行骨架 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个角色';
GO

/* ---------- ⑨ 自检 ---------- */
IF OBJECT_ID(N'dbo.rd_sample_nondev_head') IS NULL
    RAISERROR(N'[sample-nondev] 自检失败：头表未建', 16, 1);
IF OBJECT_ID(N'dbo.rd_sample_nondev_detail') IS NULL
    RAISERROR(N'[sample-nondev] 自检失败：明细表未建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'RD_SAMPLE_ND')
    RAISERROR(N'[sample-nondev] 自检失败：面板未登记（组织架构里将勾不到权限）', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_SAMPLE_ND' AND place = N'header')
    RAISERROR(N'[sample-nondev] 自检失败：表头字段为空', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = N'RD_SAMPLE_ND')
    RAISERROR(N'[sample-nondev] 自检失败：无任何角色权限行', 16, 1);
PRINT N'[sample-nondev] 自检通过：表/面板/字段/权限行齐备。';
GO
