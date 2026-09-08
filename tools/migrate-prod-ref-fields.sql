-- migrate-prod-ref-fields.sql -- 产品文件三面板(成型工艺清单/成型配方/出货检验计划表):
-- 「产品编号」改为参照字段,引用 产品信息表(RD_PROD_INFO);选产品后按同名字段带回 产品名称 等
-- 幂等:UPDATE 可重复执行

UPDATE yj_field
SET data_type = N'参照',
    ref_panel = 'RD_PROD_INFO',
    ref_field = N'产品编号',
    display_field = N'产品名称'
WHERE panel_code IN ('RD_MOLD_PROC', 'RD_MOLD_FORMULA', 'RD_INSP_PLAN')
  AND col_name = N'产品编号'
  AND place = N'header';

PRINT '产品编号参照字段(成型工艺清单/成型配方/出货检验计划表 -> 产品信息表)更新完成';
