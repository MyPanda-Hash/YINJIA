/* ============================================================================
   migrate-testlib-shared.sql
   ----------------------------------------------------------------------------
   检验项目标准库「互通」:把出货检验计划表(RD_INSP_PLAN)的条目并入共用库。

   背景(2026-09-11):
     规格书(RD_SPEC_DOC)检验项目原来挂 lib_code='spec.test',
     出货检验计划表(RD_INSP_PLAN)原来挂 lib_code='insp.plan'——两个面板各录各的,
     「规格书里录的条目,出货计划表里选不到」。前端已改为两边都读写同一批条目:
       · 读:两个弹窗都请求 GET /stdlib/list?lib=spec.test(不再按 item 过滤);
       · 写:两个表单都 POST /stdlib/add {lib:'spec.test'};编辑走 POST /stdlib/update。
     于是存量 insp.plan 条目必须改挂 spec.test,否则旧条目在新界面里看不见。

   content **保持旧格式即可,不转换**:
     出货计划表的旧条目正文是 10 个中文键的 JSON。前端 core/panel/testItemLib.js 的
     toCanonical() 读写都兼容旧形状(自动识别中文键),展示时按列名取值照常显示;
     用户在界面里点「编辑 → 保存修改」时才回写成规范结构(v=2)。
     所以本脚本只搬 lib_code,不碰正文——幂等,且不会因格式转换写坏条目。

   幂等:UPDATE 按 lib_code 精确匹配;重复执行时 insp.plan 已不存在,影响 0 行。
   执行(必须带 -f 65001,否则脚本里的中文条件静默不生效):
     sqlcmd -S localhost -d HSDZ_MES -U yinjia -P 'Yinjia@2026' -W -s '|' -f 65001 -i tools\migrate-testlib-shared.sql
   ========================================================================== */
SET NOCOUNT ON;

-- ① 搬运:出货检验计划表的条目改挂规格书检验项目库
UPDATE yj_std_lib SET lib_code = N'spec.test' WHERE lib_code = N'insp.plan';
PRINT N'  insp.plan → spec.test 搬运行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

-- ② 复查:lib_code 分布(insp.plan 应为 0 行/不出现;共用库 = 规格书内建 + 出货计划存量)
SELECT lib_code, COUNT(*) AS 条目数
  FROM yj_std_lib
 GROUP BY lib_code
 ORDER BY lib_code;
