SET NOCOUNT ON;
-- d-08a P9 工序基础库:bs_op 结构与 OP 面板字段(是否有 4 类状态分类)
SELECT c.name AS 列名, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('bs_op') ORDER BY c.column_id;
GO
SELECT panel_code, col_name, label, data_type, dict_sql, place FROM yj_field
WHERE panel_code IN ('OP','ROUTE') ORDER BY panel_code, seq;
GO
SELECT COUNT(*) AS bs_op行数 FROM bs_op;
GO
SELECT TOP 20 工序编码, 工序名称 FROM bs_op;
GO
-- d-08b P7 规格书引用材料库:RD_SPEC_DOC 物料字段的参照配置
SELECT panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, editable
FROM yj_field WHERE panel_code='RD_SPEC_DOC' ORDER BY seq;
GO
-- d-08c P4/P5 研发:产品信息表字段 + 产品开发下发表
SELECT panel_code, col_name, label, data_type, place, editable FROM yj_field
WHERE panel_code='RD_PROD_INFO' ORDER BY seq;
GO
SELECT COUNT(*) AS rd_dev_task行数 FROM rd_dev_task;
GO
SELECT 'rd_dev_task列', c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('rd_dev_task');
GO
-- d-08d C5 来料检验模板:检验项目/方案档案 + 标准库分类
SELECT COUNT(*) AS bs_qc_item行数 FROM bs_qc_item;
SELECT COUNT(*) AS bs_qc_plan行数 FROM bs_qc_plan;
GO
SELECT lib_code AS 库编码, COUNT(*) AS 条目数 FROM yj_std_lib GROUP BY lib_code ORDER BY lib_code;
GO
SELECT panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place FROM yj_field
WHERE panel_code='QC_INSP' AND (label LIKE N'%检验%' OR label LIKE N'%标准%' OR label LIKE N'%项目%')
ORDER BY seq;
GO
-- d-08e C12 模糊查询:库存三报表的查询字段
SELECT panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place
FROM yj_field WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY')
ORDER BY panel_code, seq;
GO
