# 扫码混料:相机扫码报错 + 界面与「生产领料」对齐(2026-11-17)

## 用户报障(两件事)

1. 手机 App 里点「相机扫码」弹:
   `扫码失败:This plugin method is not available on this platform.`
   用户口径:**「相机和其他扫码用一样的调用就可以」**。
2. 界面不像「生产领料」:用户口径:**「界面要和生产领料一样。一个查询,一个输入框加扫码」**。

## 根因

`frontend/src/business/nativeScan.js` 用的是 **Capacitor ML Kit 插件**
(`@capacitor-mlkit/barcode-scanning` 的 `BarcodeScanner.scan()`),而现场手机装的是**手搓壳**
(`android/app/.../MainActivity.java`):只注入 `window.YjNative`,底层是自研
ScanActivity + ZXing,**没有装这个 Capacitor 原生插件** ⇒ 插件 JS 在包里、原生实现缺席
⇒ 一调必抛 `This plugin method is not available on this platform.`。

更隐蔽的一层:`isNative()`(2026-11-01 为修 apiBase 改成「看到 `window.YjNative` 就 true」)
在手搓壳里恒为 true ⇒ 电脑端不该出现的「相机扫码」按钮在 App 里**照样显示**,点下去必然报错。

## 修法

| 位置 | 改动 |
|---|---|
| `frontend/src/business/nativeScan.js` | 重写:只走 **`window.YjNative.scan()` + `window.__yjScanResult(code, ok)`**(与生产领料 / 生产扫码登记 / 其他领料同一条调用);`hasNativeScan()` 判据改成「壳注入了 scan 桥」,不再看 `isNative()`;加 120s 兜底超时(相机权限被拒时壳只弹 Toast 不回调) |
| `frontend/src/views/mobile/MobileMixScan.vue` | 扫码行改成生产领料同款单行 `输入框 + 查询 + 扫码`(44px 命中区,手机 390 宽也不换行,不再有独立的长条「相机扫码」按钮);「取秤提交」移进电子秤卡(挨着「手输数量」);副标题缩成一句;查询框允许直接敲工单号 |
| `frontend/src/business/mixScan.js` | `parseWorkOrderQr(raw, { plainOrderNo })`:显式开关才放行「纯工单号」,默认行为不变(物料码 `编码\|批号` 仍判 no-order) |
| `frontend/src/i18n/locales/en.js` / `ja.js` | 补齐本页 **50 条**漏掉的译名(建页时未交付多语言) |
| `frontend/package.json` | 移除已无引用的 `@capacitor-mlkit/barcode-scanning`(锁文件同步) |
| `frontend/src/business/mixScan.test.js` | 新增 4 条断言:纯工单号解析;页面 tt() 文案必须有英文译名;nativeScan 只走 YjNative 桥且不再引入 ML Kit |

## 验证(ego 浏览器,`http://localhost:5173` 源码版)

> 脚本与截图都在本目录:`round-0*.mjs`、`*.png`;重跑方式
> `ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/mix-scan-ui-20261119/round-08.mjs')"`
> (先把本目录的 .mjs 拷回 `C:/Users/Lenovo/ego/mix-scan-ui-20261119/`)。
> ⚠ 仓库 `.gitignore` 里 `*.png` 被全局忽略(**截图只在本地**
> `C:/Users/Lenovo/ego/mix-scan-ui-20261119/` 与本目录);进 git 的是可复跑的 .mjs 与本说明。

用 `Page.addScriptToEvaluateOnNewDocument` 注入**假壳**(`window.YjNative.scan` 300ms 后回调
`__yjScanResult`),复现 App 内扫码链路;工单用测试库真实数据 `GD-2026-11-0015 #1`(产品 `A-45-01`,
《物料清单》2 行)。

