# 出货检验单「保存」报 8114(nvarchar→numeric)修复取证(2026-11-13)

## 用户报障

> 「现在出现了使用这个出货功能检验的保存按钮后会出错的问题，报错信息在上方显示了帮我解决这个问题」

界面红条:`服务异常：PreparedStatementCallback; uncategorized SQLException; SQL state [S0005], error code [8114];
Error converting data type nvarchar to numeric.`

## 根因

1. `检验项目标准库`(bs_qc_item)的「取样要求」是**自由文本**(如「称取100g」「每批5件」「全检」)。
2. 纸面「带入检验项目」时,`PanelxList.applyInspItems` 把取样要求原文直接写进了明细的 **`抽检量`**;
   而 `qc_proc_insp_detail.抽检量` 是 **decimal 数值列** ⇒ INSERT/UPDATE 时 SQL Server 报 8114,整单保存回滚。
3. 复现:`repro-8114.mjs` 用真实保存接口给测试账套(HSDZ_MES_TEST)ZC-2026-11-0023 提交
   `抽检量="每批5件"` ⇒ 与用户界面**逐字相同**的 500 消息;`抽检量=5`(数字)则成功 ⇒ 锁定为文本→数值列。

## 修复

- **前端(正路)**:新增纯函数 `frontend/src/core/insp/samplingQty.js`(`parseSamplingQty`)
  —— 只有「纯数字」或「数字+计量单位(nPCS/件/个/只/支/根/条/片)」才解析成数量写进抽检量;
  「称取100g / 每批5件 / 全检 / 3~5PCS」等一律返回 null(不写,保存不受影响)。单测 4/4。
- **后端(兜底)**:`ButtonService.insertRow/updateRow` 写库前按**物理列类型**收敛 ——
  数值列收到文本时:空串→null、能解析→按数值写、解析不了→null + WARN 一条;
  任何面板/绕过前端的路径都不会再因"文本进数值列"把整单保存打挂。
- 口径:**不猜、不造假数据** —— 解析不出的取样要求不落数值列,也不写成 0。

## 验证

- `round-52.mjs`(测试账套):
  - 文本「每批5件」→ 保存 **200**;读回该行保存成功、抽检量为空(不再 500)
  - 文本「称取100g」→ 保存 **200**;同上
  - 数字 5 → 保存 **200**;读回抽检量 = 5(正常值不受影响)
  - 验完提交空明细把该单还原为原始 0 行(测试账套不留造数)
- `node --test src/core/insp/samplingQty.test.js` 4/4;`npm run build` 通过;
  `mvn -DskipTests package` 通过,8090 已换新 jar 重启。
- 正式库无需改数据:事故只发生在保存瞬间(事务回滚),没有半截脏数据。
