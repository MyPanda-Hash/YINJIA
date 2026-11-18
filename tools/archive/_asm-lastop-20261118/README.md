# 出货检验表观「选生产工单」准入改为「进入末道工序」— 证据(2026-11-18)

## 用户口径

> 「这个出货检验表观应该修改为进入末道工序的就能在这里被选择」
> 「这个是出货检验表观的，出货功能检验和首件检验的不修改」
> 追问「默认的装箱产线的工序线」时确认：「不是工艺路线，当前组装工序和装箱这个工序不都是可以默认选择
> 是装箱产线的吗？」「不用加」⇒ **本次不动任何工艺路线/产线数据**，只改判据与文案。

## 改了什么(纯代码，零 DDL、零数据变更)

| 位置 | 改动 |
|---|---|
| `backend/.../service/AsmInspEntry.java` | 准入从「进入组装/装箱两道」改为「进入**末道工序**」：末道 = 优先 `bs_route.是否末道工序` 标记那道，没标记取 `加工顺序` 最后一道；组装类判据改为 `isAsmOp()`(工序名含「组装」或「装箱」，故 `组装装箱` 这种合并名也认)。进入判据仍是三条：前道流入 / 本道已审报工 / 该道实际线或工单当前线属组装车间 |
| `backend/.../controller/QcAsmInspController.java` | 列表准入 SQL 换成本行末道口径(`routeHasAssembly` 重写)，注释/话术同步 |
| `backend/.../service/QcInspAutoService.java` | `OPS.contains(op)` → `isAsmOp(op)`，避免「组装装箱」报工被当「不出检验单」 |
| `frontend/src/core/qc/QcProcInspWoPicker.vue` | 仅 `mode='asm'` 的提示语/门槛语/置灰标签改为末道工序；`proc`/`first` 文案一字未动 |
| `frontend/src/i18n/locales/en.js` | 新中文源串补 en 词条 |

出货功能检验(`QC_PROC_INSP`)与首件检验(`QC_FIRST_INSP`)的准入/列**不变**(见 `ego/05-*.png`)。

## 数据侧实况(为什么必须改)

| 工艺路线 | 工序链 | 末道 | 旧判据结果 |
|---|---|---|---|
| `GY-CB-STD` 炭棒标准路线 | 成型→切炭→组装 | 组装 | 可识别 |
| `GY-2026-11-0001` | 成型→装箱 | 装箱 | 可识别 |
| `GY-2026-10-0001` | 成型→装箱 | 装箱 | 可识别 |
| `GY-2026-10-0006` | 成型→切炭→组装→装箱 | 装箱(未标末道) | 可识别 |
| **`GY-2026-11-0003`** | 成型→**组装装箱** | 组装装箱 | **完全不出现**(既不在 `IN (组装,装箱)` 也不在 `OPS`) |

## 证据

1. `_AsmLastOpProbe.java`(只读探针，连 `HSDZ_MES`)：
   ```bash
   java -cp "backend/target/classes;$(cat backend/target/cp.txt)" \
        tools/archive/_asm-lastop-20261118/_AsmLastOpProbe.java HSDZ_MES
   ```
   - `GD-2026-11-0032#1` (`GY-2026-11-0003`) → `entered=true op=组装装箱 avail=280 done=280`
   - `GD-2026-11-0030#1` → `entered=true op=组装装箱`
   - `GD-2026-11-0031#1` → `entered=false`，原因「尚未进入末道工序「组装装箱」…」
   - 批量 `checkPage` 与单行 `of` 结果逐行一致；列表准入 SQL 命中 **430** 行(含 `GY-2026-11-0003` 全部工单行)。
2. 接口(8090 打包版)：
   - `GET /api/qc/asmInsp/woLines?keyword=GD-2026-11-0032` → `进入环节=组装装箱, 进入量=280, 已审报工量=280, 可开单=true`
   - `POST /api/qc/asmInsp/fromWoLine {GD-2026-11-0031,1}` → `422` +「该工单行尚未进入末道工序「组装装箱」（上一道工序还没有已审核报工流入），暂不能生成出货检验表观」
     (未建单，负向用例，零写入)
3. ego-browser(5173 源码版 + 8090 打包版各一遍)：
   - `ego/04-asm-picker.png`：弹窗提示「已进入末道工序」，列表 **共 45 条**(改前 38 条)，
     `GD-2026-11-0032 / GD-2026-11-0030` 的进入环节显示 **组装装箱**、可开单=可开单；
   - `ego/06-8090-asm-picker.png`：8090 打包版同上，`asmEntryRows = [0032, 0030]`；
   - `ego/05-proc-picker.png` / `ego/05-first-picker.png`：出货功能检验与首件检验的弹窗话术/列与改前一致；
   - `ego/01..03` 为定位「选生产工单」按钮的过程取证(按钮在右侧操作栏，不是 `<button>`，第一轮没点中)。

## 复跑

```bash
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_asm-lastop-20261118/ego/round-04.mjs')"
```
