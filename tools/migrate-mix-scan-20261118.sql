/* ============================================================================
   migrate-mix-scan-20261118.sql — 手机扫码 ·「扫码混料」（新面板 MIX_SCAN）+ 下线三个扫码入口的授权

   用户口径（原话）：
   「把 wms 管理-条码管理里面的扫码领料和扫码领料记录和工单扫码领料删除。然后在手机扫码里面
    加一个扫码混料的面版。逻辑：扫工单码，带出一级BOM（就是物料清单，之前生产领料的是组装物料清单），
    逐项扫物料码，自动获取电子秤的数量（我们系统已经有了（之前的工单扫码领料读的就是这个的数据）），
    提交保存一笔，全部扫完，整单保存。保存后自动打印，并且保留单据，重新扫码后进入可以补打印。」

   本脚本只做「数据库侧」的四件事（页面/代码在同一个 commit 里，不在这里插行）：
     ① 新面板 MIX_SCAN（页面级虚拟面板，定义在 PagePanelRegistry）**补授权**：
        按 MOBILE_PICK（手机扫码 · 生产领料，同一批车间账号）的角色整份复制，
        另把原来持有 WORK_ORDER_PICK 的角色（老「工单扫码领料」的授权人）一并补上；
     ② 下架两个页面级面板码的授权行：BARCODE_SCAN_PICK / WORK_ORDER_PICK
        —— 页面、路由、菜单、后端端点都已删除，留着授权只会让权限矩阵里出现点开 404 的空面板；
     ③ 删掉只为「扫码领料记录」页存在过的留痕表 wo_pick_scan_log（两账套实测 0 行；
        非空时**不删**，只提示 —— 有历史作业痕迹的表不做静默销毁）；
     ④ 补 MIX_SCAN 的面板译名（多语言强制规范：新增面板必须带译名）。

   幂等：全部 IF NOT EXISTS / 条件删，可重复执行。
   执行：tools\ 下 java -cp lib\mssql-jdbc.jar DbSync.java（两账套都要跑；先正式、后测试）
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ── ① 新面板 MIX_SCAN 的授权（照 MOBILE_PICK 复制 + 老 WORK_ORDER_PICK 的持有者） ── */
    DECLARE @mixPerms nvarchar(200) = N'view,query,save,print';

    INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
    SELECT src.role_id, N'MIX_SCAN', N'N', @mixPerms
      FROM (
            SELECT rp.role_id FROM dbo.yj_role_panel rp WHERE rp.panel_code = N'MOBILE_PICK'
            UNION
            SELECT rp.role_id FROM dbo.yj_role_panel rp WHERE rp.panel_code = N'WORK_ORDER_PICK'
           ) src
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel t
                        WHERE t.role_id = src.role_id AND t.panel_code = N'MIX_SCAN');

    -- 管理员角色恒可（与其它面板一致：is_admin='Y' 的行至少要有一份授权，矩阵里才显示得出来）
    INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
    SELECT r.id, N'MIX_SCAN', N'N', @mixPerms
      FROM dbo.yj_role r
     WHERE r.is_admin = 'Y'
       AND NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel t
                        WHERE t.role_id = r.id AND t.panel_code = N'MIX_SCAN');

    /* ── ② 下架两个页面级面板码的授权行 ─────────────────────────────────────── */
    DELETE FROM dbo.yj_role_panel WHERE panel_code IN (N'BARCODE_SCAN_PICK', N'WORK_ORDER_PICK');

    /* ── ③ 删掉「扫码领料记录」的留痕表（仅当为空；非空保留并提示） ────────── */
    IF OBJECT_ID(N'dbo.wo_pick_scan_log', N'U') IS NOT NULL
    BEGIN
        DECLARE @logRows bigint = (SELECT SUM(p.rows) FROM sys.partitions p
                                    WHERE p.object_id = OBJECT_ID(N'dbo.wo_pick_scan_log') AND p.index_id IN (0, 1));
        IF ISNULL(@logRows, 0) = 0
            DROP TABLE dbo.wo_pick_scan_log;
        ELSE
            PRINT N'[跳过] wo_pick_scan_log 还有数据（' + CAST(@logRows AS nvarchar(20))
                + N' 行）：只为「扫码领料记录」页服务过，但里面有作业痕迹，不在迁移里静默销毁，请人工确认后删。';
    END

    /* ── ④ 面板译名（yz_translation：scope='panel'） ────────────────────────── */
    DECLARE @tr TABLE (locale varchar(10), text nvarchar(400));
    INSERT INTO @tr (locale, text) VALUES
        ('en', N'Material Mixing (Scan)'),
        ('ja', N'材料混練（スキャン）');
    INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
    SELECT 'panel', N'扫码混料', t.locale, t.text, 'manual'
      FROM @tr t
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                        WHERE x.scope = 'panel' AND x.ref_key = N'扫码混料' AND x.locale = t.locale);

    /* ── ⑤ 收尾守卫 ─────────────────────────────────────────────────────────── */
    -- 5.1 新面板至少给到一个角色（否则菜单对所有人隐藏 ⇒ 功能等于没上）
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code = N'MIX_SCAN')
        THROW 51000, N'MIX_SCAN 没有任何角色授权：菜单会对所有人隐藏，请检查 yj_role_panel。', 1;
    -- 5.2 旧码授权必须清零
    IF EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code IN (N'BARCODE_SCAN_PICK', N'WORK_ORDER_PICK'))
        THROW 51000, N'BARCODE_SCAN_PICK / WORK_ORDER_PICK 的授权行没有清干净。', 1;
    -- 5.3 MIX_SCAN 的权限词必须都在词表里（写错词 = 页面上点了没反应）
    IF EXISTS (SELECT 1 FROM dbo.yj_role_panel
                WHERE panel_code = N'MIX_SCAN'
                  AND (perms IS NULL
                       OR perms LIKE N'%pick%'
                       OR REPLACE(perms, ' ', '') NOT LIKE N'%save%'))
        THROW 51000, N'MIX_SCAN 的权限词异常（应含 view/query/save/print）。', 1;
    -- 5.4 译名必须在
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                    WHERE scope = 'panel' AND ref_key = N'扫码混料' AND locale = 'en' AND LEN(text) > 0)
        THROW 51000, N'扫码混料 面板 en 译名缺失。', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ── ⑥ 结果自述（结果集而非 PRINT：SqlRunner/DbSync 只回显结果集）
   ⚠ 前面用 GO 断开：SqlRunner/DbSync 的取结果循环遇到第一条 DML（SET NOCOUNT ON 下
   update count = -1）就停，同一批里的收尾 SELECT 会被吞掉、日志里看不到自证结果。 */
GO

SELECT N'MIX_SCAN' AS 面板码, COUNT(*) AS 授权角色数, MIN(perms) AS 权限词样本
  FROM dbo.yj_role_panel WHERE panel_code = N'MIX_SCAN'
UNION ALL
SELECT N'已下架码残留', COUNT(*), N''
  FROM dbo.yj_role_panel WHERE panel_code IN (N'BARCODE_SCAN_PICK', N'WORK_ORDER_PICK')
UNION ALL
SELECT N'wo_pick_scan_log', CASE WHEN OBJECT_ID(N'dbo.wo_pick_scan_log', N'U') IS NULL THEN 0 ELSE 1 END, N'存在=1';
SELECT N'RESULT: MIX-SCAN-READY' AS 结果;
