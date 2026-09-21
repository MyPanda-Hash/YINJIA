SET NOCOUNT ON;
-- ① 研发域各表行数(看"乱"到什么程度)
SELECT N'产品信息表' AS 表, COUNT(*) AS 行数 FROM rd_prod_info_head
UNION ALL SELECT N'成型工艺清单', COUNT(*) FROM rd_mold_proc_head
UNION ALL SELECT N'组装工艺清单', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'规格书', COUNT(*) FROM rd_spec_doc_head
UNION ALL SELECT N'出货检验计划表', COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT N'产品变更申请单', COUNT(*) FROM rd_change_head
UNION ALL SELECT N'变更单行(部门评审)', COUNT(*) FROM rd_change_detail
UNION ALL SELECT N'责任人任务行', COUNT(*) FROM rd_dev_task
UNION ALL SELECT N'立项申请', COUNT(*) FROM rd_approval
UNION ALL SELECT N'项目实施计划', COUNT(*) FROM rd_plan
UNION ALL SELECT N'项目进度查询', COUNT(*) FROM rd_progress
UNION ALL SELECT N'样品编号表', COUNT(*) FROM rd_sample_no_head
UNION ALL SELECT N'数据记录表(RDDOM_TEST)', COUNT(*) FROM rd_dom_test_head;
GO
-- ② 产品信息表逐行(看名字能不能分辨哪些是测试垃圾)
SELECT TOP 60 单据编号, ISNULL(产品编号,N'-') AS 产品编号, ISNULL(产品名称,N'-') AS 产品名称,
       ISNULL(asp_user1,'-') AS 制单, CONVERT(nvarchar(16), asp_time1, 120) AS 建单时间
  FROM rd_prod_info_head ORDER BY id;
GO
-- ③ 四文件逐行(单号/产品/名称/制单)—— 分辨测试垃圾
SELECT TOP 60 单据编号, ISNULL(产品编号,N'-') AS 产品编号, ISNULL(产品名称,N'-') AS 名称,
       ISNULL(asp_user1,'-') AS 制单, ISNULL(变更来源单号,N'') AS 来源
  FROM rd_mold_proc_head ORDER BY id;
GO
SELECT TOP 60 单据编号, ISNULL(产品编号,N'-') AS 产品编号, ISNULL(产品名称,N'-') AS 名称, ISNULL(asp_user1,'-') AS 制单
  FROM rd_asm_proc_head ORDER BY id;
GO
SELECT TOP 60 单据编号, ISNULL(编号,N'-') AS 编号, ISNULL(名称,N'-') AS 名称, ISNULL(asp_user1,'-') AS 制单
  FROM rd_spec_doc_head ORDER BY id;
GO
SELECT TOP 60 单据编号, ISNULL(产品编号,N'-') AS 产品编号, ISNULL(标题,N'-') AS 标题, ISNULL(asp_user1,'-') AS 制单
  FROM rd_insp_plan_head ORDER BY id;
GO
