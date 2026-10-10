-- _probe-wo-row-scope.sql — 生产链四模块「按工单号 vs 按工单号+行号」现状取证(2026-10-15,只读)
-- 用法(tools/ 下):java -cp lib\mssql-jdbc.jar SqlRunner.java "<jdbcUrl>" yinjia env archive\_probe-wo-row-scope.sql

PRINT '== ① bd_finish_in 列 ==';
SELECT c.name AS 列名, t.name AS 类型, c.max_length AS 长度
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bd_finish_in') ORDER BY c.column_id;

PRINT '== ② bd_finish_in 行数 ==';
SELECT COUNT(*) AS 总行数, SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 存活行数 FROM dbo.bd_finish_in;

PRINT '== ③ bd_finish_in 单据 ==';
SELECT [单据编号], ISNULL([加工单号],N'') AS 加工单号, CONVERT(varchar(10),[单据日期],120) AS 单据日期,
       ISNULL([入库类别],N'') AS 入库类别 FROM dbo.bd_finish_in ORDER BY [单据编号];

PRINT '== ④ bl_finish_in 列 ==';
SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bl_finish_in') ORDER BY c.column_id;

PRINT '== ⑤ 样本工单 plang 行 ==';
SELECT id AS 行id, pl_no AS 工单号, pl_xc AS 工单行号, ISNULL([批次号],N'') AS 批次号,
       ISNULL(scx,N'') AS 生产线, ISNULL(pl_sl,0) AS 排产数量, ISNULL(rk_sl,0) AS 入库数量, ISNULL(ja,'N') AS ja
FROM dbo.plang WHERE pl_no=N'GD-2026-10-0002' ORDER BY pl_xc, id;

PRINT '== ⑥ plang_pc 排产行 ==';
SELECT id AS 排产行id, pl_no AS 工单号, pl_xc AS 工单行号, plang_id AS 工单行id,
       ISNULL([批次号],N'') AS 批次号, ISNULL(scx,N'') AS 生产线
FROM dbo.plang_pc WHERE pl_no=N'GD-2026-10-0002' ORDER BY pl_xc, id;

PRINT '== ⑦ wo_transfer_log 全部 ==';
SELECT id, pl_no AS 工单号, pl_xc AS 工单行号, plang_id AS 工单行id, ISNULL([批次号],N'') AS 批次号,
       ISNULL(从生产线,N'') AS 从生产线, ISNULL(到生产线,N'') AS 到生产线, ISNULL(原因,N'') AS 原因,
       ISNULL(asp_cancel,'N') AS 作废
FROM dbo.wo_transfer_log ORDER BY id;

PRINT '== ⑧ scjl 报工(样本工单) ==';
SELECT id, [报工单号], gldh AS 工单号, gxdm AS 工序, sl AS 数量, ISNULL(gd_id,0) AS gd_id,
       ISNULL([批次号],N'') AS 批次号, ISNULL(wgzt,'N') AS 完工
FROM dbo.scjl WHERE gldh=N'GD-2026-10-0002' ORDER BY id;

PRINT '== ⑨ wo_transfer_log 结构 ==';
SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.wo_transfer_log') ORDER BY c.column_id;
