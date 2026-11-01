# 出厂检验报告专用版式(qc_oqc.jrxml)—— 交付与验证留档

任务:面板 **QC_OQC_REPORT**(出厂检验报告,2026-10-30 新增)此前没有专用报表模板,
ReportService 回落 generic 通用模板(字段流水),不是受控表单;本目录留档 2026-11-01 补专用模板
`backend/src/main/resources/reports/qc_oqc.jrxml` 的原始件、验证工具与逐轮渲染证据。

受控表单:**c-95-12**,表单编号 **YJ-QR-05/A1**。

## 1. 交付物(仓库内)

| 文件 | 说明 |
| --- | --- |
| `backend/src/main/resources/reports/qc_oqc.jrxml` | 专用模板(新建;A4 纵向,表格形式) |
| `backend/src/main/resources/reports/report-templates.properties` | 注册表 +3 行:`qc_oqc.panelCode=QC_OQC_REPORT` / `.name=出厂检验报告` / `.file=reports/qc_oqc.jrxml` |
| `backend/src/main/resources/reports/logo_agplus.jpg` | 抬头 AGPLUS 商标(从 `docx_media/word/media/image1.jpeg` 原样拷入;200×44) |
| `tools/archive/_oqc-form-20261101/` | 本目录:原件、结构 dump、验证工具、渲染件、对照图 |

**没有改任何 Java 代码**(取数走 ReportService 通用分支 `fillReport(compile(tpl), headParams(doc,docNo), JRMapCollectionDataSource(detailRows))`)。

## 2. 取数契约(模板里用的中文名)

- **参数**(= 头字段 `yj_field.label`):`单据编号 / 单据日期 / 客户名称 / 产品编码 / 产品名称 / 规格型号 /
  批次号 / 生产日期 / 生产数量 / 检测日期 / AQL / 出库单号 / 成品检验单号 / 首件检验单号 / 制程检验单号 /
  检验员 / 检验结论 / 备注 / 单据状态` + `打印时间`。参数 class 一律 `java.lang.Object`
  (日期经 QueryService 已是 `yyyy-MM-dd` 文本,`生产数量` 是 BigDecimal,用 textField pattern 格式化)。
- **数据源字段**(= 明细 label):`序号 / 检验项目 / 检验要求 / 抽样标准 / 抽检量 / 结果 / 判定`
  (模板只引用这些;`检验方法/测量值1..5/数据来源/…` 已在 OqcReportService 侧并入 `结果`,模板不展示)。
- 明细现状:`抽样标准`/`抽检量` 是手填列(当前可能全 NULL → 模板留空格);`检验项目` 是计划表用语
  (如 `*外观`/`*炭棒尺寸`),按数据原样打;`生产日期`/`AQL`/`检验结论`/`备注` 当前生单后为空(Null → 空格)。

## 3. 版式结构(与原件对照)

```
title 带(仅第1页)  : logo + "AGplus Technologies Pte Ltd. 惠州市银嘉环保科技有限公司" + 横线
                     + 标题「出厂检验报告」+ 右上「编制日期:单据日期」
                     + 抬头 9 格:客户名|报告编号 / 产品名称|产品规格 / 生产日期|生产量 /
                       检测日期|AQL / 产品编码(整行)
                     + 主表 7 列表头(只在第 1 页打,与原件一致)
pageHeader 带(第2页起): logo + 公司名 + 横线(printWhenExpression = PAGE_NUMBER>1)
detail 带           : 明细细逐行;检验要求/结果长文本 textAdjust=StretchHeight,7 格
                     stretchType=RelativeToTallestObject 等高,边框连续;splitType=Prevent 整行不拆
group reportTail    : groupFooter 里一整套表尾 = 检验结论+备注 / 卫生安全 15 项静态表 /
                     签署行(检验员=头字段;审核/批准留空线)+ YJ-QR-05/A1
pageFooter 带       : 地址/网址/邮箱/电话(居中)+ 左「打印时间」+ 右「第 X 页 / 共 Y 页」
```

列宽取原件 twips/20:`34.7 / 59.1 / 160.5 / 56.25 / 44.2 / 170.55 / 33.15`(= 558.45pt,
四舍五入成整数磅 35/59/160/56/44/171/33);页边距 18pt,内容宽 559pt。

**卫生安全表结果列本轮不录数**:统一印「见型式检验报告」,**没有**把样张里的 0.12/1.79/ND 等样例值写死。

## 4. 验证方法(可复跑)

