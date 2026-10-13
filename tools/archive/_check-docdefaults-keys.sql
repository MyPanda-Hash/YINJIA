SET NOCOUNT ON;
-- docDefaults.js / LOCKED_PERSON 里用到的全部键,逐个与 yj_field.label 比对
-- (前端数据键必须是 label;写成物理列名 ⇒ 显示不出来 + 保存被 labelsToCols 静默丢弃)
DECLARE @m TABLE (panel nvarchar(64), k nvarchar(200));
INSERT INTO @m VALUES
 (N'RD_APPROVAL',N'申请立项日期'),(N'RD_APPROVAL',N'文件管理人'),(N'RD_APPROVAL',N'密级'),
 (N'RD_PLAN',N'文件管理人'),(N'RD_PLAN',N'密级'),
 (N'RD_PROGRESS',N'文件使用范围'),(N'RD_PROGRESS',N'密级'),
 (N'RD_FILTER_EFF',N'密级'),(N'RD_FILTER_EFF',N'适用范围'),(N'RD_FILTER_EFF',N'测试主题'),(N'RD_FILTER_EFF',N'表单审核人'),
 (N'RD_ALKALINE',N'表单审核人'),(N'RD_MINERAL',N'表单审核人'),(N'RD_ANTIBACT',N'表单审核人'),
 (N'RD_SCALE',N'表单审核人'),(N'RD_RO_PROTECT',N'表单审核人'),(N'RD_SOAK',N'表单审核人'),(N'RD_DROP_PREC',N'表单审核人'),
 (N'QC_INSP_REC',N'文件编码'),(N'QC_INSP_REC',N'检验依据'),(N'QC_INSP_REC',N'表单审核人'),(N'QC_INSP_REC',N'检验日期'),
 (N'RD_PROD_DOCLIST',N'密级'),(N'RD_PROD_DOCLIST',N'文件使用范围'),(N'RD_PROD_DOCLIST',N'文件管理人'),
 (N'RD_PROD_INFO',N'审核人一级'),(N'RD_PROD_INFO',N'审核人二级'),
 (N'RD_INSP_PLAN',N'表单管理人'),(N'RD_INSP_PLAN',N'密级'),(N'RD_INSP_PLAN',N'使用范围'),(N'RD_INSP_PLAN',N'审核人'),(N'RD_INSP_PLAN',N'版本号'),
 (N'RD_APPROVAL',N'申请立项人'),(N'QC_INSP_REC',N'检验人'),(N'RD_INSP_PLAN',N'编写人');

SELECT CASE WHEN EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = m.panel AND f.label = m.k) THEN N'OK' ELSE N'★键名错' END AS 判定,
       m.panel AS 面板, m.k AS 代码里用的键,
       ISNULL((SELECT TOP 1 f.label FROM yj_field f WHERE f.panel_code = m.panel AND f.col_name = m.k), N'—') AS 该名对应的label
  FROM @m m
 ORDER BY 判定 DESC, m.panel, m.k;
