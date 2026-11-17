# 银嘉 MES · 安卓壳(`android/`)

> **日期**:2026-10-20(2026-11-17 连出 1.0.14 / 1.0.15 / 1.0.16 / 1.0.17 / 1.0.18)
> **产物**:`android/dist/yinjia-mes-1.0.18.apk`(自签名,可直接侧载 / 覆盖升级)
> **不依赖 Gradle / Android Studio**:用 SDK 的 `aapt2 / javac / d8 / apksigner` 四步手搓出包,
> 离线、几十秒、可重复构建(本机没有 Gradle,也没有装 Studio)。

## 0. 版本与「直接更新」(2026-11-17)

| 项 | 值 |
|---|---|
| 包名 | `com.yinjia.mes.app`(**永不改**;改了就是另一个 App,旧图标/旧数据都不跟着走) |
| 本版 | `versionName=1.0.18`、`versionCode=19`(上一版 1.0.17 = 18;1.0.16 = 17;1.0.15 = 16;1.0.14 = 15) |
| 签名证书 | `CN=Yinjia MES Debug`(仓库内 `android/debug.keystore`,SHA-256 `b455080b…9cbc`) |
| 覆盖升级 | 与旧版 **同一把钥匙 + versionCode 更大** ⇒ 手机上直接装新 APK 就是「更新」,不用卸载 |
| 1.0.18 内容 | **整站前端重打(原生壳代码未改)**:生产退料**可扫码退料**(扫领料单码/工单号→打开单据→扫物料→提交)且版面与生产领料对齐;扫**工单码**弹窗选组装/混料、扫**领料单纸面码**直接跳转;其他领料/其他退料/扫码混料顶栏与生产领料统一 |
| 1.0.17 内容 | **整站前端重打(原生壳代码未改)**:生产领料页扫**领料单纸面二维码**时按第 4 段标记打开对应那张单 —— 扫 @M(混料)开混料单、扫 @A(组装)开组装单;老的三段工单码仍按原口径(打开组装那张) |
| 1.0.16 内容 | **整站前端重打(原生壳代码未改)**:生成工单领料时**组装 + 混料两张单都自动出纸**(以前只出组装那张);纸面标题改「生产领料单（组装）/（混料）」;领料单二维码第 4 段加领料标记 **@A=组装 / @M=混料**(前 3 段口径不变,扫工单/报工/扫码混料照旧);连同 1.0.15 的多仓库入库等改到最新 |
| 1.0.15 内容 | **整站前端重打(原生壳代码未改)**:采购入库单「多仓库入库」按钮与明细分配界面、同一行明细拆多个仓库存放、仓库改多选弹窗、列表页内联表单同样可用;批量生单/合单生单弹窗表头总全选;连同 1.0.14 的手机端登录页默认服务器地址一起在包内 |
| 1.0.14 内容 | **接口号默认 = 服务器的 IP:端口**(用户口径「手机端的登录界面的配置默认为服务器的 ip 和端口」):`MainActivity.DEFAULT_BASE` 由占位地址 `192.168.1.10` 改为线上服务器 `http://36.140.66.163:8090`,`getBase()` 未设置时返回该默认值 ⇒ **首装不再强制弹「接口地址」框、直接进登录页**;登录页在壳里多一行**只读**的「服务器地址 http://36.140.66.163:8090(默认)」,改地址仍点顶部「设置」 |
| 1.0.13 内容 | **整站前端重打(原生壳代码未改)**:含 1.0.12 之后 287 个提交 / 163 个前端源文件的全部更新
(生产工单草稿箱与新增整页编制、品质管理「样品检验」、出货检验表观审批流、产成品入库多批次与检验门禁、
库存以金蝶真实账套为准、检验数据记录明细表、角色字段视图、自定义字段父/子目录、采购链贯通、拍照上传等) |
| 1.0.9~1.0.12 内容 | 1.0.12 手机端两道状态闸门(已保存单据锁定设备名称 / 审批通过后整单只读);1.0.11 删除行确认弹窗;
1.0.10 加标水「测试日期」日期选择器;1.0.9 加标水明细列随「测试项目」变 |
| 1.0.8 内容 | **拍照上传附件走原生相机**:实验室记录手机登记的「拍照/上传附件」点下去打开原生相机页
(复用扫码那台相机,底部「拍照」大按钮、点屏幕开关手电),拍完自动回传并上传;网页里 `<input type=file>` 也补上了 `onShowFileChooser`(可进相册/文件) |
| 1.0.7 内容 | 手机扫码新增 **实验室记录手机登记**(3 张研发记录表的手机端:逐行附件、模糊查询、明细折叠、回填电脑端面板) |