| 断言 | 结果 |
|---|---|
| 有桥时出现「扫码」按钮,旧的「相机扫码」长按钮消失 | ✅ 05-mobile-before-scan.png |
| 点「扫码」→ `YjNative.scan()` 被调用 1 次 → 输入框被填充 → 自动查工单 | ✅ scanCalls=1 |
| **不再出现** `This plugin method is not available on this platform.` | ✅ 告警里只有业务文案(`没找到这张工单` / `+12.5 kg`) |
| 工单行 = `输入框 + 查询 + 扫码` 单行(390 宽,三元素 top 差 < 4px,高 44px) | ✅ round-08 输出 |
| 物料行 = `输入框 + 提交本笔 + 扫码` 单行 | ✅ 同上 |
| 「取秤提交」在电子秤卡内、未被截断(中/英/日) | ✅ 13-final-zh / 14-final-en / 15-final-ja |
| 手输 12.5 + 提交本笔 → 落库并累加「已记」 | ✅ `YJ-TJHZ-001 +12.5 kg`,进度 1/2(测试库草稿已用 `_clean-draft.mjs` 清掉) |
| 切英文/日文后本页显示目标语言(仅客户/物料名等业务事实保中文) | ✅ 14-final-en.png |

单测:`cd frontend && npm test` → 2016 通过(含新增 4 条);`npm run build` 通过。

## 第二批(同日):其他领料/退料加扫码按钮 + 扫码混料补模糊查询

用户口径:「其他领料和其他退料没有扫码按钮,还有扫码混料没有模糊查询的栏框」。

| 位置 | 改动 |
|---|---|
| `MobileOtherScan.vue`(其他领料 + 其他退料,同一组件两入口) | 扫码行改成 `输入框 + 查询 + 扫码`(与其他手机扫码页同形);「扫码」调 `nativeScan.scanOnce()`(即 `window.YjNative.scan()`),扫到即回填并**自动查库存**(扫一次=查一次);网页版无桥不显示该按钮 |
| `MobileMixScan.vue` | 查询框支持**模糊查询**:手敲的工单号 / 产品名 / 物料编码**片段**走 `POST /px/workOrderList`(与生产领料同一接口、同一交互),命中多行列候选(工单号#行号 · 产品编码·名称 · 排产数量),点哪条载入哪条;带 `@` 的工单码仍走精确路径 |
| `mixScan.js` | 撤掉上一版的 `plainOrderNo`:非 `@` 串一律交给模糊查询,解析器回归「只认工单二维码」(避免物料码被当单号) |
| `en.js` / `ja.js` | 补两页共 37 条译名(其他领料/退料此前 13 条 en、22 条 ja 都没交付) |

验证(同样注入假壳;测试库 YJ_TEST):

| 断言 | 结果 |
|---|---|
| 其他领料 / 其他退料出现「查询 + 扫码」两颗按钮 | ✅ 19-other-pick-scan.png / 20-other-ret-scan.png |
| 点「扫码」→ `YjNative.scan()` 被调用 → 码回填 → 自动查出库存(雅可比CS 12975) | ✅ scanCalls +1,cands=1,alerts 空 |
| 模糊查 `0015` → 1 条候选 | ✅ 17-fuzzy-by-no.png |
| 模糊查 `烧结` → 20 条候选 + 提示「匹配到多行,请选择工单行」 | ✅ 16-fuzzy-by-name.png |
| 点候选 → 载入该工单行、候选收起、物料清单按该产品取 | ✅ 18-after-pick.png |
| 带 `@` 的工单码仍走精确路径(不受模糊影响) | ✅ round-06/08 |

单测:`npm test` → 2021 通过;`npm run build` 通过。

## 遗留

- `backend/src/main/resources/static` 是打包产物(`build-appjar.ps1` 会 `npm run build` + robocopy 镜像),
  本次**未提交**该目录:工作区里还有别的任务的静态产物同步在跑,避免把别人的半成品一起提交。
- 手机端要看到效果需重新打包 APK/发版(前端在 jar / APK 内,5173 只是源码验证)。
