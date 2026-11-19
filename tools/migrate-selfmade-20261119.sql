/* ============================================================================
 * migrate-selfmade-20261119.sql —— 研发管理 · 自制料（制程记录录入 + 查询）
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-19，桌面《新建 XLS 工作表.xls》两个页签）：
 *   ① 制程记录录入：材料名 / 主批次 / 子批次(自动生成 主批次-1…-N) / 流程卡(图片·文件)
 *      / 配料表(图片·文件) / 异常情况描述 / 录入人(默认练庆文)；无审批、可修改。
 *   ② 记录查询：按材料名 + 批次起止查，列出 主批次/子批次/流程卡/配料表/异常描述/录入人/「录入日期」；
 *      需要导出 Excel 与打印；录入后打印**二维码**（内容 = 材料名 + 主批次）交仓库入库。
 *   补充确认：材料名/主批次都**手填**（不接物料档案）；子批次最少 1 行、最多 10 行；
 *   所有有录入权的人都能改任意一条；菜单新建二级分组「自制料」（与「样品」平级）。
 *
 * 表设计（沿用仓库规范：rd_ 前缀 + 单据编号分组列 + asp_* 审计列 + 中文 MS_Description）：
 *   rd_selfmade_head    一条 = 一个主批次（材料名 + 主批次 + 录入人 + 日期）
 *   rd_selfmade_detail  一行 = 一个子批次（流程卡/配料表两格附件 + 异常描述）
 *
 * 幂等：全部 IF OBJECT_ID / NOT EXISTS 守卫；两账套都执行。
 * ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---------- ① 头表 ---------- */
IF OBJECT_ID(N'dbo.rd_selfmade_head') IS NULL
BEGIN
    CREATE TABLE dbo.rd_selfmade_head (
        id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_rd_selfmade_head PRIMARY KEY,
        [单据编号]   nvarchar(60)  NOT NULL,
        [单据日期]   date          NULL,
        [材料名]     nvarchar(100) NULL,
        [主批次]     nvarchar(60)  NULL,
        [录入人]     nvarchar(50)  NULL,
        [备注]       nvarchar(500) NULL,
        asp_user1   nvarchar(50)  NULL,
        asp_time1   datetime      NULL CONSTRAINT DF_rd_selfmade_head_t1 DEFAULT (GETDATE()),
        asp_user2   nvarchar(50)  NULL,
        asp_time2   datetime      NULL,
        asp_cancel  char(1)       NULL CONSTRAINT DF_rd_selfmade_head_cancel DEFAULT ('N')
    );
    CREATE UNIQUE INDEX UX_rd_selfmade_head_no ON dbo.rd_selfmade_head([单据编号]);
    PRINT N'① 已建 rd_selfmade_head';
END
ELSE PRINT N'① rd_selfmade_head 已存在，跳过';
GO

/* ---------- ② 明细表 ---------- */
IF OBJECT_ID(N'dbo.rd_selfmade_detail') IS NULL
BEGIN
    CREATE TABLE dbo.rd_selfmade_detail (
        id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_rd_selfmade_detail PRIMARY KEY,
        [单据编号]     nvarchar(60)  NOT NULL,
        [序号]         nvarchar(10)  NULL,
        [子批次]       nvarchar(60)  NULL,
        [流程卡]       nvarchar(500) NULL,
        [配料表]       nvarchar(500) NULL,
        [异常情况描述]  nvarchar(1000) NULL,
        asp_user1     nvarchar(50)  NULL,
        asp_time1     datetime      NULL CONSTRAINT DF_rd_selfmade_detail_t1 DEFAULT (GETDATE()),
        asp_user2     nvarchar(50)  NULL,
        asp_time2     datetime      NULL,
        asp_cancel    char(1)       NULL CONSTRAINT DF_rd_selfmade_detail_cancel DEFAULT ('N')
    );
    CREATE INDEX IX_rd_selfmade_detail_no ON dbo.rd_selfmade_detail([单据编号]);
    PRINT N'② 已建 rd_selfmade_detail';
END
ELSE PRINT N'② rd_selfmade_detail 已存在，跳过';
GO

