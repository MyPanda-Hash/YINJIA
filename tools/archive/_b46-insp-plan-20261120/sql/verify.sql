-- 复核用(只读):java -cp tools/lib/mssql-jdbc.jar Q.java HSDZ_MES_TEST @sql/verify.sql
-- 1) 计划表头 + 状态
SELECT h.id, h.[单据编号], h.[单据日期], h.[产品编号], h.[标题], h.[版本号], h.[密级], h.[使用范围],
       h.[管理人] AS 表单管理人, h.[编写人], h.[审核人],
       s.saved, s.pending, s.archived, s.update_at
FROM dbo.rd_insp_plan_head h
LEFT JOIN dbo.yj_doc_status s ON s.doc_no = h.[单据编号] AND s.panel_code = 'RD_INSP_PLAN'
WHERE h.[单据编号] = 'IP-2026-11-0018';

-- 2) 6 条检验项目(表区=检验项目;同一张单还有 18 行「修订记录」预铺空行,不要算进去)
SELECT [序号], [检验类别], [控制项目], [控制标准及要求], [控制方法], [检测频率], [备注], [表区]
FROM dbo.rd_insp_plan_detail
WHERE [单据编号] = 'IP-2026-11-0018' AND [表区] = '检验项目'
ORDER BY id;

-- 3) 产品档案(草稿,供参照选择器使用)
SELECT [单据编号], [单据日期], [产品编号], [产品名称]
FROM dbo.rd_prod_info_head WHERE [产品编号] = 'B-46-10-1';

-- 4) 正式库应无 B-46-10-1(证明没写错账套):
--    java -cp tools/lib/mssql-jdbc.jar Q.java HSDZ_MES "..."
--    SELECT COUNT(*) FROM dbo.rd_insp_plan_head WHERE [产品编号] = 'B-46-10-1';   -- 期望 0
