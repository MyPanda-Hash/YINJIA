/* migrate-role-perm-words-20261016.sql — 角色面板权限词表归位(本地两账套)

【用户原话】「现在组织架构里面的研发管理模块角色可配置的权限与现在的面板功能是对不上的,
  现在审视一遍,把这个权限配置完善」(2026-10-16)

【病症 · 一句话】组织架构矩阵下发的词表与**引擎真读的词**不是同一套:
  - 通用 13 项里 `edit 修改 / delete 删除 / price 价格金额 / review 复核反审核 / adjust 调价`
    —— 服务端按钮闸门 PanelPermissionService 一个都不认(它只认 modify/del/modlog);
  - 引擎认的 `modify 申请修改 / del 删除申请 / modlog 修改记录` 通用集里**没有列**
    ⇒ 非文书类面板永远授不出「申请修改/删除申请」,勾了也 403。
  取证:tools/archive/_rd-perm-audit-20261016/(_q-rd-perm-matrix.mjs 走接口下发的动作集,
  _q-rd-role-panel-raw.mjs 走库并回填引擎词判定)。

【代码侧同批改动(本脚本是数据侧配套,两边必须一起上)】
  - SysAdminController.PERMISSION_ACTIONS:13 项 → **11 项引擎词**
    (view/query/add/modify/modlog/del/export/print/audit/field/warn;标签逐字取
     PanelPermissionService.PERM_LABEL,前端列头与后端 403 提示从此说同一句话);
  - ShareFileService/ShareFileController:全库最后一个吃 `edit`/`delete` 的地方
    (共享文件库 RD_SHARE_FILE)改读 `modify`/`del`。
  - ⚠ 部署顺序:**先跑本脚本,再换 jar**。库里还是 edit/delete 而新代码只认 modify/del 时,
    共享文件库的新增/改/删会被 403(反向也一样);本脚本正是把库推到新词。

【做什么(四步,全幂等)】
  ① 含 legacy 词的 18 行(实测)按映射重写:edit→modify、delete→del、**删除 price/review/adjust**
     —— 同时去重、按引擎词表固定顺序重排(旧值里 ROUTE 那行词序是乱的)。
  ② 研发审核(role_code='rd_review')在 can_approve='Y' 但 perms 无 audit 的 8 张 RD 面板上补 `audit`
     —— 这 8 行是**两道审批门打架**的产物:前端 approvePanels(读 can_approve)一直给研发审核显示
     「审核/审批通过/审批驳回」按钮,后端前门(读 perms 的 audit 词)却 403
     「当前角色无该面板「审批」权限」。以库里既有的 can_approve='Y' 声明为准补齐,不新增业务意图。
  ③ can_approve 收敛为 perms 派生值(perms 含 audit ⇒ 'Y',否则 'N')—— 消灭第二个真源。
     ②做完后本步应改 0 行(实测:错位 8 处全部来自①/②覆盖的面板),改 0 行即"两层门已同源"的证明。
  ④ 刷新 yj_role_panel.perms 列的中文注明(旧注明抄的还是那套废词)。

【幂等】第二次执行:①0 行 ②0 行 ③0 行(①的筛选条件是"含 legacy 词",重排后自然不再命中)。
【自检】每步带行数守卫;末尾断言「全库词都落在引擎词表内」,越界数 ≠ 0 则整段回滚并 16 级报错。
【两账套】先 HSDZ_MES 后 HSDZ_MES_TEST(DbSync 自动排队;测试库快照陈旧也可能少行,故所有
  行数断言都用「≤ 实测值」而不是「= 实测值」)。
⚠ 本库兼容级别 = 100(SQL 2008)⇒ **没有 STRING_SPLIT / STRING_AGG**,拆词用 XML nodes,
  拼词用 FOR XML PATH + GROUP BY。
*/
SET NOCOUNT ON;

/* ───────────────────────── 批 1:① legacy 词归位 ───────────────────────── */
/* ⚠ 用 #temp 不用 @table 变量:实测(本库 compat level 100 + DbSync 单批 execute)下,
   「@表变量 在 STUFF(... FOR XML PATH) 的嵌套派生表里被引用」会报
   `必须声明标量变量 "@w"`(137)—— 换成 #temp 即通。 */
