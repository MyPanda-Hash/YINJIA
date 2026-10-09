/* migrate-unit-chain.sql(2026-10-05):单位链(商品档案单位换算 → 工单单位换算率/生产数量)
 * 用户口径:「全部都先加入单位;成品库存单位记账待定」+「工序转换和最后的订单数量不影响是正确的」。
 * 只加列 + 登记元数据;**不碰入库/结案/报工封顶/成品收口**。
 * ⚠ 加列与回填必须分开批(GO):SQL Server 整批预编译,同批 UPDATE 会报 Invalid column name。
 * 撤回:ALTER TABLE ... DROP COLUMN(纯增量列);幂等;两账套均执行。
 */
IF COL_LENGTH('bs_inv', N'生产单位') IS NULL ALTER TABLE bs_inv ADD [生产单位] nvarchar(20) NULL;
IF COL_LENGTH('bs_inv', N'单位换算率') IS NULL ALTER TABLE bs_inv ADD [单位换算率] decimal(18,4) NULL;
GO
UPDATE bs_inv SET 单位换算率 = 1 WHERE 单位换算率 IS NULL;
GO
IF COL_LENGTH('plang', N'单位换算率') IS NULL ALTER TABLE plang ADD [单位换算率] decimal(18,4) NULL;
IF COL_LENGTH('plang', N'生产数量') IS NULL ALTER TABLE plang ADD [生产数量] decimal(18,4) NULL;
GO
UPDATE plang SET 单位换算率 = ISNULL(单位换算率, 1),
                 生产数量 = ISNULL(生产数量, ISNULL(pl_sl,0) * ISNULL(单位换算率,1))
 WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bs_inv')
   AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_inv'),N'生产单位','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'生产单位:生产/工序口径单位(如 支/个);销售单位见 存货单位', N'SCHEMA',N'dbo',N'TABLE',N'bs_inv',N'COLUMN',N'生产单位';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.bs_inv')
   AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_inv'),N'单位换算率','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'单位换算率:1 销售单位 = N 生产单位(默认 1;如 3支装一盒 = 3)', N'SCHEMA',N'dbo',N'TABLE',N'bs_inv',N'COLUMN',N'单位换算率';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.plang')
   AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'),N'单位换算率','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'单位换算率:转单时从商品档案带入(可覆盖);1 销售单位 = N 生产单位', N'SCHEMA',N'dbo',N'TABLE',N'plang',N'COLUMN',N'单位换算率';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID(N'dbo.plang')
   AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'),N'生产数量','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'生产数量:成品数量(排产数量)× 单位换算率;工序层再按工艺路线的计划数量换算率逐道累计', N'SCHEMA',N'dbo',N'TABLE',N'plang',N'COLUMN',N'生产数量';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'INV' AND col_name=N'生产单位')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'INV', N'生产单位', N'生产单位', N'文本', N'detail', 900, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'INV' AND col_name=N'单位换算率')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'INV', N'单位换算率', N'单位换算率', N'数值', N'detail', 910, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产单位' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产单位', 'en', N'Production UOM', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位换算率' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位换算率', 'en', N'UOM Conversion', 'manual');
GO
DECLARE @bad int = 0;
IF COL_LENGTH('bs_inv', N'生产单位') IS NULL OR COL_LENGTH('bs_inv', N'单位换算率') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH('plang', N'单位换算率') IS NULL OR COL_LENGTH('plang', N'生产数量') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'INV' AND col_name=N'单位换算率') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'单位链数据层自检失败', 16, 1);
ELSE PRINT N'单位链就绪:商品档案 生产单位/单位换算率 + 工单 单位换算率/生产数量(数量口径未动)';
GO