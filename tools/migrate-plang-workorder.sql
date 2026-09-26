/* ============================================================
   migrate-plang-workorder.sql — 2026-09-24 生产工单列表数据源切参考库 plang
   ------------------------------------------------------------
   背景(用户拍板):「生产工单」页(/px/workOrderList,WorkOrderList.vue)数据源由
   bd_manu_order×bl_manu_order 切换为参考库工单表 plang(外部系统直接写单,
   键=公司代码 comm + 工单号 pl_no + 工单行号 pl_xc);打印生产任务单留痕需要
   打印人/打印时间 两列(bd_manu_order 同名同义,对齐 ProSchedList 口径)。

   ⚠ 表属清单第 9 组 legacy;已核 plang 无任何面板/后端引用
   (yj_panel 无行、Java 零引用,仅盘点文档),本脚本为纯增量加列,幂等可重跑。
   ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.plang', N'打印人') IS NULL
    ALTER TABLE dbo.plang ADD [打印人] nvarchar(40) NULL;
IF COL_LENGTH(N'dbo.plang', N'打印时间') IS NULL
    ALTER TABLE dbo.plang ADD [打印时间] datetime NULL;
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
