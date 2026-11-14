/*
 * migrate-prodinfo-l1-approver-backfill-20261111.sql
 *
 * 目的：把产品信息表（RD_PROD_INFO）历史单据的「审核人（一级审批人）」统一成**陈秀丽**。
 *
 * 用户口径（2026-11-11）：
 *   「产品信息表的一级审核人名字改为：陈秀丽，这个是固定的」
 *   （同日后一轮确认：「改」——即历史单据也要改，不只是新建的）。
 *
 * ⚠ 为什么需要单独一条：同日的 migrate-prodinfo-approver-cells-20261111.sql 按"不篡改既成事实"
 *   的稳妥口径，**只补空值、不覆盖已有值**；而那次部署后实测生产 13 张单全是旧值「冯总」，
 *   且这三格已置 `editable=0`（纸面只读）⇒ 用户在界面上**没有任何入口**能改，
 *   只能由本脚本一次性统一。
 *
 * 影响面：只动 `审核人一级` **这一列**，不动 `审核人二级` / `责任人`（后两者由一级审批选人后回填）。
 * 幂等：只更新 ≠ 目标值的行；重复执行第二次为 0 行，且末尾自检要求"剩余不符 = 0"。
 * 行数守卫：不写死"必须 N 行"（这种硬断言在 2026-11-09 那次曾因业务新增数据而误报整批回滚），
 *   只断言**执行后**没有任何存活单据仍不等于目标值。
 *
 * 执行：两个账套都要跑（HSDZ_MES / HSDZ_MES_TEST）。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @target nvarchar(50) = N'陈秀丽';

DECLARE @before INT = (
    SELECT COUNT(*) FROM rd_prod_info_head
    WHERE ISNULL(asp_cancel, 'N') <> 'Y' AND ISNULL(审核人一级, N'') <> @target
);
PRINT '[prodinfo-l1] 需更新行数 = ' + CAST(@before AS nvarchar(10));

UPDATE rd_prod_info_head
SET 审核人一级 = @target
WHERE ISNULL(asp_cancel, 'N') <> 'Y'
  AND ISNULL(审核人一级, N'') <> @target;
PRINT '[prodinfo-l1] 已更新行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

DECLARE @after INT = (
    SELECT COUNT(*) FROM rd_prod_info_head
    WHERE ISNULL(asp_cancel, 'N') <> 'Y' AND ISNULL(审核人一级, N'') <> @target
);
IF @after > 0
BEGIN
    RAISERROR(N'[prodinfo-l1] 自检失败：仍有 %d 张存活单据的 审核人一级 不是陈秀丽', 16, 1, @after);
    RETURN;
END
PRINT '[prodinfo-l1] 自检通过：所有存活单据的 审核人一级 均为陈秀丽。';
