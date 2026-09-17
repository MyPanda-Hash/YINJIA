SET NOCOUNT ON;
SELECT col_name, place, seq, data_type FROM yj_field WHERE panel_code='QC_INSP' ORDER BY seq;
SELECT c.name, t.name AS tp, c.max_length FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.sl_recv_detail') AND c.name IN (N'物料描述',N'箱数',N'日期',N'结案',N'部门',N'部门名称');
SELECT ref_key, locale, text FROM yj_translation WHERE scope='field' AND ref_key IN (N'物料描述',N'箱数',N'结案',N'入库单号',N'不良数量',N'日期',N'部门',N'部门名称') AND locale='en';
