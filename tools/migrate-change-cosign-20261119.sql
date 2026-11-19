/*
 * migrate-change-cosign-20261119.sql
 *
 * 目的：产品变更申请表（RD_CHANGE）「会签人填本部门评审意见 + 管理员终审」的元数据/列基线。
 *
 * 用户口径（2026-11-19）：
 *   「产品变更申请表，现在会签人只能点会签通过，但是不能填对应的部门评审意见，
 *     所有会签人会签通过之后，由管理员进行一个最终的审批然后归档，
 *     管理员的签字日期也要显示在这里」
 *
 * 本脚本只做**幂等的基线补齐**，不新增业务状态列：
 *   · 会签状态沿用 yj_form_approval(action='SIGNOFF') 的 PENDING/APPROVED；
 *   · 「待批准」沿用 yj_doc_status.pending='Y' + approve_node=2（两级审批的既有写法），
 *     无新列、无新状态机；
 *   · 批准三格沿用 rd_change_head 备用列池（2026-11-11 已登记：备用2/3/4）。
 *
 * 补齐内容：
 *   ① rd_change_detail 的部门评审列（表区/部门/变更后内容/签字/日期/备注）缺则加；
 *   ② 上述明细列的 yj_field 登记（place=detail/可编辑/可见）；
 *   ③ 批准人/批准签字/批准日期 三格 yj_field 只读登记 + en 译名；
 *   ④ 动过的列补/更新 MS_Description（2026-09-28 体检留下的
 *      「历史遗留英文列、本表该列全空」注释已与实际相反，必须改正）；
 *   ⑤ 自检。
 *
 * 幂等：全部带 COL_LENGTH / NOT EXISTS 守卫，重复执行无副作用。
 * 执行：两个账套都要跑（HSDZ_MES / HSDZ_MES_TEST）。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ── ⓪ 前置对象 ─────────────────────────────────────────────────────────── */
IF OBJECT_ID(N'rd_change_detail') IS NULL
BEGIN
    RAISERROR(N'[change-cosign] 缺表 rd_change_detail，请先跑面板基线迁移', 16, 1);
    RETURN;
END
IF OBJECT_ID(N'rd_change_head') IS NULL
BEGIN
    RAISERROR(N'[change-cosign] 缺表 rd_change_head，请先跑面板基线迁移', 16, 1);
    RETURN;
END
IF OBJECT_ID(N'yj_field') IS NULL
BEGIN
    RAISERROR(N'[change-cosign] 缺表 yj_field', 16, 1);
    RETURN;
END

/* ── ① 缺列才加（动态 SQL：列名在解析期不存在时静态语句会 207）────────── */
IF COL_LENGTH('rd_change_detail', '表区') IS NULL
    EXEC(N'ALTER TABLE rd_change_detail ADD [表区] nvarchar(20) NULL');
IF COL_LENGTH('rd_change_detail', '部门') IS NULL
    EXEC(N'ALTER TABLE rd_change_detail ADD [部门] nvarchar(60) NULL');
IF COL_LENGTH('rd_change_detail', '变更后内容') IS NULL
    EXEC(N'ALTER TABLE rd_change_detail ADD [变更后内容] nvarchar(2000) NULL');
IF COL_LENGTH('rd_change_detail', '签字') IS NULL
    EXEC(N'ALTER TABLE rd_change_detail ADD [签字] nvarchar(60) NULL');
IF COL_LENGTH('rd_change_detail', '日期') IS NULL
    EXEC(N'ALTER TABLE rd_change_detail ADD [日期] nvarchar(40) NULL');
IF COL_LENGTH('rd_change_detail', '备注') IS NULL
    EXEC(N'ALTER TABLE rd_change_detail ADD [备注] nvarchar(500) NULL');

/* 批准三格：2026-11-11 的 migrate-rd-change-approval-sign-20261111.sql 已建；
   这里再守一次，保证单独部署本脚本也不会缺列。 */
IF COL_LENGTH('rd_change_head', '备用2') IS NULL
    EXEC(N'ALTER TABLE rd_change_head ADD [备用2] nvarchar(500) NULL');
IF COL_LENGTH('rd_change_head', '备用3') IS NULL
    EXEC(N'ALTER TABLE rd_change_head ADD [备用3] nvarchar(500) NULL');
