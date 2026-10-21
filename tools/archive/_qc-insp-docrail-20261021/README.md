# 三张工序检验单的左「单据选择」目录（2026-10-21）

用户口径：

> 「为当前的制程检验单，首件检验单，以及成品检验单增加目录。都添加在左侧部分」

## 改了什么

三张工序检验单接入系统既有的左「单据选择」栏（`DocSelectRail`，与来料检验单/采购入库单同款）：

| 面板 | 渲染分支 | 目录标题 |
|---|---|---|
| 制程检验单 `QC_PROC_INSP` | 纸面 `approval-layout` | 制程检验单选择 |
| 首件检验单 `QC_FIRST_INSP` | 纸面 `approval-layout` | 首件检验单选择 |
| 组装成品检验单 `QC_ASM_INSP` | 单据卡片 `doc-rail-layout` | 组装成品检验单选择 |

- **列**：`单号 | 日期 | 工单号 | 产品名称 | 审核状态`（中间两列是本次挑的）。
  三张单都是"一张检验记录对应一个生产工单行"，单号（ZC-/SJ-/ZJ-）本身看不出是哪张工单 ⇒ 给工单号；
  产品名称用来肉眼定位。工序/检验类别在三张单里是常量、客户名称在制程/组装实测几乎全空 ⇒ 都不进列。
- **落点**：`PanelxList.vue` 的 `DOC_RAIL_PANELS` 加三行即可 —— 纸面与卡片两个分支 `v-bind` 的是
  同一份 `railBind`，不需要各写一套。左侧栏本身（搜索/翻页/收起/拖宽/点行切单）全复用，零新组件。

## 顺带修掉的两个真问题（都是接入左栏后暴露的）

### ① 制程检验单「一打开就被判脏」⇒ 每次切单都弹「未保存提示」

`QcProcInspSheet.vue` 的 `uidOf()` 原来把 `row.__uid = 'q'+n` **直接挂在明细行对象上**（可枚举属性），
而"有没有未保存修改"是拿 `JSON.stringify(guardFormData())` 跟保存时的快照比 ⇒ **渲染一次就多一个
`__uid` 字段**，永远不相等。以前没有左栏时影响不明显（只能靠右栏翻页，翻页也弹），接入左栏后
**点任何一行切单都弹三态框**，非常刺眼。

改成 `WeakMap` 记 uid（不污染行对象、随行回收），顺带也不再把这个内部键跟着明细提交给后端。

### ② 已保存的外语刷新后**静态语言包不加载**（ja/ko/es/fr/de/ru/vi/th 全中）

`i18n/index.js` 的 `detectLocale()` 原来只认 `SUPPORTED = ['zh-CN','zh-TW','en']` ——
那是只有 3 个静态包年代的**过时硬编码名单**（现在 `PACKS` 有 10 个）。后果：用户切成 ja 后刷新，
`detectLocale()` 判定"不支持" ⇒ 回落 zh-CN ⇒ **ja 的静态包（2300+ 条译名）根本不加载**，
界面只有 tt() 未命中后走机翻的零星词条是外文；本机 `backend/.env` 缺失、机翻降级时就是**整屏中文**。

改成以 `PACKS` 为真源（`STATIC_PACKED`），并让浏览器语言命中静态包时直接采用。
回归钉：`frontend/src/i18n/i18n-detect-locale.test.js`（3 例）。

### ③ 左栏「共有数据」半中文

英文下原来显示 `Total records: 447 条`（「条」是量词，单独翻成 records 会变成 `records: 447 records`）。
改成整句带占位符的词条 `共有数据: {n} 条` → en `Total: {n}` / ja `全件数: {n} 件` / zh-TW `共有資料: {n} 筆`。

## 多语言

这一栏此前**从未进过静态语言包**，一直靠 tt() 未命中 → 后端机翻兜底；而 `yj_translation` 里只有
工单号/产品名称/日期（它们是 yj_field 标签）能命中，单号/审核状态/查找/模糊搜索/暂无数据/收起/
上一页…一条都没有。本次一次性补齐（幂等脚本）：

- `_i18n-docrail-ui.mjs` —— 15 条 × 10 语言包（列头 + 搜索 + 空态 + 翻页条 + 收起/拖宽）
- `_i18n-docrail-count.mjs` —— 「共有数据」整句 1 条 × 10 语言包

## 验收（2026-10-21 实测，5173 源码版与 8090 打包版都跑过）

`node tools/archive/_qc-insp-docrail-20261021/_probe-qc-insp-docrail.mjs <base> <factory> <locale>`

| 语言 | 结果 | 关键证据 |
|---|---|---|
| zh-CN | **35/35 PASS** | 标题「制程检验单选择」；列头 单号/日期/工单号/产品名称/审核状态；点第二行切单（高亮移动 + 右侧内容变） |
| en | **35/35 PASS** | `In-Process Inspection Sheet Select` / `No.·Date·Work Order No.·Product Name·Audit Status` / `Total: 447` |
| ja | **35/35 PASS** | `制程检验单選択` / `番号·日付·作業票番号·製品名·承認状態` / `全件数: 447 件` |
| ko / de | **35/35 PASS** | 同口径（只要求"已离开中文原文"；只有 en 才要求无 CJK —— 日韩繁中都含汉字） |

- 前端单测 `npm test`：858 例 / 853 通过 / **5 失败** —— 5 例全是既有「活库可连通」环境项（本机无 `SQLCMD`），与本批无关。
- 前端构建 `npm run build` 通过；8090 已用新 jar 重启并复跑（zh-CN 与 en 各 35/35）。

## 目录里的脚本

| 文件 | 用途 |
|---|---|
| `_probe-qc-insp-docrail.mjs` | **正式验收探针**（CDP + Edge headless，三面板 × 左栏 6 组断言，支持 locale 参数） |
| `_i18n-docrail-ui.mjs` / `_i18n-docrail-count.mjs` | 语言包脚本（幂等；已有键跳过） |
| `_dbg-dirty.mjs` | 取证脚本：读 PanelxList 实例的 `inlineDirtyFlag / savedSnapshot / guardFormData()`，**逐键 diff** 出"到底哪个键让单据被判脏"（① 就是它抓出来的） |
| `_dbg-proc.mjs` | 取证脚本：点左栏第 2/3 行，看是否弹「未保存提示」、点「不保存」后高亮是否移动 |
| `_dbg-i18n.mjs` / `_dbg-en.mjs` | 取证脚本：抓 intlify 的 `Not found 'biz.xxx' key` 日志 / 导出某语言下左栏的实际标题与列头 |

## 回滚点

1. `PanelxList.vue` 的 `DOC_RAIL_PANELS` 删掉那三行 ⇒ 左栏不再出现在三张单上（组件本身不动）。
2. `QcProcInspSheet.vue` 的 `uidOf` 回退成 `row.__uid` ⇒ 「一打开就脏」的问题会回来。
3. `i18n/index.js` 的 `detectLocale` 回退成 `SUPPORTED.includes` ⇒ ja/ko/… 刷新后又会回落中文。