环境:JDK 25(`JAVA_HOME=C:\Users\vigna\.jdks\ms-25.0.4`),依赖 classpath 由 maven 生成:

```bash
cd backend
JAVA_HOME=... mvn -q -DskipTests compile
JAVA_HOME=... mvn -q dependency:build-classpath -Dmdep.outputFile=target/cp.txt
cd ../tools/archive/_oqc-form-20261101
CP="D:/workspace/yinjia/backend/target/classes;$(cat ../../../backend/target/cp.txt)"
TPL="../../..//backend/src/main/resources/reports/qc_oqc.jrxml"

# 真实数据(测试账套 HSDZ_MES_TEST 里 Lead 用现役后端生成的两张报告)
java -Dstdout.encoding=UTF-8 -cp "$CP" FillQcOqc.java "$TPL" OQC-2026-11-0001 qc_oqc-0001-15rows --xlsx
java -Dstdout.encoding=UTF-8 -cp "$CP" FillQcOqc.java "$TPL" OQC-2026-11-0002 qc_oqc-0002-10rows --xlsx
# 单行 / 空数据行 / 长表(重复 3 遍=45 行,验跨页)
java -Dstdout.encoding=UTF-8 -cp "$CP" FillQcOqc.java "$TPL" OQC-2026-11-0001 qc_oqc-0001-1row --rows 1
java -Dstdout.encoding=UTF-8 -cp "$CP" FillQcOqc.java "$TPL" OQC-2026-11-0001 qc_oqc-0001-blank --blank
java -Dstdout.encoding=UTF-8 -cp "$CP" FillQcOqc.java "$TPL" OQC-2026-11-0001 qc_oqc-long45rows --repeat 3
# PDF -> PNG(2x)
"/d/deepseek harness/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe" render_pdf.py qc_oqc-0001-15rows.pdf qc_oqc-0001-15rows 2
```

`FillQcOqc.java` 用 JDBC 直读 `qc_oqc_head` / `qc_oqc_detail`,按 `QueryService.dateWallText` 的口径
把日期转 `yyyy-MM-dd` 文本、BigDecimal/Integer 保持原类型,再原样调用
`JasperFillManager.fillReport(compile(jrxml), headParams 同构 map, new JRMapCollectionDataSource(rows))`,
与 `ReportService.export()` 的通用分支完全一致。

## 5. 本轮渲染结果(本目录)

| 场景 | 文件 | 结论 |
| --- | --- | --- |
| 15 行长明细(OQC-2026-11-0001,带实测值) | `qc_oqc-0001-15rows.pdf` + `-1/-2.png` + `.xlsx` | 2 页;表尾整块到第 2 页(logo 页眉正常) |
| 10 行全空值(OQC-2026-11-0002) | `qc_oqc-0002-10rows.pdf` + `-1/-2.png` + `.xlsx` | 2 页;空数据格留白、边框连续 |
| 单行 | `qc_oqc-0001-1row.pdf` + `-1.png` | 1 页(表尾接在表后) |
| 空数据(--blank 清空明细文本) | `qc_oqc-0001-blank-*.png`、`qc_oqc-0002-blank-*.png` | 不打印 null,表格完整 |
| 长表 45 行(跨页) | `qc_oqc-long45rows.pdf` + `-1..-4.png` | 4 页;行不跨页拆、第 2 页起有 logo 页眉 |
| 标单对照 | `qc_oqc-vs-form-page1.png` / `qc_oqc-vs-form-page2.png` | 左=原件、右=渲染,结构同构 |

XLSX 也一并导出验证过(`ReportService` 同样支持 pdf/xlsx,导出走同一份 JasperPrint)。

## 6. 与标单的剩余差异(有意取舍)

1. **表头只打第 1 页**:原件第 2 页也不重复表头,故照原件;实测"每页重复"的方案会把 7 列表头
   打在表尾页(检验结论/备注上面),更像错版,故放弃。
2. **序号/检验项目的纵向合并**:原件用 Word 合并单元格(如「2 尺寸规格检查」跨 3 行);动态数据行的
   Jasper 表格不做跨行合并,同一序号/项目在多行各打一次(数据本身如此)。
3. **值口径**:`判定` 打数据里的「合格」(样张是 ok);`生产量` 只打数字(数据无单位,样张 `300pcs`);
   日期打系统口径 `2026-11-01`(样张 `2026.4.4`);`编制日期` = 单据日期。
