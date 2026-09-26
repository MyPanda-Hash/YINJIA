/* ============================================================
   migrate-plang-workorder.sql — 2026-09-24 生产工单列表数据源切参考库 plang
   ------------------------------------------------------------
   背景(用户拍板):「生产工单」页(/px/workOrderList,WorkOrderList.vue)数据源由
   bd_manu_order×bl_manu_order 切换为参考库工单表 plang(外部系统直接写单,
   键=公司代码 comm + 工单号 pl_no + 工单行号 pl_xc);打印生产任务单留痕需要
   打印人/打印时间 两列(bd_manu_order 同名同义,对齐 ProSchedList 口径)。

   ⚠ 表属清单第 9 组 legacy;已核 plang 无任何面板/后端引用
   (yj_panel 无行、Java 零引用,仅盘点文档),本脚本为纯增量变更,幂等可重跑。

   2026-09-26 补:转工单(OrderConvertService.toManu)落 plang 后工单号沿用 MO
   号池格式 MO-yyyy-MM-xxxx(15 字符),而 plang.pl_no 实际只有 nvarchar(14)
   (28 字节;旧库导出按字节显示易误读为 28 字符)——扩三列并对齐档案口径:
     pl_no nvarchar(14)→nvarchar(28)  工单号(容纳 MO-yyyy-MM-xxxx 与外部单号)
     khdm  nvarchar(8) →nvarchar(40)  客户代码(对齐 dm_kh.dm)
     od_no nvarchar(24)→nvarchar(50)  订单号(销售订单号可能超 24 字符)
   ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.plang', N'打印人') IS NULL
    ALTER TABLE dbo.plang ADD [打印人] nvarchar(40) NULL;
IF COL_LENGTH(N'dbo.plang', N'打印时间') IS NULL
    ALTER TABLE dbo.plang ADD [打印时间] datetime NULL;
GO
IF EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.plang') AND c.name=N'pl_no' AND c.max_length < 56)
    ALTER TABLE dbo.plang ALTER COLUMN pl_no nvarchar(28) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.plang') AND c.name=N'khdm' AND c.max_length < 80)
    ALTER TABLE dbo.plang ALTER COLUMN khdm nvarchar(40) NULL;
IF EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.plang') AND c.name=N'od_no' AND c.max_length < 100)
    ALTER TABLE dbo.plang ALTER COLUMN od_no nvarchar(50) NULL;
GO
IF COL_LENGTH(N'dbo.plang', N'打印人') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.plang')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'打印人', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'打印人(生产任务单打印留痕,/px/workOrderList/printStamp 写入;对齐 bd_manu_order.打印人)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'打印人';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'打印人(生产任务单打印留痕,/px/workOrderList/printStamp 写入;对齐 bd_manu_order.打印人)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'打印人';
END
GO
IF COL_LENGTH(N'dbo.plang', N'打印时间') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.plang')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'打印时间', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'打印时间(生产任务单打印留痕;对齐 bd_manu_order.打印时间)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'打印时间';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'打印时间(生产任务单打印留痕;对齐 bd_manu_order.打印时间)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'打印时间';
END
GO
PRINT N'plang 打印留痕两列就绪(幂等)';
GO
