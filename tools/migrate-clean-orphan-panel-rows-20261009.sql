-- migrate-clean-orphan-panel-rows-20261009.sql — 清理「面板已不存在」的孤儿元数据行(字段登记 + 角色授权)
--
-- 背景(2026-10-09 拉取云端仓库后体检发现):
--   本地下架两批面板 —— ① `migrate-drop-extra-docs-pu-req-20261008.sql`(请购单 + 其他入库/出库 +
--   委外入库/发料共 13 面板)② `migrate-drop-qc-unused-panels-20261009.sql`(制程品质/不良处理/品质追溯 5 面板)。
--   两脚本都把 yj_field / yj_role_panel 一并删了,但实测**仍有残留**(两账套一致):
--     · yj_field       81 行 —— 10 个面板码:OTHER_IN_DETAIL(13)/OTHER_IN_STATS(10)/OTHER_OUT(1)/
--       OTHER_OUT_DETAIL(17)/OTHER_OUT_STATS(12)/OUTSOURCE_IN_DETAIL(5)/OUTSOURCE_IN_STATS(5)/
--       OUTSOURCE_ISSUE_DETAIL(7)/OUTSOURCE_ISSUE_STATS(5)/LOT_TRACE(6)
--     · yj_role_panel  30 行(同上面板码)
--   这些面板的 yj_panel 行、物理表、视图**都已删除**(实测 yj_panel 命中 0、v_other_* / v_outsource_* /
--   v_lot_trace 均不存在)⇒ 上述行是**孤儿**:没有任何代码路径会读它们(后端面板一律由 yj_panel 驱动),
--   却让 DbNormAudit 05「元数据漂移(字段不在其所在对象里)」从 0 涨到 81(FAIL)。
--   ⚠ 残留成因未完全定位(下架脚本自检当时报 0,而残留行的 id 落在旧区间 11845~12032,
--     符合「备份 restore 走 IDENTITY_INSERT 回灌」的形态);无论成因,孤儿元数据都该清,故本脚本兜底。
--
-- 做法:删除 panel_code 在 yj_field / yj_role_panel 里但**不存在于 yj_panel** 的行。
--   安全边界:只删「面板已不存在」的行 —— 在册面板(含 *_DETAIL / *_STATS 这类独立面板码)一行不动;
--   不碰 yj_translation(字段标签多为多面板共享,按标签删会误伤;面板名译名行留着无害且便于日后恢复面板)。
--   幂等:重复执行删 0 行;末尾自检「孤儿 = 0」,非 0 即 RAISERROR(不做静默半成品)。
SET NOCOUNT ON;

-- PRINT 的表达式里不能放子查询(实测报「在此上下文中不允许使用子查询」),先落变量再打印
DECLARE @fBefore int = (SELECT COUNT(*) FROM dbo.yj_field f
                         WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = f.panel_code));
DECLARE @rBefore int = (SELECT COUNT(*) FROM dbo.yj_role_panel r
                         WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = r.panel_code));
PRINT N'[' + DB_NAME() + N'] 清理前 yj_field 孤儿 = ' + CAST(@fBefore AS nvarchar(10));
PRINT N'[' + DB_NAME() + N'] 清理前 yj_role_panel 孤儿 = ' + CAST(@rBefore AS nvarchar(10));

-- ① 字段登记孤儿(防呆:不得一次删掉全部字段行 —— 若 yj_panel 为空,本脚本必须什么都不删)
IF (SELECT COUNT(*) FROM dbo.yj_panel) = 0
    RAISERROR(N'yj_panel 为空,拒绝执行孤儿清理(防误删全表)', 16, 1);

DELETE f FROM dbo.yj_field f
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = f.panel_code);
DECLARE @dF int = @@ROWCOUNT;
PRINT N'[' + DB_NAME() + N'] 删除 yj_field 孤儿 ' + CAST(@dF AS nvarchar(10)) + N' 行';

-- ② 角色授权孤儿
DELETE r FROM dbo.yj_role_panel r
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = r.panel_code);
DECLARE @dR int = @@ROWCOUNT;
PRINT N'[' + DB_NAME() + N'] 删除 yj_role_panel 孤儿 ' + CAST(@dR AS nvarchar(10)) + N' 行';

/* ---------- ③ 自检:孤儿必须为 0 ---------- */
DECLARE @fAfter int = (SELECT COUNT(*) FROM dbo.yj_field f
                        WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = f.panel_code));
DECLARE @rAfter int = (SELECT COUNT(*) FROM dbo.yj_role_panel r
                        WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = r.panel_code));
PRINT N'[' + DB_NAME() + N'] 自检 yj_field 孤儿(应为 0): ' + CAST(@fAfter AS nvarchar(10));
PRINT N'[' + DB_NAME() + N'] 自检 yj_role_panel 孤儿(应为 0): ' + CAST(@rAfter AS nvarchar(10));
IF @fAfter <> 0 RAISERROR(N'yj_field 仍有孤儿行', 16, 1);
IF @rAfter <> 0 RAISERROR(N'yj_role_panel 仍有孤儿行', 16, 1);

-- ④ 越界自检:在册面板的字段行不得被误伤(抽四单点数,应与四单基线一致)
DECLARE @four int = (SELECT COUNT(*) FROM dbo.yj_field
                      WHERE panel_code IN (N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'PURCHASE_IN'));
PRINT N'[' + DB_NAME() + N'] 越界自检 四单字段行数(应 329): ' + CAST(@four AS nvarchar(10));
IF @four <> 329 RAISERROR(N'四单字段行数被误伤(应 329)', 16, 1);

PRINT N'✅ 面板孤儿元数据清理完成(字段 + 角色授权;面板码与物理表/视图早已删除)';
