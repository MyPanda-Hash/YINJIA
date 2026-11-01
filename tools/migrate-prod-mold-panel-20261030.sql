/* ============================================================================
   migrate-prod-mold-panel-20261030.sql
   ── 生产模具表（系统管理平台 / 设备维护）──────────────────────────────────────
   ============================================================================
   【用户口径 2026-10-30】
     「在设备维护下边加上一个新面板，叫生产模具表，字段有上面这些，不需要审批，
       就是一个维护表，不需要多单据，数据量不多，就放一张表就行，根据现在系统上有的进行设计」
     字段：炭棒尺寸 / 外模规格 / 炭棒外径尺寸 / 炭棒外径公差 / 中心杆规格 /
           炭棒内径尺寸 / 炭棒内径公差 / 可生产炭棒长度范围 / 模具数量
     截图批注：「1-7号车间每个车间一张表」⇒ 一张表按**车间**分列，筛选即按车间看。

   【为什么复用 rd_sinter_tolerance，而不是另建一张表】
     系统里已经有「烧结尺寸表」RD_SINTER_TOL（migrate-sinter-tolerance.sql），
     物理表 rd_sinter_tolerance 的列正是这批内容，且**已有 60 行真实数据**（车间 1 / 1-3 / 3 / 4）：
       车间 · 型号 · 模具尺寸 · 中心杆尺寸 · 炭棒外径 · 炭棒外径公差 ·
       炭棒内径 · 炭棒内径公差 · 长度范围 · 停用
     另建表 = 同一批模具有两份台账，早晚对不上。故这里只做两件事：
       ① 补一列 [模具数量]（用户列表里唯一缺的）；
       ② 在**同一张表**上登记新面板 PROD_MOLD，label 用用户口径（col_name 保持物理列名不变，
          这样烧结配方那条链按 车间+型号 取数的口径一个字都不用改）。
     车间字段已存在，值按现有数据结构留存（1 / 1-3 / 3 / 4 …），不强行改写成「1号车间」。

   【面板形态】mode='archive' = 维护表：无单据头、无审批流、无单据号，列表 + 内联编辑，
     与 设备点检记录(EQUIP_CHECK)/保养计划(MAINT_PLAN) 同组挂在「设备维护」下。

   【幂等】列/面板/字段/译名/授权全部按存在判；重复执行不报错、不重插。
   两个账套都要执行（先 HSDZ_MES 后 HSDZ_MES_TEST），须带 QUOTED_IDENTIFIER ON（sqlcmd -I）。
   ============================================================================ */

SET NOCOUNT ON;
GO

/* ── ① 补列：模具数量（用户字段清单里唯一缺的）────────────────────────────── */
IF COL_LENGTH('rd_sinter_tolerance', '模具数量') IS NULL
BEGIN
    ALTER TABLE rd_sinter_tolerance ADD [模具数量] int NULL;
    PRINT N'migrate-prod-mold-panel-20261030.sql:已加列 rd_sinter_tolerance.模具数量';
END
ELSE PRINT N'migrate-prod-mold-panel-20261030.sql:列 模具数量 已存在';
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_sinter_tolerance')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_sinter_tolerance'), '模具数量', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'该车间这台模具的现有数量(套)', N'SCHEMA', N'dbo', N'TABLE', N'rd_sinter_tolerance', N'COLUMN', N'模具数量';
GO

/* ── ② 登记面板：生产模具表（维护表形态）──────────────────────────────────── */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'PROD_MOLD')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col,
                          pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('PROD_MOLD', N'生产模具表', N'基础设置', 'archive', 'rd_sinter_tolerance', NULL, NULL,
            'id', N'型号', NULL, NULL, 50, 'items', N'系统管理平台', 'Production Mold Table');
GO

/* ── ③ 字段登记（label = 用户口径；col_name = 物理列，两者不同是既有机制）────
   place 口径照 RD_SINTER_TOL：标识列 query+detail（列表可筛），公差/数量只进表单明细 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'车间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'车间', N'车间', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 90, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'型号', N'炭棒尺寸', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 130, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'模具尺寸')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'模具尺寸', N'外模规格', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 30, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'中心杆尺寸')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'中心杆尺寸', N'中心杆规格', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 40, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'炭棒外径')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'炭棒外径', N'炭棒外径尺寸', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 50, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'炭棒外径公差')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'炭棒外径公差', N'炭棒外径公差', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'炭棒内径')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'炭棒内径', N'炭棒内径尺寸', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 70, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'炭棒内径公差')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'炭棒内径公差', N'炭棒内径公差', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'长度范围')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'长度范围', N'可生产炭棒长度范围', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 90, 170, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'模具数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'模具数量', N'模具数量', N'整数', NULL, NULL, NULL, NULL, N'query,detail', 100, 90, 1, 0, 0, 1);
GO

/* ⚠ data_type 必须是引擎认识的枚举：文本/多行文本/整数/小数/数值/日期/日期时间/是否/下拉框/参照/
   标准库/附件/分区选择/时间区间。首版误写成「数字」⇒ 前端整张表**一列都不渲染**（面板空白）。
   这里自愈一次，改文件后重跑迁移即修复。 */
UPDATE yj_field SET data_type = N'整数'
 WHERE panel_code = 'PROD_MOLD' AND col_name = N'模具数量' AND data_type <> N'整数';
GO

/* ── ④ 译名（AGENTS 红线：新面板/新 label 必须带 en，其余语言由机翻兜底）──── */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'生产模具表' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'生产模具表', 'en', N'Production Mold Table', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'炭棒尺寸' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒尺寸', 'en', N'Rod Size', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'外模规格' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'外模规格', 'en', N'Outer Die Spec', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'中心杆规格' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'中心杆规格', 'en', N'Core Rod Spec', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'炭棒外径尺寸' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒外径尺寸', 'en', N'Rod OD (mm)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'炭棒外径公差' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒外径公差', 'en', N'Rod OD Tolerance', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'炭棒内径尺寸' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒内径尺寸', 'en', N'Rod ID (mm)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'炭棒内径公差' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒内径公差', 'en', N'Rod ID Tolerance', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'可生产炭棒长度范围' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'可生产炭棒长度范围', 'en', N'Rod Length Range', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'模具数量' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'模具数量', 'en', N'Mold Quantity', 'manual');
GO

/* ── ⑤ 角色授权：与同组维护表（设备点检/保养计划/烧结尺寸表）一致 ─────────── */
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = 'PROD_MOLD' AND role_id = 1)
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, 'PROD_MOLD', 0, 'view,query');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = 'PROD_MOLD' AND role_id = 2)
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, 'PROD_MOLD', 0, 'view,query');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = 'PROD_MOLD' AND role_id = 4)
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (4, 'PROD_MOLD', 0, 'view,query');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = 'PROD_MOLD' AND role_id = 5)
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (5, 'PROD_MOLD', 0, 'view,query');
GO

/* ── 核验 ─────────────────────────────────────────────────────────────────── */
SELECT CASE WHEN COL_LENGTH('rd_sinter_tolerance','模具数量') IS NULL THEN N'FAIL 列未加上' ELSE N'OK 列已就绪' END AS 列检查;
SELECT COUNT(*) AS 面板登记 FROM yj_panel WHERE panel_code = 'PROD_MOLD';
SELECT COUNT(*) AS 字段登记 FROM yj_field WHERE panel_code = 'PROD_MOLD';
SELECT COUNT(*) AS 授权行 FROM yj_role_panel WHERE panel_code = 'PROD_MOLD';
SELECT seq, col_name, label FROM yj_field WHERE panel_code = 'PROD_MOLD' ORDER BY seq;
GO
