-- migrate-material-out-label-cleanup.sql — 材料出库单「中英文混杂」字段标签清理(2026-09-28)
-- ═════════════════════════════════════════════════════════════════════════════════
-- 用户口径:「现在的字段中英文混杂」。
-- 成因:接口并集生成器(tools/archive/_gen-material-out.mjs,口径照抄 2026-09-16 的采购入库那份)
--   在「中文标签已被本面板占用」时,回退成 `<中文标签>_<金蝶接口键>`,于是长出
--   单据状态_bill_status / 审核时间_audit_time / 审核人_auditor_name 这种半英半中的标签,
--   前两个还挂在**表头可见位**上,用户一眼就能看到;另外 id 类键直接用了裸英文列名
--   (dept_id/creator_id/…),与同批已成中文的 商品id/仓库id/仓位id 也不一致。
--
-- 本脚本按「改名」处理(与 2026-09-21 migrate-spec-unify.sql 的 sp_rename 同款):
--   列名 + yj_field.col_name/label 一起改(列名与标签同名是本项目惯例,改一个不改另一个会错位);
--   MS_Description 扩展属性挂在列 id 上,随 sp_rename 自动保留,无需重写;
--   旧标签的译名(yj_translation ref_key)**保留不动** —— 采购入库/销售出库仍用着
--   单据状态_bill_status 等同名标签,删了会把它们的英文界面打回中文;
--   新标签另补 en/ja 译名(多语言规范:至少 en,判定标准含日语)。
--
-- 改名对照(共 10 个):
--   单据状态_bill_status → 金蝶单据状态      (可见;金蝶 bill_status,与本单 MES 单据状态区分)
--   审核时间_audit_time  → 金蝶审核时间      (可见)
--   审核人_auditor_name  → 金蝶审核人        (可见)
--   dept_id              → 部门id            (隐藏)
--   creator_id           → 创建人id          (隐藏)
--   modifier_id          → 修改人id          (隐藏)
--   bill_type_id         → 单据类型id        (隐藏)
--   auditor_id           → 审核人id          (隐藏)
--   emp_id               → 经手人id          (隐藏;金蝶 emp=经手人/职员)
--   pick_use_id          → 领料用途id        (隐藏)
--
-- 幂等:①旧名在、新名不在 → sp_rename + 改 yj_field;
--       ②两名都在(极端:有人把生成器按清洁名重跑过)→ 把旧列数据补进新列空值处再删旧列,
--         保证「先跑生成器、后跑本脚本」与「先跑本脚本」两种顺序结果一致;
--       ③旧名不在 → 无操作。复跑 0 改动。
-- 自检:MATERIAL_OUT 不应再有「中文混英文键」标签(裸英文/含下划线且非 ERP* 的),必须为 0。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

DECLARE @ren TABLE (tbl sysname, old_col nvarchar(200), new_col nvarchar(200), en nvarchar(200), ja nvarchar(200));
INSERT INTO @ren (tbl, old_col, new_col, en, ja) VALUES
  (N'bd_material_out', N'单据状态_bill_status', N'金蝶单据状态',   N'Kingdee Bill Status', N'金蝶伝票ステータス'),
  (N'bd_material_out', N'审核时间_audit_time',  N'金蝶审核时间',   N'Kingdee Audit Time',  N'金蝶監査日時'),
  (N'bd_material_out', N'审核人_auditor_name',  N'金蝶审核人',     N'Kingdee Auditor',     N'金蝶監査者'),
  (N'bd_material_out', N'dept_id',              N'部门id',         N'Dept Id',             N'部門ID'),
  (N'bd_material_out', N'creator_id',           N'创建人id',       N'Creator Id',          N'作成者ID'),
  (N'bd_material_out', N'modifier_id',          N'修改人id',       N'Modifier Id',         N'更新者ID'),
  (N'bd_material_out', N'bill_type_id',         N'单据类型id',     N'Bill Type Id',        N'伝票タイプID'),
  (N'bd_material_out', N'auditor_id',           N'审核人id',       N'Auditor Id',          N'監査者ID'),
  (N'bd_material_out', N'emp_id',               N'经手人id',       N'Emp Id',              N'従業員ID'),
  (N'bd_material_out', N'pick_use_id',          N'领料用途id',     N'Pick Use Id',         N'出庫用途ID');

