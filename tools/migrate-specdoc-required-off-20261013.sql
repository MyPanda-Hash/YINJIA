/* migrate-specdoc-required-off-20261013.sql —— 取消规格书「规格书种类」「名称」的必填
 *
 * 起因(用户 2026-10-13 报障「填写规格书时保存不了,提示名称不能为空」):
 *   RD_SPEC_DOC 的必填表头字段里,「规格书种类」(seq 30) 与「名称」(seq 40) 在
 *   recordSheetConfigs.js 的 RD_SPEC_DOC 配置(封面 cover.fields / sections / dataTables)
 *   里**一处都没有渲染** —— 实测扫描该配置 380 行,这两个 label 命中 0 行。
 *   ⇒ 纸面上根本没有这两格,用户无处可填,而前后端都按 yj_field.required=1 校验,
 *     保存被**永久拦死**(前端 validateInlineDraft 只报第一个命中的,所以用户只看到
 *     「名称不能为空」,其实「规格书种类」同样填不了)。
 *
 * 处置(用户 2026-10-13 拍板「取消这两个字段的必填」,而不是在纸面上补格子):
 *   把这两行(仅限 place='header')的 required 置 0。
 *   字段保留、数据保留、可见性不变 —— 将来若按设计纸补上这两格,把 required 改回 1 即可。
 *
 * ⚠ 必须限定 place='header':RD_SPEC_DOC 另有 place='query' 的同名行(「名称」「规格书种类」
 *   各有一条查询条件行),那是查询区,不该被本次调整波及。
 *
 * 幂等:重复执行 = 0 行。两账套都跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
 * 用法:sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d <库> -C -f 65001 -i <本文件> -W -s"|"
 */
SET NOCOUNT ON;

/* ① 改前报数 */
SELECT N'[改前] 待调整行数(应=2)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM yj_field
 WHERE panel_code = N'RD_SPEC_DOC' AND place = N'header'
   AND label IN (N'规格书种类', N'名称') AND required = 1;

/* ② 执行 */
UPDATE yj_field SET required = 0
 WHERE panel_code = N'RD_SPEC_DOC' AND place = N'header'
   AND label IN (N'规格书种类', N'名称') AND required = 1;
PRINT N'[调整] required 1→0 行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ③ 自证 */
SELECT N'[改后] header 仍必填的字段' AS 项,
       ISNULL(STUFF((SELECT N',' + label FROM yj_field
                      WHERE panel_code = N'RD_SPEC_DOC' AND place = N'header' AND required = 1
                      ORDER BY seq FOR XML PATH('')), 1, 1, N''), N'(无)') AS 值
UNION ALL SELECT N'[改后] query 侧同名行 required=1 的条数(应=0)',
       CAST(COUNT(*) AS nvarchar(10)) FROM yj_field
        WHERE panel_code = N'RD_SPEC_DOC' AND place = N'query'
          AND label IN (N'规格书种类', N'名称') AND required = 1
UNION ALL SELECT N'[改后] 这两个字段仍在(应=4: header+query 各 2)',
       CAST(COUNT(*) AS nvarchar(10)) FROM yj_field
        WHERE panel_code = N'RD_SPEC_DOC' AND label IN (N'规格书种类', N'名称');

PRINT N'=== RD_SPEC_DOC header 字段现状 ===';
SELECT seq, label, col_name, required, editable, visible
  FROM yj_field WHERE panel_code = N'RD_SPEC_DOC' AND place = N'header' ORDER BY seq, id;
