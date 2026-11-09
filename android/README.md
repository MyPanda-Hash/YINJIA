# 银嘉 MES · 安卓壳(`android/`)

> **日期**:2026-10-20(2026-11-09 出 1.0.7)
> **产物**:`android/dist/yinjia-mes-1.0.7.apk`(自签名,可直接侧载 / 覆盖升级)
> **不依赖 Gradle / Android Studio**:用 SDK 的 `aapt2 / javac / d8 / apksigner` 四步手搓出包,
> 离线、几十秒、可重复构建(本机没有 Gradle,也没有装 Studio)。

## 0. 版本与「直接更新」(2026-11-09)

| 项 | 值 |
|---|---|
| 包名 | `com.yinjia.mes.app`(**永不改**;改了就是另一个 App,旧图标/旧数据都不跟着走) |
| 本版 | `versionName=1.0.7`、`versionCode=8`(上一版 1.0.6 = 7) |
| 签名证书 | `CN=Yinjia MES Debug`(仓库内 `android/debug.keystore`,SHA-256 `b455080b…9cbc`) |
| 覆盖升级 | 与 1.0.6 **同一把钥匙 + versionCode 更大** ⇒ 手机上直接装新 APK 就是「更新」,不用卸载 |
| 本版内容 | 手机扫码新增 **实验室记录手机登记**(3 张研发记录表的手机端:逐行附件拍照/下载、模糊查询、明细折叠、回填电脑端面板) |

> 铁律:① `com.yinjia.mes.app` 与 `android/debug.keystore` 丢了就无法覆盖升级(只能卸载重装);
> ② 每次出包 **versionCode 必须比上一版大**(脚本里 `$versionCode`),否则安卓拒绝覆盖安装;
> ③ 换签名 = 必须卸载重装(证书不一致,系统直接拒绝)。

---

## 1. 它是什么

**整个前端打进 APK**(`assets/www` = `frontend/dist` 的完整镜像),WebView 从
`file:///android_asset/www/index.html` 加载,**不依赖服务器就能开界面**;
再补两件网页给不了的原生能力:

| 能力 | 为什么必须原生 |
|---|---|
| **摄像头扫码** | 安卓 WebView 把 `http://` 视为**不安全上下文**,`navigator.mediaDevices` 直接不存在(和 Chrome 同一条规则);工厂内网是 `http://IP:8090`,没证书 ⇒ 网页调不起摄像头 |
| **接口号(后端地址)可配置** | 页面是本地 assets,不知道后端在哪;由它决定"连哪台服务器 / 哪个账套",网页据此把所有 `/api` 请求指过去(`frontend/src/core/request.js`) |

**扫码只放在「生产计划 → 生产领料」页**(用户 2026-10-20 口径:只有这个页面需要扫码):
工具条上**没有**全局扫码按钮,页面里的「扫工单 / 扫物料」按需调原生相机。

> ⚠ 代价:整包模式意味着**前端改了要重新打 APK**(以前"改服务器即可"不成立了)。
> 数据面不受影响 —— 台账/库存/审批仍然全在服务器。

## 2. 界面

```
┌──────────────────────────────────────────┐
│ http://192.168.1.10:8090          [设置] │ ← 42dp 原生工具条(显示当前接口号)
├──────────────────────────────────────────┤
│                                          │
│   MES 网页(打包在 APK 内,离线可开)     │
│                                          │
└──────────────────────────────────────────┘
```

- **首次启动**弹「接口地址」对话框(默认 `http://192.168.1.10:8090`),保存后加载内置页面;
- 工具条「设置」随时可改地址(改完重新加载,`/api` 前缀随之变化);
- 扫码结果通过 JS 桥回传网页:`window.__yjScanResult(code, ok)`。

## 3. 网页 ↔ 原生 的桥(只在这一个页面用到)

原生注入的对象:

```js
window.YjNative.scan()        // 打开原生扫码页(异步,结果走 __yjScanResult)
window.YjNative.getBaseUrl()  // 当前接口号
window.YjNative.setBaseUrl(u) // 改接口号(暂未在页面上开放写)
window.YjNative.toast(msg)    // 原生 toast
window.YjNative.appVersion()  // 壳版本
```

