/* ============================================================================
   migrate-mold-calcparam.sql —— 配方计算弹窗的「工艺参数」系统默认条目
   ============================================================================
   背景(口径见 CONTEXT.md「配方计算器」/ docs/adr/0004):
     成型工艺清单(RD_MOLD_PROC)页 2 配方表的表头新增「配方计算」按钮,弹窗做 12 步配方计算。
     公式写死在代码里(=《炭棒工艺配方设计器》exe 的 app.domain.engine,逐位一致),**可调的只有
     工艺参数**:一切几 / 折算比 / 成型长度公差上下限 / 脱模漂移系数。
     参数粒度 = 系统默认 + 按产品编号覆盖,落点复用既有标准库 yj_std_lib:
       lib_code = 'mold.calcparam'
       item_code = 产品编号;item_code = N'默认' 这一条即**系统默认**
     维护界面复用现成的 StdLibManager(勾选一行 → 编辑/停用/恢复启用),
     所以本脚本只负责把「系统默认」那一条种下去,不建新表、不新增维护入口。

   幂等:按 (lib_code, item_code) 判存在;已存在则不动(管理员后来改的值不会被覆盖)。
   两个账套都要执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
   ============================================================================ */

SET NOCOUNT ON;
GO

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = 'mold.calcparam' AND item_code = N'默认')
BEGIN
    INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1)
    VALUES (
        'mold.calcparam',
        N'默认',
        /* 默认值与 exe 的 constants 一致:折算比 0.5(设计源 Excel 里是硬编码 0.65,exe 起改为可调)、
           成型长度公差 ±2.5、脱模漂移系数 1.0(设计源 Excel 用硬编码 99.5%/100.5%) */
        N'{"cavities":1,"conversion_ratio":0.5,"length_tol_low":2.5,"length_tol_high":2.5,"demold_low_factor":1,"demold_high_factor":1}',
        1, 1, 'system', SYSDATETIME());
    PRINT N'migrate-mold-calcparam.sql:已种入 mold.calcparam 的系统默认参数条目';
END
ELSE
    PRINT N'migrate-mold-calcparam.sql:系统默认条目已存在,未改动';
GO

SELECT id, lib_code, item_code, content, enabled FROM yj_std_lib WHERE lib_code = 'mold.calcparam';
GO
