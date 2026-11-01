# 工序检验三单「检验人员」= 当前电脑端登录人(2026-10-21)

## 用户口径

> 「将当前首件检验单,制程检验单,组装成品检验单的检验人员都填写默认当前电脑端的用户
> 而不是 system(手机端报工吸收)。」

## 现状(改前取证)

`ExternalReportAbsorbScheduler` 每分钟跑一次手机端报工吸收,没有登录人 ⇒
`ExternalReportAbsorbService` 把审计用占位值 `system(手机端报工吸收)` 当成 `user` 传给
`QcInspAutoService.build()`,三个单头组装方法都 `head.put("检验员", user)`。
正式库实测(`_Q.java` 查询)共 14 张:

| 面板 | 张数 | 单号 | 审核状态 |
|---|---|---|---|
| QC_FIRST_INSP | 5 | SJ-2026-10-0062 / 0164~0167 | 全部未审核(`yj_doc_status.shr` 为空) |
| QC_PROC_INSP | 5 | ZC-2026-10-0030 / 0128~0131 | 全部未审核 |
| QC_ASM_INSP | 4 | ZJ-2026-10-0136/0138/0139/0140 | 已作废(`canceled='Y'`) |

## 改法(三层,口径一份)

1. **出单不再写检验员** —— `QcInspAutoService` 三个 `head()` 去掉 `head.put("检验员", …)`,
   `build(scjlId, repNo)` 不再收 `user`;审计留痕仍走 `asp_user2` / `create_by`。
   后台定时吸收线程本来就没有登录人,签名格留空比伪造 `system` 诚实。
2. **PC 打开草稿即带出** —— 新模块 `frontend/src/core/qc/qcInspector.js`:
   三面板名单 + 占位值判定 + 显示名口径一份真源;`PanelxList` 在 `watch(cur)` 里
   **早于 `markSavedSnapshot()`** 调用(`draftEditable` 才带),所以带出的值不会被
   "未保存修改"守卫误判。
   - 空值 / `system…` 占位 → 当前登录人**姓名**(`realName`,退回账号);
   - 已有真人姓名一律不动(签名是事实)。
3. **保存兜底** —— `ButtonService.defaultQcInspector(def, head, user)`(在 `saveDoc` 入口):
   空值 / `system…` 占位 → `realNameOf(user)`;`user="system"`(后台线程)时不写。
   `QcFirstInspController.fromWoLine` / `QcProcInspController.fromWoLine` 原先预填
   `currentUser()`(username)的两行已移除,统一交给兜底写**姓名**,避免"姓名被账号盖掉"。

## 验证证据

1. **单测**:`node --test src/core/qc/qcInspector.test.js` → 8/8 通过。
2. **后端(测试账套 HSDZ_MES_TEST,临时实例 8091,admin 登录)**:

   | 场景 | 提交值 | 保存后回读 |
   |---|---|---|
   | 新建空白制程检验单 | (无) | **系统管理员** |
   | 历史 system 占位再保存 | `system(手机端报工吸收)` | **系统管理员** |
   | 已有真人姓名再保存 | `陈秀丽` | **陈秀丽**(不覆盖) |

   脚本:`_verify-inspector.mjs`(建单)、`_verify-one.mjs`(单场景保存+回读)、`_cleanup.mjs`(清理);
   验证单 `ZC-2026-10-0030` / `ZC-2026-10-0031` 已物理清理(头/状态行均 0 残留)。
3. **界面(5173 源码版,CDP + Edge headless)**:`_probe-inspector-default.mjs` → 5/5 通过:

   | 面板 | 单号 | 库值 | 界面显示 |
   |---|---|---|---|
   | 制程 | ZC-2026-10-0131 | `system(手机端报工吸收)` | **系统管理员** |
   | 首件 | SJ-2026-10-0167 | `system(手机端报工吸收)` | **系统管理员** |
   | 组装成品 | ZJ-2026-10-0007 | (空) | **系统管理员** |
   | 制程 | ZC-2026-10-0127 | `admin` | **admin**(原样) |

4. **8090 打包版复验**(`rebuild-prod.ps1` 重打包重启后,同一脚本):
   - 界面 5/5 通过(同上四张单,显示不变);
   - 后端(测试账套):提交 `system(手机端报工吸收)` → 回读 **系统管理员**(验证单 `ZC-2026-10-0031` 已清理)。
   - `QcInspAutoService` 出单不再写检验员:重启后 15 分钟内无新单可验(吸收候选中没有达标行),
     以代码 + 测试账套保存路径取证;`asp_user2/create_by` 的审计留痕不受影响。


## 边界(如实)

- **存量未审核草稿**:库里仍是 `system…`;在电脑端打开即显示当前登录人,保存一次后落库纠正
  (未另写数据迁移:无法知道每张单该由谁检,按人猜等于造假签名)。
- **没人打开过的后台出单**:检验员为空 —— 无真人可签,比伪造 `system` 更诚实。
- 已审核/已归档单据的签名格**不参与**默认(前端只在 `draftEditable` 时带出;后端只在空值/占位时填)。
