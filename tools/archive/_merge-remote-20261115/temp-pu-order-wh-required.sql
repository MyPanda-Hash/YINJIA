/* 临时把 PU_ORDER 明细「仓库」必填位恢复成 1 —— 仅为本机执行远端迁移
 * migrate-pu-order-price-wh-not-required-20261113.sql 的前置守卫(它要求「单价」「仓库」恰有 2 行 required=1)。
 * 本机库里「仓库」早已是非必填(历史任务改过,未入链),守卫因此中止;该脚本的目标状态就是两格都非必填,
 * 临时置 1 → 脚本按原样执行(两格都改 0 + 自带自检/取证)即得到同一目标态。
 * 幂等:仅当 仓库 required=0 且 单价 required=1 时才动。
 */
IF EXISTS (SELECT 1 FROM yj_field WHERE RTRIM(panel_code)='PU_ORDER' AND place LIKE '%detail%' AND label=N'单价' AND required=1)
   AND EXISTS (SELECT 1 FROM yj_field WHERE RTRIM(panel_code)='PU_ORDER' AND place LIKE '%detail%' AND label=N'仓库' AND required=0)
BEGIN
    UPDATE yj_field SET required = 1
     WHERE RTRIM(panel_code) = 'PU_ORDER' AND place LIKE '%detail%' AND label = N'仓库';
    PRINT N'[temp] PU_ORDER.仓库 required 0 → 1(为满足远端迁移的前置守卫,脚本跑完会变回 0)';
END
ELSE PRINT N'[temp] 状态不是「单价=1/仓库=0」,无需临时调整';
/* 改后自检:必须恰好 2 行 */
IF (SELECT COUNT(*) FROM yj_field WHERE RTRIM(panel_code)='PU_ORDER' AND place LIKE '%detail%' AND label IN (N'单价',N'仓库') AND required=1) <> 2
    RAISERROR(N'[temp] PU_ORDER 单价/仓库 required=1 行数不是 2,中止', 16, 1);
