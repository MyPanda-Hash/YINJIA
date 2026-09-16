SET NOCOUNT ON;
-- 4 个标签修正:列改名 + yj_field + 译名同步
EXEC sp_rename N'bd_so_order.[单据整单折前价税合计]', N'折前价税合计', N'COLUMN';
EXEC sp_rename N'bd_so_order.[业务模式0:普通销售，1:直运销售]', N'业务模式', N'COLUMN';
EXEC sp_rename N'bd_so_order.[交货方式id,6-物流发货，8-车辆配送，9-客户自提]', N'交货方式id', N'COLUMN';
EXEC sp_rename N'bd_so_order.[发票类型：1：普票，2:专票]', N'发票类型', N'COLUMN';
UPDATE yj_field SET col_name=N'折前价税合计', label=N'折前价税合计' WHERE panel_code='SO_ORDER' AND col_name=N'单据整单折前价税合计';
UPDATE yj_field SET col_name=N'业务模式',    label=N'业务模式'    WHERE panel_code='SO_ORDER' AND col_name=N'业务模式0:普通销售，1:直运销售';
UPDATE yj_field SET col_name=N'交货方式id',  label=N'交货方式id'  WHERE panel_code='SO_ORDER' AND col_name LIKE N'交货方式id%';
UPDATE yj_field SET col_name=N'发票类型',    label=N'发票类型'    WHERE panel_code='SO_ORDER' AND col_name LIKE N'发票类型%';
UPDATE yj_translation SET ref_key=N'折前价税合计' WHERE scope='field' AND ref_key=N'单据整单折前价税合计';
UPDATE yj_translation SET ref_key=N'业务模式' WHERE scope='field' AND ref_key=N'业务模式0:普通销售，1:直运销售';
UPDATE yj_translation SET ref_key=N'交货方式id' WHERE scope='field' AND ref_key LIKE N'交货方式id%';
UPDATE yj_translation SET ref_key=N'发票类型' WHERE scope='field' AND ref_key LIKE N'发票类型%';
SELECT COUNT(*) AS SO面板字段数 FROM yj_field WHERE panel_code='SO_ORDER';