IF COL_LENGTH('rd_change_head', '备用4') IS NULL
    EXEC(N'ALTER TABLE rd_change_head ADD [备用4] nvarchar(500) NULL');
GO

SET NOCOUNT ON;

/* ── ② 明细字段登记（部门评审意见那一张表）──────────────────────────────── */
DECLARE @detail TABLE (label nvarchar(60) PRIMARY KEY, col nvarchar(20), seq int);
INSERT INTO @detail (label, col, seq) VALUES
    (N'表区',       N'表区',       4),
    (N'部门',       N'部门',       10),
    (N'变更后内容', N'变更后内容', 20),
    (N'签字',       N'签字',       30),
    (N'日期',       N'日期',       40);

INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, editable, required, hidden, visible)
SELECT N'RD_CHANGE', d.col, d.label, N'文本', N'detail', d.seq, 1, 0, 0, 1
FROM @detail d
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'RD_CHANGE' AND x.col_name = d.col);

/* 已存在但被改坏（隐藏/不可见/必填/位置不对）的拉回本功能需要的口径。
   ⚠ 只动这五列，不碰 dict_sql/ref_* 等业务配置。 */
UPDATE f
   SET label = d.label, place = N'detail', seq = d.seq,
       editable = 1, required = 0, hidden = 0, visible = 1
FROM yj_field f
JOIN @detail d ON d.col = f.col_name
WHERE f.panel_code = N'RD_CHANGE'
  AND (ISNULL(f.label, N'') <> d.label OR ISNULL(f.place, N'') <> N'detail'
       OR ISNULL(f.seq, -1) <> d.seq OR ISNULL(f.editable, 0) <> 1
       OR ISNULL(f.required, 0) <> 0 OR ISNULL(f.hidden, 0) <> 0 OR ISNULL(f.visible, 0) <> 1);
PRINT '[change-cosign] rd_change_detail 字段登记完成';

/* ── ③ 批准三格：字段只读 + en 译名 ─────────────────────────────────────── */
DECLARE @approve TABLE (label nvarchar(60) PRIMARY KEY, col nvarchar(20), seq int, en nvarchar(60));
INSERT INTO @approve (label, col, seq, en) VALUES
    (N'批准人',   N'备用2', 300, N'Approved by'),
    (N'批准签字', N'备用3', 310, N'Approval signature'),
    (N'批准日期', N'备用4', 320, N'Approval date');

INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, place, seq, editable, required, hidden, visible)
SELECT N'RD_CHANGE', a.col, a.label, a.en, N'文本', N'header', a.seq, 0, 0, 0, 1
FROM @approve a
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'RD_CHANGE' AND x.col_name = a.col);

UPDATE f
   SET label = a.label, place = N'header', seq = a.seq,
       editable = 0, required = 0, hidden = 0, visible = 1
FROM yj_field f
JOIN @approve a ON a.col = f.col_name
WHERE f.panel_code = N'RD_CHANGE'
  AND (ISNULL(f.label, N'') <> a.label OR ISNULL(f.place, N'') <> N'header'
       OR ISNULL(f.seq, -1) <> a.seq OR ISNULL(f.editable, 1) <> 0
       OR ISNULL(f.required, 0) <> 0 OR ISNULL(f.hidden, 0) <> 0 OR ISNULL(f.visible, 0) <> 1);
PRINT '[change-cosign] 批准三格字段登记完成';

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', a.label, N'en', a.en, N'manual'
FROM @approve a
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = N'field' AND t.ref_key = a.label AND t.locale = N'en');
PRINT '[change-cosign] en 译名补齐完成';

