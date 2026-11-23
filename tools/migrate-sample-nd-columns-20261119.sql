/* ============================================================================
 * migrate-sample-nd-columns-20261119.sql
 * 外部-非开发样品申请单（RD_SAMPLE_ND）明细：加「产品编码」「产品名称」
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-19 销售问题汇总 P5）：
 *   「这几个去掉（产品整体规格/产品功能/性能要求），前面增加：产品编码、产品名称」。
 * 纸面去掉的三列只改前端配置（数据/历史值保留在库）；新增的两列必须有物理列 + yj_field，
 * 否则保存会被后端静默丢弃（label 不在元数据里）。
 * 幂等：COL_LENGTH / NOT EXISTS 守卫；两账套都执行。
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('rd_sample_nondev_detail') IS NULL
    PRINT N'[sample-nd-cols] 本库无 rd_sample_nondev_detail，跳过';
GO

IF OBJECT_ID('rd_sample_nondev_detail') IS NOT NULL AND COL_LENGTH('rd_sample_nondev_detail', N'产品编码') IS NULL
    ALTER TABLE rd_sample_nondev_detail ADD [产品编码] nvarchar(60) NULL;
GO
IF OBJECT_ID('rd_sample_nondev_detail') IS NOT NULL AND COL_LENGTH('rd_sample_nondev_detail', N'产品名称') IS NULL
    ALTER TABLE rd_sample_nondev_detail ADD [产品名称] nvarchar(200) NULL;
GO

IF OBJECT_ID('rd_sample_nondev_detail') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SAMPLE_ND' AND label = N'产品编码')
        INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
        VALUES (N'RD_SAMPLE_ND', N'产品编码', N'产品编码', N'文本', N'detail', 1, 200, 1, 0, 0, 1);
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SAMPLE_ND' AND label = N'产品名称')
        INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
        VALUES (N'RD_SAMPLE_ND', N'产品名称', N'产品名称', N'文本', N'detail', 2, 240, 1, 0, 0, 1);
    PRINT N'[sample-nd-cols] 字段行就绪';
END
GO

IF OBJECT_ID('rd_sample_nondev_detail') IS NOT NULL
   AND (SELECT COUNT(*) FROM yj_field WHERE panel_code='RD_SAMPLE_ND' AND place='detail' AND label IN (N'产品编码',N'产品名称')) <> 2
    RAISERROR(N'[sample-nd-cols] 自检失败：产品编码/产品名称字段各应 1 行', 16, 1);
ELSE PRINT N'[sample-nd-cols] 自检通过';
GO
