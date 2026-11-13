/*
 * migrate-prodinfo-required-20261112.sql
 *
 * 目的：产品信息表（RD_PROD_INFO）按用户口径把「一、二区」的字段声明为必填。
 *
 * 用户口径（2026-11-12）：
 *   「除了项目编号和项目名称，一、二、三区都是需要填写的，三区最少一行数据，
 *    剩下的那些数值以及字段都是需要填写的，在没有填写完就提交审批的情况下，
 *    弹窗提示一次，并高亮显示未填写内容」
 *
 * 落点：yj_field.required = 1（前端 validateInlineDraft 读 isRequired 做校验 +
 *       高亮缺失格；纸面标签前的红色 * 也由它驱动）。
 *
 * 本次置必填的 9 个字段（一区 7 个 + 二区 2 个）：
 *   一区：客户名称 / 客户编码 / 客户料号 / 产品管控等级 / 产品功能类别 / 产品形态 / 应用场景
 *   二区：产品整体尺寸 + 炭棒外径 / 炭棒内径 / 炭棒长度
 *        （「炭棒尺寸」是标签格，不是录入格；真正的三格是 外径/内径/长度）
 *
 * ⚠ 明确**不置必填**的：
 *   · 项目编号 / 项目名称 —— 用户点名豁免（参照立项申请带过来，允许空）；
 *   · 产品编号 / 产品名称 / 单据编号 / 单据日期 / 产品类型 —— 本来就是必填，不动；
 *   · 四区「主要性能描述」与五区（客户图纸/备注/审批人）—— 用户只要求一、二、三区；
 *   · 炭棒外径/内径/长度、产品分类 —— 隐藏列（hidden=1），不是纸面录入格。
 *
 * 三区「至少一行」：由 `tab.isRequired`（= 该面板有明细字段）在前端校验，**不需要**改库。
 *
 * 幂等：只把 required 从 0 改成 1；重复执行 0 行。末尾自检"目标字段全部必填"。
 * 执行：两个账套都要跑（HSDZ_MES / HSDZ_MES_TEST）。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @req TABLE (label nvarchar(60) PRIMARY KEY);
INSERT INTO @req (label) VALUES
    (N'客户名称'), (N'客户编码'), (N'客户料号'),
    (N'产品管控等级'), (N'产品功能类别'), (N'产品形态'), (N'应用场景'),
    (N'产品整体尺寸'),
    -- 二区「炭棒尺寸」那一行是**标签格**，真正录入的是它下面的三个格子（配置里 pair.cells），
    -- 故必填标在 外径/内径/长度 上；`炭棒尺寸` 本身只是历史整串列、不在纸面录入面上。
    (N'炭棒外径'), (N'炭棒内径'), (N'炭棒长度');

UPDATE f
SET required = 1
FROM yj_field f
JOIN @req r ON r.label = f.label
WHERE f.panel_code = N'RD_PROD_INFO' AND ISNULL(f.required, 0) = 0;
PRINT '[prodinfo-required] 置必填行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 「炭棒尺寸」是标签格、不是录入格：确保它没有被标成必填（曾被误标过） */
UPDATE yj_field
SET required = 0
WHERE panel_code = N'RD_PROD_INFO' AND label = N'炭棒尺寸' AND ISNULL(required, 0) = 1;
PRINT '[prodinfo-required] 标签格(炭棒尺寸)回退行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 用户点名豁免的两个字段：确保没有被历史配置标成必填 */
UPDATE yj_field
SET required = 0
WHERE panel_code = N'RD_PROD_INFO' AND label IN (N'项目编号', N'项目名称') AND ISNULL(required, 0) = 1;
PRINT '[prodinfo-required] 豁免(项目编号/项目名称)回退行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 自检：**只要字段在本账套存在**，就必须 required=1。
   ⚠ 不能断言"11 个字段一个不少"：实测 2026-11-12 两个账套的 yj_field 有 schema 漂移 ——
   测试账套(HSDZ_MES_TEST)的 RD_PROD_INFO 缺「客户名称」「应用场景」两行（正式库有），
   硬断言会让整条迁移在测试账套上失败回滚。这里改为：
     · 存在但没置必填 → 报错（真问题）；
     · 压根不存在的字段 → 只 PRINT 出来（账套漂移，属另一件事，另行对齐）。 */
DECLARE @miss INT = (
    SELECT COUNT(*) FROM @req r
    WHERE EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = N'RD_PROD_INFO' AND f.label = r.label)
      AND NOT EXISTS (
        SELECT 1 FROM yj_field f
        WHERE f.panel_code = N'RD_PROD_INFO' AND f.label = r.label AND ISNULL(f.required, 0) = 1)
);
IF @miss > 0
BEGIN
    RAISERROR(N'[prodinfo-required] 自检失败：还有 %d 个已存在的字段没置成必填', 16, 1, @miss);
    RETURN;
END
/* 本账套缺哪些目标字段（只报告，不阻断） */
SELECT N'[prodinfo-required] 本账套缺字段: ' + r.label AS missing
FROM @req r
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = N'RD_PROD_INFO' AND f.label = r.label);
DECLARE @exempt INT = (
    SELECT COUNT(*) FROM yj_field
    WHERE panel_code = N'RD_PROD_INFO' AND label IN (N'项目编号', N'项目名称') AND ISNULL(required, 0) = 1
);
IF @exempt > 0
BEGIN
    RAISERROR(N'[prodinfo-required] 自检失败：项目编号/项目名称被标成了必填（用户要求豁免）', 16, 1);
    RETURN;
END
PRINT '[prodinfo-required] 自检通过：本账套存在的目标字段已全部必填，项目编号/项目名称保持豁免。';