> **版本号只有一处真源(2026-11-15 修正)**:改版本只改 `build.ps1` 的 `$version` / `$versionCode`;
> `AndroidManifest.xml` 里**不写** versionCode/versionName —— aapt2 的 `version-code` / `version-name`
> 参数只在 manifest 缺这两个属性时才注入,写了就沿用文件里的值。以前两边手工同步,
> 2026-11-15 出 1.0.13 时就踩到「APK 文件名是 1.0.13、装上去 versionCode 还是 13」的假发布(已修正并复验)。

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
│ http://36.140.66.163:8090        [设置] │ ← 42dp 原生工具条(显示当前接口号,默认即服务器)
├──────────────────────────────────────────┤
│                                          │
│   MES 网页(打包在 APK 内,离线可开)     │
│                                          │
└──────────────────────────────────────────┘
```

- **首次启动不再弹「接口地址」对话框**(2026-11-17):没设置过就用默认值
  `http://36.140.66.163:8090`(线上服务器),直接加载内置页面进登录页;
- 登录页在壳里会显示一行**只读**的「服务器地址 http://36.140.66.163:8090(默认)」,
  要连别的服务器/测试账套点工具条「设置」覆盖(改完重新加载,`/api` 前缀随之变化);
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

前置:Android SDK、JDK(脚本优先 `JAVA_HOME`;本机用 JDK 23 出包通过)、
`android/libs/zxing-core-3.5.3.jar`(已随仓库提供,离线可构建)。
SDK 位置探测见 `android/sdk.ps1`:`ANDROID_HOME` → `ANDROID_SDK_ROOT` →
`%LOCALAPPDATA%\Android\Sdk` → **各盘根目录的 `\SDK` / `\Android\Sdk` / `\android-sdk` 等**
(本机 SDK 就在 `E:\SDK`,不必再手工设环境变量)。

**手机安装 / 升级**:把 `android/dist/yinjia-mes-1.0.18.apk` 拷到手机点安装(需允许「安装未知应用」)。
手机上已装旧版的**直接装这个就是升级**(同包名同签名、versionCode 16>15);装完可从「我的桌面 → 设置」里
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

### 8.4 2026-11-06:适配本机 SDK(E:\SDK)并用 1.0.6 重新出包

> 用户:「帮我使用当前本地的 Android sdk 打包」

- **为什么动脚本**:本机 SDK 在 `E:\SDK`(build-tools 34.0.0 / 35.0.0 / 35.0.1、
  platforms android-34 / 35、platform-tools;无 cmdline-tools),旧脚本两处会卡:
  ① 只认 `ANDROID_HOME` / `%LOCALAPPDATA%\Android\Sdk` ⇒ 报「找不到 Android SDK」;
  ② d8 写死按 `36.1.0 → 37.0.0 → 34.0.0` 找的旧逻辑回落到 **34.0.0 的 d8 8.2.2**,
  在 JDK 23 上直接崩:`Compilation failed with an internal error: ... String.length() ... null`。
- **改法**:① 新增 [`sdk.ps1`](sdk.ps1) 里的 `Get-AndroidSdk`,`build.ps1` / `install.ps1`
  共用,探测链补上各盘根目录;② d8 改为**按 build-tools 版本号倒序取最新**
  (本机取到 35.0.1 的 **8.6.2**;34.0.0 继续负责 aapt2 / zipalign / apksigner);
  ③ platform 优先 android-34,没有则取现有最高。
- **产物**:`dist/yinjia-mes-1.0.6.apk` **2.53 MB**,
  versionCode **7** / versionName **1.0.6**,`minSdk 24` / `targetSdk 34`,
  包名 `com.yinjia.mes.app`,label「银嘉MES」。