-- ① 改名(sp_rename 需逐条动态执行;两种情形分别处理)
DECLARE @t sysname, @o nvarchar(200), @n nvarchar(200), @sql nvarchar(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, old_col, new_col FROM @ren;
OPEN cur;
FETCH NEXT FROM cur INTO @t, @o, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('dbo.' + @t, @o) IS NOT NULL AND COL_LENGTH('dbo.' + @t, @n) IS NULL
  BEGIN
    SET @sql = N'EXEC sp_rename N''dbo.' + @t + N'.' + @o + N''', N''' + @n + N''', N''COLUMN'';';
    EXEC sp_executesql @sql;
    PRINT N'[matout-label] 改列名: ' + @t + N'.' + @o + N' → ' + @n;
  END
  ELSE IF COL_LENGTH('dbo.' + @t, @o) IS NOT NULL AND COL_LENGTH('dbo.' + @t, @n) IS NOT NULL
  BEGIN
    -- 两名并存:补齐新列空值 → 删旧列(不动已有值)
    SET @sql = N'UPDATE ' + @t + N' SET [' + @n + N'] = [' + @o + N'] WHERE [' + @n + N'] IS NULL AND [' + @o + N'] IS NOT NULL;';
    EXEC sp_executesql @sql;
    SET @sql = N'ALTER TABLE ' + @t + N' DROP COLUMN [' + @o + N'];';
    EXEC sp_executesql @sql;
    PRINT N'[matout-label] 两名并存 → 已并数据并删旧列: ' + @o;
  END
  FETCH NEXT FROM cur INTO @t, @o, @n;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ② yj_field:列名与标签一起改(旧行在则改;不在则说明已改过)
DECLARE @ren2 TABLE (old_col nvarchar(200), new_col nvarchar(200), en nvarchar(200), ja nvarchar(200));
INSERT INTO @ren2 VALUES
  (N'单据状态_bill_status', N'金蝶单据状态', N'Kingdee Bill Status', N'金蝶伝票ステータス'),
  (N'审核时间_audit_time',  N'金蝶审核时间', N'Kingdee Audit Time',  N'金蝶監査日時'),
  (N'审核人_auditor_name',  N'金蝶审核人',   N'Kingdee Auditor',     N'金蝶監査者'),
  (N'dept_id',    N'部门id',       N'Dept Id',       N'部門ID'),
  (N'creator_id', N'创建人id',     N'Creator Id',    N'作成者ID'),
  (N'modifier_id',N'修改人id',     N'Modifier Id',   N'更新者ID'),
  (N'bill_type_id',N'单据类型id',  N'Bill Type Id',  N'伝票タイプID'),
  (N'auditor_id', N'审核人id',     N'Auditor Id',    N'監査者ID'),
  (N'emp_id',     N'经手人id',     N'Emp Id',        N'従業員ID'),
  (N'pick_use_id',N'领料用途id',   N'Pick Use Id',   N'出庫用途ID');

-- ② 记录「旧名行」的 id(改名后无法再区分哪行来自旧名,先存下来)
DECLARE @oldRows TABLE (id int, new_col nvarchar(200));
INSERT INTO @oldRows (id, new_col)
SELECT f.id, r.new_col FROM yj_field f JOIN @ren2 r ON f.col_name = r.old_col
WHERE f.panel_code = 'MATERIAL_OUT';

UPDATE f SET f.col_name = r.new_col, f.label = r.new_col
FROM yj_field f JOIN @ren2 r ON f.col_name = r.old_col
WHERE f.panel_code = 'MATERIAL_OUT';
PRINT N'[matout-label] yj_field 改名行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

-- ②b 去重:若 yj_field 里**已经有**新名行(极端顺序:生成器按清洁名重跑过,
--     它的 IF NOT EXISTS 会先插一行新名的),上面的改名会造出同名两行 →
--     删掉「由旧名改来的那一行」,保留新名行(两行 place/seq/可见性本就同源,信息不丢)。
DELETE f FROM yj_field f JOIN @oldRows o ON f.id = o.id
WHERE (SELECT COUNT(*) FROM yj_field x WHERE x.panel_code='MATERIAL_OUT' AND x.col_name = o.new_col) > 1;
PRINT N'[matout-label] yj_field 重复行清理: ' + CAST(@@ROWCOUNT AS nvarchar(10));

-- ③ 新标签译名(en/ja;仅补缺失,不覆盖)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', r.new_col, 'en', r.en, 'manual' FROM @ren2 r
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=r.new_col AND t.locale='en');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', r.new_col, 'ja', r.ja, 'manual' FROM @ren2 r
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=r.new_col AND t.locale='ja');
GO

-- ④ 自检:不应再有「中文混英文键」标签
--   判定:① 含下划线(单据状态_bill_status 这种拼接名);② 纯 ASCII 标签(裸英文列名 dept_id 这种)。
--   ⚠ 不能简单用「含小写字母」判 —— 商品id/仓库id/序列号流转ID 是全项目通用的 id 后缀写法,
--     误判会直接把自检打成失败(2026-09-28 首跑实测:25 个误报)。
DECLARE @mixed int = (
  SELECT COUNT(*) FROM yj_field
  WHERE panel_code = 'MATERIAL_OUT'
    AND (label LIKE N'%\_%' ESCAPE N'\' OR label NOT LIKE N'%[^a-zA-Z0-9_]%')
);
IF @mixed <> 0
BEGIN
  SELECT col_name, label, hidden FROM yj_field WHERE panel_code='MATERIAL_OUT'
    AND (label LIKE N'%\_%' ESCAPE N'\' OR label NOT LIKE N'%[^a-zA-Z0-9_]%');
  RAISERROR(N'[matout-label] 自检失败:仍有 %d 个中英混杂标签(应 0)', 16, 1, @mixed);
END
ELSE PRINT N'[matout-label] 自检通过:材料出库单字段标签已全为中文(id 后缀为全项目通用写法)';
GO

-- ⑤ 报告:改名后的可读字段清单
SELECT place, seq, col_name, label, hidden, visible FROM yj_field
WHERE panel_code='MATERIAL_OUT' AND (col_name LIKE N'%id%' OR label LIKE N'金蝶%')
ORDER BY place, seq;
GO
