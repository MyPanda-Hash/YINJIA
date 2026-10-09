/* migrate-yjuser-workshop.sql(2026-10-05):账号挂「生产车间」—— 9.29 生产管理批次 ③「排产界面按车间过滤」
 *
 * 口径来源(会议):「排产界面按登录车间过滤,组装账号只见组装相关工单,剔除成型/切断等无关车间」。
 *
 * 落地口径(已确认):本厂五道工序**共用工单**(一张工单要过成型/切炭/组装/装箱),待排产池的行
 *   (scx 为空)本身没有车间属性 ⇒ 「按车间过滤」= **按产线收敛**:
 *     · 工单/排产的车间归属 = 其产线的车间(`bs_prod_line.生产车间`,已维护:成型1~5线/切炭线/组装线/装箱线);
 *     · 账号的车间 = 本列 `yj_user.生产车间`(空 = 不受限,如管理员/计划组);
 *     · 待排产池(无产线)只对**不受限账号**可见 —— 车间账号在本车间产线范围内看/操作。
 *   依据:`bs_inv.默认生产车间编码` 实测 338 个商品**一个都没维护**,做不了「按产品判车间」的判据;
 *   `bs_op.默认车间` 是工序→车间(工序维度,不是工单维度),故不采用。
 *
 * 引擎表结构变更(账号属性):列加在 yj_user 上,由引擎侧账号管理读写(SysAdminController)。
 * 幂等可重跑;两账套均执行。
 */

IF COL_LENGTH('yj_user', N'生产车间') IS NULL ALTER TABLE yj_user ADD [生产车间] nvarchar(50) NULL;
GO

/* 中文注明(全量部署规范) */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.yj_user')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_user'), N'生产车间', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'账号所属生产车间(=bs_prod_line.生产车间 取值域;空=不受限,排产界面看到全部产线)',
       N'SCHEMA', N'dbo', N'TABLE', N'yj_user', N'COLUMN', N'生产车间';
GO

/* 自检 */
IF COL_LENGTH('yj_user', N'生产车间') IS NULL
  RAISERROR(N'yj_user.生产车间 未建成', 16, 1);
ELSE PRINT N'yj_user.生产车间 就绪(排产界面按车间过滤)';
GO
