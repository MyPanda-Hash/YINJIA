/* ============================================================
   migrate-field-multiline-text-rollback-20261015.sql — 2026-10-15
   【手动回滚】关掉「多行文本」字段类型,三张工序检验单的长文本明细列恢复单行

   ⚠ 本脚本**有意不进迁移链**(tools/db-migrations.txt):
     一登记,DbSync 就会在每个环境的链尾自动执行它 —— 等于功能被自动关掉。
     同类先例与判定口径见 tools/verify/DbNormAudit.java 检查 12 的 allowOffChain
     (「手动回滚/撤回工具」那一条)。

   ── 为什么回滚这么轻 ────────────────────────────────────────────────
   多行显示**不是前端写死的面板名单**,而是认 `yj_field.data_type = N'多行文本'`:
     前端 PanelxList.vue / PanelxForm.vue 都只是 `if (字段类型 === '多行文本') 用多行框`。
   所以把 data_type 改回 N'文本',**刷新页面即恢复单行** ——
   不需要 npm build、不需要重新打包 jar、不需要重启服务。
   (前端那两个分支留着不碍事:类型改回去后它们永远不命中。)

   ── 回滚后还剩什么(有余量,可再开) ─────────────────────────────────
   · 只改了 yj_field.data_type 这一个值,列/place/seq/可见性一律没动;
   · 物理列 合格数量/不合格数量 与三张检验单的表头带入、明细不填 都是**另一件事**
     (migrate-insp-detail-quantity-20261015.sql),本回滚**不碰**;
   · 想再开回来:重跑 migrate-field-multiline-text-20261015.sql(它是幂等的 UPDATE)。

   ── 用法(两个账套各跑一遍,先正式后测试) ────────────────────────────
     java -cp tools\lib\mssql-jdbc.jar tools\SqlRunner.java "<jdbcUrl>" yinjia env \
          tools\migrate-field-multiline-text-rollback-20261015.sql
   幂等:已回滚过再跑 = 影响 0 行。
   ============================================================ */
SET NOCOUNT ON;
GO

DECLARE @labels TABLE (label nvarchar(64) PRIMARY KEY);
INSERT INTO @labels (label) VALUES
    (N'处理方式'), (N'备注'), (N'检验项目'), (N'标准要求'), (N'实测数值'), (N'检验方法'), (N'判定');

DECLARE @panels TABLE (panel_code nvarchar(64) PRIMARY KEY);
INSERT INTO @panels (panel_code) VALUES (N'QC_MOLD_INSP'), (N'QC_CUT_INSP'), (N'QC_ASM_INSP');

DECLARE @n int;
UPDATE f
   SET f.data_type = N'文本'
  FROM dbo.yj_field f
  JOIN @panels p ON p.panel_code = f.panel_code
  JOIN @labels l ON l.label = f.label
 WHERE f.place LIKE N'%detail%'
   AND f.data_type = N'多行文本';
SET @n = @@ROWCOUNT;
PRINT N'  ~ yj_field「多行文本」改回「文本」: ' + CAST(@n AS nvarchar(10)) + N' 行(已回滚过则为 0)';
GO

/* ---------- 自检:该类型在三面板已清零,且短列没被牵连 ---------- */
DECLARE @bad int = 0;
IF EXISTS (SELECT 1
             FROM dbo.yj_field
            WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
              AND place LIKE N'%detail%'
              AND data_type = N'多行文本')
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 三面板明细里仍有「多行文本」行,回滚未干净';
END

IF EXISTS (SELECT 1
             FROM dbo.yj_field
            WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
              AND place LIKE N'%detail%'
              AND label IN (N'表区', N'行号', N'数量')
              AND data_type <> N'文本')
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 表区/行号/数量 的类型被牵连改了(本不该发生)';
END

DECLARE @left int, @msg nvarchar(300);
SELECT @left = COUNT(*) FROM dbo.yj_field WHERE data_type = N'多行文本';
SET @msg = N'  · 全库 data_type=多行文本 剩余 = ' + CAST(@left AS nvarchar(10)) + N' 行(应为 0)';
PRINT @msg;
IF @left <> 0 SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'「多行文本」回滚自检失败(%d 项)', 16, 1, @bad);
ELSE PRINT N'「多行文本」已回滚:三面板 21 个长文本明细列恢复单行(前端无需重新发版,刷新即可)';
GO
