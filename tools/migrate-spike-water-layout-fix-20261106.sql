/* ============================================================================
   migrate-spike-water-layout-fix-20261106.sql
   修正加标水表格结构迁移：条目名从 content 移到 item_code —— 2026-11-06

   【上一版的问题（本脚本修的就是它）】
     migrate-spike-water-layout-20261106.sql 把结构 JSON 写进了 yj_std_lib.content，
     而加标水的「测试项目」下拉候选取的正是 **content** ⇒ 用户看到的下拉项变成了一整段 JSON，
     原本的条目名（「NSF 53-除铅（PH8.5）」等）被覆盖掉了。

   【正确口径】
     yj_std_lib 有 item_code 与 content 两列：
       · item_code = 条目名（下拉里显示的那个，一个条目一个名字）
       · content   = 条目正文（这里存表格结构 JSON）
     本脚本把原条目名写回 item_code，content 只保留结构 JSON。
     ⇒ 下拉仍显示「NSF 53-除铅（PH8.5）」，选中后前端按 item_code 匹配、从 content 取结构。

   【数据安全】只 UPDATE 这 3 行配置，无 DELETE/TRUNCATE，带行数守卫与自检。

   ⚠ 两账套都要跑，已登记 tools/db-migrations.txt。幂等（WHERE item_code='默认'）。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

/* 除铅：item_code 写回条目名 */
UPDATE yj_std_lib SET item_code = N'NSF 53-除铅（PH8.5）'
 WHERE lib_code = 'lab.test_item' AND item_code = N'默认'
   AND content LIKE N'{%' AND content LIKE N'%"可溶性铅"%'
   AND ISNULL(asp_cancel,'N') <> 'Y';
IF @@ROWCOUNT > 1 RAISERROR(N'fix: 除铅 命中超过 1 行', 16, 1);

UPDATE yj_std_lib SET item_code = N'NSF 53-除汞（PH8.5）'
 WHERE lib_code = 'lab.test_item' AND item_code = N'默认'
   AND content LIKE N'{%' AND content LIKE N'%"汞标准溶液%'
   AND ISNULL(asp_cancel,'N') <> 'Y';
IF @@ROWCOUNT > 1 RAISERROR(N'fix: 除汞 命中超过 1 行', 16, 1);

UPDATE yj_std_lib SET item_code = N'NSF 53-除VOC'
 WHERE lib_code = 'lab.test_item' AND item_code = N'默认'
   AND content LIKE N'{%' AND content NOT LIKE N'%"可溶性铅"%' AND content NOT LIKE N'%"汞标准溶液%'
   AND ISNULL(asp_cancel,'N') <> 'Y';
IF @@ROWCOUNT > 1 RAISERROR(N'fix: 除VOC 命中超过 1 行', 16, 1);

/* 自检：3 条都应有具体条目名，且 content 仍是结构 JSON */
IF EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code='lab.test_item'
            AND content LIKE N'{%' AND item_code = N'默认' AND ISNULL(asp_cancel,'N') <> 'Y')
    RAISERROR(N'fix: 自检失败 —— 仍有条目名为「默认」的结构条目', 16, 1);
GO

COMMIT TRAN;
GO
