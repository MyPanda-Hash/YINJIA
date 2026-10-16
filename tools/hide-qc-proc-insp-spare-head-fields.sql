/* hide-qc-proc-insp-spare-head-fields.sql(2026-10-12)
 *
 * 用户口径:「表头字段不需要存在那么多的字段内容,使用到的对应字段可以隐藏起来」。
 *
 * 背景:制程检验单(QC_PROC_INSP)头表 28 个字段全部可编辑并铺在纸张抬头上,
 *   字段过多、且含一批**运行/审计类**字段(报工数量/生产线/审核人…),业务填写时用不到。
 *   纸张式页面的抬头读 yj_field(过滤 hidden),故**置 hidden=1 即可从页面收掉**,
 *   字段与数据保留、随时可放开(改回 hidden=0)。
 *
 * 保留(15):单据编号 单据日期 检验类别 工单号 工序 批次号 客户名称 产品编码
 *           产品名称 规格型号 抽检总量 检验员 检验日期 总结论 检验方案
 * 隐藏(13):检验时间 工单行号 报工单号 生产线 生产车间 报工数量 检验数量
 *           文件编码 执行标准 处理方式 审核人 审核时间 单据状态
 *
 * 幂等;两账套均执行。
 */
SET NOCOUNT ON;
GO

DECLARE @hide TABLE (col nvarchar(50));
INSERT INTO @hide VALUES
 (N'检验时间'), (N'工单行号'), (N'报工单号'), (N'生产线'), (N'生产车间'),
 (N'报工数量'), (N'检验数量'), (N'文件编码'), (N'执行标准'), (N'处理方式'),
 (N'审核人'), (N'审核时间'), (N'单据状态');

DECLARE @c nvarchar(50), @n int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col FROM @hide;
OPEN cur FETCH NEXT FROM cur INTO @c;
WHILE @@FETCH_STATUS = 0
BEGIN
  UPDATE yj_field SET hidden = 1
   WHERE panel_code = N'QC_PROC_INSP' AND col_name = @c AND ISNULL(hidden,0) <> 1;
  SET @n = @n + @@ROWCOUNT;
  FETCH NEXT FROM cur INTO @c;
END
CLOSE cur DEALLOCATE cur;
PRINT N'[OK] 制程检验单收起表头字段 ' + CAST(@n AS nvarchar(4)) + N' 个';
GO

/* 自检:13 个字段必须已 hidden,且 15 个保留字段仍可见 */
DECLARE @bad int = 0;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP'
      AND col_name IN (N'检验时间',N'工单行号',N'报工单号',N'生产线',N'生产车间',N'报工数量',
                       N'检验数量',N'文件编码',N'执行标准',N'处理方式',N'审核人',N'审核时间',N'单据状态')
      AND ISNULL(hidden,0) = 1) < 13 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP'
      AND col_name IN (N'单据编号',N'单据日期',N'检验类别',N'工单号',N'工序',N'批次号',N'客户名称',
                       N'产品编码',N'产品名称',N'规格型号',N'抽检总量',N'检验员',N'检验日期',
                       N'总结论',N'检验方案')
      AND ISNULL(hidden,0) = 0) < 15 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单表头字段收起自检失败', 16, 1);
ELSE PRINT N'制程检验单表头字段就绪(保留 15 / 收起 13)';
GO
