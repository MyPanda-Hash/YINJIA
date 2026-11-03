/* ============================================================================
   migrate-mold-spec-strip-prefix-20261103.sql —— 炭棒规格三格去纸面前缀(存量数据清理)
   ============================================================================
   事故(2026-11-03 用户报障):
     「服务器上的烧结工艺清单导进来的炭棒规格带文字,导致后续计算有问题,还得我手动删掉」

   根因:`core/panel/carbonSpec.js` 把纸面**显示用的标签前缀** `外：`/`内：`/`长：`
   当成数据写进了 `炭棒规格1/2/3`。前缀写进数据后:
     · `matchSinterModel`(烧结型号自动匹配)走 `Number('外：56.5')` = NaN ⇒ 型号选不中;
     · `sinterLengthWarning`(长度越界提示)同样 NaN ⇒ 提示**静默消失**;
     · 界面上只能看到一串脏文本,用户只好手删。
   前端已改(落格只写裸数字 + 纸面按配置渲染前缀 + 消费端容错),本脚本清理**存量**。

   ── 只做一件事 ──────────────────────────────────────────────────────────────
   把 `炭棒规格1/2/3` 里 `xxx：数字` / `xxx: 数字` 形式的冒号前缀剥掉,只留裸数字。
   剥的条件**严格**,避免误伤:
     · 只动 rd_mold_proc_head(实测唯一有脏值的表;rd_mold_formula_head 实测 0 行);
     · 只动**冒号前没有数字**的值(`外：45` 会剥,`12:30` 不会);
     · 剥完必须能转成数字(`TRY_CONVERT` 判定,允许尾随 mm),否则原样保留;
     · 空值/NULL 不碰。

   幂等:剥过一遍后不再匹配,第二遍 0 行受影响。
   两账套都要跑:先 HSDZ_MES、后 HSDZ_MES_TEST。
   ============================================================================ */

SET NOCOUNT ON;
GO

PRINT N'=== migrate-mold-spec-strip-prefix-20261103:炭棒规格去纸面前缀 ===';
GO

/* ── 前置:表不存在就跳过(防在只有部分面板的账套上中止整条链) ── */
IF OBJECT_ID('rd_mold_proc_head') IS NULL
BEGIN
    PRINT N'[跳过] rd_mold_proc_head 不存在,本脚本无事可做';
    SET NOEXEC ON;
END
GO

/* ── 执行前快照 ── */
SELECT N'清理前:带冒号的格数' AS 项目, COUNT(*) AS 数量
FROM (
    SELECT 炭棒规格1 AS v FROM rd_mold_proc_head
    UNION ALL SELECT 炭棒规格2 FROM rd_mold_proc_head
    UNION ALL SELECT 炭棒规格3 FROM rd_mold_proc_head
) t
WHERE ISNULL(v, '') LIKE N'%[：:]%';
GO

/* ── 主体 ────────────────────────────────────────────────────────────────────
   SQL Server 没有正则,用「冒号位置 + 冒号前不含数字 + 冒号后可转数字」三段拼:
     冒号位置 = 全角冒号位优先,没有再取半角冒号位
     守卫 ① 冒号前不含 0-9  —— 免得把 `12:30` 当标签
     守卫 ② 冒号后 TRIM → 去尾随 mm → TRIM,再 TRY_CONVERT(decimal) 判"是不是数字"
   三格统一进一张临时表算,免得同一段逻辑照抄三遍(照抄就是将来漂移的来源)。
   ────────────────────────────────────────────────────────────────────────── */

IF OBJECT_ID('tempdb..#spec') IS NOT NULL DROP TABLE #spec;
CREATE TABLE #spec (id int, col sysname, val nvarchar(2000));

INSERT INTO #spec (id, col, val)
SELECT id, N'炭棒规格1', 炭棒规格1 FROM rd_mold_proc_head
UNION ALL SELECT id, N'炭棒规格2', 炭棒规格2 FROM rd_mold_proc_head
UNION ALL SELECT id, N'炭棒规格3', 炭棒规格3 FROM rd_mold_proc_head;