/* ---------- ③ 表/列中文注明 ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.rd_selfmade_head') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'自制料-制程记录录入-头（研发管理·自制料）。一条=一个主批次。',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_selfmade_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.rd_selfmade_detail') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'自制料-制程记录录入-明细（研发管理·自制料）。一行=一个子批次，流程卡/配料表为附件格。',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_selfmade_detail';
PRINT N'③ 表注明已写入';
GO

/* ---------- ④ 面板登记 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'RD_SELFMADE')
BEGIN
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table,
                          group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
    VALUES (N'RD_SELFMADE', N'自制料-制程记录录入', N'单据', N'doc',
            N'rd_selfmade_detail', N'rd_selfmade_head',
            N'单据编号', N'id', N'单据编号', N'ZL', N'单据日期', 20, N'items', N'研发管理');
    PRINT N'④ 面板 RD_SELFMADE 已登记';
END
ELSE PRINT N'④ 面板已存在，跳过';
GO

/* ---------- ⑤ 字段 ---------- */
DECLARE @f TABLE (
    col sysname, lbl nvarchar(100), dtype nvarchar(30), place varchar(10), seq int,
    editable bit, required bit, width int
);
INSERT INTO @f VALUES
    (N'单据编号', N'单据编号', N'文本', 'header', 10, 0, 0, 140),
    (N'单据日期', N'单据日期', N'日期', 'header', 20, 1, 0, 120),
    (N'材料名',   N'材料名',   N'文本', 'header', 30, 1, 1, 200),
    (N'主批次',   N'主批次',   N'文本', 'header', 40, 1, 1, 160),
    (N'录入人',   N'录入人',   N'文本', 'header', 50, 1, 0, 120),
    (N'序号',     N'序号',     N'文本', 'detail', 10, 1, 0, 60),
    (N'子批次',   N'子批次',   N'文本', 'detail', 20, 1, 0, 160),
    (N'流程卡',   N'流程卡',   N'附件', 'detail', 30, 1, 0, 160),
    (N'配料表',   N'配料表',   N'附件', 'detail', 40, 1, 0, 160),
    (N'异常情况描述', N'异常情况描述', N'文本', 'detail', 50, 1, 0, 300);

INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT N'RD_SELFMADE', f.col, f.lbl, f.dtype, f.place, f.seq, f.width, f.editable, f.required, 0, 1
FROM @f f
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'RD_SELFMADE' AND x.label = f.lbl);
PRINT N'⑤ 字段行 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ⑥ 译名（至少 en） ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'panel' AND ref_key=N'自制料-制程记录录入' AND locale=N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'panel', N'自制料-制程记录录入', N'en', N'In-house Material Process Record', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'材料名' AND locale=N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'材料名', N'en', N'Material', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'主批次' AND locale=N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'主批次', N'en', N'Main batch', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'子批次' AND locale=N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'子批次', N'en', N'Sub batch', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'流程卡' AND locale=N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'流程卡', N'en', N'Process card', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'配料表' AND locale=N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'配料表', N'en', N'Batching sheet', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'异常情况描述' AND locale=N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'异常情况描述', N'en', N'Abnormality', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'field' AND ref_key=N'录入人' AND locale=N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'录入人', N'en', N'Entered by', N'manual');
PRINT N'⑥ 译名已写入';
GO

/* ---------- ⑦ 权限骨架（用户口径：所有有录入权的人都能改任意一条 ⇒ view+add+modify） ---------- */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'RD_SELFMADE', N'N', N'view,query,add,modify,modlog,del,export,print'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p WHERE p.role_id = r.id AND p.panel_code = N'RD_SELFMADE');
PRINT N'⑦ 权限行 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个角色';
GO

/* ---------- ⑧ 自检 ---------- */
IF OBJECT_ID(N'dbo.rd_selfmade_head') IS NULL RAISERROR(N'[selfmade] 头表未建', 16, 1);
IF OBJECT_ID(N'dbo.rd_selfmade_detail') IS NULL RAISERROR(N'[selfmade] 明细表未建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code=N'RD_SELFMADE') RAISERROR(N'[selfmade] 面板未登记', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'RD_SELFMADE' AND place='header') < 5
    RAISERROR(N'[selfmade] 表头字段不足', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'RD_SELFMADE' AND place='detail') < 5
    RAISERROR(N'[selfmade] 明细字段不足', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'RD_SELFMADE' AND label IN (N'流程卡',N'配料表') AND data_type=N'附件')
    RAISERROR(N'[selfmade] 流程卡/配料表必须 data_type=附件', 16, 1);
PRINT N'[selfmade] 自检通过';
GO
