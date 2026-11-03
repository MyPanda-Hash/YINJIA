# 工单追溯·工序进度图例「蓝=进行中」与实际渲染不符(2026-11-03)

## 用户报障

> 这个不是蓝色为正在进行吗？为什么现在显示出来的颜色为黑色，把前端中这个小字修改为黑=进行中。

截图(1612x886):工单 `GD-2026-11-0008`「工单详情 · 追溯」弹窗,工序① **成型 1000/5000(1单)**
圆圈与标题是**深黑**,工序② 切炭 / ③ 组装是灰;下方图例却写着「绿=已完工 ｜ 蓝=进行中 ｜ 灰=未开始」。

## 取证(像素实测,不是猜)

`_q-step-color.py` 对截图取样(默认取样框为上面那版 1612x886 截图):

| 取样区 | 主要颜色 | 结论 |
|---|---|---|
| ① 图标(进行中·圆圈) | `#303133` x88 | 深黑,不是蓝 |
| ① 标题「成型」(进行中) | `#303133` x62 | 深黑,粗体 |
| ② 图标(未开始) | `#a8abb2` x144 | 灰 |

Element Plus 样式依据(`frontend/node_modules/element-plus/theme-chalk/el-step.css`):

```css
.el-step__head.is-process  { color: var(--el-text-color-primary) }              /* #303133 */
.el-step__title.is-process { color: var(--el-text-color-primary); font-weight: 700 }
.el-step__head.is-finish   { color: var(--el-color-primary) }                   /* #409eff 蓝 */
```

即:**el-step 的 `process`(= 进行中)态天生是深黑 `#303133`,蓝色 `#409eff` 只给 `finish`**。
后端的 `进行中` 经 `stepStatus()` 映射成 `process`,渲染出来必然是黑;图例原先写成「蓝=进行中」
是**文案与组件实际配色不符**,不是状态映射坏了。

## 处置(用户口径:改图例文案,不动组件配色)

- `frontend/src/views/modules/plan/WorkOrderTraceDialog.vue`
  - 图例 `蓝=进行中` → **`黑=进行中`**
  - 待审提示 `只算已开始(蓝)` → `只算已开始(黑)`(同一状态,口径一致)
  - 注释补上「process 态 = #303133,非蓝」的原因,避免下次又有人照着旧注释改回蓝色
- `frontend/src/i18n/locales/en.js`:`'蓝=进行中': 'Blue = In Progress'` → `'黑=进行中': 'Black = In Progress'`
  (待审那条同步 `blue` → `black`)。其余语言包本来就没有这两条键(缺词走库表/机翻),本次不扩散改动。

## 验证

- `vite`(5173,源码即刷)拉取 `src/views/modules/plan/WorkOrderTraceDialog.vue` 与
  `src/i18n/locales/en.js`:已含 `黑=进行中`、不再含 `蓝=进行中`(注释里提到旧文案属正常)。
- `tt()` 在 zh-CN 下原样返回键 ⇒ 中文界面显示「黑=进行中」。

## 别再犯

组件状态色以**组件库实际 CSS 变量**为准,不在图例里凭印象写颜色名:element-plus
`is-process = --el-text-color-primary(#303133)`、`is-finish = --el-color-primary(#409eff)`
—— 想图例写「蓝」,就得先给 `.el-step__head.is-process` 加覆写样式(本次按用户口径不改配色)。
