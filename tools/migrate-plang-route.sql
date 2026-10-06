/* migrate-plang-route.sql(2026-10-05):工单关联工艺路线(plang.工艺路线)
 *
 * 用户口径:「当前工单需要关联工序路线,意味着转工单的时候需要选择工序路线」。
 * 处置:工单行加 `工艺路线` 列(存 bs_route.工艺路线编码),转工单时写入(快速排产弹窗选择);
 *   回填口径:优先取产品档案绑定(bs_inv.工艺路线),未绑定 → 默认 **GY-CB-STD**(炭棒标准路线,推荐口径)。
 *   有了它,工单详情的工序步骤条改为**按该路线自己的工序序列**渲染(没绑则回退标准五步)。
 * 撤回:ALTER TABLE plang DROP COLUMN [工艺路线];  (一行,无业务数据损失)
 * 幂等可重跑;两账套均执行。
 */
IF COL_LENGTH('plang', N'工艺路线') IS NULL ALTER TABLE plang ADD [工艺路线] nvarchar(50) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.plang')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'工艺路线', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'工艺路线:工单采用的工艺路线编码(→bs_route.工艺路线编码),转工单时选择;空=未指定(按默认 GY-CB-STD 处理)',
       N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'工艺路线';
GO
UPDATE p SET p.工艺路线 = ISNULL(NULLIF(rv.工艺路线, N''), N'GY-CB-STD')
  FROM plang p LEFT JOIN bs_inv rv ON rv.存货编码 = p.dm AND ISNULL(rv.asp_cancel,'N') <> 'Y'
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.工艺路线, N'') = N'';
GO
DECLARE @bad int = 0;
IF COL_LENGTH('plang', N'工艺路线') IS NULL SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工艺路线,N'')=N'') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM bs_route WHERE 工艺路线编码 = N'GY-CB-STD' AND ISNULL(asp_cancel,'N')<>'Y') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工单关联工艺路线自检失败', 16, 1);
ELSE PRINT N'工单工艺路线就绪:列已加 + 存量回填(产品绑定优先,否则 GY-CB-STD)';
GO