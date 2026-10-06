/* migrate-route-restore-required.sql(2026-10-05):撤回「工艺路线必填收敛」,恢复必填
 * 用户口径:「撤回上面的修改,当前需要实现必填,但是**不是在填写明细表的时候**检验必填」
 *   ⇒ 必填**保留**(工序控制/生效日期/失效日期 恢复 required=1);
 *     要改的是**校验时机**:明细行录入过程中不校验,统一在**保存时**校验(前端改动,见 PanelxForm/PanelxList)。
 * 撤回(再放开):UPDATE yj_field SET required=0 WHERE panel_code=N'ROUTE' AND col_name IN (N'加工方式',N'生效日期',N'失效日期');
 * 幂等;两账套均执行。
 */
UPDATE yj_field SET required = 1
 WHERE panel_code = N'ROUTE' AND col_name IN (N'加工方式', N'生效日期', N'失效日期');
GO
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'ROUTE' AND required=0
           AND col_name IN (N'加工方式',N'生效日期',N'失效日期'))
  RAISERROR(N'必填恢复未完成',16,1);
ELSE PRINT N'必填已恢复:工序控制/生效日期/失效日期 = 必填(校验时机待改为保存时)';
GO