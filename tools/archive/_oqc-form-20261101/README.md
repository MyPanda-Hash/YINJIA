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
