SELECT id,label,col_name,data_type,dict_sql,ref_panel,ref_field,display_field,editable,required,hidden
FROM yj_field WHERE panel_code='RD_INSP_PLAN' AND label IN (N'产品编号',N'检验类别',N'检测频率',N'标题',N'密级',N'版本号',N'编写人',N'表单管理人',N'产品功能类别',N'主要性能')