- **验证(不需要手机的部分全绿)**:`apksigner verify` 通过(v2+v3,`CN=Yinjia MES Debug`);
  `zipalign -c 4` 通过;dex **327 类**(36 个自有类 + 291 个 ZXing 类,含
  `GenericMultipleBarcodeReader` 与 `scanMulti`);`assets/www` **159 个文件**、0 条反斜杠条目、
  `index.html` 与 `frontend/dist` **逐字节一致**(入口 chunk `index-u8jisrf6.js`);
  manifest 的 `usesCleartextTraffic=true` 与 `networkSecurityConfig` 均在。
  前端产物沿用已入库的 `frontend/dist`(与 `backend/src/main/resources/static` 逐字节一致),
  本次未重新 `npm run build`。
- **仍未真机验证**:`adb devices` 为空。手机插上后跑
  `powershell -ExecutionPolicy Bypass -File android\install.ps1` 覆盖安装即可
  (签名仍是同一把 `debug.keystore`,可直接覆盖 1.0.x 旧包)。


### 8.5 第五轮(2026-11-09):拍照上传附件走**原生相机**

> 用户:「点击拍照上传附件,并没有调用摄像机,摄像机就同一沿用之前的就行。」

- **根因**:页面跑在 `file:///android_asset/www`,WebView 对 `<input type=file capture>`
  **不会拉起相机**(壳原先连 `onShowFileChooser` 都没实现)⇒ 点「拍照/上传附件」毫无反应。
- **做法(复用扫码那台相机)**:`ScanActivity` 加 **photo 模式**
  (`am ... --ez photo true` / 内部 Intent):同一套 `Camera.open()` 预览 + 自动对焦 + 点屏幕开关手电,
  只是不再解码;底部多一颗大号「拍照」按钮 → `takePicture` → 压到长边 ≤1280 / JPEG 80 存缓存 →
  回传路径给 `MainActivity` → 转 `data:image/jpeg;base64,…` →
  `window.__yjPhotoResult(dataUrl, fileName)` → 网页当普通 `File` 走既有 `/attachment/upload`。
- **桥**:`YjNative.takePhoto()`(新)+ `YjNative.hasCamera()`;网页侧见
  `frontend/src/business/nativeCamera.js`(壳内走原生、浏览器自动退化回 file input)。
- **顺带**:WebChromeClient 补了 `onShowFileChooser` —— 网页里的文件框在 APK 里也能开
  (进相册/文件),不再是"点了没反应"。
- **验证**(Android 14 模拟器 + 真机待现场):
  - `adb install -r` 覆盖安装成功,`dumpsys package` = `versionCode=9 / versionName=1.0.8`;
  - dex 里可见 `takePhoto` / `hasCamera` / `__yjPhotoResult` / `btn_shoot` / `yj_photo_`;
  - 临时钩子(仅验证用,已回滚)直接进拍照页:**相机预览出来了、「拍照」按钮在、点了之后回到主界面,
    `logcat` 无 FATAL / 无 `YjPhoto` 报错**,权限弹窗也按预期出现。
  - ⚠ 尚未在真机上走完"拍照 → 上传 → 回填"整链(模拟器无真实镜头)。
- 版本 `1.0.8`(versionCode 9);证据截图 `tools/archive/_lab-native-photo-20261109/`。

---

## 9. 2026-11-15:出 **1.0.13** —— 1.0.12 之后的整站前端重打

> 用户口径:「帮我看下这个安卓的更新然后帮我重新打包」。

- **改动范围**:`android/` 原生代码 **零改动**(`git diff --numstat 019a12917..HEAD -- android/` = 0 文件;
  最后一次碰 `android/` 的提交就是 1.0.12 的出包提交 `019a12917`)。变的只是**打进 APK 的前端**
  —— 1.0.12 之后 **287 个提交 / 163 个前端源文件**(生产工单整页编制+草稿箱、样品检验、出货检验表观审批流、
  产成品入库多批次、库存以金蝶为准、检验数据记录明细表、角色字段视图、自定义字段父/子目录、采购链贯通、
  手机报工超量改弹窗 等)。所以本版 = **纯前端重打**,原生行为与 1.0.12 完全一致。
- **前端产物取证**:`frontend/dist`(173 文件)与 `backend/src/main/resources/static` **逐文件 SHA-256 全等**,
  而 static 由 HEAD `61ffe85f4`「前端静态产物同步」入库、时间紧接在最后一次 `frontend/src` 改动之后
  ⇒ 确认打进去的就是当前源码的构建产物。本次**未重跑 `npm run build`**(本机沙箱内 esbuild 报 `spawn EPERM`,
  绕法见 `docs/development/开发与质量.md`;不影响出包,因为 dist 已被上面两条取证钉死在 HEAD)。