/* 引擎真读的词表(顺序 = 组织架构矩阵列顺序;21 个词 = 通用 11 + 页面级 10) */
CREATE TABLE #wo (word nvarchar(20) NOT NULL PRIMARY KEY, seq int NOT NULL);
INSERT INTO #wo (word, seq) VALUES
 (N'view',1),(N'query',2),(N'add',3),(N'modify',4),(N'modlog',5),(N'del',6),
 (N'export',7),(N'print',8),(N'audit',9),(N'field',10),(N'warn',11),
 (N'date',21),(N'convert',22),(N'assign',23),(N'unassign',24),(N'transfer',25),
 (N'revoke',26),(N'unclose',27),(N'close',28),(N'split',29),(N'picking',30);

DECLARE @dbn sysname = DB_NAME();

/* 目标行:只碰"含 legacy 词"的行(窄条件,其余行一个字节不动) */
CREATE TABLE #t (id int NOT NULL PRIMARY KEY);
INSERT INTO #t (id)
SELECT id FROM yj_role_panel
 WHERE ','+ISNULL(perms,'')+',' LIKE '%,edit,%'   OR ','+ISNULL(perms,'')+',' LIKE '%,delete,%'
    OR ','+ISNULL(perms,'')+',' LIKE '%,price,%'  OR ','+ISNULL(perms,'')+',' LIKE '%,review,%'
    OR ','+ISNULL(perms,'')+',' LIKE '%,adjust,%';
DECLARE @target int = @@ROWCOUNT;
RAISERROR(N'[待改] %s:含 legacy 词(edit/delete/price/review/adjust)的授权行 %d 行', 10, 1, @dbn, @target);
IF @target = 0
BEGIN
  RAISERROR(N'[SKIP] %s:无 legacy 词,①跳过', 10, 1, @dbn);
  RETURN;   /* 结束本批;后三批仍会跑(②③④ 各自幂等) */
END

/* 拆词(本库 compat level 100 没有 STRING_SPLIT ⇒ XML nodes)→ 映射 → 词序 */
CREATE TABLE #w0 (id int NOT NULL, word nvarchar(50) NOT NULL, seq int NULL);
INSERT INTO #w0 (id, word)
SELECT rp.id, LTRIM(RTRIM(z.v))
  FROM yj_role_panel rp JOIN #t AS t ON t.id = rp.id
 CROSS APPLY (SELECT CAST('<i>'+REPLACE(ISNULL(rp.perms,''),',','</i><i>')+'</i>' AS XML) AS x) AS x1
 CROSS APPLY (SELECT T.c.value('.','nvarchar(50)') AS v FROM x1.x.nodes('/i') AS T(c)) AS z
 WHERE LTRIM(RTRIM(z.v)) <> '';

/* 映射:edit→modify、delete→del;price/review/adjust 丢弃 */
DELETE FROM #w0 WHERE word IN (N'price', N'review', N'adjust');
UPDATE #w0 SET word = N'modify' WHERE word = N'edit';
UPDATE #w0 SET word = N'del'    WHERE word = N'delete';

