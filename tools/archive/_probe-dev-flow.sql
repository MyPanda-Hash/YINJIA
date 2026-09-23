/* 只读探针:产品开发下发链路现状 */
USE HSDZ_MES;
SET NOCOUNT ON;

PRINT N'== 1. rd_dev_task 按产品汇总 ==';
SELECT 产品编号, 产品名称, MAX(源单据号) AS 源单据号, COUNT(*) AS 任务行数,
       COUNT(DISTINCT 目标面板) AS 目标面板数,
       MIN(ISNULL(负责人, N'(挂起)')) AS 负责人, MAX(下发人) AS 下发人, MAX(下发时间) AS 下发时间
FROM rd_dev_task WHERE ISNULL(asp_cancel,'N') <> 'Y'
GROUP BY 产品编号, 产品名称 ORDER BY 产品编号;

PRINT N'== 2. rd_dev_task 明细(前 20 行)==';
SELECT TOP 20 产品编号, 目标面板, ISNULL(负责人,N'(null)') AS 负责人, 下发人, 目标面板 AS t
FROM rd_dev_task WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY 产品编号, 目标面板;

PRINT N'== 3. 产品信息表单据状态分布 ==';
SELECT s.saved, s.archived, s.pending, s.modify_state, COUNT(*) AS n
FROM yj_doc_status s WHERE s.panel_code = N'RD_PROD_INFO'
GROUP BY s.saved, s.archived, s.pending, s.modify_state;

PRINT N'== 4. 已归档的产品信息表(产品编号/名称/责任人/编号)==';
SELECT TOP 20 h.单据编号, h.产品编号, h.产品名称, ISNULL(h.责任人, N'(空)') AS 责任人,
       CASE WHEN EXISTS (SELECT 1 FROM rd_dev_task t WHERE t.产品编号 = h.产品编号 AND ISNULL(t.asp_cancel,'N')<>'Y')
            THEN N'已下发' ELSE N'未下发' END AS 下发状态
FROM rd_prod_info_head h
LEFT JOIN yj_doc_status s ON s.panel_code = N'RD_PROD_INFO' AND s.doc_no = h.单据编号
WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(s.archived,'N') = 'Y'
ORDER BY h.id DESC;

PRINT N'== 5. 下游 4 面板里挂在这些产品编号上的单据 ==';
SELECT 面板, 产品编号, 单据状态, 单据编号 FROM (
  SELECT N'成型工艺清单' AS 面板, 产品编号, N'—' AS 单据状态, 单据编号 FROM rd_mold_proc_head WHERE ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL SELECT N'组装工艺清单', 产品编号, N'—', 单据编号 FROM rd_asm_proc_head WHERE ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL SELECT N'规格书', 编号, N'—', 单据编号 FROM rd_spec_doc_head WHERE ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL SELECT N'出货检验计划表', 产品编号, N'—', 单据编号 FROM rd_insp_plan_head WHERE ISNULL(asp_cancel,'N')<>'Y'
) x ORDER BY 面板, 产品编号;

PRINT N'== 6. 规格书分发(rd_spec_assign)==';
SELECT TOP 15 产品编号, 单据编号, ISNULL(规格书种类,N'') AS 规格书种类, ISNULL(责任人,N'(未分配)') AS 责任人,
       ISNULL(负责人, N'(空)') AS 负责人 FROM rd_spec_assign WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
