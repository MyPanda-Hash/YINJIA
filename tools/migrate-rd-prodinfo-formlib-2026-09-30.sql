-- migrate-rd-prodinfo-formlib-2026-09-30.sql
-- 研发管理·产品信息表(RD_PROD_INFO)两项修正 —— 幂等,两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   ① 「产品名称不能为空」——必填标记与实际界面不符

   现象:研发管理 → 产品信息表,填好点「保存」/「提交」必报「产品名称不能为空」,
        而界面上**根本没有这一格**,用户无路可走。

   根因(2026-09-30 实测):
     · yj_field 里 panel_code='RD_PROD_INFO' 的「产品名称」是 required=1、hidden=0;
     · 「产品类别」同样是 required=1;
     · 但产品信息表纸面只渲染 14 格 ——
       frontend/src/core/views/recordSheetConfigs.js 的 RD_PROD_INFO.sections
       (产品编号/客户项目名称/客户料号/产品管控等级/产品功能类别/产品形态/
        产品整体尺寸/炭棒尺寸/主要性能描述/客户图纸或规格书/两级审批人/产品负责人/备注),
       **不含 产品名称、产品类别**(该处注释原文:「产品名称/产品类别/产品类型/产品分类/
        下单数量 保留在元数据但不进纸面(兼容历史单据)」)。
     · 前后端两层必填校验都按 required=1 拦:
       PanelxList.vue validateInlineDraft(只看 headerFields=未 hidden 的字段)与
       ButtonService.ensureRequiredFilled(只看 place='header' 且未 hidden 的必填字段),
       两处都拦不到"界面上没渲染"这件事。

   用户口径(2026-09-30):纸面保持现状,只关掉这两个字段的必填。
   ⚠ 「产品类别」必须一起关:它已被新列「产品功能类别」取代(见 migrate-rd-2026-design.sql
      §2.1.0 的三分类收口),只是当初漏关必填;不一起关,修好产品名称后会紧接着报
     「产品类别不能为空」——同一漏改的第二例。
   ⚠ 只改 required,不动 hidden/visible/seq:两个字段仍保留在元数据与列表里(历史值不丢)。
   ═══════════════════════════════════════════════════════════════════════════ */
UPDATE yj_field
   SET required = 0
 WHERE panel_code = 'RD_PROD_INFO'
   AND col_name IN (N'产品名称', N'产品类别')
   AND ISNULL(required, 0) = 1;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   ② 「产品形态」下拉支持自定义新增/删除选项

   原状:data_type=N'下拉框',dict_sql 是一段**硬编码 SQL**
        (SELECT v FROM (VALUES (N'包布'),(N'套网'),(N'打端盖'),(N'套PP棉')) AS t(v)),
        用户改不了选项 —— 要加一项就得改数据库。

   做法:改用项目既有的「标准库」机制(与实验室 4 张表、RD_MOLD_PROC 的
        烧结炉参数/配料要求 等 15 个字段同一套,见 migrate-lab-stdlib.sql):
          · data_type 改 N'标准库';
          · dict_sql 改存**库编码** N'prod.form'(不再是可执行 SQL);
          · 选项由 PanelConfigService.stdLibOptions() 从 yj_std_lib 取
            (lib_code='prod.form' AND enabled=1 AND asp_cancel<>'Y',按 seq,id 排序);
          · 界面挂「⧉ 标准库维护」入口(共用组件 StdLibManager.vue):
            可新增、可编辑、可停用(软删,下拉里消失且可恢复)、可恢复启用。
      原 4 个选项按原顺序(包布/套网/打端盖/套PP棉)迁入库,取值与显示都不变。
      item_code 取 N'默认' —— 与 StdLibManager 的 addItem 缺省值一致
      (它新增条目时 item=props.item || props.addItem='默认'),保证新增项与本行分组同源。
   ⚠ 历史单据里的旧值(如演示数据的 产品形态='成品')不在库里:el-select 仍会原样显示
     该文本、保存也照旧写回,不会被清空(条目维护只影响以后的候选,不回头改已录入单据)。
   ═══════════════════════════════════════════════════════════════════════════ */
-- ②-a 原有 4 个选项迁入标准库(同库同内容已存在则跳过 —— 重跑不产生重复行)
--     写法参照 migrate-stdlib-seed.sql:同库同 content 有**启用中**条目即视为已迁入
--     (含用户自己先手工加的同名项,不重复插)。
INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1, asp_cancel)
SELECT v.lib, v.item, v.content, v.seq, 1, N'migration', SYSDATETIME(), 'N'
FROM (VALUES
  (N'prod.form', N'默认', N'包布',    10),
  (N'prod.form', N'默认', N'套网',    20),
  (N'prod.form', N'默认', N'打端盖',  30),
  (N'prod.form', N'默认', N'套PP棉',  40)
) AS v(lib, item, content, seq)
WHERE NOT EXISTS (
  SELECT 1 FROM yj_std_lib t
   WHERE t.lib_code = v.lib
     AND t.content = v.content
     AND t.enabled = 1
     AND ISNULL(t.asp_cancel, 'N') <> 'Y'
);
GO

-- ②-b 字段改挂标准库(仅当尚未改过;重跑无副作用)
UPDATE yj_field
   SET data_type = N'标准库',
       dict_sql  = N'prod.form'
 WHERE panel_code = 'RD_PROD_INFO'
   AND col_name = N'产品形态'
   AND (ISNULL(data_type, N'') <> N'标准库' OR ISNULL(dict_sql, N'') <> N'prod.form');
GO

-- ②-c 自检:改完必须能看到 4 个候选(选项为空时下拉会全空且**不报错**,故留一条打印)
DECLARE @n int = (SELECT COUNT(*) FROM yj_std_lib
                   WHERE lib_code = N'prod.form' AND enabled = 1 AND ISNULL(asp_cancel,'N') <> 'Y');
IF @n >= 4 PRINT N'[OK] prod.form 标准库候选 ' + CAST(@n AS nvarchar(10)) + N' 条(>=4)';
ELSE PRINT N'[WARN] prod.form 标准库候选仅 ' + CAST(@n AS nvarchar(10)) + N' 条,请检查 yj_std_lib';
GO
