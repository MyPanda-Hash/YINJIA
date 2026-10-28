/* ============================================================================
 * migrate-pu-label-prod-date-20261023.sql —— 采购订单「打印材料码」弹窗增「生产日期」
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-23):
 *   「采购订单的打印材料码界面需要在批次号后面加个生产日期,进行填写,
 *     填写后可以打印的材料码会加上生产日期」
 *   ⇒ ① 弹窗顶部在**批次号右边**加一个「生产日期」日期框(可填);
 *      ② 确认并打印后,**打印出来的材料码标签卡面上「生产日期」一栏印上这个日期**
 *         (版式早就有这一栏,此前一直传空串 ⇒ 打出来是空白手填线)。
 *
 * 落库位置(**按头登记**):`bd_pu_label.[生产日期]` date NULL ——
 *   一张打印单只对应一个批次号 = 一批货 = 一个生产日期,故与 [批次号] 同级放在头上;
 *   行表不放(同一张单的多行必然是同一批货,重复存反而会不一致)。
 *   「重打」走 bd_pu_label 单头读数 ⇒ 生产日期自然跟着出来,与批次号同一条路径。
 *
 * 本脚本(幂等,只加一列 + 一条列注明,不动任何业务数据):
 *   ① ALTER TABLE ADD [生产日期] date NULL(列已存在则跳过);
 *   ② 写列级 MS_Description(《数据库注明与全量部署规范》);
 *   ③ 自检:列存在 + 类型 date + 注明存在,否则 RAISERROR。
 *
 * 历史行(本次之前打印的单):[生产日期] 为 NULL ⇒ 卡面该栏仍留空白手填线(与原行为一致)。
 *
 * ⚠ 同一批代码改动(同提交):
 *   · 后端 PuLabelService —— dialog 回可选值、print 落库、reprint 带回、records 展示;
 *     PxController —— /puLabel/print 读 body 的 prodDate;
 *   · 前端 MaterialLabelDialog.vue —— 批次号右侧日期框 + 出纸时灌进卡面 生产日期;
 *   · 多语言:生产日期/恢复默认/请选择生产日期 等词条(en/ja/zh-TW/de/es/fr/ko/ru/th/vi);
 *   · 表清单 docs/development/数据库表清单.md:bd_pu_label 列数 15→16。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 加列:生产日期(按头登记,与批次号同级) ---------- */
IF COL_LENGTH(N'dbo.bd_pu_label', N'生产日期') IS NULL
BEGIN
    ALTER TABLE dbo.bd_pu_label ADD [生产日期] date NULL;
    PRINT N'① 已为 bd_pu_label 增加列 [生产日期] date NULL';
END
ELSE
    PRINT N'① bd_pu_label.[生产日期] 已存在,跳过';
GO

/* ---------- ② 中文注明 ---------- */
DECLARE @txt nvarchar(600) =
    N'★本批材料码上的生产日期(2026-10-23 用户口径「在批次号后面加个生产日期,填写后打印的材料码会加上生产日期」):'
  + N'打印时在批次号旁边手填,确认后与批次号一起登记在本张打印单上,标识卡卡面「生产日期」栏印此值;'
  + N'一张打印单 = 一个批次号 = 一批货 ⇒ 生产日期与批次号同级放头上,不放到行;重打原样带出;为空则卡面该栏留空白手填';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(N'dbo.bd_pu_label')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_pu_label'), N'生产日期', 'ColumnId')
             AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', N'bd_pu_label', N'COLUMN', N'生产日期';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', N'bd_pu_label', N'COLUMN', N'生产日期';
PRINT N'② bd_pu_label.[生产日期] 列注明已写入';
GO

/* ---------- ③ 自检 ---------- */
IF COL_LENGTH(N'dbo.bd_pu_label', N'生产日期') IS NULL
    RAISERROR(N'自检失败:bd_pu_label.[生产日期] 未建', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.columns c
               WHERE c.object_id = OBJECT_ID(N'dbo.bd_pu_label') AND c.name = N'生产日期'
                 AND TYPE_NAME(c.user_type_id) = 'date' AND c.is_nullable = 1)
    RAISERROR(N'自检失败:bd_pu_label.[生产日期] 类型应为 date NULL', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bd_pu_label')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_pu_label'), N'生产日期', 'ColumnId')
                 AND ep.name = N'MS_Description')
    RAISERROR(N'自检失败:bd_pu_label.[生产日期] 缺列级中文注明', 16, 1);

SELECT N'自检' AS k, c.name AS 列, TYPE_NAME(c.user_type_id) AS 类型, c.is_nullable AS 可空
FROM sys.columns c
WHERE c.object_id = OBJECT_ID(N'dbo.bd_pu_label') AND c.name = N'生产日期';
GO
PRINT N'✅ 材料码打印单生产日期列就绪(bd_pu_label.[生产日期] date NULL)';
GO
