-- migrate-rd-editor-stamp-20261028.sql
-- 研发管理:两格「编辑人自动带入」的元数据调整(2026-10-28 用户口径)。
--
-- 口径原文:
--   「研发管理模块的产品信息表中需实现编辑自动填入当前的对应账号姓名……
--     组装工艺的表单管理人修改为编辑人的账号姓名,选择产品编号之后就自动带入,或者进行其他编辑也自动带入」
--
-- 改法:把这两格改成**只读**(editable=0),值一律由前端带出 + 后端 ButtonService 每次保存回写:
--   · RD_PROD_INFO.编辑人        —— 前端 applyDocDefaults 新增时带当前用户;后端每次保存(含存草稿)回写真名;
--   · RD_ASM_PROC.表单管理人      —— 前端新建带当前用户 + PanelxList 编辑任一项即刷新;后端每次保存回写真名。
-- 只读的理由:这两格记的是"谁最后编辑了这张单"的事实,放开手填既能乱填、也会被下一次保存覆盖 ⇒ 观感矛盾。
-- (成型工艺清单 RD_MOLD_PROC / 成型配方 RD_MOLD_FORMULA 的「表单管理人」**不在此列**,仍按 2026-10-27 口径默认刘磊。)
--
-- 幂等:仅在存在且 editable<>0 时更新;两账套(HSDZ_MES / HSDZ_MES_TEST)都要跑。
SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_PROD_INFO' AND label = N'编辑人' AND ISNULL(editable, 1) <> 0)
BEGIN
    UPDATE yj_field SET editable = 0
    WHERE panel_code = 'RD_PROD_INFO' AND label = N'编辑人';
    PRINT N'[OK] RD_PROD_INFO.编辑人 → 只读(editable=0)';
END
ELSE
    PRINT N'[SKIP] RD_PROD_INFO.编辑人 已是只读或该字段不存在';

IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_ASM_PROC' AND label = N'表单管理人' AND ISNULL(editable, 1) <> 0)
BEGIN
    UPDATE yj_field SET editable = 0
    WHERE panel_code = 'RD_ASM_PROC' AND label = N'表单管理人';
    PRINT N'[OK] RD_ASM_PROC.表单管理人 → 只读(editable=0)';
END
ELSE
    PRINT N'[SKIP] RD_ASM_PROC.表单管理人 已是只读或该字段不存在';

-- 自检:两行都必须是 editable=0
SELECT panel_code, label, editable
FROM yj_field
WHERE (panel_code = 'RD_PROD_INFO' AND label = N'编辑人')
   OR (panel_code = 'RD_ASM_PROC' AND label = N'表单管理人');
