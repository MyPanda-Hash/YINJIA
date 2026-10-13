SET NOCOUNT ON;
SELECT N'表 qc_fin_spec_head/_detail' AS 检查项,
       CASE WHEN OBJECT_ID('dbo.qc_fin_spec_head') IS NOT NULL AND OBJECT_ID('dbo.qc_fin_spec_detail') IS NOT NULL THEN N'OK' ELSE N'缺' END AS 结果
UNION ALL SELECT N'面板 QC_FIN_SPEC', CASE WHEN EXISTS (SELECT 1 FROM yj_panel WHERE panel_code=N'QC_FIN_SPEC') THEN N'OK' ELSE N'缺' END
UNION ALL SELECT N'字段数 >= 38', CAST((SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_FIN_SPEC') AS nvarchar(10))
UNION ALL SELECT N'en 译名 >= 7', CAST((SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND locale='en' AND ref_key IN (N'文件编号',N'版本版次',N'工单号',N'检验对象',N'称料',N'接受标准',N'不合格处置')) AS nvarchar(10))
UNION ALL SELECT N'播种 头 CPJY-2026-10-0001', CAST((SELECT COUNT(*) FROM qc_fin_spec_head WHERE 单据编号=N'CPJY-2026-10-0001') AS nvarchar(10))
UNION ALL SELECT N'播种 修订履历', CAST((SELECT COUNT(*) FROM qc_fin_spec_detail WHERE 单据编号=N'CPJY-2026-10-0001' AND 表区=N'修订履历') AS nvarchar(10))
UNION ALL SELECT N'播种 检验项目', CAST((SELECT COUNT(*) FROM qc_fin_spec_detail WHERE 单据编号=N'CPJY-2026-10-0001' AND 表区=N'检验项目') AS nvarchar(10))
UNION ALL SELECT N'播种 处理方式', CAST((SELECT COUNT(*) FROM qc_fin_spec_detail WHERE 单据编号=N'CPJY-2026-10-0001' AND 表区=N'处理方式') AS nvarchar(10));
