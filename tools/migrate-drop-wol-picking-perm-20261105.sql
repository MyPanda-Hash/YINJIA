/* =============================================================================
   migrate-drop-wol-picking-perm-20261105.sql
   生产工单「转领料单」下架:清理 yj_role_panel 里 WORK_ORDER_LIST 的 picking 授权词

   【用户口径 2026-11-05】「把当前这个转领料单的按钮删除,记得把权限设置中的也去除掉,
     不需要删除当前的工单和领料的实现,只需要完成对这个按钮的去除即可。」
     —— 按钮(前端)与权限设置(组织架构「角色与面板权限」矩阵列)都要去掉;
        **工单 / 领料的后端实现不删**。

   【代码侧同批改动(本脚本是数据侧配套,两边必须一起上)】
     ① frontend/src/views/modules/plan/WorkOrderList.vue:删「转领料单」按钮 +
        只被它调用的 toPicking() 函数(顺手删真无用的 useTabsStore);
     ② PagePanelRegistry.WORK_ORDER_LIST_ACTIONS:删 {"picking","转领料单"}
        ⇒ 后端下发的动作集少了该词,组织架构矩阵按 actions 渲染 ⇒ 「转领料单」列自然消失
        (OrgAdmin.vue 无需改动);WORK_ORDER_LIST 常量注释同步;
     ③ PanelPermissionService:**保留** PERM_LABEL 的 picking 与 BUTTON_PERMS_OVERRIDE 的
        「WORK_ORDER_LIST|转领料单」—— 后端 /px/workOrderList/toPicking + WorkOrderPickingService
        + ManuWritebackService 回写原样保留,端点仍按 picking 词鉴权(二道闸)。
     ⚠ 本脚本清掉库里**已授出**的 picking 词;清完后该端点对非管理员自然 403(矩阵也授不出来了),
        管理员恒过。语义正好等价于"入口撤掉、实现保留"。

   【做什么(两批,全幂等)】
     批1:yj_role_panel 里 panel_code = N'WORK_ORDER_LIST' 且 perms 含 picking 的行 → 删掉 picking 一词,
          **其余词与相对顺序一字不动**(整词字符串修剪,不做词表重排 —— 与
          migrate-role-perm-words-20261016「按引擎词表固定顺序重排」不同:本次没有换词,只去掉一个词)。
          边界 a:整行只有 picking ⇒ 置 'view'(空词表非法;保留"仍能看见本页"的最小权限);
          边界 b:同一行 picking 出现 ≥2 次 ⇒ 16 级报错不动(整词修剪的前提是词唯一)。
     批2:刷新 yj_role_panel.perms 的列中文注明(picking 标注"已下架、端点在"),并做**末尾自检**:
          全库残留 picking 行数必须 = 0,否则 16 级报错。

   【幂等】批1 第二次执行:目标行 0 行 → SKIP;批2 列注明幂等重写 + 自检恒为 0。
   【实测】正式库 HSDZ_MES 5 行 / 测试库 HSDZ_MES_TEST 4 行(均 panel_code=WORK_ORDER_LIST)。
   【两账套】先 HSDZ_MES 后 HSDZ_MES_TEST(DbSync 按清单排队;测试库是正式库快照,行数可能少)。
   【自检】批1 事务内:目标行残留 picking = 0 且无空词表,否则整段回滚;
          批2 全库再次断言残留 = 0(必须 [OK] 才算完成)。
   ⚠ 本库兼容级别 = 100(SQL 2008)⇒ **没有 STRING_SPLIT / STRING_AGG**。
     本脚本用 nvarchar 整词修剪(不需要拆词/重拼),天然保住其余词的顺序。
   ⚠ 不要改历史脚本(如 migrate-page-panel-perms-20261016.sql):改字节会触发 DbSync 重跑。
============================================================================= */
SET NOCOUNT ON;
DECLARE @dbn sysname = DB_NAME();

/* ───────────────── 批 1:删 picking 词 ───────────────── */
CREATE TABLE #t (id int NOT NULL PRIMARY KEY);
INSERT INTO #t (id)
SELECT id FROM yj_role_panel
 WHERE panel_code = N'WORK_ORDER_LIST'
   AND ',' + ISNULL(perms,'') + ',' LIKE '%,picking,%';
DECLARE @target int = @@ROWCOUNT;
RAISERROR(N'[待改] %s:WORK_ORDER_LIST 含 picking 的授权行 %d 行', 10, 1, @dbn, @target);
IF @target = 0
BEGIN
  RAISERROR(N'[SKIP] %s:无 picking 残留,批1跳过(幂等)', 10, 1, @dbn);
  RETURN;
END

/* 重复词守卫:整词修剪的前提 = 同一行 picking 最多出现一次 */
DECLARE @dup int = (SELECT COUNT(*) FROM yj_role_panel rp JOIN #t AS t ON t.id = rp.id
                     WHERE (LEN(',' + ISNULL(rp.perms,'') + ',')
                          - LEN(REPLACE(',' + ISNULL(rp.perms,'') + ',', N',picking,', N''))) / 9 > 1);
