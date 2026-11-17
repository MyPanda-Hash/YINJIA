/* ============================================================================
 * migrate-insp-commission-sender-20261117.sql —— 检验委托单「联系人」= 送样人(拉选填)
 * ----------------------------------------------------------------------------
 * 用户 2026-11-17 口径(截图:联系人格标黄「拉选填」,红字要求):
 *   「送样人进行选择填入嘛,直接带入有账号的人的姓名」
 *
 * 落地:
 *   ① `yj_field`(INSP_COMMISSION.联系人)data_type 文本 → **下拉框**,字典 = **有账号的人员姓名**
 *      (`yj_user.real_name`,只取 enable=1 且未作废;去重后按姓名排序)。
 *      存值仍是**姓名文本**(数据键口径不变,老数据里的手打姓名照常显示,不会被改)。
 *   ② 纸面(`InspCommissionSheet.vue`)把该格渲染成可搜索下拉(也允许手输,历史姓名不受限)。
 *   ③ 新建单据时**默认带入当前登录人姓名**(后端 `ButtonService.putSenderDefault/…InHead`,
 *      panel 名单 = SENDER_DEFAULT_COL;只补空值,已有值/历史单一律不覆盖,后台线程不填)。
 *
 * ⚠ 字典是"人名清单",不建参照面板(`yj_user` 没有面板登记,参照会 404)⇒ 走 dict_sql 这条路,
 *   与「检验结论」「检验项」等既有下拉同一机制(见 migrate-qc-insp-rec-verdict-dropdown-20261019.sql)。
 * 幂等:重复执行 0 行变更;末尾自检不符即 RAISERROR。两账套都要执行。
 * ========================================================================== */

SET NOCOUNT ON;
GO

UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql  = N'SELECT DISTINCT real_name FROM yj_user WHERE ISNULL(enabled, ''1'') = ''1'''
                + N' AND ISNULL(asp_cancel, ''N'') <> ''Y'' AND ISNULL(real_name, '''') <> '''' ORDER BY real_name'
 WHERE panel_code = N'INSP_COMMISSION'
   AND label      = N'联系人'
   AND (data_type <> N'下拉框' OR ISNULL(dict_sql, N'') NOT LIKE N'%yj_user%');
PRINT N'[改] 联系人 → 下拉框(有账号的人员姓名),行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* 自检:必须是下拉框、字典读 yj_user、且 required 仍为必填(红色 * 不回退) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND label = N'联系人'
                AND data_type = N'下拉框' AND dict_sql LIKE N'%yj_user%')
    RAISERROR(N'联系人 未改成「人员下拉」(字典应读 yj_user)', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND label = N'联系人' AND required = 0)
    RAISERROR(N'联系人 的必填标记被清掉了(纸面红色 * 会被一起丢掉)', 16, 1);
-- 字典可用性抽检:至少能取到 1 个有账号的人(空账号库不该悄悄变成空下拉)
DECLARE @n int;
SELECT @n = COUNT(DISTINCT real_name) FROM yj_user
 WHERE ISNULL(enabled, '1') = '1' AND ISNULL(asp_cancel, 'N') <> 'Y' AND ISNULL(real_name, '') <> '';
IF @n < 1 RAISERROR(N'yj_user 里没有可用的 real_name,联系人文下拉会是空的', 16, 1);
PRINT N'✅ 联系人 已改为送样人下拉(可用人员 ' + CAST(@n AS nvarchar(10)) + N' 人)';
GO
