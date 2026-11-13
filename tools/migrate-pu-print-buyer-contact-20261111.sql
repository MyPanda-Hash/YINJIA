/* ============================================================================
 * migrate-pu-print-buyer-contact-20261111.sql —— 采购订单「需方联系人」候选名单落地
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):
 *   「打印有金额的采购订单,下面的供方单位名称带入供应商名称。还有需方的联系人和联系方式
 *     改为打印前先弹窗。下拉选择名字和联系方式。可以新增」
 *
 * 落库位置:**系统参数** `yj_app_setting.pu_order.buyer_contacts`(不建表、不建面板) ——
 *   值格式 `姓名|联系方式;姓名|联系方式`;打印弹窗的下拉选项就取它,
 *   在弹窗里选了名单外的人/电话,确认打印时自动追加进来。
 *   放系统参数而不是常量/表:① 改一处全公司生效;② 它只是"打印时填哪个人"的候选,没有单据语义;
 *   ③ 参数表本来就承载这类运行期小配置(如 receive_over_ratio / 打印站点)。
 *
 * 本脚本(幂等):
 *   ① 没有该参数就插一条**历史默认值**(孙郝聪 | 13718162430,与代码里 COMPANY.buyer 一致),
 *      已存在则不动(不覆盖现场已经改过的人);
 *   ② 写 remark 中文说明,便于以后在参数表里认出来;
 *   ③ 自检:参数存在 + 值非空,否则 RAISERROR。
 *
 * ⚠ 代码侧:`PuPrintService.buyerContacts()/addBuyerContact()` 读写本参数;
 *   库里没有该参数时**回落**同一个默认值(老行为不丢),所以本脚本是"让配置可见",不是硬依赖。
 * ⚠ 两账套都要执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 种子:需方联系人候选 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_app_setting WHERE setting_key = N'pu_order.buyer_contacts')
BEGIN
    INSERT INTO yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
    VALUES (N'pu_order.buyer_contacts', N'孙郝聪|13718162430',
            N'采购订单「有金额」打印·需方联系人候选(格式 姓名|联系方式;分号分隔多条)。打印弹窗下拉选,可新增;送货单(无金额版)不印需方框',
            N'migration', SYSDATETIME());
    PRINT N'① 已插入 yj_app_setting.pu_order.buyer_contacts(默认 孙郝聪|13718162430)';
END
ELSE
    PRINT N'① yj_app_setting.pu_order.buyer_contacts 已存在,保留现值(不覆盖现场改动)';
GO

/* ---------- ② 自检 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_app_setting WHERE setting_key = N'pu_order.buyer_contacts')
    RAISERROR(N'自检失败:yj_app_setting 缺少 pu_order.buyer_contacts', 16, 1);

IF NOT EXISTS (SELECT 1 FROM yj_app_setting
               WHERE setting_key = N'pu_order.buyer_contacts' AND ISNULL(setting_value, N'') <> N'')
    RAISERROR(N'自检失败:pu_order.buyer_contacts 为空(打印弹窗下拉会是空的)', 16, 1);

SELECT setting_key, setting_value, remark FROM yj_app_setting WHERE setting_key = N'pu_order.buyer_contacts';
GO
PRINT N'✅ 采购订单需方联系人候选参数就绪';
GO
