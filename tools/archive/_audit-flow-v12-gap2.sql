SET NOCOUNT ON;
SELECT DB_NAME() AS 数据库;

PRINT N'=== L. 五道工序相关对象是否存在 ===';
SELECT name AS 对象, type_desc AS 类型 FROM sys.objects
WHERE name IN (N'bs_route',N'wo_progress',N'wo_process_line',N'wo_transfer_log',N'wo_split_log',
               N'bs_line_capacity',N'bs_line_open',N'v_line_load',N'v_manu_schedule',N'wo_kit')
   OR name LIKE N'%line_stock%' OR name LIKE N'%线边%' OR name LIKE N'%kit%' OR name LIKE N'%capacity%'
ORDER BY name;

PRINT N'=== M. 线边库存/车间仓 档案与数据 ===';
SELECT COUNT(*) AS 线边仓档案数 FROM dbo.bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND (仓库名称 LIKE N'%线边%' OR 仓库名称 LIKE N'%车间%');
SELECT COUNT(*) AS 车间仓库存行 FROM dbo.kucun k JOIN dbo.bs_wh w ON w.仓库编码=k.ckdm
WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(w.仓库名称,N'') LIKE N'%车间%';

PRINT N'=== N. 产能与负荷 ===';
SELECT CASE WHEN OBJECT_ID(N'dbo.bs_line_capacity') IS NULL THEN N'bs_line_capacity 已删除' ELSE N'bs_line_capacity 存在' END AS 产能表;
SELECT TOP 10 * FROM dbo.v_line_load;

PRINT N'=== O. 工序任务(wo_progress)生成情况 ===';
SELECT COUNT(*) AS 工序任务总数, COUNT(DISTINCT 单据编号) AS 覆盖工单数, COUNT(DISTINCT 工序) AS 覆盖工序数
FROM dbo.wo_progress WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT ISNULL(工序,N'(空)') AS 工序, COUNT(*) AS 任务行 FROM dbo.wo_progress WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 工序 ORDER BY 工序;

PRINT N'=== P. 预排台账(工序-产线) ===';
SELECT 工单号, 工单行id, 工序, ISNULL(计划生产线,N'') AS 计划生产线, ISNULL(实际生产线,N'') AS 实际生产线, ISNULL(状态,N'') AS 状态
FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 工单号, 工序序, id;

PRINT N'=== Q. 库存流水(产成品/材料) ===';
SELECT 'kucun 库存行' AS 项, COUNT(*) AS 行数 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'inh 入库流水', COUNT(*) FROM dbo.inh
UNION ALL SELECT 'outh 出库流水', COUNT(*) FROM dbo.outh;

PRINT N'=== R. 成本核算相关列/数据 ===';
SELECT COUNT(*) AS 出库总行 FROM dbo.outh;
SELECT COUNT(*) AS 库存行数 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y';

PRINT N'=== S. 二维码/标签表数据量 ===';
SELECT 'bd_pu_label' AS 表, COUNT(*) AS 行数 FROM dbo.bd_pu_label
UNION ALL SELECT 'bl_pu_label', COUNT(*) FROM dbo.bl_pu_label
UNION ALL SELECT 'qr_batch_registry', COUNT(*) FROM dbo.qr_batch_registry;

PRINT N'=== T. 单据状态表覆盖(各面板已审核量) ===';
SELECT panel_code AS 面板, COUNT(*) AS 状态行, SUM(CASE WHEN shr IS NOT NULL THEN 1 ELSE 0 END) AS 已审核
FROM dbo.yj_doc_status GROUP BY panel_code ORDER BY panel_code;
