SET NOCOUNT ON;
PRINT '--- yj_schema_log 列 ---';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('yj_schema_log') ORDER BY column_id;
PRINT '--- 对象存在性 ---';
SELECT name FROM sys.objects WHERE name IN ('bd_manu_order','bl_manu_order','bs_line_capacity','bs_line_open','wo_report','wo_progress','bd_prod_line','bd_op_time','bd_prod_abn','v_manu_schedule','v_line_load','v_manu_order_detail') ORDER BY name;
PRINT '--- 面板存在性 ---';
SELECT panel_code FROM yj_panel WHERE panel_code IN ('MANU_ORDER','MANU_SCHEDULE','PROD_LINE','OP_TIME','LINE_LOAD','PROD_ABN','WO_ORDER','WO_SCHEDULE') ORDER BY panel_code;
PRINT '--- bd_manu_order 关键列 ---';
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('bd_manu_order') AND name IN (N'生产线',N'排产数量',N'需求数量',N'结案人',N'结案时间',N'打印人',N'打印时间',N'批号',N'锭号',N'生产车间',N'每箱数量',N'重点管控',N'首件完成',N'拆分序号',N'源工单号') ORDER BY name;