4. **数据缺项**:`生产日期`/`AQL`/`检验结论`/`备注`/`抽样标准`/`抽检量` 当前业务未录 → 空格
   (模板不造假、不做默认值回填)。
5. **页脚**比原件多一行「打印时间 + 第 X 页 / 共 Y 页」(需求要求;原件只有地址行)。
6. **logo** 走 classpath:`JRResourcesUtil.findClassLoaderResource("reports/logo_agplus.jpg", TCCL)`,
   `onErrorType="Blank"` 兜底 —— 部署时打进 jar 的 `BOOT-INF/classes/reports/` 即可命中;
   注意 JR 6.21 的内置参数 `$P{REPORT_CLASS_LOADER}` 在填充期为 **null**(实测),不能用那种写法。
7. `检验项目` 用计划表用语(`*炭棒尺寸` 等),与受控表单用语(外观检查/尺寸规格检查)不同 —— 这是
   数据现状(OqcReportService 存的是计划表项目名),不是模板问题;要改成表单用语需改 Java 侧映射。

## 7. 实现踩坑(给后来改本模板的人)

- JasperReports **6.21**:元素 `x/y/width/height` 与 page 尺寸/margin 都是**整数**(整数磅),
  不能用 558.45 这种小数;列宽按 twips/20 四舍五入。
- `REPORT_CLASS_LOADER` 参数在填充期为 null(不是"能拿来取 classpath 资源"的老写法)。
- **NotoSansSC 文本高度阈值**(本机实测):8pt→10、9pt→11、10pt→12、11pt→14、12pt→15、16pt→20、22pt→27;
  **元素高度(减 padding)低于阈值时文本会被整段丢弃(视觉上整行空白)**,不是截断。
- `summary` 单独起页时**不打印 pageHeader/columnHeader**(实测);需要页眉就用 group footer。
- JR 6.21 的 XSD 里 `<summary>`/`<pageHeader>` 等 section **只能有 1 个 band**;"多 band"在这版不成立。
- band 的 `printWhenExpression=false` **不占高度**(首页隐藏 pageHeader 靠它,已实测)。
- image 元素属性是 `scaleImage`(不是 imageScale),且**不支持 `lazy` 属性**;`label` 也不行。
- XML 注释里不能出现 `--`(写分隔线用 `=`),否则 digester 直接 parse fatal error。
- 长文本等高表格的写法:每个格 `textAdjust="StretchHeight"` + `stretchType="RelativeToTallestObject"`,
  detail 带 `splitType="Prevent"`(整行不跨页拆)。

## 8. 本目录其他文件

- 原件/解析:`source.doc|docx|pdf`、`docx_dump.txt`(逐行合并格/列宽 twips)、`docx_media/`、
  `dump_docx.py`、`form-1.png|form-2.png`(原件 144dpi 渲染,版式基准)。
- 工具:`FillQcOqc.java`(填充/导出验证器)、`render_pdf.py`(PDF→PNG)。
- Lead 的取证/端到端留档:
  - `Probe.java`(面板/字段/报表登记/`v_oqc_std`/出库单盘点)、`ProbeTest.java`(测试账套对象与数据)、
    `ProbeSeed.java`(交叉库/E2E 素材核查)、`ProbeCols.java`(两库表列差异)
  - `SeedTest.java`(测试账套演示数据:出货检验计划 4 张 + 三张检验单各 1 张 + 演示出库单
    `XSCK-2026-11-99001`;`apply|cleanup|check` 三模式,只写 `HSDZ_MES_TEST`)
  - `e2e-api.mjs`(登录→preview→generate→export 全链路)、`e2e-ui.mjs`(销售出库勾选→生成→跳转→导出 PDF→打印按钮)、
    `e2e-print-i18n.mjs`(报告面板打印走服务端 PDF + 切 en 校验弹窗文案)
  - `e2e-1-saleout.png` / `e2e-2-dialog.png` / `e2e-3-jumped.png` / `e2e-4-report.pdf`(服务端真导出) /
    `e2e-real-1.png` / `e2e-real-2.png`(真导出渲染) / `e2e-6-print.png` / `e2e-7-en-dialog.png`
  - `generic-1.png`:改造**前**的通用兜底版式首页(5 页字段流水),留作对照。

## 9. 复跑前置(`pylibs` 不入库)

`render_pdf.py` 用 pymupdf 把 PDF 渲成 PNG;为免把 200MB+ 的依赖提交进仓库,本轮结束后
`pylibs/` 已从本目录删除。要复跑渲染:

