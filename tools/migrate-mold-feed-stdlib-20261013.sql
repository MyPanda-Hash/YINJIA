/* migrate-mold-feed-stdlib-20261013.sql —— 给成型工艺清单「灌料要求」挂标准库(用户 2026-10-13)
 *
 * 用户口径:「灌料要求、烧结温度 时间参数、热压、冷却参数 都需要提供标准库 手动输入两种方式,
 *   已有的标准库同时可以提供下拉列表,即标准库维护下拉列表模板,选择下拉模板字段后可以手动编辑!」
 *
 * 取证(HSDZ_MES_TEST):该面板这 5 个字段里,**只有「灌料要求」没挂标准库**:
 *   配料要求            dict_sql=(空)  data_type=文本    ← 走「文本框 + ⌄标准库」版式,双模
 *   灌料要求            dict_sql=(空)  data_type=文本    ← ★ 本次要补的就是它
 *   烧结炉参数          dict_sql=mold.sinter       data_type=标准库
 *   烧结时间调速器参数  dict_sql=mold.sintertime   data_type=标准库
 *   热压要求            dict_sql=mold.hotpress     data_type=标准库
 *   冷却参数设置        dict_sql=mold.cooling      data_type=标准库
 *   (recordSheetConfigs.js:224 的注释原文也写着「工序五个字段(配料要求/烧结炉参数/烧结时间调速器参数/
 *    热压要求/冷却参数设置)挂标准库」—— 恰好不含「灌料要求」。)
 *
 * 处置:新建独立库编码 **mold.feed**(与配料要求的 mold.batching 分开,两者是不同工序环节),
 *   把「灌料要求」的 dict_sql 指过去、data_type 改成「标准库」。
 *   **不需要改任何前端代码**:RecordSheetPanels 的渲染里,stdLibOf(key) 判据是
 *   `f.dataType === '标准库' && f.stdLib`(stdLib 来自后端下发的 dict_sql),
 *   而「灌料要求」在配置里是 `{ key:'灌料要求', span:8, area:true }`(文本框版式),
 *   命中模板 :307 分支「标准库型字段但版式要文本框」⇒ 自动变成「文本可自由改 + ⌄标准库选预设」双模。
 *
 * 幂等:重复执行 = 0 行。两账套都跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
 * 用法:sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d <库> -C -f 65001 -i <本文件> -W -s"|"
 */
SET NOCOUNT ON;

/* ① 改前报数 */
SELECT N'[改前] 灌料要求 现配置' AS 项,
       ISNULL(MAX(ISNULL(data_type,N'(空)')), N'(无此行)') + N' / dict_sql=' + ISNULL(MAX(ISNULL(dict_sql,N'(空)')), N'(无)') AS 值
  FROM yj_field WHERE panel_code = N'RD_MOLD_PROC' AND label = N'灌料要求';

/* ② 执行:只在「还没挂库」时改,避免覆盖别人后来配的库 */
UPDATE yj_field
   SET dict_sql = N'mold.feed', data_type = N'标准库'
 WHERE panel_code = N'RD_MOLD_PROC' AND label = N'灌料要求'
   AND (dict_sql IS NULL OR dict_sql = N'');
PRINT N'[调整] 灌料要求 挂标准库行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ③ 自证:该面板 6 个字段的标准库配置现状 */
PRINT N'=== 成型工艺清单 配料/灌料/烧结/热压/冷却 六格的标准库配置 ===';
SELECT label, place, seq, ISNULL(data_type,N'') AS 类型, ISNULL(dict_sql,N'(无)') AS 标准库编码, editable
  FROM yj_field
 WHERE panel_code = N'RD_MOLD_PROC'
   AND label IN (N'配料要求', N'灌料要求', N'烧结炉参数', N'烧结时间调速器参数', N'热压要求', N'冷却参数设置')
 ORDER BY seq;

/* ④ 自证:漏配的行数应为 0 */
SELECT N'[自证] 六格里还没挂标准库的行数(应=0)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM yj_field
 WHERE panel_code = N'RD_MOLD_PROC'
   AND label IN (N'配料要求', N'灌料要求', N'烧结炉参数', N'烧结时间调速器参数', N'热压要求', N'冷却参数设置')
   AND (dict_sql IS NULL OR dict_sql = N'');