/* 未知词守卫:映射后每个词都必须在词表内(否则报错不动) */
DECLARE @unknown nvarchar(200) = (SELECT TOP 1 w.word FROM #w0 w WHERE NOT EXISTS (SELECT 1 FROM #wo o WHERE o.word = w.word));
IF @unknown IS NOT NULL
BEGIN
  RAISERROR(N'[FAIL] %s:出现引擎词表外的词「%s」,①未执行(先补词表再跑)', 16, 1, @dbn, @unknown);
  RETURN;
END
UPDATE x SET x.seq = o.seq FROM #w0 x JOIN #wo o ON o.word = x.word;

BEGIN TRANSACTION;
UPDATE rp SET rp.perms = n.perms_new
  FROM yj_role_panel rp
  JOIN (
    SELECT m.id,
           STUFF((SELECT N',' + x.word
                    FROM #w0 x
                   WHERE x.id = m.id
                   GROUP BY x.word, x.seq
                   ORDER BY x.seq
                     FOR XML PATH('')), 1, 1, '') AS perms_new
      FROM (SELECT DISTINCT id FROM #w0) m
  ) n ON n.id = rp.id;
DECLARE @n1 int = @@ROWCOUNT;

/* 自检:目标行里不该再有任何 legacy 词;也不该出现空词表 */
DECLARE @bad int = (SELECT COUNT(*) FROM yj_role_panel rp JOIN #t AS t ON t.id = rp.id
                     WHERE ','+ISNULL(rp.perms,'')+',' LIKE '%,edit,%'   OR ','+ISNULL(rp.perms,'')+',' LIKE '%,delete,%'
                        OR ','+ISNULL(rp.perms,'')+',' LIKE '%,price,%'  OR ','+ISNULL(rp.perms,'')+',' LIKE '%,review,%'
                        OR ','+ISNULL(rp.perms,'')+',' LIKE '%,adjust,%'
                        OR ISNULL(rp.perms,'') = N'');
IF @bad <> 0
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] %s:自检未过(残留 legacy 词或空词表的行 %d),①已整段回滚', 16, 1, @dbn, @bad);
  RETURN;
END
COMMIT TRANSACTION;
RAISERROR(N'[OK] %s:①legacy 词归位 %d 行(edit→modify / delete→del / 删 price,review,adjust)', 10, 1, @dbn, @n1);
GO

/* ───────────────── 批 2:② 研发审核补 audit + ③ can_approve 收敛 ───────────────── */
SET NOCOUNT ON;
DECLARE @dbn2 sysname = DB_NAME();

/* 角色定位守卫:rd_review 必须唯一命中 */
DECLARE @rid int = (SELECT MIN(id) FROM yj_role WHERE role_code = N'rd_review');
DECLARE @rn  int = (SELECT COUNT(*) FROM yj_role WHERE role_code = N'rd_review');
IF @rn <> 1
BEGIN
  RAISERROR(N'[FAIL] %s:role_code=rd_review 命中 %d 个角色(期望 1),②③未执行', 16, 1, @dbn2, @rn);
  RETURN;
END

DECLARE @fix TABLE (id int PRIMARY KEY);
INSERT INTO @fix (id)
SELECT id FROM yj_role_panel
 WHERE role_id = @rid
   AND ISNULL(can_approve,'N') = 'Y'
   AND ','+ISNULL(perms,'')+',' NOT LIKE '%,audit,%'
   AND ISNULL(perms,'') <> '';
DECLARE @nf int = @@ROWCOUNT;
RAISERROR(N'[待改] %s:研发审核「can_approve=Y 但 perms 无 audit」的行 %d 行', 10, 1, @dbn2, @nf);

BEGIN TRANSACTION;
/* ② 补齐 audit(appends 在 export 之后正好落在词表第 9 位,顺序天然正确) */
DECLARE @n2 int = 0;
IF @nf > 0
BEGIN
  UPDATE rp SET rp.perms = ISNULL(rp.perms,'') + N',audit'
    FROM yj_role_panel rp JOIN @fix AS f ON f.id = rp.id;
  SET @n2 = @@ROWCOUNT;
END

/* ③ can_approve := perms 含 audit(逗号边界精确匹配;Java 侧 saveRolePanels 用 contains("audit"),
   因词表里没有别的词含 audit 子串,两种判法等价) */
DECLARE @n3 int = 0;
UPDATE rp SET rp.can_approve = CASE WHEN ','+ISNULL(rp.perms,'')+',' LIKE '%,audit,%' THEN 'Y' ELSE 'N' END
  FROM yj_role_panel rp
 WHERE ISNULL(rp.can_approve,'N') <> CASE WHEN ','+ISNULL(rp.perms,'')+',' LIKE '%,audit,%' THEN 'Y' ELSE 'N' END;
SET @n3 = @@ROWCOUNT;

/* 自检:两层审批门必须同源(错位数 = 0) */
DECLARE @split2 int = (SELECT COUNT(*) FROM yj_role_panel rp
   WHERE ISNULL(rp.can_approve,'N') <> CASE WHEN ','+ISNULL(rp.perms,'')+',' LIKE '%,audit,%' THEN 'Y' ELSE 'N' END);
IF @split2 <> 0
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] %s:审批两层门仍错位 %d 处,②③已整段回滚', 16, 1, @dbn2, @split2);
  RETURN;