IF @dup <> 0
BEGIN
  RAISERROR(N'[FAIL] %s:picking 在同一行重复出现(%d 行),批1未执行(先人工核对词表)', 16, 1, @dbn, @dup);
  RETURN;
END

/* 先快照 id + 原 perms,再游标遍历 —— 更新 yj_role_panel 不会影响遍历中的结果集(不漏行) */
CREATE TABLE #work (id int NOT NULL PRIMARY KEY, old_perms nvarchar(1000) NULL);
INSERT INTO #work (id, old_perms)
SELECT rp.id, rp.perms FROM yj_role_panel rp JOIN #t AS t ON t.id = rp.id;

BEGIN TRANSACTION;

DECLARE @n int = 0, @only int = 0;
DECLARE @id int, @w nvarchar(1000), @old nvarchar(1000);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT id, old_perms FROM #work ORDER BY id;
OPEN cur;
FETCH NEXT FROM cur INTO @id, @old;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @w = N',' + ISNULL(@old,'') + N',';
  IF @w = N',picking,'
  BEGIN
    /* 整行只有 picking:去掉后成空词表(非法)⇒ 收成 view(仍可见本页,但无任何动作权限) */
    SET @w = N',view,'; SET @only += 1;
  END
  ELSE
  BEGIN
    /* 整词修剪:词唯一 ⇒ REPLACE 只命中一次,其余词与相对顺序保持原样 */
    SET @w = REPLACE(@w, N',picking,', N',');
  END
  /* 去掉包装用的一端逗号(中间词会剩首尾各一个) */
  IF LEFT(@w,1) = N',' SET @w = SUBSTRING(@w, 2, LEN(@w) - 1);
  IF RIGHT(@w,1) = N',' SET @w = LEFT(@w, LEN(@w) - 1);
  UPDATE yj_role_panel SET perms = @w WHERE id = @id;
  SET @n += @@ROWCOUNT;
  FETCH NEXT FROM cur INTO @id, @old;
END
CLOSE cur; DEALLOCATE cur;

/* 批 1 自检:目标行不得再有 picking,也不得出现空词表 */
DECLARE @bad int = (SELECT COUNT(*) FROM yj_role_panel rp JOIN #t AS t ON t.id = rp.id
                     WHERE ',' + ISNULL(rp.perms,'') + ',' LIKE '%,picking,%'
                        OR ISNULL(rp.perms,'') = N'');
IF @bad <> 0
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] %s:批1自检未过(目标行残留 picking 或空词表 %d 行),已整段回滚', 16, 1, @dbn, @bad);
  RETURN;
END
COMMIT TRANSACTION;
RAISERROR(N'[OK] %s:批1 删除 picking 词 %d 行(其中整行仅 picking→view %d 行;其余词与顺序未变)', 10, 1, @dbn, @n, @only);
GO

/* ───────────── 批 2:刷新 perms 列中文注明 + 全库残留自检(末尾闸门) ───────────── */
SET NOCOUNT ON;
DECLARE @dbn2 sysname = DB_NAME();

/* 列注明:把 picking 标成"已下架、端点保留",防止后来人又把词加回矩阵 */
DECLARE @cmt nvarchar(1000) =
  N'操作权限词表(逗号分隔,顺序=组织架构矩阵列顺序)。引擎真读的词:view/query/add/modify/modlog/del/export/print/audit/field/warn;页面级面板另有 date/convert/assign/unassign/transfer/revoke/unclose/close/split/picking(2026-11-05 起 picking 已从生产工单矩阵下架,仅保留给后端 /px/workOrderList/toPicking 端点鉴权)。can_approve 恒等于本列是否含 audit(单一真源,2026-10-16 词表归位)';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
            WHERE ep.major_id = OBJECT_ID('yj_role_panel')
              AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('yj_role_panel'),'perms','ColumnId')
              AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description', @cmt,
       N'SCHEMA', N'dbo', N'TABLE', N'yj_role_panel', N'COLUMN', N'perms';
ELSE
  EXEC sp_addextendedproperty N'MS_Description', @cmt,
       N'SCHEMA', N'dbo', N'TABLE', N'yj_role_panel', N'COLUMN', N'perms';

/* 末尾自检:全库任何面板任何行都不得残留 picking */
DECLARE @left int = (SELECT COUNT(*) FROM yj_role_panel
                      WHERE ',' + ISNULL(perms,'') + ',' LIKE '%,picking,%');
IF @left <> 0
BEGIN
  RAISERROR(N'[FAIL] %s:全库仍残留 %d 行 picking 授权(多为非 WORK_ORDER_LIST 面板,需人工核对),末尾自检未过', 16, 1, @dbn2, @left);
  RETURN;
END
RAISERROR(N'[OK] %s:批2 全库 picking 授权残留 = 0(生产工单权限矩阵不再有「转领料单」)', 10, 1, @dbn2);
GO
