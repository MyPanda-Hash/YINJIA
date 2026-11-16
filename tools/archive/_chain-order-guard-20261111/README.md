# 下方工序不得早于上方工序(工序日期链顺序校验,2026-11-11)

用户报障(「工序路线排线」截图):第 1 道 成型 **11-11~11-13**,第 2/3 道 切炭、组装 却是
**11-01~11-01** —— 下方工序比上方工序还早,弹窗照常显示、能提交。
用户口径:「校验需要增加实现下方的工序页不能比上方的工序小的实现。」

## 1. 根因

日期链纯逻辑在 `frontend/src/business/planChain.js`(单行「工序路线排线」与「批量排产」共用):

- 改日期时级联只往**下**传(改上道完工 ⇒ 下道开工跟着动);
- 改**下道自己的**日期时,没有任何一处看它跟**上道**的关系 ⇒ 手工把切炭开工改成 11-01 也照收,
  而 `normalizePlanChain` 只在**打开弹窗时**收口一次。
- 后端 `preplanManual` 会强制「下道开工 = 上道完工」,但它**静默纠正**,既不报错也不提示,
  所以现场以为"填进去了",实际存的又是另一套。

## 2. 修复(三层,和 2026-11-09 的「本道开工≤完工」同一套结构)

1. **改日期即夹紧**(`planChain.js`,两个弹窗共用):
   - `cascadeStart`:下道开工早于**上道完工** ⇒ 夹到上道完工日;再管「开工 > 本道完工 ⇒ 完工顺延」;
   - `cascadeDue`:下道完工早于**上道完工** ⇒ 夹到上道完工日;再管「本道开工 > 完工 ⇒ 开工回拉」;
   - 两个函数返回值从「被调的日期」升级为 `{start, due}`(两个字段各自是否被调平),
     弹窗据此弹对应提示;话术统一收到新文件 `business/planChainNotice.js`(两个弹窗不再各写一份)。
2. **提交前硬校验**:`planDateProblems(rows)` 一次列出两类问题
   (`kind:'inverted'` 本道倒挂 / `kind:'order'` 下道早于上道),`planProblemMessages` 点名单并拦下。
3. **后端守卫**(`ProcessTaskService.preplanManual`,服务端真源):客户端**明确给了**日期却早于上道完工 ⇒
   `400 工序「切炭」计划开工日期不能早于上道工序的计划完工日期(2026-11-13 → 2026-11-01)`(完工同理);
   只拒「明确给出且早于上道完工」,派生不一致(逾期单按交期回落)仍按原口径顺延,不误拦。

多语言:新增 3 条词条(`下道工序的计划开工日期不能早于上道工序的计划完工日期` + 两条带 `{d}` 的整句),
10 个静态语言包全补(整句一条,英文里不会串出全角标点)。

## 3. 验证证据

- 单测 `node frontend/src/business/planChain.test.js` → **9/9 pass**
  (新增:截图场景下道开工夹回上道完工、下道完工夹回、`planDateProblems` 两类问题同时报)。
- 后端 `mvn -o -DskipTests compile` 通过(守卫已编译进 target/classes;本机 8090 跑的还是旧 jar,
  另一并行任务正在改 `ButtonService`/`WoReportService` 并占用 8090,故本次**未重建 jar/未重启服务**)。
- 界面(ego,5173 vite 源码即时生效;截图见 `ego-shots/`,全程未点「排产/保存」,不写库):
  - `round-02-chain-order-clamped.png`:**单行弹窗**,把第 2 道开工改 2026-11-01 ⇒
    提示「下道工序的计划开工日期不能早于上道工序的计划完工日期，已把开工日期调为 2026-11-13」,
    三道变成 11-11~11-13 / 11-13~11-13 / 11-13~11-13,顺序正确;
  - `round-03a-single-due-clamped.png`:单行弹窗改**下方完工**到 11-01 ⇒
    提示「下道工序的计划完工日期不能早于上道工序的计划完工日期，已把完工日期调为 2026-11-13」;
  - `round-04-batch-chain-order.png`:**批量排产弹窗**同样动作 ⇒ 同样夹回 + 提示;
  - `round-05-en-chain-order.png`:切 **en** ⇒
    `A later operation cannot start before the previous operation finishes; planned start adjusted to 2026-11-13`
    (工序名是业务数据,按 ADR-0001 保持中文原值)。
- 提交前硬校验直测(`round-06.mjs`,vite 直接 import 源码模块,不靠界面触发):
  - 截图形态 ⇒ `下道工序的计划开工日期不能早于上道工序的计划完工日期: 切炭 2026-11-01 < 成型 2026-11-13`;
  - 两类问题同时存在 ⇒ 两条都点名单(本道倒挂 + 工序顺序);
  - 合法链 ⇒ 空串(放行);en 下同一句为英文。

## 4. 复跑方式

```powershell
node frontend\src\business\planChain.test.js
# 界面(vite 5173 在跑时;没开就 frontend\start-vite.bat)
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_chain-order-guard-20261111/ego-scripts/round-02.mjs')"
```

## 5. 文件清单

| 文件 | 改动 |
|---|---|
| `frontend/src/business/planChain.js` | `cascadeStart` / `cascadeDue` 增加「≥ 上道完工」夹紧,返回值改 `{start,due}`;新增 `planDateProblems`(本道倒挂 + 工序顺序两类) |
| `frontend/src/business/planChainNotice.js` | **新增**:把调平结果/提交校验结果变成中/英整句(两个弹窗共用) |
| `frontend/src/business/planChain.test.js` | 9 条用例(含截图场景、完工方向、两类问题合集) |
| `frontend/src/views/modules/plan/ProcessRoutePlanDialog.vue` | 接入新返回值/话术;提交前用 `planProblemMessages` 硬校验 |
| `frontend/src/views/modules/plan/ScheduleBatchDialog.vue` | 同上 |
| `backend/.../service/ProcessTaskService.java` | `preplanManual` 增加「下道日期不得早于上道完工」明确入参守卫 |
| `frontend/src/i18n/locales/*.js`(10 个静态包) | 3 条新词条(见 §2) |
| `tools/archive/_chain-order-guard-20261111/_add-chain-i18n-keys.mjs` | 一次性补词条脚本(幂等,锚点 = `已把完工日期调为 {d}`) |