END
COMMIT TRANSACTION;
RAISERROR(N'[OK] %s:②研发审核补 audit %d 行 / ③can_approve 收敛 %d 行(此后错位 0 处)', 10, 1, @dbn2, @n2, @n3);
GO

/* ───────────────── 批 3:④ 列注明 + 全库词表越界自检 ───────────────── */
SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM sys.extended_properties ep
            WHERE ep.major_id = OBJECT_ID('yj_role_panel') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('yj_role_panel'),'perms','ColumnId')
              AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'操作权限词表(逗号分隔,顺序=组织架构矩阵列顺序)。引擎真读的词:view/query/add/modify/modlog/del/export/print/audit/field/warn;页面级面板另有 date/convert/assign/unassign/transfer/revoke/unclose/close/split/picking。can_approve 恒等于本列是否含 audit(单一真源,2026-10-16 词表归位)',
       N'SCHEMA', N'dbo', N'TABLE', N'yj_role_panel', N'COLUMN', N'perms';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'操作权限词表(逗号分隔,顺序=组织架构矩阵列顺序)。引擎真读的词:view/query/add/modify/modlog/del/export/print/audit/field/warn;页面级面板另有 date/convert/assign/unassign/transfer/revoke/unclose/close/split/picking。can_approve 恒等于本列是否含 audit(单一真源,2026-10-16 词表归位)',
       N'SCHEMA', N'dbo', N'TABLE', N'yj_role_panel', N'COLUMN', N'perms';
GO
DECLARE @w2 TABLE (word nvarchar(20) PRIMARY KEY);
INSERT INTO @w2 (word) VALUES
 (N'view'),(N'query'),(N'add'),(N'modify'),(N'modlog'),(N'del'),(N'export'),(N'print'),(N'audit'),(N'field'),(N'warn'),
 (N'date'),(N'convert'),(N'assign'),(N'unassign'),(N'transfer'),(N'revoke'),(N'unclose'),(N'close'),(N'split'),(N'picking');

/* 越界自检(逐词计数,只报第一个越界词) */
DECLARE @oob nvarchar(400) = (
  SELECT TOP 1 N'「' + d.word + N'」× ' + CAST(d.n AS nvarchar(10))
    FROM (SELECT LTRIM(RTRIM(z.v)) AS word, COUNT(*) AS n
            FROM yj_role_panel rp
           CROSS APPLY (SELECT CAST('<i>'+REPLACE(ISNULL(rp.perms,''),',','</i><i>')+'</i>' AS XML) AS x) AS x1
           CROSS APPLY (SELECT T.c.value('.','nvarchar(50)') AS v FROM x1.x.nodes('/i') AS T(c)) AS z
           WHERE LTRIM(RTRIM(z.v)) <> ''
           GROUP BY LTRIM(RTRIM(z.v))) d
   WHERE NOT EXISTS (SELECT 1 FROM @w2 w WHERE w.word = d.word));
IF @oob IS NOT NULL
  RAISERROR(N'[FAIL] 全库词表越界:%s', 16, 1, @oob);
ELSE
  RAISERROR(N'[OK] 全库词表越界 0 处(所有词都在引擎词表内)', 10, 1);

SELECT N'归位后 · 角色授权词频' AS 段, LTRIM(RTRIM(z.v)) AS 词, COUNT(*) AS 行数
  FROM yj_role_panel rp
 CROSS APPLY (SELECT CAST('<i>'+REPLACE(ISNULL(rp.perms,''),',','</i><i>')+'</i>' AS XML) AS x) AS x1
 CROSS APPLY (SELECT T.c.value('.','nvarchar(50)') AS v FROM x1.x.nodes('/i') AS T(c)) AS z
 WHERE LTRIM(RTRIM(z.v)) <> ''
 GROUP BY LTRIM(RTRIM(z.v)) ORDER BY 行数 DESC, 词;
GO
