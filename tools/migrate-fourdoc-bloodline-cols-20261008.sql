/* migrate-fourdoc-bloodline-cols-20261008.sql — 采购链四单:补回基线档登记、但本机表已无的 5 个物理列
 *
 * 【为什么有这条】
 *   docs/development/采购链四单字段与显示字段.md(2026-10-03 基线)登记了 5 个字段,而本机两账套的
 *   物理列已不存在 —— 于是"按文档实现字段"卡在这 5 行上:
 *     · QC_RETURN  表头 「退货原因」(文本,可见)
 *     · QC_RETURN  表头 「经手人」  (参照 EMP,可见)
 *     · QC_RETURN  明细 「单位」    (参照 UOM,隐藏)
 *     · PURCHASE_IN 明细 「仓位名称」(文本,隐藏)
 *     · PURCHASE_IN 明细 「换算率2」 (文本,隐藏)
 *   查证:`yj_schema_log` 里**没有任何迁移**删过这几列(DROP/rename 全无命中),测试账套(09-28 快照 + 之后迁移)
 *   与正式库结构完全一致 ⇒ 这几列在本机是**越链操作/结构导入**时丢的,不是迁移链的正常演进。
 *   本脚本按文档把列补回来(纯 NULL 空列,无破坏性),随后由 migrate-fourdoc-baseline-restore-20261008.sql
 *   把 5 行字段登记一并回正(重跑生成器后基线为 329 行)。
 *
 * ⚠ 不在本脚本范围:「QC_RETURN 明细 退货数量」的**列名**仍是 `数量`(存量数据在 `数量`,实测 15/15 非空)——
 *   按 doc §5.4/§8.4 的口径,字段标签(数据键)保持「退货数量」不变、物理列绑 `数量`(后端 inspAutoReturn
 *   按面板注册标签择一写入)。若加一个空的 `退货数量` 列并把字段改绑过去,界面数量会变空,属功能倒退,故不做。
 *
 * 【幂等】逐列 COL_LENGTH 守卫;列已存在即跳过。带列级 MS_Description 中文注明(数据库规范硬要求)。
 * 【执行】两账套各跑一遍(先 HSDZ_MES、后 HSDZ_MES_TEST);本脚本排在回正脚本之前。
 */
SET NOCOUNT ON;
GO

DECLARE @added int = 0;

/* ---------- ① QC_RETURN 表头:退货原因 / 经手人 ---------- */
IF COL_LENGTH('dbo.qc_return', N'退货原因') IS NULL
BEGIN
  ALTER TABLE dbo.qc_return ADD [退货原因] nvarchar(500) NULL;
  SET @added += 1;
END
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.qc_return')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return'), N'退货原因', 'ColumnId')
                  AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'退货原因:暂收退料单的退货/退料事由(面板 QC_RETURN 表头,可见)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_return', N'COLUMN', N'退货原因';

IF COL_LENGTH('dbo.qc_return', N'经手人') IS NULL
BEGIN
  ALTER TABLE dbo.qc_return ADD [经手人] nvarchar(100) NULL;
  SET @added += 1;
END
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.qc_return')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return'), N'经手人', 'ColumnId')
                  AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'经手人:暂收退料单经办人(参照员工档案 EMP.员工名称;面板 QC_RETURN 表头)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_return', N'COLUMN', N'经手人';
GO

/* ---------- ② QC_RETURN 明细:单位(隐藏列,参照 UOM) ---------- */
IF COL_LENGTH('dbo.qc_return_detail', N'单位') IS NULL
BEGIN
  ALTER TABLE dbo.qc_return_detail ADD [单位] nvarchar(100) NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.qc_return_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'), N'单位', 'ColumnId')
                  AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'单位:暂收退料单明细的计量单位(参照计量单位档案 UOM;面板 QC_RETURN 明细隐藏列,与「计量单位」同源)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'单位';
GO

/* ---------- ③ PURCHASE_IN 明细:仓位名称 / 换算率2(隐藏列) ---------- */
IF COL_LENGTH('dbo.bl_purchase_in', N'仓位名称') IS NULL
BEGIN
  ALTER TABLE dbo.bl_purchase_in ADD [仓位名称] nvarchar(200) NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.bl_purchase_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bl_purchase_in'), N'仓位名称', 'ColumnId')
                  AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'仓位名称:采购入库单明细的仓位(面板 PURCHASE_IN 明细隐藏列,随 ERP 血统保留)',
       N'SCHEMA', N'dbo', N'TABLE', N'bl_purchase_in', N'COLUMN', N'仓位名称';

IF COL_LENGTH('dbo.bl_purchase_in', N'换算率2') IS NULL
BEGIN
  ALTER TABLE dbo.bl_purchase_in ADD [换算率2] nvarchar(200) NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.bl_purchase_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bl_purchase_in'), N'换算率2', 'ColumnId')
                  AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'换算率2:采购入库单明细辅助单位换算率(面板 PURCHASE_IN 明细隐藏列,随 ERP 血统保留)',
       N'SCHEMA', N'dbo', N'TABLE', N'bl_purchase_in', N'COLUMN', N'换算率2';
GO

/* ---------- ④ 存量回填:明细「单位」← 同表「计量单位」(仅补空) ---------- */
UPDATE d
   SET d.[单位] = d.[计量单位]
  FROM dbo.qc_return_detail d
 WHERE d.[单位] IS NULL AND ISNULL(d.[计量单位], N'') <> N'';
PRINT N'qc_return_detail.单位 回填行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ⑤ 自检:5 列必须在 ---------- */
DECLARE @miss nvarchar(400) = N'';
IF COL_LENGTH('dbo.qc_return', N'退货原因') IS NULL SET @miss += N' qc_return.退货原因';
IF COL_LENGTH('dbo.qc_return', N'经手人') IS NULL SET @miss += N' qc_return.经手人';
IF COL_LENGTH('dbo.qc_return_detail', N'单位') IS NULL SET @miss += N' qc_return_detail.单位';
IF COL_LENGTH('dbo.bl_purchase_in', N'仓位名称') IS NULL SET @miss += N' bl_purchase_in.仓位名称';
IF COL_LENGTH('dbo.bl_purchase_in', N'换算率2') IS NULL SET @miss += N' bl_purchase_in.换算率2';
IF @miss <> N'' RAISERROR(N'四单血统列补建失败,仍缺:%s', 16, 1, @miss);
ELSE PRINT N'✅ 四单血统列已齐(退货原因/经手人/单位/仓位名称/换算率2)';
GO
PRINT N'migrate-fourdoc-bloodline-cols-20261008 完成';
GO
