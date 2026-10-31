# 日计划「自动算」取证与回归（2026-10-31 三改）

用户口径：**「当前不需要手填能自动算就可以了。」**
追问确认：自动算的是**日期格里的日计划**；口径 = **工序计划量 ÷ 开工日→交期**。
方案与验收标准见 `docs/plans/2026-10-31-工单排产-日排产分配与产能可见-方案.md` §9。

## 文件

| 文件 | 用途 |
|---|---|
| `SpreadTest.java` | **回归闸**：直接调用业务类 `com.yinjia.mes.service.DayPlanSpread`（不是复制公式），15 个用例覆盖 整数均分/余数逐天摊开/逾期压今天/无开工日/非整数/跨度上限/边界零负值 |
| `Q.java` | 只读查库小工具（核对 plang 的 排产数量/开工日/交期/当前工序） |

业务实现在 `backend/src/main/java/com/yinjia/mes/service/DayPlanSpread.java`。

## 跑法（必须先 `mvn compile` 出 `backend/target/classes`）

```bash
cd tools
JAVA=C:/Users/vigna/.jdks/ms-25.0.4/bin/java      # 任意 JDK 21+ 均可
"$JAVA_HOME/bin/javac" -encoding UTF-8 -cp "../backend/target/classes" \
    -d archive/_dayplan-auto-20261031/out archive/_dayplan-auto-20261031/SpreadTest.java
"$JAVA_HOME/bin/java" -cp "../backend/target/classes;archive/_dayplan-auto-20261031/out" SpreadTest
# → RESULT: [PASS] 全部通过
```

## 实测（2026-10-31 15:4x，重复 `_dayplan-shot-20261031/probe-dayplan.mjs`）

13 行逐行对账：`7天已排 == 出列格子里 ≤今天+7 的计划合计` **13/13 OK**。

| 行 | 输入 | 自动摊出 |
|---|---|---|
| GD-2026-10-0227 行1 | 6000、开工 10-29、交期 10-31 | 10-29/10-30/10-31 各 2000 |
| 逾期且无开工日（交期 10-19，70 件） | 70、无开工日 | 整笔落**今天** 10-31：70 |
| GD-2026-10-0228 / 0229 | 无开工日、交期 11-07 | 10-30~11-07 每天 222 / 333，余数归最后一天 |