页面侧(见 [MobilePick.vue](../frontend/src/views/mobile/MobilePick.vue) 「生产领料」):

- 只有检测到 `window.YjNative.scan` 才显示「扫码」按钮 ⇒ **网页版不受影响**;
- 「扫工单」按钮 → 结果填工单号并自动查询;「扫物料」按钮 → 结果填物料编码并自动查可用量;
- 顶部原生「扫码」不指定目标:没选工单就当工单码,已选工单就当物料码;
- 结果回调统一走 `window.__yjScanResult(code, ok)`,页面卸载时注销。

## 4. 构建 / 安装

```powershell
# 出包(仓库根)
powershell -ExecutionPolicy Bypass -File android\build.ps1

# 出包并 adb 安装到已连的手机(需开 USB 调试)
powershell -ExecutionPolicy Bypass -File android\build.ps1 -Install
```

前置:Android SDK(`ANDROID_HOME` 或 `%LOCALAPPDATA%\Android\Sdk`)、JDK 25(`JAVA_HOME`)。
脚本会自动探测;`android/libs/zxing-core-3.5.3.jar` 已随仓库提供(离线可构建)。

**手机安装 / 升级**:把 `android/dist/yinjia-mes-1.0.7.apk` 拷到手机点安装(需允许「安装未知应用」)。
手机上已装旧版的**直接装这个就是升级**(同包名同签名、versionCode 8>7);装完可从「我的桌面 → 设置」里
看到壳版本,或看 APK 文件名核对。

> 出包前先 `cd frontend && npm run build`(脚本会自己把 `frontend/dist` 收进 `assets/www`,
> 见 [1/7]);**前端改了不重新出包,手机上就还是旧界面**(整包嵌入模式)。

> ⚠ 签名是 `debug.keystore`(自签名,脚本首次运行自动生成,不入库)。**内部侧载够用**;
> 若要上应用市场/企业分发,换成正式 keystore 并妥善保管(丢了就没法覆盖升级)。

## 5. 关键实现点

| 点 | 说明 |
|---|---|
| 前端打包踩坑 | **`aapt2 link -A` 在 Windows 下把条目写成 `assets/www\assets\...`(反斜杠)⇒ WebView 找不到 `index.html`(白屏)。改为在脚本里自己往 zip 写 `assets/www/...`(POSIX 分隔符),实测 122 条全部正斜杠、0 条反斜杠 |
| 明文 http | `AndroidManifest` 开 `usesCleartextTraffic` + `res/xml/network_security_config.xml` 显式允许;否则 WebView 直接拒绝加载 http |
| 扫码 | `ScanActivity`:系统 Camera(API1)预览 + **ZXing core** 解码(QR/128/39/93/EAN13/EAN8/ITF/DataMatrix),不联网、不用第三方 SDK |
| 手电 | 扫码页**点屏幕**开关闪光灯(仓库光线差时用) |
| 震动 | 扫中震 60ms,给现场一个"扫到了"的反馈 |
| 返回键 | WebView 能后退就后退,退到底再退出 App |
| 权限 | 仅 INTERNET / CAMERA / VIBRATE / ACCESS_NETWORK_STATE;相机在首次扫码时动态申请 |

## 6. 验证状态(2026-10-20)

### 6.1 已完成(不需要手机就能验的,全绿)