```bash
cd tools/archive/_oqc-form-20261101
"/d/deepseek harness/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe" \
  -m pip install pymupdf --target pylibs -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com
# 之后照 §4 的命令渲图(render_pdf.py 会把 ./pylibs 插到 sys.path)
```

## 10. 2026-11-01 第三轮:面板页改成「首件检验单」同款纸张式受控表单

**用户口径(2026-11-01 07:28)**:「我是说当前的出厂检验报告实现当前和首件检验单相同的形式,
能实现这个出厂检验报告实现而不是这种表格页面了」⇒ 服务端 Jasper 版式(§1~§8)**保留不动**(只给
「导出报表 / 导出」的 PDF/Excel 用);本次改的是**面板页本身的实现方式**:
原来是「表头字段条 + 17 列明细表格」的数据页,现在是整页 A4 纸居中 + 左侧单据选择栏 + 右侧按钮竖栏、
纸上直接填的受控记录表(与 `QC_FIRST_INSP` 的 `QcFirstInspSheet.vue` 同形态)。

### 10.1 交付文件

| 文件 | 说明 |
| --- | --- |
| `frontend/src/core/qc/QcOqcSheet.vue` | **新建**,纸张式受控记录表(c-95-12 / YJ-QR-05/A1:纸头 logo + 抬头 9 格 + 7 列主表 + 检验结论/备注 + 卫生安全 15 行 + 签署 + 页脚),含打印 CSS |
| `frontend/src/core/views/PanelxList.vue` | 接线:`isApprovalDoc` + `DOC_RAIL_PANELS` + 挂载 `QcOqcSheet` + 两处纸张选择器加 `.oqc-sheet`;「导出」弹窗 PDF/Excel/预览对 QC_OQC_REPORT 改走服务端 `/report/export?code=qc_oqc`;删死代码 `printOqcReport()` 与 onButton 的 OQC 打印分支 |
| `frontend/src/assets/logo_agplus.jpg` | 抬头商标(与 `backend/src/main/resources/reports/logo_agplus.jpg` 同一张,200×44,import 进前端打包) |
| `frontend/src/i18n/locales/en.js` | 纸面静态标签词条(编制日期/产品规格/生产量/检测日期/抽样标准/抽检量/判定/卫生安全 15 项 + 卫生要求/见型式检验报告/页脚地址等) |
| `backend/.../service/PanelConfigService.java` | 删掉上一轮给 QC_OQC_REPORT 加的「打印\|预览」按钮组(改成 approval 布局后工具栏整条不渲染 = 死配置) |

### 10.2 纸张结构(与原件对照)

