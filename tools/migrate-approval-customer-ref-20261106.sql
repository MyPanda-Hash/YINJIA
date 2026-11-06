-- migrate-approval-customer-ref-20261106.sql — 立项申请表「客户名」改为参照客户档案(KHDA)下拉
--
-- 【用户口径 2026-11-06】
--   「把客户名一栏改为下拉选择客户（在数据建模的基础数据里面），到时候一选择右上角编号就自行填写进来」
--   「叫客户的面板里面有客户的数据，就是这个表」
--
-- 【现状】
--   rd_approval 的「客户名」在 yj_field 里 ref_panel = NULL ⇒ DocSheet 按纯文本输入框渲染
--   (isRefKey 判的是 fieldMap.get(key).refPanel,空就出 el-input)。
--   客户档案面板 = KHDA(面板名「客户」),物理表 dm_kh,列 dm=客户编码 / mc=客户名称。
--   同库既有口径:SALE_OUT / SO_ORDER / PROJ / QC_BHG 的「客户」都指 KHDA.mc
--   (见 migrate-doc-panel-references.sql 与各面板现役 ref_panel 值)。
--
-- 【本次改什么】
--   只把「客户名」这一格挂上参照源,不新增字段、不动数据:
--     ref_panel = 'KHDA' / ref_field = 'mc'(存客户名称,与既有同类字段一致)
--     display_field = 'mc'
--   编号自动填(客户编码+日期)走前端 DocSheet 的 onProdRefConfirm(选中后按客户编码拼),
--   不落库规则 —— 换客户重选即重算,历史单据的号不被回改。
--
-- 【幂等】重复执行 UPDATE 命中 0 行(条件带 ISNULL(ref_panel,'')<>'KHDA')。
SET NOCOUNT ON;
GO

UPDATE yj_field
   SET ref_panel = 'KHDA', ref_field = 'mc', display_field = 'mc'
 WHERE panel_code = 'RD_APPROVAL'
   AND label = N'客户名'
   AND ISNULL(ref_panel, '') <> 'KHDA';
-- 行数守卫:RD_APPROVAL 的「客户名」只有 1 行,命中超过 3 行说明 WHERE 被截断
IF @@ROWCOUNT > 3 RAISERROR(N'migrate-approval-customer-ref: 「客户名」UPDATE 命中行数异常,疑 WHERE 条件被截断', 16, 1);
GO

-- 自检:改完必须是 KHDA.mc,否则报错(迁移链按内容哈希判定重跑,错了要当场红)
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code = 'RD_APPROVAL' AND label = N'客户名'
                  AND ref_panel = 'KHDA' AND ref_field = 'mc')
    RAISERROR(N'migrate-approval-customer-ref: 自检失败 —— 客户名未指向 KHDA.mc', 16, 1);
GO
