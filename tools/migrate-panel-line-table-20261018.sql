/* migrate-panel-line-table-20261018.sql(2026-10-18)
 *
 * 目的:修复三个「单表式 doc 面板」的元数据漏配 —— yj_panel.line_table 为空,
 *   导致 QueryService.loadDocs 取明细行时把 null 直接拼进 SQL:
 *     SELECT t.id AS __id, t.[单据编号] AS __no, t.* FROM null t WHERE ... IN (?)
 *   ⇒ SQL state S0001 / error 156「关键字 'null' 附近有语法错误」。
 *   面板表现:打开单据(getFormDescriptor)500;列表一旦有单据(queryDocs → loadDocs)500;
 *   保存时 ButtonService.softDeleteMissing 拼 `UPDATE null` 同样 500。
 *
 * 涉及面板(全库**仅这 3 个** doc 面板是「有头表、无行表」,其余 59 个 doc 都成对,
 *   另 4 个是「只有行表没有头表」的单表式,走另一条分支不受影响):
 *   GRAN_RECORD  造粒记录    head = gran_record    + line = gran_record_detail  (恒空明细)
 *   WH_RECORD    无黑处理登记 head = wh_record      + line = wh_record_detail    (恒空明细)
 *   PACK_CONFIRM 封箱确认    head = pack_confirm   + line = pack_confirm_detail (恒空明细)
 *
 * 背景:三张 *_detail 早已由 migrate-prod-forms-fix.sql 建好(字段全在表头,明细行恒空),
 *   但同一脚本里的 UPDATE 用**旧值**做条件(`WHERE line_table='gran_record'`),
 *   而正式库这 3 行是 NULL —— 等值比较与 NULL 永远不成立 ⇒ 只建了空表、没写指针。
 *   测试库与生成物 tools/gen/db-catalog-panels.tsv 里这 3 行均已指向 *_detail,
 *   本脚本把正式库对齐到同一状态(纯元数据,不动表结构、不动业务数据)。
 *
 * 幂等:只更新「指针为空 / 仍是头表名」的行;已指向 *_detail 的账套执行 = 0 行。
 * 自检:① 三行指针均指向存在的对象;② 全库「mode='doc' 且有头表、无行表」= 0,
 *   ③ 三张行表的 OBJECT_ID 存在 —— 任一条不满足即 RAISERROR 中止(不写 yj_schema_log)。
 * 两账套均执行(先正式、后测试)。
 */

IF OBJECT_ID('dbo.gran_record_detail') IS NULL
   OR OBJECT_ID('dbo.wh_record_detail') IS NULL
   OR OBJECT_ID('dbo.pack_confirm_detail') IS NULL
    RAISERROR(N'[panel-line-table] 缺 *_detail 明细表:请先执行 migrate-prod-forms-fix.sql', 16, 1);
GO

DECLARE @fixed int = 0;

UPDATE yj_panel SET line_table = N'gran_record_detail'
 WHERE panel_code = N'GRAN_RECORD'
   AND (line_table IS NULL OR LTRIM(RTRIM(line_table)) = N'' OR line_table = N'gran_record');
SET @fixed += @@ROWCOUNT;

UPDATE yj_panel SET line_table = N'wh_record_detail'
 WHERE panel_code = N'WH_RECORD'
   AND (line_table IS NULL OR LTRIM(RTRIM(line_table)) = N'' OR line_table = N'wh_record');
SET @fixed += @@ROWCOUNT;

UPDATE yj_panel SET line_table = N'pack_confirm_detail'
 WHERE panel_code = N'PACK_CONFIRM'
   AND (line_table IS NULL OR LTRIM(RTRIM(line_table)) = N'' OR line_table = N'pack_confirm');
SET @fixed += @@ROWCOUNT;

PRINT N'[panel-line-table] 本次修正 ' + CAST(@fixed AS nvarchar(10)) + N' 行(已对齐的账套应为 0)';
GO

DECLARE @ok int;
SELECT @ok = COUNT(*) FROM yj_panel
WHERE (panel_code = N'GRAN_RECORD'  AND line_table = N'gran_record_detail')
   OR (panel_code = N'WH_RECORD'    AND line_table = N'wh_record_detail')
   OR (panel_code = N'PACK_CONFIRM' AND line_table = N'pack_confirm_detail');
IF @ok <> 3 RAISERROR(N'[panel-line-table] 自检失败:三个面板未全部指向 *_detail', 16, 1);

DECLARE @headOnly int;
SELECT @headOnly = COUNT(*) FROM yj_panel
WHERE mode = N'doc'
  AND head_table IS NOT NULL AND LTRIM(RTRIM(head_table)) <> N''
  AND (line_table IS NULL OR LTRIM(RTRIM(line_table)) = N'');
IF @headOnly > 0 RAISERROR(N'[panel-line-table] 自检失败:仍有 doc 面板「有头表、无行表」', 16, 1);

DECLARE @missing int;
SELECT @missing = COUNT(*) FROM yj_panel p
WHERE p.panel_code IN (N'GRAN_RECORD', N'WH_RECORD', N'PACK_CONFIRM')
  AND OBJECT_ID(N'dbo.' + p.line_table) IS NULL;
IF @missing > 0 RAISERROR(N'[panel-line-table] 自检失败:行表对象不存在', 16, 1);

IF @ok = 3 AND @headOnly = 0 AND @missing = 0
    PRINT N'[panel-line-table] 自检通过:3 个面板已连上 *_detail,全库无「有头无行」doc 面板';
GO
