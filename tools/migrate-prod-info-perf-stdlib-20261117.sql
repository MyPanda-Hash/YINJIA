/* ============================================================================
 * migrate-prod-info-perf-stdlib-20261117.sql
 * 产品信息表「主要性能描述」改成标准库下拉
 * ----------------------------------------------------------------------------
 * 用户口径（《产品开发系统问题汇总11.17.xlsx》「产品信息表」表行22：「主要性能描述：加标准库」）。
 * 实测该字段 data_type='文本' ⇒ 界面是纯输入框、没有「⧉ 标准库维护」。
 * 同页另外四个下拉格（产品管控等级/产品功能类别/产品形态/应用场景）已是标准库。
 *
 * 新建库编码 `prod.perf`，把库里已有的主要性能描述取值去重种进去（否则改下拉后历史值
 * 不在候选里、界面显示不出标签）。字段侧改 data_type/dict_sql。
 *
 * ⚠ 两账套 schema 不同步：测试库 rd_prod_info_head 没有 [主要性能描述] 列
 *   ⇒ 种库必须走**动态 SQL**（`IF COL_LENGTH` 挡不住批编译期列名解析，实测踩过）。
 * 幂等：库条目按 (lib_code, content) 去重；字段只在不符合目标时更新。
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('yj_std_lib') IS NULL RAISERROR(N'[prod-perf] 缺 yj_std_lib', 16, 1);
GO

/* ---------- ① 种入历史取值（动态 SQL） ---------- */
-- ⚠ 物理列名是「特殊性能描述」不是「主要性能描述」（实测 yj_field: label 主要性能描述 → col 特殊性能描述）
IF COL_LENGTH('rd_prod_info_head', N'特殊性能描述') IS NOT NULL
BEGIN
    DECLARE @seed nvarchar(max) = N'
        ;WITH src AS (
            SELECT DISTINCT LTRIM(RTRIM([特殊性能描述])) AS v
              FROM rd_prod_info_head
             WHERE ISNULL([特殊性能描述], N'''') <> N''''
               AND ISNULL(asp_cancel, ''N'') <> ''Y''
        )
        INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1)
        SELECT N''prod.perf'', s.v, s.v,
               ISNULL((SELECT MAX(seq) FROM yj_std_lib WHERE lib_code = N''prod.perf''), 0) + 1,
               1, N''migrate'', GETDATE()
          FROM src s
         WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib l WHERE l.lib_code = N''prod.perf'' AND l.content = s.v);';
    EXEC sp_executesql @seed;
    PRINT N'[prod-perf] 历史取值已种入 prod.perf = ' + CAST(@@ROWCOUNT AS nvarchar(10));
END
ELSE PRINT N'[prod-perf] 本库无 rd_prod_info_head.[特殊性能描述] 列，跳过种入';
GO

/* ---------- ② 字段改标准库 ---------- */
UPDATE yj_field
   SET data_type = N'标准库', dict_sql = N'prod.perf'
 WHERE panel_code = N'RD_PROD_INFO' AND label = N'主要性能描述'
   AND (ISNULL(data_type, N'') <> N'标准库' OR ISNULL(dict_sql, N'') <> N'prod.perf');
PRINT N'[prod-perf] 字段已改标准库 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ③ 译名 ---------- */
IF OBJECT_ID('yj_translation') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'lib' AND ref_key = N'prod.perf' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'lib', N'prod.perf', 'en', N'Main Performance', N'manual');
GO

/* ---------- ④ 自检（三态，容忍 schema 滞后） ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROD_INFO' AND label = N'主要性能描述')
    PRINT N'[prod-perf] 本库无 RD_PROD_INFO.主要性能描述 字段，跳过（schema 滞后）';
ELSE IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROD_INFO' AND label = N'主要性能描述'
                    AND data_type = N'标准库' AND dict_sql = N'prod.perf')
    RAISERROR(N'[prod-perf] 自检失败：主要性能描述 存在但未改成标准库', 16, 1);
ELSE PRINT N'[prod-perf] 自检通过。';
GO
