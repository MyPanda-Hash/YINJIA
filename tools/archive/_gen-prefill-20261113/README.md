# 生单对话框「不滚动 + 仓库/仓位预填」取证（2026-11-13）

用户口径（本次两条需求原文）：

> ①「不要滚动，一次显示全部。采购到入库所有流程分支的生单都是不要滑动，全部展示出来」
> ②「从采购订单生单的时候就开始预填仓库仓位」；追问后补充：
>    「生单可以选仓库和仓位，可以每行不一样，也可以所有行带入第一个填入的仓库和仓位」；
>    「送料暂收单 / 来料检验单 上要把 仓库、仓位 列显示出来」。

## 一、改了什么

| 点 | 落点 | 取证 |
|---|---|---|
| 生单对话框不再内层滚动 | `GenerateLinesDialog.vue`（统一生单/批量生单）：弹窗 `96vw / top 1vh`，表格去掉 `max-height=260`，`.gl` 去掉 `max-height:68vh; overflow:auto`；`BatchSendDialog.vue`（单张分批送料）同样处理（去掉 `height=300` / `max-height=260`） | `round-01.json`：弹窗 313px < 视口 707px，`bodyWrappers.inner=false`、`overflowY=hidden`、`maxHeight=none`，2 行全部渲染 |
| 生单时可**按行**选仓库/仓位 | 两个对话框都加了「仓库 / 仓位」两列（`el-select`，仓位按本行仓库级联，含"默认仓位"预填），行头按钮「仓库仓位应用到所有行」 | `round-05.json` / `round-06.json`：表头含 `仓库、仓位` 两列（`heads`）、`hasApplyAll=true`、仓库候选 9 个、仓位候选 168 个 |
| 预填随生单落到下游单据 | 后端 `PxController` 收集行级 仓库/仓位 → `PushGenerateHandler.applyWhBin` 落目标行；`PanelConfigService.FLOW_DETAIL_SYNONYMS` 补 `仓位编码→仓位 / 仓位名称 / 仓位id` 等链路同义词 | `round-11.json`（免检直达）：暂收单行 `A仓 / A1-09-1` → 采购入库单行 `A仓 / A1-09-1` |
| 仓位沿链贯通到检验单 | 迁移 `tools/migrate-gen-wh-bin-prefill-20261113.sql` 给 `sl_recv_detail` / `qc_insp_detail` 补 `仓位编码/仓位名称/仓位id` 并登记 yj_field（暂收行「仓库」、检验行「仓库代码」改为可见） | `round-12.json`（需检物料）：暂收单行 `A仓 / A1-09-1` → 来料检验单行 `仓库代码=A仓 / 仓位=A1-09-1` |
| 生单时已带仓位不被预设覆盖 | `PushGenerateHandler.applySourceFlags`、`ButtonService.inspAutoPurchaseIn` 都改成「**本行已有仓位就不预设**」 | `round-12` 的检验行与 `round-11` 的入库行都保留用户选的 `A1-09-1`（若是旧逻辑会被 `presetBinFor` 的默认仓位盖掉） |

## 二、取数口径（为什么必须加列）

`ProbeChain.java` / `ProbeRefCfg.java` 实测（HSDZ_MES）：

- 采购订单行 `bl_pu_order`：`仓库 / 仓库编码 / 仓库id / 仓库启用仓位管理 / 仓位id / 仓位名称 / 仓位编码` 都在，仓位系列是隐藏列；5080 行里只有 **47 行**填过仓库 ⇒ 不能只靠"从订单行带"，必须给当场选的入口。
- 送料暂收行 `sl_recv_detail`：只有 `仓库`（yj_field 里还是隐藏），**没有仓位列**；
- 来料检验行 `qc_insp_detail`：仓库叫 `仓库代码`（隐藏），**没有仓位列**；
- 采购入库行 `bl_purchase_in`：`仓库 / 仓位(列 仓位编码)` 齐全 —— 链路终点本来就填得下，缺的正是中间两站。

## 三、环境与复跑

- 界面：`http://localhost:5173`（vite 源码版）；后端 8090 已按本次源码重新打包。
- 写库只在 `YINJIA-MES·测试库`（`HSDZ_MES_TEST`）：`round-08 / 12` 自己建单、审核、生单，跑完**当场删掉**造出来的单据
  （`round-12.json` 的 `cleanup` 三条都是 `删除=200`）。正式库只做只读断言（`round-01/03/05/06`）。
- ⚠ 这台机器的 ego 浏览器 `Page.captureScreenshot` 一直 CDP 超时（上一任务已记录），故本次证据同样是
  **DOM 断言 + 接口原文**，没有截图。

```powershell
# 需要 ego 浏览器 + 8090(jar) + 5173(vite) 都在跑
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_gen-prefill-20261113/round-01.mjs')"   # 不滚动
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_gen-prefill-20261113/round-12.mjs')"   # 预填沿链(需检分支)
```

⚠ `round-08 / 12` 会在**测试账套**建单/审核/删除；跑之前确认浏览器账套是「YINJIA-MES·测试库」，
脚本自身会先断言账套名，不是测试库直接拒绝执行。

## 四、库侧校验

- 迁移已进 `tools/db-migrations.txt`，两账套 `DbSync` 均「执行 1 / 失败 0」，`ChkMig.java` 复核列与字段元数据都在。
- 采购链四单基线已回写：`docs/development/采购链四单字段与显示字段.md` 由 `_gen-doc-fields-md.mjs` 重新生成（§四 12/12），
  `tools/fourdoc-baseline.tsv` 由 `_gen-fourdoc-restore.mjs` 刷新（335 行），`FourDocAudit` = **PASS**。
