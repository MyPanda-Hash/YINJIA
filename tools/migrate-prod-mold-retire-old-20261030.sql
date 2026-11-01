/* ============================================================================
   migrate-prod-mold-retire-old-20261030.sql
   ── 撤掉旧面板「烧结尺寸表 RD_SINTER_TOL」，只留「生产模具表 PROD_MOLD」────────────
   ============================================================================
   【用户口径 2026-10-30】「把旧的撤掉」。

   两块面板指同一张物理表 rd_sinter_tolerance（生产模具表就是复用它的那 60 行）。
   保留新面板（它在「系统管理平台 / 设备维护」菜单里、列名是用户口径），撤掉旧面板。

   【撤什么 / 不撤什么】
     撤：yj_panel / yj_field / yj_role_panel 里 RD_SINTER_TOL 的登记行
         —— 这才是"面板还在"的凭据（权限矩阵、面板清单都读它）。
     不撤：rd_sinter_tolerance **表与 60 行数据**（生产模具表还在用，撤了就没数据了）。

   【顺序依赖】配方计算弹窗（RecipeCalcDialog）与「维护尺寸表」入口已改为指向 PROD_MOLD；
     生产模具表**额外补了一个「停用」字段** —— 原来烧结尺寸表有这一列，配方计算靠它
     过滤掉停用的模具，合并时不能丢。
     ⚠ 本脚本带硬闸门：PROD_MOLD 没登记就整体跳过，绝不让系统出现"没有任何模具维护入口"。
     ⚠ 它必须在 migrate-prod-mold-panel-20261030.sql 之后执行（db-migrations.txt 顺序即是）。

   【幂等】删前先判存在；重复执行不报错。
   三个库都要执行：本地 HSDZ_MES / HSDZ_MES_TEST / 客户服务器 HSDZ_MES。
   ============================================================================ */

SET NOCOUNT ON;
GO

/* ── ① 生产模具表补「停用」（原烧结尺寸表有，配方计算用它过滤停用模具）───────── */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_MOLD' AND col_name = N'停用')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('PROD_MOLD', N'停用', N'停用', N'是否', NULL, NULL, NULL, NULL, N'detail', 110, 80, 1, 0, 0, 1);
GO

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'停用' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'停用', 'en', N'Disabled', 'manual');
GO

/* ── ② 撤掉旧面板（硬闸门：新面板必须已就绪）─────────────────────────────── */
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'PROD_MOLD')
BEGIN
    DELETE FROM yj_role_panel WHERE panel_code = 'RD_SINTER_TOL';
    DELETE FROM yj_field      WHERE panel_code = 'RD_SINTER_TOL';
    DELETE FROM yj_panel      WHERE panel_code = 'RD_SINTER_TOL';
    PRINT N'已撤掉旧面板 RD_SINTER_TOL（物理表与数据保留）';
END
ELSE
    PRINT N'⚠ 跳过：生产模具表 PROD_MOLD 未登记，保留旧面板不动';
GO

/* ── 核验 ─────────────────────────────────────────────────────────────────── */
SELECT panel_code, panel_name, mode, line_table FROM yj_panel WHERE panel_code IN ('RD_SINTER_TOL','PROD_MOLD');
SELECT COUNT(*) AS 生产模具表字段 FROM yj_field WHERE panel_code = 'PROD_MOLD';
SELECT COUNT(*) AS 数据行仍在 FROM rd_sinter_tolerance;
GO
