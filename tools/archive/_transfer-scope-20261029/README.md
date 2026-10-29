# _transfer-scope-20261029 — 工单调拨「只能调拨到当前工序的产线」取证与验收

任务口径(用户 2026-10-29):「修改当前工单排产的调拨逻辑需要实现当前的调拨只能调拨到当前工序的产线中」。
正式说明见 `docs/development/工单调拨-只调当前工序产线-20261029.md`,本目录只放一次性探针与验收脚本。

## 文件

| 文件 | 用途 |
|---|---|
| `Probe.java` | 只读:产线档案车间分布 / 已排产行的当前工序 vs 所在线车间匹配汇总 / `wo_process_line` 台账形态 |
| `Probe2.java` | 只读:已排产行按当前工序分布 + 各工序样例行(取真实行 id 供接口验收) |
| `check-sfc.mjs` | 沙箱里 `npm run build` 会因 esbuild spawn EPERM,用 `@vue/compiler-sfc` 纯 JS 校验改过的 SFC 语法 |
| `qa-transfer.ps1` | **正式库(8090)** 接口验收:候选线只出本工序 + 错投被拒 + 未发生写入(只跑"该被拒"分支) |
| `qa-transfer-success.ps1` | **测试库(8091 实例)** 成功路径:同工序换线 → 轨迹 → 撤回调拨回原线 |

跑法:

```powershell
# ① 取证(正式库,只读)
cd tools
java -cp lib\mssql-jdbc.jar archive\_transfer-scope-20261029\Probe.java
java -cp lib\mssql-jdbc.jar archive\_transfer-scope-20261029\Probe2.java

# ② 语法(改了 .vue 但 npm run build 被沙箱拦时)
node tools\archive\_transfer-scope-20261029\check-sfc.mjs frontend\src\views\modules\plan\WorkOrderBoard.vue

# ③ 接口验收(先登录拿 token 写到 .tmp\mytask-token.txt;8091 用测试账套实例)
pwsh -File .tmp\qa-transfer.ps1          # 正式库只读 + 拒绝分支
pwsh -File .tmp\qa-transfer-success.ps1  # 测试库成功路径(会写/撤回轨迹,勿对正式库跑)
```

## 2026-10-29 实测结论(正式库 HSDZ_MES,只读)

```
① 产线档案(启用):成型 19 / 切炭 5 / 组装 6(无停用线)
② 已排产 388 行:当前工序 100% 可判(0 行为空);
   工序与所在线车间一致 371 行,不一致 17 行(历史跨车间数据:当前工序=成型却停在组装线),
   线未归类车间 0 行
③ 台账 wo_process_line:已落实 51 行(成型 33 / 切炭 10 / 组装 8,工单行id 全非空)、计划 48 行
```

接口验收(8090,正式库,**只跑会拒绝的分支,零写入**):

```
成型行 GD-2026-10-0227#1(行id=2172,当前工序=成型,现线 2号车间)
  transferTargets → 工序=成型 车间=成型 候选线=18(19 条成型线剔掉原线),含原线=false
  调到切炭线 → 409「当前工序「成型」只能调拨到「成型」车间下的产线(…19 条…);目标线「切炭线」属于「切炭」车间」
  旧入口 /reassign 同样 409 ⇒ 只剩一条改线路径
组装行(当前工序=组装)→ 候选线=5(6 条组装线剔原线),候选车间只有「组装」
成型 + 组装 混选 → 可调拨=false,提示「所选工单当前工序不同(成型 / 组装)…请按工序分行调拨」
```

成功路径(8091 = 同 jar + `--spring.datasource.url` 指向测试库 HSDZ_MES_TEST):

```
MO-2026-09-0004#1(行id=26,当前工序=成型,原线 成型2线)
  候选 18 条成型线(不含原线)→ 调到 成型1线 → 新线命中=true / 原线命中=false
  transferRevoke → 回到 成型2线;追溯「调拨轨迹」1 条:成型2线→成型1线,原因「自动化验收(测试库)」,状态 已撤销
```

⚠ 该测试库行/轨迹是测试账套里的验收留痕(不是正式库数据),保留可作证据。