/* ── ④ 列注明（数据库规范：动过的列要能说清用途）───────────────────────── */
DECLARE @docs TABLE (tbl sysname, col sysname, descr nvarchar(300));
INSERT INTO @docs (tbl, col, descr) VALUES
    (N'rd_change_detail', N'表区',       N'产品变更申请表·表区分区值（部门评审意见）'),
    (N'rd_change_detail', N'部门',       N'部门评审意见·部门（预置行来自 yj_change_dept；会签人只能填本部门行）'),
    (N'rd_change_detail', N'变更后内容', N'部门评审意见·变更/新增申请内容（本部门会签人在会签中填写）'),
    (N'rd_change_detail', N'签字',       N'部门评审意见·会签人签字（保存/会签通过时按账号姓名自动盖章，接口载荷不可伪造）'),
    (N'rd_change_detail', N'日期',       N'部门评审意见·会签日期（自动写当天）'),
    (N'rd_change_detail', N'备注',       N'部门评审意见·备注（纸面未展示，按行留档）'),
    (N'rd_change_head',   N'备用2',      N'批准人（admin 最终批准时自动写入姓名，纸面只读）'),
    (N'rd_change_head',   N'备用3',      N'批准签字（与批准人同源，自动写入，纸面只读）'),
    (N'rd_change_head',   N'备用4',      N'批准日期（admin 最终批准当天，自动写入，纸面只读）');

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, descr FROM @docs;
DECLARE @tbl sysname, @col sysname, @descr nvarchar(300);
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col, @descr;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(@tbl, @col) IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                       WHERE major_id = OBJECT_ID(@tbl)
                         AND minor_id = COLUMNPROPERTY(OBJECT_ID(@tbl), @col, 'ColumnId')
                         AND name = 'MS_Description')
            EXEC sp_addextendedproperty N'MS_Description', @descr,
                 N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
        ELSE
            EXEC sp_updateextendedproperty N'MS_Description', @descr,
                 N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    END
    FETCH NEXT FROM cur INTO @tbl, @col, @descr;
END
CLOSE cur; DEALLOCATE cur;
PRINT '[change-cosign] 列注明更新完成';

/* ── ⑤ 自检 ─────────────────────────────────────────────────────────────── */
DECLARE @missing_cols INT = 0;
IF COL_LENGTH('rd_change_detail', '变更后内容') IS NULL SET @missing_cols += 1;
IF COL_LENGTH('rd_change_detail', '部门') IS NULL SET @missing_cols += 1;
IF COL_LENGTH('rd_change_detail', '签字') IS NULL SET @missing_cols += 1;
IF COL_LENGTH('rd_change_detail', '日期') IS NULL SET @missing_cols += 1;
IF COL_LENGTH('rd_change_head', '备用2') IS NULL SET @missing_cols += 1;
IF COL_LENGTH('rd_change_head', '备用3') IS NULL SET @missing_cols += 1;
IF COL_LENGTH('rd_change_head', '备用4') IS NULL SET @missing_cols += 1;
IF @missing_cols > 0
BEGIN
    RAISERROR(N'[change-cosign] 自检失败：还有 %d 个物理列缺失', 16, 1, @missing_cols);
    RETURN;
END

DECLARE @missing_fields INT =
    (SELECT COUNT(*) FROM @detail d
      WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'RD_CHANGE' AND x.col_name = d.col))
  + (SELECT COUNT(*) FROM @approve a
      WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'RD_CHANGE' AND x.col_name = a.col));
IF @missing_fields > 0
BEGIN
    RAISERROR(N'[change-cosign] 自检失败：还有 %d 个 yj_field 没登记', 16, 1, @missing_fields);
    RETURN;
END

DECLARE @bad_approve INT = (SELECT COUNT(*) FROM yj_field f JOIN @approve a ON a.col = f.col_name
    WHERE f.panel_code = N'RD_CHANGE' AND (ISNULL(f.editable, 1) <> 0 OR ISNULL(f.visible, 0) <> 1));
IF @bad_approve > 0
BEGIN
    RAISERROR(N'[change-cosign] 自检失败：%d 个批准格不是“只读可见”', 16, 1, @bad_approve);
    RETURN;
END

DECLARE @bad_detail INT = (SELECT COUNT(*) FROM yj_field f JOIN @detail d ON d.col = f.col_name
    WHERE f.panel_code = N'RD_CHANGE' AND (ISNULL(f.editable, 0) <> 1 OR ISNULL(f.visible, 0) <> 1));
IF @bad_detail > 0
BEGIN
    RAISERROR(N'[change-cosign] 自检失败：%d 个部门评审字段不是“可编辑可见”', 16, 1, @bad_detail);
    RETURN;
END

PRINT '[change-cosign] 自检通过：部门评审列/字段与批准三格均已就位（幂等，可重复执行）。';