IF OBJECT_ID('tempdb..#clean') IS NOT NULL DROP TABLE #clean;
CREATE TABLE #clean (id int, col sysname, oldval nvarchar(2000), newval nvarchar(2000), act varchar(10));

INSERT INTO #clean (id, col, oldval, newval, act)
SELECT s.id, s.col, s.val,
       CASE WHEN x.act = 'strip' THEN b.body ELSE NULL END AS newval,
       x.act
FROM #spec s
CROSS APPLY (
    SELECT CASE
        WHEN CHARINDEX(N'：', s.val) > 0 THEN CHARINDEX(N'：', s.val)
        WHEN CHARINDEX(N':',  s.val) > 0 THEN CHARINDEX(N':',  s.val)
        ELSE 0
    END AS pos
) p
CROSS APPLY (
    SELECT CASE
        WHEN p.pos <= 1 THEN NULL                                        /* 没有冒号 / 冒号在第 1 位 */
        WHEN SUBSTRING(s.val, 1, p.pos - 1) LIKE N'%[0-9]%' THEN NULL     /* 冒号前有数字 ⇒ 不是标签 */
        ELSE LTRIM(RTRIM(REPLACE(LTRIM(RTRIM(SUBSTRING(s.val, p.pos + 1, 4000))), N'mm', N'')))
    END AS body
) b
CROSS APPLY (
    /* act:strip = 剥成裸数字 / clear = 纯前缀无数字,清空 / NULL = 不动 */
    SELECT CASE
        WHEN b.body IS NULL THEN NULL
        /* 纯前缀(如 `长：`):半截值本身就不合口径(carbonSpec 头注「不许只有前缀没有数字」),
           清空而不是留一个带冒号的空壳 —— 纸上两者都显示为空,但清空后核验才能真正归零。
           ⚠ 这是本脚本**唯一**会"删内容"的分支,只对"冒号后什么都没有"的值生效。 */
        WHEN b.body = N'' THEN 'clear'
        /* ⚠ 两个账套的兼容级别都是 100(SQL 2008 语义)⇒ **没有 TRY_CONVERT**。
           用确定性字符判据代替:只接受 `12` / `56.5` 这种纯数字形态。 */
        WHEN b.body LIKE N'%[^0-9.]%' THEN NULL                                    /* 夹了别的字符 */
        WHEN b.body NOT LIKE N'%[0-9]%' THEN NULL                                  /* 一个数字都没有 */
        WHEN b.body LIKE N'.%' OR b.body LIKE N'%.' THEN NULL                      /* 点开头/结尾 */
        WHEN LEN(b.body) - LEN(REPLACE(b.body, N'.', N'')) > 1 THEN NULL           /* 多于一个小数点 */
        ELSE 'strip'
    END AS act
) x
WHERE s.val IS NOT NULL;

DELETE FROM #clean WHERE act IS NULL;

SELECT N'待处理格数(剥前缀)' AS 项目, COUNT(*) AS 数量 FROM #clean WHERE act = 'strip';
SELECT N'待处理格数(纯前缀清空)' AS 项目, COUNT(*) AS 数量 FROM #clean WHERE act = 'clear';
GO