- **版本号机制修正(本轮真问题)**:`AndroidManifest.xml` 原来硬写 `android:versionCode="13"` /
  `versionName="1.0.12"`,而 `aapt2 link` 的 `version-code` / `version-name` **只在 manifest 缺该属性时才生效**
  ⇒ 第一次出包的文件名是 1.0.13、`aapt2 dump badging` 却仍是 `versionCode=13 / 1.0.12`
  (装上去是"假发布":覆盖升级看着成功、版本没变)。已把这两个属性从 manifest 删除,
  版本只由 `build.ps1` 注入;重出后实测 `versionCode=14 / versionName=1.0.13`。
- **验证(不需要手机的部分全绿)**:

| 项 | 结果 |
|---|---|
| 包信息 | `com.yinjia.mes.app`、`versionCode=14`、`versionName=1.0.13`、`minSdk 24`、`targetSdk 34`、label「银嘉MES」 |
| 签名/对齐 | `apksigner verify` 通过(v2+v3;`CN=Yinjia MES Debug`,SHA-256 `b455080b…9cbc` 与上一版**同一把钥匙** ⇒ 可覆盖升级);`zipalign -c 4` 通过 |
| 体积/指纹 | `dist/yinjia-mes-1.0.13.apk` **2.74 MB**(2,870,731 字节),SHA-256 `93E3AFFE…4D704F` |
| 前端资源 | APK 内 `assets/www/` **173 个文件**,与 `frontend/dist` **逐文件 SHA-256 全等(0 失配)**;**0 个反斜杠条目**;`index.html` 逐字节一致 |
| dex | `class_defs_size=332`;`scanMulti / takePhoto / hasCamera / __yjPhotoResult / __yjScanResultMulti`、`GenericMultipleBarcodeReader` 全在 |
| 桥契约 | 前端用到的 `YjNative.*` 全在壳内(`scan/scanMulti/takePhoto/getBaseUrl/setBaseUrl/toast/appVersion`),三个回调均在 |
| 权限/明文 | INTERNET / ACCESS_NETWORK_STATE / CAMERA / VIBRATE;`usesCleartextTraffic=true` + `networkSecurityConfig` 已挂 |
| 真机 | `adb devices` 为空 ⇒ **仍未真机验证** |

