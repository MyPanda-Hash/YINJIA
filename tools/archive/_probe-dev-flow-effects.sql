/* 只读核验:产品开发下发的副作用(留痕 / 消息 / 任务行)—— 清理前抓证据 */
USE HSDZ_MES;
SET NOCOUNT ON;

SELECT N'1 探针产品信息表' AS 项, COUNT(*) AS n FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%'
UNION ALL SELECT N'2 其状态行(已归档)', COUNT(*) FROM yj_doc_status WHERE panel_code=N'RD_PROD_INFO' AND ISNULL(archived,'N')='Y'
        AND doc_no IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%')
UNION ALL SELECT N'3 下发任务行', COUNT(*) FROM rd_dev_task WHERE 产品编号 LIKE N'PROBE-DEV-%'
UNION ALL SELECT N'4 站内消息(SPEC_DISPATCHED)', COUNT(*) FROM yj_message WHERE 消息码=N'SPEC_DISPATCHED'
        AND 单据编号 IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%')
UNION ALL SELECT N'5 审批留痕(SUBMIT/APPROVE)', COUNT(*) FROM yj_form_approval WHERE panel_code=N'RD_PROD_INFO'
        AND form_no IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%');

SELECT 产品编号, 目标面板, ISNULL(负责人,N'(挂起)') AS 负责人, ISNULL(下发人,N'') AS 下发人, 源单据号,
       CONVERT(nvarchar, 下发时间, 120) AS 下发时间
FROM rd_dev_task WHERE 产品编号 LIKE N'PROBE-DEV-%' ORDER BY 产品编号, 目标面板;

SELECT 收件人, 消息码, 面板编码, 单据编号, 参数, CONVERT(nvarchar, 创建时间, 120) AS 创建时间
FROM yj_message WHERE 消息码 = N'SPEC_DISPATCHED'
  AND 单据编号 IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%');

SELECT action, result, ISNULL(opinion, N'') AS opinion, operator, CONVERT(nvarchar, create_time, 120) AS create_time
FROM yj_form_approval WHERE panel_code = N'RD_PROD_INFO'
  AND form_no IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-DEV-%')
ORDER BY id;
GO
