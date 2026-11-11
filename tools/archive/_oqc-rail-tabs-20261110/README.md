# 出货检验单功能左栏「未完成 / 已完成 / 全部」状态页签 —— 取证归档(2026-11-10 ~ 11-11)

> 任务:用户口径「出货功能检验中在左侧的列表中增加对应的页签实现已审核的完成单据和未完成的分开显示,
> 增加在当前列表处的部分,不要修改其他页面的这个组件我先确认查看」;次日追加
> 「修改一下顺序,把未完成放在最左侧作为打开页面的默认选项」。

## 一、改了什么(4 个文件)

| 文件 | 改动 |
|---|---|
| `backend/src/main/java/com/yinjia/mes/service/QueryService.java` | condition 控制键 `_statusTab`(all/done/todo)的服务端过滤;`STATUS_TAB_PANELS` 闸门只含 `QC_PROC_INSP`;done 口径与 `docStatus()` 逐条对齐,todo 取补集 |
| `frontend/src/core/views/DocSelectRail.vue` | 新增 `tabs`/`activeTab` prop 与 `emit('tab')`;`.dsr-head` 下渲染页签条(未传 tabs = 完全不渲染,其他 20+ 个带左栏面板零变化) |
| `frontend/src/core/views/PanelxList.vue` | `RAIL_STATUS_TABS` 只登记 `QC_PROC_INSP`(顺序 **未完成 → 已完成 → 全部**,首项即默认页签);`load()` 派生 `condition._statusTab`;两处 `DocSelectRail` 都接 `@tab`;切面板复位默认项;`?focus=` 深链在默认页签里找不到时回退「全部」 |
| `frontend/src/core/views/railStatusTabs.test.js` | 5 条 node:test 回归闸(只对一张单开 / 顺序与默认项 / 接线 / 10 语种词条 / 后端闸门) |

## 二、口径与数字(HSDZ_MES 正式账套,只读探针实测)

| 页签 | 可见条数 | 行状态 |
|---|---|---|
| 全部 | 434 | 草稿 16 + 已审核 34(第 1 页,按单据日期倒序) |
| 已完成 | 417 | 100% 已审核(第 2 页 51-100 同) |
| 未完成 | 17 | 100% 草稿 |

- 434 = 445(qc_proc_insp_head 全表)− 1(头表 `asp_cancel='Y'`)− 10(yj_doc_status `canceled='Y'`);
  页签只**分组**、不改变现网左栏的可见集合;417 + 17 = 434 ⇒ done/todo 是互补划分,不会漏单。
- HSDZ_MES_TEST:全部 25 / 已完成 22 / 未完成 3。

## 三、验证方式(ego 浏览器,5173 源码版;脚本见本目录 round-0N.mjs)

| 轮次 | 验的事 | 结果 |
|---|---|---|
| round-01 | 打开 QC_PROC_INSP,左栏出现页签、共用数据 434 | ✅ |
| round-02 | 点「已完成」=417(全已审核)、「未完成」=17(全草稿)、「全部」=434;QC_INSP / QC_OQC_REPORT 左栏**无页签** | ✅ |
| round-03 | 已完成第 2 页(51-100/417)仍全已审核 ⇒ 服务端过滤跨页正确;点行切单正常 | ✅ |
| round-04 | 英文界面页签译名(All/Done/Not done)、Total: 434 → 17;还原简中 | ✅ |
| round-06 | **顺序调整后**:默认「未完成」且在最左(17 条全草稿);已完成 417;全部 434;`?focus=ZC-2026-10-0126`(已审核单)自动回退「全部」并定位;出厂/首件检验单左栏仍无页签;再次进入仍默认未完成 | ✅ |

关键截图(**按仓库 `.gitignore` 的 `*.png` 规则不入库**,原图在各轮跑完后留在
`C:/Users/vigna/ego/oqc-rail-tabs-20261110/`,文件名与本目录脚本同名):
- `round-06-default-todo.png` —— 打开即「未完成」(最左、高亮,17 条全草稿)
- `round-06-done.png` / `round-06-all.png` —— 已完成 417 / 全部 434
- `round-06-focus-done-doc.png` —— 深链已审核单回退「全部」并定位
- `round-06-other-first-insp.png` —— 其他面板左栏无页签(用户「不要修改其他页面」)
- `round-07-en-default.png` —— 英文界面「Not done / Done / All」,左一默认
- `round-03-en-tabs.png` / `round-04-en-tabs.png` —— 顺序调整前的英文词条取证(历史轮次)

## 四、复跑方法

```bash
# 前置:8090(后端,含本次 _statusTab 过滤)+ 5173(vite,源码即时生效)在跑
# ego-browser 路径(0.6.2.10):
"C:/Program Files/Citro Labs/ego lite/Application/0.6.2.10/ego-browser.exe" nodejs \
  -e "await import('file:///C:/Users/vigna/ego/oqc-rail-tabs-20261110/round-06.mjs')"
```

回归测试:

```bash
cd frontend && node --test src/core/views/railStatusTabs.test.js
```

## 五、未做/待用户确认

1. 页签**不显示条数**(要「未完成 17 / 已完成 417」需后端额外一次聚合,列为下一轮可选项)。
2. 在「未完成」页签里审核一张单后,刷新会从当前页签消失(语义正确)——是否要自动切「已完成」待确认。
3. `8090` 的内嵌前端 static 未同步(仍是无页签的旧包):按用户「先确认查看」口径,待确认后再 `npm run build` + 同步 static 单独提交。