- **仍未真机验证**:手机插上后跑 `powershell -ExecutionPolicy Bypass -File android\install.ps1` 覆盖安装即可
  (该脚本按 `LastWriteTime` 取 `dist\` 下最新 APK,即 1.0.13)。
- **出包脚本两个编码铁律**(本轮踩到):`android/build.ps1` **必须是 UTF-8 带 BOM**(缺 BOM 时
  Windows PowerShell 5.1 按 ANSI 解析,脚本里的中文全变乱码,`Write-Host` 日志成"鏀惰繘"这类);
  `AndroidManifest.xml` 也保持 BOM(保持既有约定,减少无意义 diff)。
- **既有隐患(非本次引入)**:壳没实现 `setDownloadListener` ⇒ APK 内点 CSV / 报表导出(`a.download`)不落盘;
  要支持需在 `MainActivity` 接 DownloadManager(另开任务)。

---

## 10. 2026-11-17:出 **1.0.14** —— 手机端登录页的服务器配置默认 = 服务器 IP:端口

> 用户口径:「手机端的登录界面的配置默认为服务器的 ip 和端口」。

- **改动**:`MainActivity.DEFAULT_BASE` `http://192.168.1.10:8090` → `http://36.140.66.163:8090`
  (与 `frontend/src/business/appConfig.js` 的 `API_ORIGIN` 对齐);`getBase()` 空值时返回默认值 ⇒
  **首装不再强制弹「接口地址」框**,直接进登录页;登录页在壳里多一行**只读**的
  「服务器地址 http://36.140.66.163:8090(默认)」+「如需修改请点顶部『设置』」。
  顶部「设置」对话框预填默认值、文案改为"默认已连服务器 X"。前端 `en.js` 补两条词条。
- **验证(不需要手机的部分全绿)**:

| 项 | 结果 |
|---|---|
| 包信息 | `com.yinjia.mes.app`、`versionCode=15`、`versionName=1.0.14`、`minSdk 24`、`targetSdk 34`、label「银嘉MES」 |
| 签名/对齐 | `apksigner verify` 通过(`CN=Yinjia MES Debug`,SHA-256 `b455080b…9cbc` —— 与上一版**同一把钥匙** ⇒ 可覆盖升级);`zipalign -c 4` exit 0 |
| 体积/指纹 | `dist/yinjia-mes-1.0.14.apk` **2.77 MB**(2,899,955 字节),SHA-256 `592D9F93…46AAE8C` |
| 前端资源 | APK 内 `assets/www/` **179 个文件**,与 `frontend/dist` **逐文件 SHA-256 全等(0 失配 / 179)**;**0 个反斜杠条目** |
| dex | `classes.dex` 内含 `http://36.140.66.163:8090`(**已无** `192.168.1.10`);`scanMulti / takePhoto / hasCamera / getBaseUrl / setBaseUrl` 全在 |
| 界面(ego 浏览器,壳内桩) | 登录页显示「服务器地址 http://36.140.66.163:8090 默认」+ 提示行,旧黄色「首次使用…」横幅消失;英语下整行已翻译、无残留中文;网页版不渲染这一行。证据 `tools/archive/_mobile-login-default-20261117/` |
| 真机 | `adb devices` 为空 ⇒ **仍未真机验证** |

- **仍未真机验证**:手机插上后跑 `powershell -ExecutionPolicy Bypass -File android\install.ps1` 覆盖安装即可
  (脚本按 `LastWriteTime` 取 `dist\` 下最新 APK,即 1.0.18)。
- **踩坑提醒(本轮再踩一次)**:`android/build.ps1` 与 `install.ps1` **必须保持 UTF-8 带 BOM**;
  用会丢 BOM 的编辑器/工具改完后,Windows PowerShell 5.1 会把中文注释按 ANSI 解析,
  直接报 `Unexpected token ')' in expression or statement`(语法错误位置还指在无关行上,极易误判)。
  改完用 `[System.IO.File]::ReadAllBytes(path)[0..2]` 核对 `EF BB BF`。

---

## 11. 2026-11-17:整站重打 **1.0.15**(APK 内前端追到最新源码)

> 用户口径:「重新打包 apk,确保是最新的状态」—— 1.0.14 出包在后,前端又落了好几轮改动,
> 手机里装的是缺功能的旧界面(整包嵌入模式:前端改了不重打 APK 就不生效)。

- **做法**:`cd frontend && npm run build`(全新构建,`dist` 命中 **179 个文件**)→
  `powershell -ExecutionPolicy Bypass -File android\build.ps1`(脚本第 1 步把 `frontend/dist` 整份收进
  `assets/www`)。**原生壳代码一行未改**(Java/资源/Manifest 均未动),所以扫描、拍照、接口号逻辑与 1.0.14 完全一致;
  本版只换包里的网页与版本号。`versionName=1.0.15`、`versionCode=16`(上一版 15 ⇒ 可覆盖升级)。
- **本版带上的前端改动**(1.0.14 之后):采购入库单「多仓库入库」按钮与明细分配界面(列表页内联表单同样可用)、
  一行明细拆多个仓库存放、仓库改多选弹窗、批量生单/合单生单弹窗表头总全选;以及 1.0.14 那轮的手机端
  登录页默认服务器地址(`http://36.140.66.163:8090`)。
- **验证(不需要手机的部分全绿)**:

| 项 | 结果 |
|---|---|
| 前端构建 | `npm run build` 成功(`✓ built in 1m 10s`,`dist` 179 个文件),主 chunk `index-C3fzy9Ph.js` |
| 包信息 | `com.yinjia.mes.app`、`versionCode=16`、`versionName=1.0.15`、`minSdk 24`、`targetSdk 34`、label「银嘉MES」、launcher `MainActivity` |
| 签名/对齐 | `apksigner verify` 通过(`CN=Yinjia MES Debug`,SHA-256 `b455080b…9cbc` = 与 1.0.14 **同一把钥匙**);`zipalign -c 4` **Verification succesful** |
| 体积/指纹 | `dist/yinjia-mes-1.0.15.apk` **2.84 MB**(2,904,051 字节),SHA-256 `DFC7F722…53445AC1` |
| 前端资源 | APK 内 `assets/www/` **179 个文件**,与 `frontend/dist` **逐文件 SHA-256 全等(0 失配 / 0 缺失)**;**0 个反斜杠条目**;包内 `index.html` 主 chunk = `index-C3fzy9Ph.js`(与 dist 一致) |
| 新功能在包内 | `PanelxList-BADM9cVa.js` / `PanelxForm-Bl-hrrv9.js` 含「多仓库入库」文案,`index-CPksl9sA.js` 含「服务器地址」⇒ 本版确实是新前端 |
| dex | `classes.dex` 494,500 字节(壳代码未改,与 1.0.14 同类) |
| 真机 | `adb devices` 为空 ⇒ **仍未真机验证** |

- **BOM 踩坑(本轮复现并修复)**:编辑 `build.ps1` 时 UTF-8 BOM 被工具抹掉,`powershell -File` 直接
  `Unexpected token ')' in expression or statement`(报在第 35 行,真因是第 34 行中文注释被按 ANSI 读)。
  已把文件写回 **UTF-8 with BOM** 并复验 `Parser::ParseFile` = **0 errors** 后才出包。
  ⇒ **以后任何工具改完 `android/*.ps1`,先查前三字节 `EF BB BF`,再出包。**

---

## 12. 2026-11-17:重打 **1.0.16**(修「混料领料单不出纸」+ 标题/二维码改动)

> 用户口径:「生成工单领料扫码的时候,只有组装领料由自动打印,混料领料没有打印出来」→ 修完再打:
> 「标题都是生产领料单,加个后面括号备注是(组装还是混料就行);混料和组装的二维码是一样的,
> 需要在二维码上多一位作为混料领料还是组装领料的标记」。

- **本版带上的前端改动**(原生壳一行未改):
  1. 开单工作台按 `单据[]` **逐张**取打印载荷(以前只打顶层那张=组装),重复扫码路径后端也逐张补载荷;
  2. 纸面标题统一「生产领料单（组装）」/「生产领料单（混料）」;
  3. 领料单二维码 `0@工单号@(1000+行号)@A|M` —— A=组装、M=混料;前 3 段不变,老的三段工单码照旧能扫
     (解析器多返回一个 `kind`,老码为空)。
- **验证**:

| 项 | 结果 |
|---|---|
| 构建 | `npm run build`(177 文件,主 chunk 见 dist)+ `aapt2/javac/d8/zip/zipalign/apksigner` 全绿 |
| 包信息 | `com.yinjia.mes.app`、`versionCode=17`、`versionName=1.0.16`、`minSdk 24`、`targetSdk 34`、label「银嘉MES」 |
| 签名/对齐 | `apksigner verify` 通过(`CN=Yinjia MES Debug`,SHA-256 `b455080b…9cbc`,与上一版同一把钥匙);`zipalign -c 4` sucessful |
| 体积/指纹 | `dist/yinjia-mes-1.0.16.apk` **2.84 MB**(2,903,891 字节),SHA-256 `85FE126C…F31296DE` |
| 前端资源 | APK 内 `assets/www/` **177 个文件**,与 `frontend/dist` **逐文件 SHA-256 全等(0 失配 / 0 缺失)**、**0 个反斜杠条目** |
| 改动确实在包内 | `assets/www/assets/scanCode-*.js` 含新解析器的 `ASSEMBLY` 字面量(领料标记解析) |
| 打印链路实测 | 同一份源码在 5173 实跑:打印任务 #9「生产领料单（组装）」`0@GD-2026-11-0007@1004@A`、#10「生产领料单（混料）」`…@M`,两条 DONE ⇒ 两张纸都出(见 `tools/archive/_print-mix-slip-20261117/`) |

- ⚠ 手机端要装**这个新包**才有上述修复(整包嵌入前端);覆盖安装即可(versionCode 17 > 16,同签名)。

---

## 13. 2026-11-17:重打 **1.0.17**(生产领料扫哪张标签就开哪张单)

> 用户报障:「生产领料扫混料和扫组装的二维码,都是跳到组装的单据界面,这个不对。」

- **根因**:领料单纸面二维码第 4 段(1.0.16 新加的领料标记 `@A`/`@M`)在「生产领料」页被丢掉了 ——
  页面只把「工单号 + 行号」发给后端 `GET /px/mobilePick/locate`,后端只能按"命中整组、默认第一张=组装"打开。
- **改动**:
  1. 后端 `locate` 增可选参数 `kind`(组装/混料 或 A/M),传了就只在那一种单里定位;
     没有该类型的单回 `hint = no-doc-kind`(前端给一句人话提示);
  2. 前端 `business/mobilePick.js` 新增 `locateQueryOf(raw)`(纯逻辑 + 单测):把码拆成 wo/line/kind;
     页面「打开单据」与相机扫码都走它,并把 `kind` 传给后端。
- **实测**(5173,`GD-2026-11-0010 #3`,组装 `LL-…0047` / 混料 `LL-…0048`):

| 扫的码 | 打开 | 结论 |
|---|---|---|
| `0@GD-2026-11-0010@1003@M` | id=857 `LL-2026-11-0048`(**混料**) | ✅ |
| `0@GD-2026-11-0010@1003@A` | id=856 `LL-2026-11-0047`(**组装**) | ✅ |
| `0@GD-2026-11-0010@1003`(老三段码) | id=856(组装) | ✅ 行为未变 |

接口侧:不带 `kind` 仍是「整组、组装在前」;`kind=A/M/组装/混料` 各自命中;认不出的值按"不过滤"处理。
前端单测 **2021 项全过**。

- **验证**:

| 项 | 结果 |
|---|---|
| 包信息 | `com.yinjia.mes.app`、`versionCode=18`、`versionName=1.0.17`、`minSdk 24`、`targetSdk 34` |
| 签名/对齐 | 同一把钥匙(`b455080b…9cbc`);`zipalign -c 4` 通过 |
| 体积/指纹 | **2.84 MB**(2,903,977 字节),SHA-256 `4CB6BDD4…2BFF29` |
| 前端资源 | APK 内 `assets/www/` **178 个文件**,与 `frontend/dist` 逐文件 SHA-256 全等(0 失配/0 缺失)、0 反斜杠 |
| 改动在包内 | `assets/www/assets/scanCode-*.js` 含领料标记解析(`ASSEMBLY` 字面量) |

---

## 14. 2026-11-18:重打 **1.0.18**(退料可扫码 + 版面统一 + 扫工单码弹窗)

> 用户口径:「生产退料也要可以扫码退料而且前端页面要和生产领料对齐……其他的扫码也要和领料对齐。」
> 「如果领料退料扫的是工单码,就要弹窗选择是混料还是组装。如果是领料单上的二维码就直接跳转。」

- **改动**(全在前端,原生壳未改):
  1. 生产退料:顶部加「扫码定位」行(扫领料单码/工单号),扫到可退单直接进退料作业;不可退给提示;
  2. 生产退料版面与生产领料同一套(48px 顶栏 + 灰底 + 查询单据卡 + 卡片列表);
  3. 新增 `PickKindDialog`:扫**工单码**(分不出类型)弹窗选组装/混料;扫**领料单纸面码**(`@A`/`@M`)直接跳;
  4. 其他领料 / 其他退料 / 扫码混料 顶栏与生产领料统一(工序报工本来就是);
  5. keep-alive 回页也回焦扫码框;新增 13 条文案英文译名。
- **验证**:

| 项 | 结果 |
|---|---|
| 包信息 | `com.yinjia.mes.app`、`versionCode=19`、`versionName=1.0.18`、`minSdk 24`、`targetSdk 34` |
| 签名/对齐 | 同一把钥匙(`b455080b…9cbc`);`zipalign -c 4` 通过 |
| 体积/指纹 | **2.84 MB**(2,912,350 字节),SHA-256 `00D41427…7FE20A8` |
| 前端资源 | APK 内 `assets/www/` **180 个文件**,与 `frontend/dist` 逐文件 SHA-256 全等(0 失配/0 缺失)、0 反斜杠 |
| 界面实测 | 领料扫工单码弹窗选混料/组装、扫 `@M` 直接开混料单;退料扫 `@A` 直接选中可退单并出现作业区(见 `tools/archive/_scan-align-20261118/`) |