| 项 | 结果 |
|---|---|
| 构建 | `aapt2 + javac + d8(36.1.0)+ zipalign + apksigner` 全绿,产出 **2.3 MB** APK(整站前端在内) |
| 包信息 | `package=com.yinjia.mes.app`,`minSdk=24`(Android 7.0+),`targetSdk=34`,label=`银嘉MES`,launcher=`MainActivity` |
| 签名/对齐 | `apksigner verify` 通过(证书 `CN=Yinjia MES Debug`);`zipalign 4` 通过 |
| 权限 | INTERNET / ACCESS_NETWORK_STATE / CAMERA / VIBRATE |
| 相对路径 | 内置 `index.html` 引用 `./assets/...`(vite `base: './'`),`file://` 下可解析;Web 端同一份产物实测 10/10 不回归 |
| 明文 http | APK 内 manifest 实测 `usesCleartextTraffic=0xffffffff`(true)、`networkSecurityConfig=@0x7f060000` 已挂上 |
| 前端打包 | APK 内 `assets/www/` **122 个文件**、`index.html` 在、**0 个反斜杠条目**(踩坑见 §5) |
| dex 内容 | **317 个类** = 26 个自有类(`MainActivity` / `ScanActivity` / `Bridge` / `R.*`)+ 291 个 ZXing 类,数量与预期一致 |
| JS 桥契约 | 两侧逐字对得上:原生 `addJavascriptInterface(new Bridge(), "YjNative")` + `window.__yjScanResult(...)`;网页 `window.YjNative.scan/getBaseUrl` + `window.__yjScanResult = (code, ok) => …` |
| 网页回归 | 390 宽探针 **10/10**(加了扫码按钮后网页版行为不变:检测不到桥就不显示按钮) |
| 安装脚本 | `android\install.ps1` 冒烟通过:能找到 APK、能进入「等设备」循环、无设备时给出人话提示 |

### 6.2 待办:真机验证(本机做不了)

`adb devices` 为空;SDK 里**没有 AVD、没有系统镜像、也没有 cmdline-tools**(`sdkmanager` 不可用),
所以这台机器上无法自主起模拟器安装。需要**任一条**:

| 做法 | 怎么做 |
|---|---|
| **A. 插手机(最直接)** | 手机开「USB 调试」→ 连电脑 → `powershell -ExecutionPolicy Bypass -File android\install.ps1`(会等设备连上再装) |
| **B. 让我起模拟器** | 需要先下载系统镜像(约 1.0~1.3 GB,x86_64 API 34)+ 补 cmdline-tools;模拟器**没有真实相机**,只能验「启动 / 接口号保存 / 网页加载 / 表单流程」,验不了扫码取景 |
| **C. 先不动** | 包已在 `android/dist/`,等人到位再装;代码与文档已冻结 |

真机装好后要看的三件事:① 能否登录(接口号填对);② 「扫工单」取景方向是否正常(横/倒就调 `ScanActivity` 的 `setDisplayOrientation` 与预览尺寸);③ 扫出来的码是否落进正确的输入框(工单/物料)。

## 7. 已知限制 / 下一步

1. **未在真机验证**:相机预览方向、扫码速度要以真机为准(不同机型 preview 尺寸/方向有差异);
2. 目前只支持 **http/https** 的 MES 地址;若以后上 HTTPS 域名,这里什么都不用改;
3. 没有做「离线缓存 / 断网重试」;没有做 App 内自动升级(需要的话加个版本检查接口);
4. 扫码只回传**一段文本**(码内容)。工单码内容是 `工单号`(或 `公司代码@工单号@行号`),物料码是 `存货编码|批号` —— 解析交回网页(`parseBarcode` 已实现);
5. 若以后要在网页里用摄像头(不装 App),必须先给 MES 配 **HTTPS**。
## 8. 2026-11-05:一屏多个码时可以选择

用户口径:「手机扫码遇到多码不能选择」。

- **改前**:`MultiFormatReader.decodeWithState()` 一帧只解一个码,解到谁就回传谁 ——
  一沓工单码、一箱多袋料时,想扫指定那个必须先挪开别的;
- **改后**:改用 `GenericMultipleBarcodeReader`(整图 + 四象限递归)一帧找多个:
  - 一帧只有 1 个码 ⇒ 连续命中 **2 次**才回传(≈0.3 秒,够快,也不会误扫刚入镜的邻码);
  - 一帧 **≥2 个码** ⇒ **暂停解码 + 弹选择框**,每项显示 `工单 · GD-… 行1` /
    `物料 · YJ-… 批号 20261021` 这样的摘要,点哪个回传哪个;点「继续扫」回到取景继续扫;