/* 逐格按 id 精确更新(三格各一条 UPDATE,不整表扫) */
DECLARE @c sysname, @stmt nvarchar(max), @n int;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT DISTINCT col FROM #clean;
OPEN cur;
FETCH NEXT FROM cur INTO @c;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @stmt = N'UPDATE h SET [' + @c + N'] = k.newval '
              + N'FROM rd_mold_proc_head h JOIN #clean k ON k.id = h.id AND k.col = N''' + @c + N''';';
    EXEC sp_executesql @stmt, N'@n int OUTPUT', @n OUTPUT;
    PRINT N'  已更新 ' + @c + N',命中 ' + CAST(@n AS nvarchar(10)) + N' 行';
    FETCH NEXT FROM cur INTO @c;
END
CLOSE cur;
DEALLOCATE cur;

DROP TABLE #clean;
DROP TABLE #spec;
GO

/* ── 核验 ①:还有多少"可剥离"的格(应 = 0) ────────────────────────────────────
   判据只算**本可以剥掉却还带前缀**的值:
     · `12:30`   冒号前有数字 ⇒ 本来就不是标签,应当保留 ⇒ **不计入**;
     · `外：abc` 冒号后不是数字 ⇒ 无法剥成数字,保留原值 ⇒ **不计入**;
     · `长：`    纯前缀(本轮已清空)⇒ 清空后不存在 ⇒ **不计入**。
   这段判据**故意与上面的清洗逻辑分开写**:闸门若与修复共用同一段代码,
   一旦那段写错,闸门也会跟着错、一起放行 —— 校验必须独立才算校验。 */
SELECT N'仍可剥离的格数(应 0)' AS 项目, COUNT(*) AS 数量
FROM (
    SELECT 炭棒规格1 AS v FROM rd_mold_proc_head
    UNION ALL SELECT 炭棒规格2 FROM rd_mold_proc_head
    UNION ALL SELECT 炭棒规格3 FROM rd_mold_proc_head
) t
CROSS APPLY (
    SELECT CASE
        WHEN CHARINDEX(N'：', t.v) > 0 THEN CHARINDEX(N'：', t.v)
        WHEN CHARINDEX(N':',  t.v) > 0 THEN CHARINDEX(N':',  t.v)
        ELSE 0
    END AS pos
) p
CROSS APPLY (
    SELECT LTRIM(RTRIM(REPLACE(LTRIM(RTRIM(SUBSTRING(t.v, p.pos + 1, 4000))), N'mm', N''))) AS body
) b
WHERE t.v IS NOT NULL
  AND p.pos > 1
  AND SUBSTRING(t.v, 1, p.pos - 1) NOT LIKE N'%[0-9]%'
  AND b.body LIKE N'%[0-9]%'
  AND b.body NOT LIKE N'%[^0-9.]%'
  AND b.body NOT LIKE N'.%'
  AND b.body NOT LIKE N'%.'
  AND LEN(b.body) - LEN(REPLACE(b.body, N'.', N'')) <= 1;
GO

/* ── 核验 ②:核验 ① 必须为 0,否则报错中止(不静默放过) ── */
IF EXISTS (
    SELECT 1
    FROM (
        SELECT 炭棒规格1 AS v FROM rd_mold_proc_head
        UNION ALL SELECT 炭棒规格2 FROM rd_mold_proc_head
        UNION ALL SELECT 炭棒规格3 FROM rd_mold_proc_head
    ) t
    CROSS APPLY (
        SELECT CASE
            WHEN CHARINDEX(N'：', t.v) > 0 THEN CHARINDEX(N'：', t.v)
            WHEN CHARINDEX(N':',  t.v) > 0 THEN CHARINDEX(N':',  t.v)
            ELSE 0
        END AS pos
    ) p
    CROSS APPLY (
        SELECT LTRIM(RTRIM(REPLACE(LTRIM(RTRIM(SUBSTRING(t.v, p.pos + 1, 4000))), N'mm', N''))) AS body
    ) b
    WHERE t.v IS NOT NULL
      AND p.pos > 1
      AND SUBSTRING(t.v, 1, p.pos - 1) NOT LIKE N'%[0-9]%'
      AND b.body LIKE N'%[0-9]%'
      AND b.body NOT LIKE N'%[^0-9.]%'
      AND b.body NOT LIKE N'.%'
      AND b.body NOT LIKE N'%.'
      AND LEN(b.body) - LEN(REPLACE(b.body, N'.', N'')) <= 1
)
BEGIN
    RAISERROR(N'[失败] 仍有"可剥离却未剥"的炭棒规格值,请查看上一结果集定位单据', 16, 1);
END
ELSE
    PRINT N'[OK] 炭棒规格三格已无可剥离的纸面前缀';
GO

/* ── 核验 ③:三格现状(改完长什么样,一眼可看) ── */
SELECT 单据编号,
       ISNULL(产品编号, N'') AS 产品编号,
       炭棒规格1, 炭棒规格2, 炭棒规格3
FROM rd_mold_proc_head
WHERE 炭棒规格1 IS NOT NULL OR 炭棒规格2 IS NOT NULL OR 炭棒规格3 IS NOT NULL
ORDER BY 单据编号;
GO