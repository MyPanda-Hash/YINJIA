-- ============================================================================
-- 材料出库单:生产车间 → 生产线(2026-10-21,用户口径)
--
-- 用户原话:「把材料出库单的生产车间改成生产线,然后依靠生产领料来填,不能修改」
--
-- 为什么只改 label、不动物理列:
--   · 物理列 `bd_material_out.生产车间` 有历史数据(489 张单据);
--   · 项目铁律是 col_name 永不改(改了历史单据的数据键全丢,见 ButtonService 4596 注释);
--   · 面板引擎取值是「先按 col_name 取,取不到再按 label 取」(ButtonService.ensureProductCodeUnique
--     等处的写法),所以 label 改成「生产线」后:
--       - 旧单据仍能从 `生产车间` 列读出值,显示为「生产线」;
--       - 生产领料页提交 `生产线` 也能落到 `生产车间` 列。
--
-- 同时:
--   · editable = 0  ⇒ 材料出库单表单里该字段**只读**(由生产领料带入,人不能改);
--   · ref_panel/ref_field 清空 ⇒ 不再是「部门」下拉(DEPT),避免误选成部门;
--   · required 放宽为 0(老单据可能没有产线,不能因为加必填卡住审核)。
--
-- 幂等:重复执行不出错。
-- ============================================================================

SET NOCOUNT ON;

-- ① 字段定义:显示名改成生产线 + 只读 + 去掉部门参照
UPDATE yj_field
   SET label      = N'生产线',
       editable   = 0,
       required   = 0,
       ref_panel  = NULL,
       ref_field  = NULL,
       display_field = NULL
 WHERE panel_code = N'MATERIAL_OUT'
   AND col_name   = N'生产车间';

-- ② 多语言:字段译名(AGENTS 强制规范:新增/改名字段必须同时交付译名)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'生产线', 'en', N'Production line', 'manual'
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产线' AND locale='en');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'生产线', 'ja', N'製造ライン', 'manual'
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产线' AND locale='ja');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'生产线', 'ko', N'생산 라인', 'manual'
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产线' AND locale='ko');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'生产线', 'vi', N'Chuyền sản xuất', 'manual'
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产线' AND locale='vi');

-- ③ 自检:必须 [PASS]
SELECT CASE WHEN EXISTS (
         SELECT 1 FROM yj_field
          WHERE panel_code = N'MATERIAL_OUT' AND col_name = N'生产车间'
            AND label = N'生产线' AND editable = 0 AND ref_panel IS NULL
       ) THEN '[PASS] MATERIAL_OUT.生产车间 → 生产线(只读、无部门参照)'
            ELSE '[FAIL] 字段没改成功' END AS 自检1;

SELECT CASE WHEN EXISTS (
         SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产线' AND locale='en'
       ) THEN '[PASS] 译名 生产线/en 已就绪'
            ELSE '[FAIL] 缺译名' END AS 自检2;

-- ④ 清点:影响行数应 ≤ 1
SELECT COUNT(*) AS 命中行数
  FROM yj_field WHERE panel_code = N'MATERIAL_OUT' AND col_name = N'生产车间';
