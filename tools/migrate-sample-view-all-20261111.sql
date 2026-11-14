/*
 * migrate-sample-view-all-20261111.sql
 *
 * 目的：给样品申请单两个面板授「可见全部单据」(view_all) 词。
 *
 * 用户口径（2026-11-11）：
 *   ① 「刘磊账号需要看到全部外部开发样品单信息」—— 刘磊 = 文件负责人(1025)，**不是管理员**；
 *      服务端默认对非管理员强制 asp_user1 = 当前账号（QueryService.OWN_DOCS_PANELS）
 *      ⇒ 生产实测外部样品单 11 张他一张都看不到。
 *   ② 「内部单信息是全部共享的」—— RD_SAMPLE_INT 已从 OWN_DOCS_PANELS 移除（代码层，不需迁移）。
 *   ③ 「这个可以做成面板权限然后把个人角色的权限配置好了」—— 走 org 界面勾选，本脚本只做初值。
 *
 * 授权对象（按**角色码**定位，绝不写死 role_id —— 2026-11-06 的教训：本地 role_id=3/4，
 *   生产是 1025/1026，写死 ID 在生产上是空操作）：
 *   · admin        —— 管理员本就是恒放行，这里显式补词便于矩阵显示一致
 *   · rd_file_owner —— 文件负责人（刘磊所在角色）
 *   · rd_review     —— 研发审核
 *
 * 幂等：已含 view_all 的行不重复追加（用 LIKE '%,view_all%' 类判据做防护，
 *   注意 perms 是 csv，必须按 "整词" 判，不能简单 CHARINDEX 子串）。
 *
 * ⚠ 与 edit_others 的分工：view_all 管"看得见"(读)，edit_others 管"改得动"(写)。
 *   本脚本**不动** edit_others（那是 2026-11-06 的 migrate-sample-int-row-owner 负责的）。
 *
 * 执行：两个账套都要跑（HSDZ_MES / HSDZ_MES_TEST），幂等。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @tbl TABLE (panel_code nvarchar(64), role_code nvarchar(64));
INSERT INTO @tbl (panel_code, role_code) VALUES
    (N'RD_SAMPLE_EXT', N'admin'),
    (N'RD_SAMPLE_EXT', N'rd_file_owner'),
    (N'RD_SAMPLE_EXT', N'rd_review'),
    (N'RD_SAMPLE_INT', N'admin'),
    (N'RD_SAMPLE_INT', N'rd_file_owner'),
    (N'RD_SAMPLE_INT', N'rd_review');

DECLARE @added INT = 0, @touched INT = 0;

;WITH tgt AS (
    SELECT rp.role_id, rp.panel_code, ISNULL(rp.perms, '') AS perms
    FROM yj_role_panel rp
    JOIN yj_role r ON r.id = rp.role_id
    JOIN @tbl t ON t.panel_code = rp.panel_code AND t.role_code = r.role_code
)
UPDATE rp
SET perms = CASE
        WHEN LTRIM(RTRIM(tgt.perms)) = '' THEN N'view_all'
        ELSE tgt.perms + N',view_all'
    END
FROM yj_role_panel rp
JOIN tgt ON tgt.role_id = rp.role_id AND tgt.panel_code = rp.panel_code
-- 整词判重：'view_all' 前面必须是串首或逗号，后面必须是串尾或逗号
WHERE NOT (N',' + REPLACE(tgt.perms, N' ', N'') + N',' LIKE N'%,view_all,%');

SET @added = @@ROWCOUNT;
SET @touched = (SELECT COUNT(*) FROM yj_role_panel rp
                JOIN yj_role r ON r.id = rp.role_id
                JOIN @tbl t ON t.panel_code = rp.panel_code AND t.role_code = r.role_code);

PRINT '[view-all] 目标授权行 = ' + CAST(@touched AS nvarchar(10))
    + '，本次新增 = ' + CAST(@added AS nvarchar(10));

-- 自检 1：目标角色的两个样品面板都必须含 view_all（缺一即失败）
DECLARE @missing INT = (
    SELECT COUNT(*)
    FROM @tbl t
    JOIN yj_role r ON r.role_code = t.role_code
    JOIN yj_role_panel rp ON rp.role_id = r.id AND rp.panel_code = t.panel_code
    WHERE N',' + REPLACE(ISNULL(rp.perms, N''), N' ', N'') + N',' NOT LIKE N'%,view_all,%'
);
IF @missing > 0
BEGIN
    RAISERROR(N'[view-all] 自检失败：仍有 %d 条目标授权行没有 view_all', 16, 1, @missing);
    RETURN;
END

-- 自检 2：通用面板不许被误加 view_all（本词只给样品两面板）
DECLARE @leaked INT = (
    SELECT COUNT(*) FROM yj_role_panel
    WHERE panel_code NOT IN (N'RD_SAMPLE_EXT', N'RD_SAMPLE_INT')
      AND N',' + REPLACE(ISNULL(perms, N''), N' ', N'') + N',' LIKE N'%,view_all,%'
);
IF @leaked > 0
BEGIN
    RAISERROR(N'[view-all] 自检失败：有 %d 条非样品面板被加了 view_all（本词只该给样品两面板）', 16, 1, @leaked);
    RETURN;
END

PRINT '[view-all] 自检通过：目标行齐全，无越权外溢。';
