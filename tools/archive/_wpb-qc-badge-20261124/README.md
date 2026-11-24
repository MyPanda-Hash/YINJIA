# 生产工序进度看板 · 待检验徽标升到状态标签规格（2026-11-24）

## 用户口径（两轮原话，决定了这里只做“一条 CSS”）
1. 「这个待检验需要能制作的更加明显，符合操作逻辑」
2. 「卡在检验这道关卡 —— 这个不需要，因为当前的检验不卡整体的工单流程」
   以及： 「『!』角标和实心块显得土/像报警」「文案不对（待开单/去开单 这类说法）」
   「刚改完的观感跟系统其他页面不搭」
3. 在 A / B / 保持原样 三选一里：**「按推荐执行」** ⇒ 选 A

⇒ 结论：**检验与工序并行、不阻断工单流转**，看板这里只是一条信息，不是闸门。
   所以只把环下检验徽标从 10px/14px 升到**页面其它状态标签的规格**，位置 / 浅底配色 / 文案全不动。

## 唯一改动
`frontend/src/views/modules/plan/WoProgressRing.vue` 的 `.wpr-ins`：

| 属性 | 改前 | 改后（= `.wpb-qc` / `.wpb-status` 同规格） |
|---|---|---|
| font-size | 10px | **11px** |
| line-height | 14px | **18px** |
| border-radius | 8px | **10px** |
| padding | 0 5px | **0 6px** |
| margin-top | 1px | 2px |

明确**没有**动：整环配色（绿/蓝/灰语义不变）、光环、角标、行级徽标、品质提示条、图例、列表视图圆点链、
任何状态词（仍是「待检验/待审核/合格/不合格/需检」）。

## 实测（ego 浏览器，5173 源码版，可复跑）
```
C:/Users/vigna/.local/share/ego/active_version_dir/ego-browser.exe nodejs \
  -e "await import('file:///D:/workspace/yinjia/tools/archive/_wpb-qc-badge-20261124/verify-a.mjs')"
```

| 项 | 实测值 |
|---|---|
| 环下徽标 | `待检验` 11px / 18px / radius 10 / padding 0 6px，盒子 **45 × 18**，底色 `rgb(253,246,236)`，字色 `rgb(184,130,48)` |
| 行级徽标（未动） | 同为 11px / 18px / radius 10，浅底 → 两处现在**同规格**，不再“跟系统其它页面不搭” |
| 四道工序的行 | 4 个环 top 全部相同（3473 / 3691）⇒ **没有换行**，完工信息列仍是一排 |
| 窄/宽 | 68px 格（窄）/ 80px 格（宽）下徽标都放得下（45px < 68px），无横向溢出 |
| 已撤掉的东西 | 无 `wpr-flag`、无 `.wpr.is-waiting`、图例回到「绿/蓝/灰」三项、提示条仍是原来那行橙字 |

回归钉子：`frontend/src/views/modules/plan/workOrderProgressQcBadge.test.js`（4 条，`node --test` 全过）。

## 截图（`*.png` 被仓库 .gitignore 忽略，只在本机查看）
`C:/Users/vigna/ego/wpb-qc-preview-20261124/`
- `after-a-full.png` 整页
- `after-a-ops.png` 完工信息列特写（徽标与环）
- `after-a-left.png` 生产工单格特写（徽标/提示条应与改前一致）

## 没做的事（口径红线，下次别又加回来）
- 不给工序环染色 / 加光圈 / 加「!」角标 / 实心色块；
- 不在工序之间加“关卡/闸门/箭头”节点（检验不阻断流程）；
- 不新增「待开单 / 去开单 / 去检验」这类状态词（缺检验单只在悬停 title 里说「暂无检验单」）。
