/* ============================================================================
 * migrate-prod-info-scene-stdlib-20261117.sql
 * 产品信息表「应用场景」改成标准库下拉（可维护）
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-17，1117问题 #7；对照《产品信息表（固定）》目标版式）：
 *   基本信息区四个下拉格（产品管控等级/产品功能类别/产品形态、应用场景）都要能
 *   「⧉ 标准库维护」。实测前三个 yj_field.data_type 已是「标准库」，
 *   **只有「应用场景」还是「文本」** ⇒ 界面不出标准库入口。
 *
 * 改法：
 *   ① 新建库编码 `prod.scene`，把**库里已有的应用场景取值**去重种进去
 *      （否则改成下拉后历史值不在候选里，界面显示不出标签）；
 *   ② yj_field：RD_PROD_INFO.应用场景 → data_type='标准库'、dict_sql='prod.scene'。
 *
 * 幂等：库条目按 (lib_code, content) 去重插入；字段更新按当前值判断。
 * 两账套都执行。
 * ========================================================================== */

SET NOCOUNT ON;

IF COL_LENGTH('yj_field', 'dict_sql') IS NULL
    RAISERROR(N'[prod-scene] yj_field 缺 dict_sql 列', 16, 1);
IF OBJECT_ID('yj_std_lib') IS NULL
    RAISERROR(N'[prod-scene] 缺 yj_std_lib 表', 16, 1);
GO

/* ---------- ① 把历史取值种进标准库 ---------- */
;WITH src AS (
    SELECT DISTINCT LTRIM(RTRIM([应用场景])) AS v
      FROM rd_prod_info_head
     WHERE ISNULL([应用场景], N'') <> N''
       AND ISNULL(asp_cancel, 'N') <> 'Y'
)
INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1)
SELECT N'prod.scene', s.v, s.v,
       ISNULL((SELECT MAX(seq) FROM yj_std_lib WHERE lib_code = N'prod.scene'), 0) + 1,
       1, N'migrate', GETDATE()
  FROM src s
 WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib l WHERE l.lib_code = N'prod.scene' AND l.content = s.v);
PRINT N'[prod-scene] 历史取值已种入 prod.scene = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ② 字段改标准库 ---------- */
UPDATE yj_field
   SET data_type = N'标准库', dict_sql = N'prod.scene'
 WHERE panel_code = N'RD_PROD_INFO' AND label = N'应用场景'
   AND (ISNULL(data_type, N'') <> N'标准库' OR ISNULL(dict_sql, N'') <> N'prod.scene');
PRINT N'[prod-scene] 字段已改标准库 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ③ 译名（库编码展示用；AGENTS 要求新增 i18n） ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'lib' AND ref_key = N'prod.scene' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'lib', N'prod.scene', 'en', N'Application Scenario', N'manual');
GO

/* ---------- ④ 自检 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROD_INFO' AND label = N'应用场景'
               AND data_type = N'标准库' AND dict_sql = N'prod.scene')
    RAISERROR(N'[prod-scene] 自检失败：应用场景 未改成标准库', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'prod.scene')
    PRINT N'[prod-scene] 提示：prod.scene 暂无条目（库里历史上没有应用场景取值），需业务侧在界面新增';
ELSE PRINT N'[prod-scene] 自检通过。';
GO
