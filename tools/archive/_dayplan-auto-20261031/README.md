# 日计划「自动算」取证与回归（2026-10-31 三改）

用户口径：**「当前不需要手填能自动算就可以了。」**
追问确认：自动算的是**日期格里的日计划**；口径 = **工序计划量 ÷ 开工日→交期**。
方案与验收标准见 `docs/plans/2026-10-31-工单排产-日排产分配与产能可见-方案.md` §9。

## 文件

| 文件 | 用途 |
|---|---|
| `SpreadTest.java` | **回归闸**：直接调用业务类 `com.yinjia.mes.service.DayPlanSpread`（不是复制公式），覆盖 整数均分/余数逐天摊开/逾期压今天/无开工日/非整数/跨度上限/边界零负值/merge 合并/超分配/区间外人工值 |
| `verify-inline.mjs` | 复核「双击就地改」两条链路：改当天数量（人工指定/超分配/恢复自动）+ 改排产日期（同步 plang_pc 与当前工序台账），**跑完自动还原**，不往正式账留测试数据 |
| `shot-inline.mjs` | CDP 截图：预置一个人工指定 → 截「手」角标 → 双击那格截编辑态 → 清掉 |
| `Q.java` | 只读查库小工具（核对 plang/plang_pc/wo_process_line/wo_day_plan） |

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

## 2026-10-31 下午:就地改(双击)

用户口径「当前实际不需要弹窗,只要帮我看下如何实现那些功能即可」+ 两个决定
(A 生产工单页不做调线 / B 改日期同步工序台账) ⇒ 已按「表格里就地改」实现:

- **双击日期格改当天数量**:改过的那天落 `wo_day_plan` 当「人工指定」,其余天按
  `工序计划量 − 人工合计` **重摊**(守恒);清空 = 恢复自动;人工格带「手」角标,超分配标红只提示不拦。
- **双击开工日/计划完工日改日期**:`POST /px/scheduleBoard/rowDates` → 写 `plang` + 镜像
  `plang_pc` + 同步 `wo_process_line` **当前工序**那道区间(不碰后续工序的排期)。

复核:`node verify-inline.mjs http://127.0.0.1:8090 2173`(自动还原) + `node shot-inline.mjs`。

## 2026-10-31 晚:改回弹窗

用户口径「那还是改成弹窗先给我看下吧」⇒ 表格里不再就地编辑,双击日期格弹
`ScheduleQuickEditDialog`(数量/开工日/预定完成日,工单排产页多一块调线);后端逻辑与口径不变。

- `shot-dialog.mjs` —— 截图两页的弹窗(生产工单两块 / 工单排产含调线);
- `dialog-save.mjs` —— 端到端:双击 → 弹窗填 3 → 保存 → 校验 `wo_day_plan` 与接口,跑完自动还原。
