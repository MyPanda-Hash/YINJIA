/* ============================================================================
 * 材料码打印单:**一次打印 = 一行 = 一张打印单**(2026-10-04 追加口径)
 * ----------------------------------------------------------------------------
 * 用户口径:「打印需要是每次一行,不能多行否则作废就全部作废了」。
 * 作废是按**单据编号**整张作的(bd_pu_label 头 + bl_pu_label 行一并软删),多行挤在一张单里,
 * 作废其中一行必然连累其余行 ⇒ 打印粒度钉死成"一次一行一张单":
 *
 *   ① 服务端 PuLabelService.print 强制 rows.size()==1(多行直接拒),并且**每次都新建头**;
 *   ② 因此原来那条「同订单 + 同批次号只有一张存活头」的唯一索引
 *      uq_bd_pu_label_order_batch **必须废掉** —— 否则"先打甲行、再打乙行,同一个批次号"
 *      第二张头会被唯一索引顶掉(当年就是它导致 UX 重复键 500);
 *   ③ 原来靠"复用同一张头"实现的**重打不重复占量**,改由显式入口承担:
 *      PuLabelService.reprint(打印次数 +1,不新增预约);前端「已打印记录」里就地「重打」。
 *
 * 顺带把表/列的中文注明改成新口径(旧注明写着"同订单+同批次号复用同一张",会误导后来人)。
 *
 * 幂等:索引删过即跳过;注明用 sp_updateextendedproperty;两账套均执行。
 * 配套代码(同提交):PuLabelService(print 一次一行 + reprint)、PxController(/px/puLabel/reprint)、
 *   engine.puLabelReprint、MaterialLabelDialog.vue(单选 + 重打)、
 *   tools/archive/_verify-pu-label.mjs/_verify-pu-label-ui.cjs。
 * ========================================================================== */

SET NOCOUNT ON;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- ① 废掉「同订单+同批次号一张存活头」的唯一索引 ---------- */
IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE name = N'uq_bd_pu_label_order_batch' AND object_id = OBJECT_ID(N'dbo.bd_pu_label'))
BEGIN
    DROP INDEX uq_bd_pu_label_order_batch ON dbo.bd_pu_label;
    PRINT N'① 已删除唯一索引 uq_bd_pu_label_order_batch(一次一行后同订单+同号可以有多张单)';
END
ELSE
    PRINT N'① 唯一索引 uq_bd_pu_label_order_batch 不存在,跳过';
GO

/* ---------- ② 行表那条「同单同行只有一行」的唯一索引留着 ----------
 * 一次一行 ⇒ 一张单本来就只有一行,它依然成立(历史多行单也满足:行 id 各不相同) */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'uq_bl_pu_label_doc_line' AND object_id = OBJECT_ID(N'dbo.bl_pu_label'))
    PRINT N'② 警告:uq_bl_pu_label_doc_line 不在了(它应当保留)';
ELSE
    PRINT N'② 行表唯一索引 uq_bl_pu_label_doc_line 保留(一张单一行,依然成立)';
GO

/* ---------- ③ 中文注明改成新口径 ---------- */
DECLARE @c TABLE (tbl sysname, col sysname, txt nvarchar(400));
INSERT INTO @c (tbl, col, txt) VALUES
  (N'bd_pu_label', N'__TABLE__',
   N'采购订单材料码打印单(头):供应商自行打码时批次号的登记处。**一次打印 = 一行 = 一张单**(2026-10-04 口径:作废按单作,多行会一起作废),因此每次打印都新建一张头;需要"同一张纸再打一遍"用「重打」(只累加打印次数,不新增预约)。打印即预约,未生单预约量从余量里扣减,作废即释放'),
  (N'bd_pu_label', N'采购订单号',
   N'来源采购订单号(bd_pu_order.单据编号);与批次号一起只用于反查,**不再唯一标识一张打印单**(一次一行后同订单+同批次号可以有多张)'),
  (N'bd_pu_label', N'批次号',
   N'★本批材料码上的批次号:默认=供应商编码去掉 YJ- 前缀 + - + 打印当天 yyyyMMdd,可人工改;打印后即为该订单上批次号的权威值,生单按它落库、不再按公式重算。同订单+同批次号**允许有多张打印单**(一次一行)'),
  (N'bd_pu_label', N'打印次数',
   N'累计打印次数(重打累加,便于追溯"这批标签打过几次");新建时为 1,不因重打而重复占用余量'),
  (N'bl_pu_label', N'__TABLE__',
   N'采购订单材料码打印单(行):本批次号下该采购订单行打印了多少。**一次打印只有一行**(2026-10-04 口径),历史多行单保留;采购订单行id 与 form_flow_link.source_line_key 的 "{采购订单号}#{行id}" 同锚;已生单量不落本表,由 form_flow_link 派生');

DECLARE @tbl sysname, @col sysname, @txt nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @c;
OPEN cur; FETCH NEXT FROM cur INTO @tbl, @col, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF @col = N'__TABLE__'
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.' + @tbl) AND minor_id = 0 AND name = 'MS_Description')
            EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl;
        ELSE
            EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl;
    END
    ELSE IF COL_LENGTH(N'dbo.' + @tbl, @col) IS NOT NULL
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID(N'dbo.' + @tbl)
                     AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @col, 'ColumnId')
                     AND name = 'MS_Description')
            EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
        ELSE
            EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    END
    FETCH NEXT FROM cur INTO @tbl, @col, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'③ 新口径中文注明已写入(表 + 采购订单号/批次号/打印次数 列)';
GO

/* ---------- ④ 自检 ---------- */
IF OBJECT_ID(N'dbo.bd_pu_label') IS NULL RAISERROR(N'自检失败:bd_pu_label 不存在(应先跑 migrate-pu-label.sql)', 16, 1);
IF OBJECT_ID(N'dbo.bl_pu_label') IS NULL RAISERROR(N'自检失败:bl_pu_label 不存在(应先跑 migrate-pu-label.sql)', 16, 1);

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'uq_bd_pu_label_order_batch' AND object_id = OBJECT_ID(N'dbo.bd_pu_label'))
    RAISERROR(N'自检失败:唯一索引 uq_bd_pu_label_order_batch 仍在 —— 同订单+同批次号的第二张打印单会被顶掉', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.bd_pu_label') AND minor_id = 0 AND name = 'MS_Description'
                 AND CAST(value AS nvarchar(400)) LIKE N'%一次打印 = 一行 = 一张单%')
    RAISERROR(N'自检失败:bd_pu_label 表级中文注明没更新成「一次打印 = 一行 = 一张单」口径', 16, 1);

SELECT N'自检' AS k, i.name AS 索引, i.is_unique AS 唯一, i.has_filter AS 带筛选
FROM sys.indexes i WHERE i.object_id = OBJECT_ID(N'dbo.bd_pu_label') AND i.name IS NOT NULL
ORDER BY i.name;
GO

PRINT N'✅ 材料码打印单已切到「一次一行一张单」(唯一索引已废,注明已改口径)';
GO
