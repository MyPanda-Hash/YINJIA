/* ============================================================================
 * migrate-qc-tc-in-move-attach-20261019.sql —— 特采单:归采购管理 + 可上传附件
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-19《10.19 问题》):
 *   第 3 条「特采单归供应链的采购管理的目录下,不要在品质管理的目录下。」
 *   第 4 条「特采单上面也要可以传附件。」
 *
 * ① 菜单归属(第 3 条)
 *    左导航的唯一真源是**前端 `frontend/src/business/menus.js`**(仓库早有结论:改
 *    yj_panel.category/module_group 并不影响导航,见 migrate-wlbom-menu-rollback-20261015.sql 头注),
 *    故菜单那一跳改在 menus.js:品质管理 > 来料品质 → **智能供应链 > 采购管理 > 单据**。
 *    本脚本只把 `yj_panel` 的 `module_group` / `category` 对齐到新位置 —— 这两列另有用途:
 *      · `SysAdminController` 的「组织架构 · 面板权限」按 module_group 分组;
 *      · `PanelPermissionService` 的读放行集合含"同模块面板";
 *      · `ReportService.navGroup` / 桌面模块计数。
 *    搬完后特采单在权限树里也归「智能供应链 / 采购管理」,与导航一致(业务上它就是采购口对
 *    不合格来料的让步接收申请)。面板编码 QC_TC_IN / 表 / 前缀 TCI / 权限行**一个字节没动**。
 *
 * ② 附件位(第 4 条)
 *    附件在本仓库是**元数据驱动**的:头表有 `附件1..附件6` 列 + `yj_field.data_type='附件'`
 *    ⇒ 渲染层(文书式面板 = DocSheet 的备注栏旁 / 网格面板 = PanelxList 的「附件」区)自动挂
 *    `FileAttachCell`(上传/查看/删除,文件实体落 `yj_attachment`)。特采单这两样都没有,
 *    故本脚本给 `qc_tc_in` 补 **附件1..附件6** 六列(nvarchar(1000),与采购/销售/出入库单同名同型;
 *    实占最多 6 个文件,页面是一个附件格,上传按序占第一个空列位)并逐列写中文注明 +
 *    `yj_field` 登记 6 行(data_type='附件', place='header', visible=1, editable=1)。
 *    「已审核也能补附件」由前端 `PanelxList.ATTACH_EDIT_PANELS` 放行(本批把 QC_TC_IN 加进去)。
 *
 * 幂等:列用 COL_LENGTH 判、字段用 NOT EXISTS 判、注明用 extended_properties 判。两账套均执行。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① yj_panel 归属对齐(菜单本体在 menus.js) ---------- */
UPDATE yj_panel
   SET module_group = N'智能供应链',
       category     = N'采购管理'
 WHERE panel_code = N'QC_TC_IN';
PRINT N'[归属] QC_TC_IN → 智能供应链 / 采购管理,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ② qc_tc_in 补 附件1..附件6 ---------- */
DECLARE @i int = 1, @col sysname, @cmt nvarchar(300);
WHILE @i <= 6
BEGIN
    SET @col = N'附件' + CAST(@i AS nvarchar(2));
    IF COL_LENGTH(N'dbo.qc_tc_in', @col) IS NULL
    BEGIN
        EXEC(N'ALTER TABLE dbo.qc_tc_in ADD [' + @col + N'] nvarchar(1000) NULL');
        PRINT N'[加列] qc_tc_in.' + @col;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = OBJECT_ID(N'dbo.qc_tc_in')
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_tc_in'), @col, 'ColumnId')
                     AND ep.name = N'MS_Description')
    BEGIN
        SET @cmt = N'附件列位' + CAST(@i AS nvarchar(2)) + N'(最近一次上传的文件名;实体在 yj_attachment,锚=panel_code+单据编号+本列名)。'
                 + N'2026-10-19 用户口径「特采单上面也要可以传附件」:与采购订单/出入库单同款六列位,页面一个附件格按序占用';
        EXEC sp_addextendedproperty N'MS_Description', @cmt,
             N'SCHEMA', N'dbo', N'TABLE', N'qc_tc_in', N'COLUMN', @col;
    END
    SET @i = @i + 1;
END
GO

/* ---------- ③ yj_field 登记 6 个附件字段 ---------- */
DECLARE @j int = 1, @lab nvarchar(50);
WHILE @j <= 6
BEGIN
    SET @lab = N'附件' + CAST(@j AS nvarchar(2));
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_TC_IN' AND label = @lab)
        INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
        VALUES (N'QC_TC_IN', @lab, @lab, N'附件', N'header', 300 + @j, 160, 1, 0, 0, 1);
    SET @j = @j + 1;
END
PRINT N'[字段] QC_TC_IN 附件1..附件6 已登记';
GO

/* ---------- ④ 自检 ---------- */
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.qc_tc_in') AND name LIKE N'附件%') <> 6
    RAISERROR(N'qc_tc_in 附件列不是 6 个', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_TC_IN' AND data_type = N'附件') <> 6
    RAISERROR(N'QC_TC_IN 的 yj_field 附件字段不是 6 个', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_TC_IN'
                AND module_group = N'智能供应链' AND category = N'采购管理')
    RAISERROR(N'QC_TC_IN 的 module_group/category 未归到 智能供应链/采购管理', 16, 1);
SELECT N'[自检] QC_TC_IN 归属/附件列/附件字段 全部就绪' AS 项;
PRINT N'✅ 特采单:已归 智能供应链>采购管理(菜单在 menus.js),已可上传附件(6 列位)';
GO