```
纸头   : AGPLUS logo(图内自带 tagline)+「AGplus Technologies Pte Ltd.」+ 惠州市银嘉环保科技有限公司 + 通栏横线
标题   : 出厂检验报告居中;右侧「编制日期:<单据日期>」
抬头 9 格(列宽 = 原件 twips 694/1182/3210/2009/4074):客户名|报告编号 / 产品名称|产品规格 /
        生产日期|生产量 / 检测日期|AQL / 产品编码(整行)   ← 草稿态可填客户名称/产品名称/规格型号/
        生产日期/生产数量/检测日期/AQL;单据编号、产品编码只读
主表 7 列(694/1182/3210/1125/884/3411/663 twips → 6.21%/10.58%/28.74%/10.07%/7.91%/30.54%/5.94%):
        序号|检验项目|检验要求|抽样标准|抽检量|结果|判定,行 = head.detail.items
        (多行文本 textarea autosize 不设 maxRows ⇒ 长文本整段撑高;表格天然整行等高、边框连续)
结论/备注: 在**同一张主表**里 label 跨前 2 列、值跨后 5 列 ⇒ 列线天然对齐(不用第二张表凑宽度)
卫生安全: 小标题 + 3 列 15 行静态表(结果列统一印「见型式检验报告」,只读)
签署   : 检验员(头字段,草稿可填)/ 审核(头字段 审核人,只读)/ 批准(留空线);右下 YJ-QR-05/A1
页脚   : 地址 / 网址 / 邮箱 / 电话(小字灰)
打印   : @page A4 portrait margin 8mm;隐藏门户壳(顶栏/左栏/页签/侧栏/单据选择栏),纸张白名单
        `.oqc-sheet`;表格 10px;行 break-inside:avoid;表尾(.oqc-tail)整块不拆页;
        另外要清掉 index.html 预置的 `html{background:#f0f2f3}`(否则第 2 页余量刷灰底)、
        隐藏日期选择器 prefix 图标与 placeholder。
```

### 10.3 打印/导出口径

- **侧栏「打印」** = `printApprovalSheet`(浏览器打印屏幕上这张纸);实测 2 页、纸面完整不裁切。
- **「导出」弹窗的 PDF / Excel / 打印预览** 对 QC_OQC_REPORT **一律走服务端受控表单报表**
  (`/report/export?code=qc_oqc&panelCode=QC_OQC_REPORT&docNo=…&format=pdf|xlsx`),不再截图 ——
  连续 HTML 截图会被压成一页/裁掉,服务端 .jrxml 本来就是 A4 分页受控表单。
- **「导出报表」弹窗**原本就走服务端模板,无需改。

### 10.4 本轮验证件

| 场景 | 文件 | 结论 |
| --- | --- | --- |
| 屏幕(中文,草稿可填) | `oqc-sheet-1.png`(视口:左栏+纸面+右栏)、`oqc-sheet-paper.png`(整张纸) | 纸张式页面,抬头 9 格/15 行主表/结论备注/卫生安全/签署齐全,输入框可点 |
| 屏幕(英文) | `oqc-sheet-en-1.png`、`oqc-sheet-en-paper.png` | 纸面标签全英文、业务数据(检验项目/合格/客户名)保持中文 |
| 打印 PDF(OQC-2026-11-0003,15 行) | `oqc-sheet-print.pdf` + `-1.png`/`-2.png` | 2 页:第 1 页抬头+15 行+结论备注;第 2 页卫生安全+签署+页脚 |
| 打印 PDF(OQC-2026-11-0004,10 行) | `oqc-sheet-print-0004.pdf` + `-1.png`/`-2.png` | 2 页;表尾整块落到第 2 页 |
| 交互接线 | `oqc-sheet-wiring.mjs`(打印→window.print;导出 PDF→`/report/export?…format=pdf`;导出 Excel→`…format=xlsx`;导出报表预览→服务端 PDF) | 全部命中 |
| 复跑截图 | `node oqc-sheet-shot.mjs http://127.0.0.1:5173 OQC-2026-11-0003 [zh-CN\|en]` | 会重建 `oqc-sheet-*.png` |

⚠ 后端那处删除要换 jar/重启 8090 才生效;**换包前**旧后端仍会给本面板下发「打印|预览」两个按钮,
前端 onButton 已做兜底(approval 布局下打印一律走 printApprovalSheet),换包后按钮自然消失。

### 10.5 Lead 收尾(2026-11-01 换包后实测 + 一处补充)

**补充改动**:`frontend/src/core/views/PanelxList.vue` 的 `DIRECT_AUDIT_PANELS` 加入
`QC_OQC_REPORT` —— 面板改成文书式后原来的审批按钮不再出现(该面板无审批流、也不是两级审批的
8 张质量单据),必须与首件/制程同口径放开**管理员直审**「审核/弃审」;后端 `ButtonService.audit()`
是通用 doc 面板直审,不用改。加进名单后侧栏出现「审核/弃审」,审核后单据状态 `已审核`、纸面
0 个输入框(只读)、纸面「审核人」格由虚拟字段带出。

**换包后端到端取证**(`e2e-sheet-full.mjs` / `e2e-final.mjs`,8090 新 jar + 测试账套):

| 验证 | 结果 |
| --- | --- |
| 销售出库勾选 → 生成 → 跳转 | 页面 = 纸张式(左栏/纸面/右栏);主表 15 行、卫生安全 15 行;侧栏「打印/导出报表/导出」各 1 个,无旧工具栏、无重复「打印」 |
| 纸上编辑 → 保存 → 刷新 | 改「抽样标准」→ 提示「「保存」成功」→ 刷新后值仍在(落库) |
| 打印(CDP printToPDF,与侧栏「打印」同口径) | 2 页 A4,受控表单完整:第 1 页纸头+抬头+15 行+结论备注,第 2 页卫生安全+签署+页脚 |
| 「导出报表 → 打印预览」 | 打开服务端受控表单 PDF(blob) |
| 只读态 | 管理员直审 `OQC-2026-11-0004` → 已审核、输入框 0 个、保存消失;弃审回草稿 ✅ |
| en | 纸面标签全英文、业务数据中文;`npm run build` ✅、`DbSync` 执行 0 失败 0 |

本轮新增验证件:`e2e-sheet-full.mjs`、`e2e-final.mjs`、`oqc-sheet-final-screen.png`(干净单屏幕)、
`oqc-sheet-final-en-screen.png`(英文)、`oqc-sheet-final-print.pdf`(干净单打印 2 页)、
`oqc-sheet-final-audited.png`(已审核只读态)、`print-to-pdf.mjs`(通用 `Page.printToPDF` 工具)。
测试账套演示数据只保留 `OQC-2026-11-0003`(B-92-25,15 行)/ `OQC-2026-11-0004`(C-23-11,10 行)。

## 11. 2026-11-01 第四轮:卫生安全 15 项「结果」可填写

**用户口径(2026-11-01 08:42,截图红框圈住卫生安全表「结果」整列)**:「这些红框内容要能填写」
⇒ 卫生安全 15 项结果由静态「见型式检验报告」改为**手填 + 落库**;纸面直接填,打印/导出报表按填写值印出。
(取代设计 Q5/Q8「本轮不录数」旧口径。)

### 11.1 改动

| 件 | 说明 |
| --- | --- |
| `tools/migrate-oqc-hygiene-results-20261101.sql`(新) | `qc_oqc_head` 加 15 个可空文本列 `卫生_<项目>` + 15 列中文注明 + `yj_field` 15 行(hidden)+ 15 条 en 译名;自检;已登记 `db-migrations.txt`,两账套均执行(执行 1 / 失败 0) |
| `frontend/src/core/qc/QcOqcSheet.vue` | 卫生安全「结果」列:草稿态 `el-input` 绑定 `head['卫生_<项目>']`、只读态显示值;打印 CSS 把输入框收到 10px 去掉控件外观 |
| `backend/.../controller/OqcReportController.java` | 新增 `POST /api/oqc/hygieneResults`:按 15 列白名单显式写(空串→NULL)、草稿态守卫、需「保存」权限 —— 通用保存对空串跳过 ⇒ 已填值改回空白清不掉,这个接口专门解决「清空」 |
| `frontend/src/core/views/PanelxList.vue` | 保存成功后(`load()` 之前)对 QC_OQC_REPORT 调上述接口补存 15 列 |
| `backend/src/main/resources/reports/qc_oqc.jrxml` | 15 个 `$P{卫生_<项目>}` 参数;卫生安全表结果列 staticText → textField(空→留空) |
| `en.js` | 「填写」/「卫生安全结果保存失败，请重试」 |

### 11.2 验证(`e2e-hygiene.mjs` + 渲染件)

| 场景 | 结果 |
| --- | --- |
| 纸面填 15 项(0.12/无/无/1.79/20/0.46/ND×9)→ 保存 → 刷新回读 | 15 个值全部回读一致(落 `qc_oqc_head`) |
| 清空 15 项 → 保存 → 刷新回读 | 15 个值全部清空(**专用接口把空串写成 NULL**;通用保存单独做不到) |
| 打印(CDP printToPDF,同侧栏「打印」) | 第 2 页卫生安全表结果列印出填写值;`e2e-hygiene-print.pdf` |
| 「导出报表 → PDF」服务端 Jasper | 结果列同样印出填写值;`e2e-hygiene-report.pdf` |
| 旧报告(迁移前) | 15 列为 NULL ⇒ 该列留空(不再印「见型式检验报告」) |

### 11.3 2026-11-01 09:24 补正:空格内空白(去掉「填写」占位文字)

用户口径(截图圈住 15 个结果格,格内都是浅灰「填写」占位)：「空白的就可以」
⇒ 结果格**不再显示占位文字**,未填时就是空白格(与纸质表单一致)。改 `QcOqcSheet.vue`
去掉 `:placeholder`;`en.js` 删除「填写」词条。打印/导出/保存/清空逻辑不变。

### 11.4 2026-11-01 09:46 补正:销售出库「生成出厂检验报告」挪进「打印」下拉

用户口径(截图圈住销售出库工具栏上独立的「生成出厂检验报告」)：「把销售出库单里这个改到当前的打印按钮里面」
⇒ `PanelConfigService`(SALE_OUT 的 PANDA 分支)不再单独插组,改为把动作**追加进「打印」组**:
主按钮仍「打印」,下拉 = 预览 / 导出 / **生成出厂检验报告**。前端零改动(下拉项走
`onGroupAction → onButton`,现有 `openOqcPicker` 分支照常生效)。仅后端 jar 变更,换包即生效。
