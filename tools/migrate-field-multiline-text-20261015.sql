/* ============================================================
   migrate-field-multiline-text-20261015.sql — 2026-10-15
   新增「多行文本」字段类型,并把三张工序检验单的长文本明细列改用它

   用户口径(2026-10-15,两轮):
     ① 「还需要实现让当前明细行文字过长时可以多行显示」;
     ② 撤回上一版(改成面板白名单硬编码)后要求「重新创建出多行文本形式」,
        并选定:**走元数据驱动**(新增 `yj_field.data_type = N'多行文本'` 字段类型,
        哪个面板的哪个字段要多行由库里配置,前端不维护面板/字段名单);
        改哪些列:**只改长文本列** —— 处理方式 / 备注 / 检验项目 / 标准要求 /
        实测数值 / 检验方法 / 判定;**表区 / 行号 / 数量 保持单行**。

   为什么不是面板白名单(PanelxForm.vue 硬编码 ['QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP']):
     · 本项目一切面板/字段由 `yj_panel`/`yj_field` 元数据驱动(AGENTS.md / 数据库规范),
       面板清单写死在组件里属于「契约外特例」,以后任何面板想多行都得改代码;
     · 硬编码按"面板"放行,会把该面板所有「文本」列一并变多行 —— 上一版就把
       `数量`/`表区`/`行号` 这些短列也变成了多行框(用户当场发现并撤回)。
     改成字段类型后,粒度落到**字段**,两个毛病一起没有。

   处置:
     ① `yj_field.data_type = N'多行文本'`(三面板 × 上列 7 个长文本列,共 21 行);
     ② 前端 `PanelxForm.vue` 增加该类型的渲染分支(表单头 + 明细通用),
        文字超长自动撑高折行,`autosize` 上限 6 行。

   ⚠ 本脚本**只改 data_type 这一个值**,不动列、不动 place/seq/visible:
     想恢复单行,把对应字段的 data_type 改回 N'文本' 即可(文末附回滚片段)。
   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- ① 三面板长文本明细列 → 多行文本 ---------- */
DECLARE @labels TABLE (label nvarchar(64) PRIMARY KEY);
INSERT INTO @labels (label) VALUES
    (N'处理方式'), (N'备注'), (N'检验项目'), (N'标准要求'), (N'实测数值'), (N'检验方法'), (N'判定');

DECLARE @panels TABLE (panel_code nvarchar(64) PRIMARY KEY);
INSERT INTO @panels (panel_code) VALUES (N'QC_MOLD_INSP'), (N'QC_CUT_INSP'), (N'QC_ASM_INSP');

DECLARE @n int;
UPDATE f
   SET f.data_type = N'多行文本'
  FROM dbo.yj_field f
  JOIN @panels p ON p.panel_code = f.panel_code
  JOIN @labels l ON l.label = f.label
 WHERE f.place LIKE N'%detail%'
   AND ISNULL(f.data_type, N'') <> N'多行文本';
SET @n = @@ROWCOUNT;
PRINT N'  ~ yj_field 长文本明细列改为「多行文本」: ' + CAST(@n AS nvarchar(10)) + N' 行(已就绪则为 0)';
GO

/* ---------- 自检:该改的都改了,不该改的没动 ---------- */
DECLARE @bad int = 0, @msg nvarchar(400);

/* (a) 三面板 × 7 长文本列 = 21 行,必须都是「多行文本」 */
DECLARE @want int;
SELECT @want = COUNT(*)
  FROM dbo.yj_field f
  JOIN (VALUES (N'QC_MOLD_INSP'), (N'QC_CUT_INSP'), (N'QC_ASM_INSP')) AS p(panel_code)
    ON p.panel_code = f.panel_code
  JOIN (VALUES (N'处理方式'), (N'备注'), (N'检验项目'), (N'标准要求'), (N'实测数值'), (N'检验方法'), (N'判定')) AS l(label)
    ON l.label = f.label
 WHERE f.place LIKE N'%detail%';
IF @want <> 21
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 预期 21 个长文本明细列,实际命中 ' + CAST(@want AS nvarchar(10)) + N' 个(面板/字段有变动?)';
END

DECLARE @ok int;
SELECT @ok = COUNT(*)
  FROM dbo.yj_field f
  JOIN (VALUES (N'QC_MOLD_INSP'), (N'QC_CUT_INSP'), (N'QC_ASM_INSP')) AS p(panel_code)
    ON p.panel_code = f.panel_code
  JOIN (VALUES (N'处理方式'), (N'备注'), (N'检验项目'), (N'标准要求'), (N'实测数值'), (N'检验方法'), (N'判定')) AS l(label)
    ON l.label = f.label
 WHERE f.place LIKE N'%detail%' AND f.data_type = N'多行文本';
IF @ok <> 21
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 只有 ' + CAST(@ok AS nvarchar(10)) + N'/21 个长文本明细列处于「多行文本」';
END

/* (b) 短列(表区/行号/数量)不得被顺手改成多行 —— 这正是上一版撤回的原因,守住它 */
IF EXISTS (SELECT 1
             FROM dbo.yj_field
            WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
              AND place LIKE N'%detail%'
              AND label IN (N'表区', N'行号', N'数量')
              AND data_type = N'多行文本')
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 表区/行号/数量 里出现了「多行文本」——短列不该多行';
END

/* (c) 该类型是新增的,别处不应有历史误配(有也不拦,只提示) */
SELECT @msg = N'  · 全库 data_type=多行文本 的字段数 = ' + CAST(COUNT(*) AS nvarchar(10))
  FROM dbo.yj_field WHERE data_type = N'多行文本';
PRINT @msg;

IF @bad > 0 RAISERROR(N'「多行文本」字段类型落地自检失败(%d 项)', 16, 1, @bad);
ELSE PRINT N'「多行文本」字段类型就绪:三张工序检验单 21 个长文本明细列(表区/行号/数量 仍为单行)';
GO

/* ------------------------------------------------------------
   回滚片段(需要恢复单行时执行):
     UPDATE dbo.yj_field SET data_type = N'文本'
      WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
        AND place LIKE N'%detail%'
        AND label IN (N'处理方式', N'备注', N'检验项目', N'标准要求', N'实测数值', N'检验方法', N'判定')
        AND data_type = N'多行文本';
   ------------------------------------------------------------ */
