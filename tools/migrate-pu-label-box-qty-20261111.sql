/* ============================================================================
 * migrate-pu-label-box-qty-20261111.sql —— 采购订单「打印材料码」增「每箱数量」
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):
 *   「材料码多加一个每箱数量打印,每箱数量才等于标识卡上的数量」
 *   + 追问确认:「用 B 就行(仍一行一张卡,卡面「数量」印每箱数量,不拆多张);
 *     打多少张卡在打印预览里选份数」;
 *   + 零头口径:「按每箱数量打印,并且给他提示零头箱数量不足每箱,可以单独打印零头箱相关数量」。
 *
 * 落库位置:行表 `bl_pu_label.[每箱数量]` decimal(18,4) NULL。
 *   为什么放行而不是放头:
 *     · 一张打印单 = 一个采购订单行(见 PuLabelService.print 的"每行一张单"),
 *       每箱数量是**物料/包装属性**,同一张单里若日后允许多行,逐行各写各的才对;
 *     · 头部已有 [批次号]/[生产日期] 是"这批货"的属性,与包装规格不同级。
 *   为什么要落库:卡面「数量」改为印每箱数量 ⇒ **重打必须原样重现**,
 *     不能靠"这次再抄一遍输入框"(人工可能改过),所以打印时即快照。
 *
 * 历史行(本次之前打印的):[每箱数量] 为 NULL ⇒ 前端回退成「本次打印数量」,
 *   卡面与旧版一致(不会把老标签打成 0 或空白)。
 *
 * 本脚本(幂等,只加一列 + 一条列注明,不动任何业务数据):
 *   ① ALTER TABLE ADD [每箱数量] decimal(18,4) NULL(列已存在则跳过);
 *   ② 写列级 MS_Description(《数据库注明与全量部署规范》);
 *   ③ 自检:列存在 + 类型 decimal(18,4) + 可空 + 注明存在,否则 RAISERROR。
 *
 * ⚠ 同一批代码改动(同提交):
 *   · 后端 PuLabelService —— dialog 回「每箱数量」(取该行最近一次打印值预填)、
 *     print 落库并回给前端出纸、reprint 原样带回;
 *   · 前端 MaterialLabelDialog.vue —— 主表/补登表各加「每箱数量」列、
 *     出纸卡面 数量 = 每箱数量(空则回退本次打印数量)、整箱/零头提示;
 *   · 多语言:i18n-pu-label-box-qty-20261111.sql(每箱数量,scope=field,10 语言)
 *     + 前端 locales 静态包(en/ja/ko/de/es/fr/ru/th/vi/zh-TW);
 *   · 表清单 docs/development/数据库表清单.md:bl_pu_label 列数 17→18。
 *
 * ⚠ 两账套都要执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 加列:每箱数量(行级,卡面「数量」印它) ---------- */
IF COL_LENGTH(N'dbo.bl_pu_label', N'每箱数量') IS NULL
BEGIN
    ALTER TABLE dbo.bl_pu_label ADD [每箱数量] decimal(18,4) NULL;
    PRINT N'① 已为 bl_pu_label 增加列 [每箱数量] decimal(18,4) NULL';
END
ELSE
    PRINT N'① bl_pu_label.[每箱数量] 已存在,跳过';
GO

/* ---------- ② 中文注明 ---------- */
DECLARE @txt nvarchar(600) =
    N'★每箱数量(2026-11-11 用户口径「材料码多加一个每箱数量打印,每箱数量才等于标识卡上的数量」):'
  + N'打印材料码弹窗里逐行填写,标识卡卡面「数量」栏印**这个数**而不是本次打印数量(一箱一张卡的实物口径);'
  + N'本次打印数量仍按整批记账(预约/已打印口径不变);打印时即快照,重打原样带回;'
  + N'为空(历史行)则卡面回退印本次打印数量。整箱数=⌊本次打印数量÷每箱数量⌋,余额为「零头箱」(不足一箱,可单独打印)';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(N'dbo.bl_pu_label')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_pu_label'), N'每箱数量', 'ColumnId')
             AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', N'bl_pu_label', N'COLUMN', N'每箱数量';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', N'bl_pu_label', N'COLUMN', N'每箱数量';
PRINT N'② bl_pu_label.[每箱数量] 列注明已写入';
GO

/* ---------- ③ 自检 ---------- */
IF COL_LENGTH(N'dbo.bl_pu_label', N'每箱数量') IS NULL
    RAISERROR(N'自检失败:bl_pu_label.[每箱数量] 未建', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.columns c
               WHERE c.object_id = OBJECT_ID(N'dbo.bl_pu_label') AND c.name = N'每箱数量'
                 AND TYPE_NAME(c.user_type_id) = 'decimal'
                 AND c.precision = 18 AND c.scale = 4 AND c.is_nullable = 1)
    RAISERROR(N'自检失败:bl_pu_label.[每箱数量] 类型应为 decimal(18,4) NULL', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bl_pu_label')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_pu_label'), N'每箱数量', 'ColumnId')
                 AND ep.name = N'MS_Description')
    RAISERROR(N'自检失败:bl_pu_label.[每箱数量] 缺列级中文注明', 16, 1);

SELECT N'自检' AS k, c.name AS 列, TYPE_NAME(c.user_type_id) AS 类型,
       CAST(c.precision AS varchar(5)) + ',' + CAST(c.scale AS varchar(5)) AS 精度,
       c.is_nullable AS 可空
FROM sys.columns c
WHERE c.object_id = OBJECT_ID(N'dbo.bl_pu_label') AND c.name = N'每箱数量';
GO
PRINT N'✅ 材料码打印单每箱数量列就绪(bl_pu_label.[每箱数量] decimal(18,4) NULL)';
GO