- 行号仍按「1000 + 行号」还原(与网页 `scanCode.js` 同口径);选择框只是"选哪一个",解析仍在网页;
- 版本:`1.0.1`(versionCode 2)。`window.YjNative.appVersion()` 改成**直接读 APK 的 versionName**
  —— 以后发布只改 `build.ps1` 里 `$version` 一处,不用再同步 Manifest / MainActivity;
- 构建验证:`aapt2 / javac / d8 / zipalign / apksigner` 全绿;dex 里可见
  `GenericMultipleBarcodeReader`、`decodeMultiple` 与「扫到 N 个码,请选择」文案;
- ⚠ 仍属**未真机验证**:多码识别的实际速度取决于机型和镜头距离(标定 1280×720 预览),
  现场若觉得慢,把 `ScanActivity.FRAME_SKIP` 调小(现在 4)。
### 8.1 第二轮(对着《成型生产任务单》一页 9 个码实测)

> 用户:「实际上是 9 个码,但扫完后就弹出来 7 个码,扫到部分码就弹窗了,而且码和信息很难对应是哪一条的」

- **弹模态框就停了取景解码** ⇒ 只收到先入镜的那几个。现在改成**常驻覆盖面板**(占下半屏,
  `activity_scan.xml` 的 `multiPanel`):解码**不停**,边扫边往列表里追加,9 个能集齐;
- 每行**两段**:第一段 `工单 · GD-… 行N`(预判类型 + 关键字段),第二段 = **原始码全文**,
  和纸上「单据编号」列一致,照着纸就能挑;
- 面板出现后**不再自动回传**(只有单个码时才连续命中 2 次自动回传);
- 「重新扫」清空重来;返回键先收面板、再退出;
- 纸面配套:同一轮把《成型生产任务单》的「单据编号」列定宽并 `nowrap`,
  不再被折成 `GD-2026-11-001 / 8`(见 `tools/archive/_print-sheet-cols-20261105/`)。
### 8.2 第三轮(2026-11-05):按纸面顺序排列 + 多选扫码

> 用户:「下边的提示框能不能实现,按照图片中的顺序来对应的。生成工单领料和退料单
> 这个界面的扫码能不能支持多选。可以多个订单生成一对一的领料单。」

- **按纸面顺序**:列表不再按"谁先解出来"排,改成按条码在画面里的位置
  (上→下、左→右)排 —— 竖屏 `setDisplayOrientation(90)` 下 buffer(x,y) 映射到
  屏幕是 `(H-1-y, x)`,故排序键 = (x 升序, y 降序)。手机对着纸上那一列码,
  列表顺序就等于纸上序号;
- **多选扫码**:新增原生方法 `YjNative.scanMulti()`,以 `multi` 模式打开扫码页 ——
  面板每行可勾选(默认全选)、有「全选 / 重扫 / 取消」,确认后一次回传
  `window.__yjScanResultMulti([...])`;
- **网页侧**(「生成工单领料/退料单」页):多一个「扫多张」按钮(仅新版 APK 显示),
  勾选的码逐个解析成「工单号 + 行号」进待生成队列(重复的跳过并报数),
  再点「批量生成」——后端 `/create/batch` 本来就是**一张工单一对领料/退料单**;
- 版本:`1.0.3`(versionCode 4)。旧 APK 里没有 `scanMulti` ⇒ 按钮不出现(不会报错)。
### 8.3 第四轮(2026-11-05):只留一个「扫码」按钮

> 用户:「只要扫码一个按钮,然后扫码界面变成勾选确认就可以了。因为生成保持批量生成」

- 「生成工单领料/退料单」页只剩一个「扫码」,内部优先 `YjNative.scanMulti()`;
  老 APK 无此方法时退回单码 `scan()`;
- 多选模式下**收到第一个码就出勾选面板**(不再等第 2 个),底部按钮 `确定(N)`;
- 版本 `1.0.4`(versionCode 5)。
