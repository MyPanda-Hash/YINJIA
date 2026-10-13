/* _fix-orphan-translations-20261013.sql —— 清掉我误插的 12 条孤儿字段译名
 *
 * 经过:2026-10-13 为「规格书关键物料列表引用物料清单」补 WLBOM 面板字段时,
 *   我依据一次**被截断**的查询输出(只看到 WLBOM 的 3 个字段)判定它缺父件/规格/单位列,
 *   于是写了 migrate-wlbom-bom-cols-20261013.sql 去补 6 个字段 + 15 条译名。
 *   实跑后 yj_field 新增 **0 行**(字段本来就是齐的 15 个 —— 那次查询输出被 Select-Object -First 40
 *   切掉了后 12 行),但译名却按错误的 label 插进去 12 条。
 *
 * 证据:父件编码 / 父件名称 / 母件号 / 定额数量 这四个词作为 yj_field.label **全库 0 个字段**
 *   (对照组「规格型号」有 35 个字段)—— 即这 12 条译名没有任何字段会用它们,是纯孤儿数据。
 *   同一批里「规格型号」的 3 条是**有效的**(WLBOM 确有该 label),保留。
 *
 * 幂等:重复执行 = 0 行。两账套都跑。
 * 用法:sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d <库> -C -f 65001 -i <本文件> -W -s"|"
 */
SET NOCOUNT ON;
DECLARE @orphan TABLE (k nvarchar(100) PRIMARY KEY);
INSERT INTO @orphan (k) VALUES (N'父件编码'), (N'父件名称'), (N'母件号'), (N'定额数量');

-- 删除前报数 + 再确认一次"这些词确实没有对应字段"
SELECT N'[删除前] 待清孤儿译名行数' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM yj_translation WHERE scope = 'field' AND ref_key IN (SELECT k FROM @orphan)
UNION ALL SELECT N'[删除前] 这些词作为 yj_field.label 的字段数(应=0)',
       CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE label IN (SELECT k FROM @orphan);

DELETE FROM yj_translation WHERE scope = 'field' AND ref_key IN (SELECT k FROM @orphan);
PRINT N'[清理] 删除孤儿译名行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

SELECT N'[删除后] 残留(应=0)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM yj_translation WHERE scope = 'field' AND ref_key IN (SELECT k FROM @orphan)
UNION ALL SELECT N'[对照] 规格型号译名仍在(应>0)',
       CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation WHERE scope = 'field' AND ref_key = N'规格型号';
