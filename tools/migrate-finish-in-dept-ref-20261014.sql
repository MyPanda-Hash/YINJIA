/* ============================================================
   migrate-finish-in-dept-ref-20261014.sql — 2026-10-14
   产成品入库单(FINISH_IN)的「部门 / 部门编码」由**文本**改**参照部门档案**

   背景:用户 2026-10-14 反馈「其他出库和入库没有下拉数据下来,也没有将面板的全部实现与产成品入库对齐」。
     排查时发现参照面板自身也有一处口径不一致:产成品入库单的 部门/部门编码 是 Phase 1 新建字段时
     按**文本**登记的(当时只求落库),而 采购入库单/销售出库单 的同名字段是**参照 DEPT**
     (部门 ref=部门名称/disp=部门名称;部门编码 ref=部门编码/disp=部门名称 —— 见采购链四单文档 §3.4)。
     本脚本把这两行对齐到采购入库单/销售出库单的口径(纯元数据 UPDATE,零 DDL)。

   ⚠ 只动「(type/ref 与目标口径不一致)」的行(窄条件),幂等可重跑;两账套均执行。
   ============================================================ */
SET NOCOUNT ON;
GO
-- 部门:参照 DEPT.部门名称 → 部门名称
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'DEPT', ref_field = N'部门名称', display_field = N'部门名称'
 WHERE panel_code = 'FINISH_IN' AND label = N'部门'
   AND (data_type <> N'参照' OR ISNULL(ref_panel, '') <> N'DEPT' OR ISNULL(ref_field, '') <> N'部门名称');
GO
-- 部门编码:参照 DEPT.部门编码 → 部门名称(与采购入库单同款)
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'DEPT', ref_field = N'部门编码', display_field = N'部门名称'
 WHERE panel_code = 'FINISH_IN' AND label = N'部门编码'
   AND (data_type <> N'参照' OR ISNULL(ref_panel, '') <> N'DEPT' OR ISNULL(ref_field, '') <> N'部门编码');
GO
-- 自检:两行都必须已是 参照/DEPT
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'部门'
               AND data_type = N'参照' AND ref_panel = N'DEPT' AND ref_field = N'部门名称') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'部门编码'
               AND data_type = N'参照' AND ref_panel = N'DEPT' AND ref_field = N'部门编码') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'FINISH_IN 部门/部门编码 参照口径自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'FINISH_IN 部门/部门编码 已对齐为参照 DEPT(与采购入库单/销售出库单同款)';
GO
