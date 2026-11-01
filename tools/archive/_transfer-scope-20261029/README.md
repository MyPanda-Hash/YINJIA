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
| `qa-postmerge.ps1` | 2026-10-30 合并 `origin/main` 后**重建 jar 的 8090** 上重跑:本任务回归 + 相关接口冒烟 |
| `ProbeTestDb.java` | 只读:测试库 `HSDZ_MES_TEST` 是否已跟上新增对象/列(两账套核对) |

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

## 2026-10-30 合并 `origin/main` 后复验(合并 04e9672a / 静态同步 cc20b19c)

并行会话在 10-30 00:04~00:19 完成了 `origin/main`(61 提交)的合并;合并把后端 61 个提交带进来了,
**但运行时 jar 还是合并前的**(00:06 那次构建)⇒ 本次收尾:停 8090 → `mvn clean package -DskipTests`
(JDK 25;fat jar 97,573,090 B / `BOOT-INF/lib` 129 条)→ `start-prod.ps1` 重启。

```
① 启动时数据库增量同步:执行 0 / 跳过 661 / 失败 0(合并带来的迁移此前已应用)
② 两账套核对(ProbeTestDb.java,HSDZ_MES_TEST):wo_day_plan、wo_proc_card_head/detail、
   wo_process_line.计划开工/完工日期、yj_form_approval.self_audit 全 [有];yj_schema_log 689 条登记 ⇒ 测试库已跟上
③ 四单回归闸 verify/FourDocAudit.java HSDZ_MES → [PASS](四单 327 行:多 0 / 缺 0 / 内容变 0 / 名次不符 0)
④ 本任务回归(qa-postmerge.ps1,仍是 GD-2026-10-0227#1,成型,现线 2号车间):
   候选 18 条成型线(不含原线,候选车间只有「成型」);调到「切炭线」→ 409 且列全候选线;
   旧入口 /reassign → 409;该行仍在 2号车间(零写入)
⑤ 冒烟:lineSummary 30 条(成型 19/切炭 5/组装 6)、stats、生产工单列表 390 行、工单追溯 15 段、
   日排产·读 200(说明上一轮未提交的日排产后端也随工作区编进了新 jar)
```

合并本身**没有改动**本任务的 5 个文件(`git diff 08b0f6cf..HEAD -- <5 files>` 为空),
所以上面 2026-10-29 的口径与验收结论继续有效。

