# 阶段 A 改前基线（baseline/）清单与复跑说明

本目录固定「出厂检验报告改版前」的可复核证据。时间戳为 2026-11-04 本机实测。
校验入口：`node tools/archive/_oqc-next/_check-old-baseline.mjs` → `old-baseline-check.{json,txt}`（PASS 8/8）。

## 目录

| 目录 | 时点 | 内容 | 用途 |
|---|---|---|---|
| `20261104T1857-old-8090/` | 18:57~18:58 | `report-templates-baseline.json.txt`：`/api/report/templates?panelCode=QC_OQC_REPORT` 与 `all=true`（模板管理列表）的快照 | 证明**DB 模板落库前**：面板级 API 能列出 qc_oqc（走 classpath 注册表），而模板管理全量列表里没有 qc_oqc 行 |
| `20261104T1904-old-template-HEAD/` | 19:04 | `qc_oqc.HEAD.jrxml`（git HEAD 即改前版模板，34602 字节）+ 用该模板离线重渲染的 `old-layout-0003.{pdf,xlsx,txt}`（2 页，数据取测试账本 `HSDZ_MES_TEST` 的 `OQC-2026-11-0003`，15 行；**不写库**） | 可复跑的旧版式证据：页脚含 `惠州大亚湾区龙海二路303号 / www.water-agplus.com / info@water-agplus.com / 0752-5583930`；签署行「审核/批准」为静态下划线；检验员取头字段值 `admin` |
| `20261104T1911-live-8090-task3-template/` | 19:11 | 旧 8090 导出（`--expect=drift`）的 PDF/XLSX/文本/JSON | **现场漂移记录**：task-3 模板迁移落库后，旧 8090（旧 jar）立即改走 DB 新模板 ⇒ 页脚消失、签署仍为静态下划线（旧后端不落审批参数）。不判 PASS/FAIL，仅记录极性 |
| `20261104T1917-old-ui-8090/` | 19:17 | 旧 jar 打包前端（8090）纸张面板截图 + 采集 JSON + 结果文本 | 纸面存在 `.oqc-footer` 且含三地址串；侧栏有「审核/弃审」；签署行空白线（旧 UI 基线） |

## 文件指纹（sha256 / 字节数）

```
330113a4... 558     20261104T1857-old-8090/report-templates-baseline.json.txt
58e01289... 128873  20261104T1904-old-template-HEAD/old-layout-0003.pdf
3ebc9458... 2792    20261104T1904-old-template-HEAD/old-layout-0003.txt
c1c6c96a... 48945   20261104T1904-old-template-HEAD/old-layout-0003.xlsx
deb34623... 34602   20261104T1904-old-template-HEAD/qc_oqc.HEAD.jrxml
669dfddc... 3097    20261104T1911-live-8090-task3-template/live-template-after-task3.json
ab793047... 81689   20261104T1911-live-8090-task3-template/live-template-after-task3.pdf
0dd05f4c... 161949  20261104T1917-old-ui-8090/ui-old-paper.png
a1f367e3... 4718    20261104T1917-old-ui-8090/ui-old.json
b1c809f9... 2688    old-baseline-check.json
```

## 复跑「旧版式离线重渲染」（不需要 8090/8091，不写库）

依赖：JDK25（`C:/Users/vigna/.jdks/ms-25.0.4`）、Maven 离线仓库 `.m2-repo`、`tools/archive/_oqc-form-20261101/FillQcOqc.java`（现成渲染器）。

```bash
cd D:/workspace/yinjia
JAVA_HOME=C:/Users/vigna/.jdks/ms-25.0.4
mkdir -p .tmp/oqc-verify/old-render

# 1) 取 git HEAD（改前）版本模板
git show HEAD:backend/src/main/resources/reports/qc_oqc.jrxml > .tmp/oqc-verify/old-render/qc_oqc.HEAD.jrxml

# 2) 生成 jasper 依赖 classpath（输出到 .tmp，不写 backend/target）
JAVA_HOME=$JAVA_HOME mvn -o -q -s tools/settings.xml -f backend/pom.xml dependency:build-classpath \
  -Dmdep.outputFile='D:/workspace/yinjia/.tmp/oqc-verify/backend-cp.txt' -DincludeScope=runtime

# 3) 编译渲染器
CP="$(cat .tmp/oqc-verify/backend-cp.txt)"
cp tools/archive/_oqc-form-20261101/FillQcOqc.java .tmp/oqc-verify/old-render/
C:/Users/vigna/.jdks/ms-25.0.4/bin/javac.exe -encoding UTF-8 -cp "$CP" -d .tmp/oqc-verify/classes .tmp/oqc-verify/old-render/FillQcOqc.java

# 4) 渲染旧版式（数据只读 HSDZ_MES_TEST；backend/src/main/resources 上 classpath 是为了 jasper 中文字体注册）
C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe '-Dstdout.encoding=UTF-8' \
  -cp "$CP;backend/src/main/resources;.tmp/oqc-verify/classes" \
  FillQcOqc .tmp/oqc-verify/old-render/qc_oqc.HEAD.jrxml OQC-2026-11-0003 .tmp/oqc-verify/old-render/old-layout-0003 --xlsx

# 5) 抽文本复核（openpdf 文本层）
node -e "import('./tools/archive/_oqc-next/_lib.mjs').then(async m=>{const t=m.pdfText('.tmp/oqc-verify/old-render/old-layout-0003.pdf','.tmp/oqc-verify/old-render/old-layout-0003.txt');console.log(t.pages,t.chars)})"
```

## 说明 / 踩坑

1. **旧 8090 直出的 PDF 文本被覆盖过**：18:57 第一次 `_api-baseline.mjs` 把旧版式 PDF 抽取文本写进
   `old-qc_oqc.txt`；19:01 复跑时被同名覆盖（当时尚未加守卫）。现已：
   - 脚本对证据文件加「已存在即拒绝覆盖」守卫（须显式 `--force`）；
   - 旧版式证据改用「HEAD jrxml 离线重渲染 + git HEAD 静态串」固定（上表），18:57 快照仅留模板注册 JSON。
2. **为什么必须在离线重渲染**：报表模板是 **DB 优先**（`yj_report_template`）。task-3 一落库，
   旧 8090 立刻改走 DB 新模板，旧版式就再也导不出来了。
3. `FillQcOqc.java` 默认读 `HSDZ_MES_TEST`；可用 `-Doqc.db=HSDZ_MES` 覆盖（本目录基线用测试库 15 行数据）。
4. jasper 中文字体依赖 `backend/src/main/resources/fonts/` + `jasperreports_extension.properties`，
   所以第 4 步 classpath 必须带 `backend/src/main/resources`，否则报 `JRFontNotFoundException: NotoSansSC`。
