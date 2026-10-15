/* migrate-change-title-20261016.sql — 产品变更申请单(RD_CHANGE):大标题格改为**可自主编辑的普通文本框**
 *
 * 用户口径(2026-10-16,原话):
 *   「产品变更信息表的 KPC管控点申请单 这个栏改为可自主编辑的普通文本框,背景提示词默认为现在的这个,
 *     未进行更改则默认背景提示词」。
 *
 * 做法(与产品信息表 2026-10-16 那次「大标题格 → 字段输入框」同一套机制):
 *   ① 头表加一列 [标题] —— 存操作者自己写的标题;
 *   ② yj_field 登记(place=header,可编辑) —— 保存链路按 yj_field 收发,不登记就存不进去;
 *   ③ 前端 recordSheetConfigs.RD_CHANGE 上 cfg.titleKey='标题' / titleKeyPh='KPC管控点申请单'
 *      —— 空值时纸上仍印 staticTitle(同文),老单据观感不变(见 RecordSheetPanels 大标题格)。
 *
 * 幂等:列 / 字段 / 注释 三处都先判存在;整段包在事务里,末尾自检(踩过"脚本看着跑过了其实没落地")。
 * 两账套都要执行(先 HSDZ_MES 后 HSDZ_MES_TEST)。
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

IF COL_LENGTH('rd_change_head', N'标题') IS NULL
BEGIN
  ALTER TABLE rd_change_head ADD [标题] nvarchar(400) NULL;
  PRINT N'[+] rd_change_head.标题 已新增';
END
ELSE PRINT N'[=] rd_change_head.标题 已存在';

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_CHANGE' AND col_name = N'标题')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('RD_CHANGE', N'标题', N'标题', N'文本', N'header', 25, 200, 1, 0, 0, 1);
  PRINT N'[+] yj_field RD_CHANGE.标题 已登记(表头 / seq 25 / 可编辑)';
END
ELSE PRINT N'[=] yj_field RD_CHANGE.标题 已存在';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_change_head')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_change_head'), N'标题', 'ColumnId')
                 AND name = N'MS_Description')
BEGIN
  EXEC sp_addextendedproperty N'MS_Description',
       N'产品变更申请单大标题(KPC管控点申请单;可自主编辑,空值按静态标题印刷)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_change_head', N'COLUMN', N'标题';
  PRINT N'[+] 列中文注明已写';
END

-- 自检:列与字段都必须真的在,否则回滚报错(不许"静默成功")
IF COL_LENGTH('rd_change_head', N'标题') IS NULL
   OR NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_CHANGE' AND col_name = N'标题')
BEGIN
  ROLLBACK;
  RAISERROR (N'自检失败:rd_change_head.标题 或 yj_field 登记未落地,已回滚', 16, 1);
  RETURN;
END

COMMIT;
PRINT N'完成:rd_change_head 列数 = 52';
GO
