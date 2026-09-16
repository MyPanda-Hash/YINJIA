SET NOCOUNT ON;
SELECT col_name, label, place, seq FROM yj_field WHERE panel_code='PURCHASE_IN' AND (col_name LIKE N'%金额%' OR col_name LIKE N'%备注%' OR col_name LIKE N'%入库类别%' OR col_name LIKE N'%总数%' OR col_name LIKE N'%应付%');
SELECT col_name, label, place FROM yj_field WHERE panel_code='SALE_OUT' AND (col_name LIKE N'%备注%' OR col_name LIKE N'%出库类别%');
