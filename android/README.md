# 银嘉 MES · 安卓壳(`android/`)

> **日期**:2026-10-20
> **产物**:`android/dist/yinjia-mes-1.0.0.apk`(自签名,可直接侧载)
> **不依赖 Gradle / Android Studio**:用 SDK 的 `aapt2 / javac / d8 / apksigner` 四步手搓出包,
> 离线、几十秒、可重复构建(本机没有 Gradle,也没有装 Studio)。

---

## 1. 它是什么

一个**很薄的安卓壳**,里面是 MES 网页,外面补两件网页给不了的原生能力:

| 能力 | 为什么必须原生 |
|---|---|
| **摄像头扫码** | 安卓 WebView 把 `http://` 视为**不安全上下文**,`navigator.mediaDevices` 直接不存在(和 Chrome 同一条规则);工厂内网是 `http://IP:8090`,没证书 ⇒ 网页调不起摄像头 |
| **接口号(服务器地址)可配置** | 手机装到哪台服务器、连哪个账套,网页自己不知道(页面是从那台服务器加载来的) |

除此之外**不重写任何业务**:登录、面板、生产领料全是同一套网页 —— 以后改功能只更新服务器,不用重发 APK。

## 2. 界面

```
┌──────────────────────────────────────────┐
│ http://192.168.1.10:8090      [扫码][设置] │ ← 42dp 原生工具条(显示当前接口号)
├──────────────────────────────────────────┤
│                                          │
│        MES 网页(WebView)                │
│                                          │
└──────────────────────────────────────────┘
```

- **首次启动**弹「接口地址」对话框(默认 `http://192.168.1.10:8090`),保存后自动加载;
- 工具条右边「设置」随时可改地址(改完立即重新加载)、「扫码」打开原生相机;
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

**手机安装**:把 `android/dist/yinjia-mes-1.0.0.apk` 拷到手机点安装(需允许「安装未知应用」)。

> ⚠ 签名是 `debug.keystore`(自签名,脚本首次运行自动生成,不入库)。**内部侧载够用**;
> 若要上应用市场/企业分发,换成正式 keystore 并妥善保管(丢了就没法覆盖升级)。

## 5. 关键实现点

| 点 | 说明 |
|---|---|
| 明文 http | `AndroidManifest` 开 `usesCleartextTraffic` + `res/xml/network_security_config.xml` 显式允许;否则 WebView 直接拒绝加载 http |
| 扫码 | `ScanActivity`:系统 Camera(API1)预览 + **ZXing core** 解码(QR/128/39/93/EAN13/EAN8/ITF/DataMatrix),不联网、不用第三方 SDK |
| 手电 | 扫码页**点屏幕**开关闪光灯(仓库光线差时用) |
| 震动 | 扫中震 60ms,给现场一个"扫到了"的反馈 |
| 返回键 | WebView 能后退就后退,退到底再退出 App |
| 权限 | 仅 INTERNET / CAMERA / VIBRATE / ACCESS_NETWORK_STATE;相机在首次扫码时动态申请 |

## 6. 已验证

| 项 | 结果 |
|---|---|
| 构建 | `aapt2 + javac + d8(36.1.0)+ zipalign + apksigner` 全绿,产出 **244.7 KB** APK |
| 包信息 | `package=com.yinjia.mes.app`,`minSdk=24`(Android 7.0+),`targetSdk=34`,label=`银嘉MES`,launcher=`MainActivity` |
| 签名/对齐 | `apksigner verify` 通过;`zipalign 4` 通过 |
| 权限 | INTERNET / ACCESS_NETWORK_STATE / CAMERA / VIBRATE |
| 真机 | **未测**(本机无手机连接;`adb devices` 为空)—— 装到手机后请回一句,我按真机结果再调 |

## 7. 已知限制 / 下一步

1. **未在真机验证**:相机预览方向、扫码速度要以真机为准(不同机型 preview 尺寸/方向有差异);
2. 目前只支持 **http/https** 的 MES 地址;若以后上 HTTPS 域名,这里什么都不用改;
3. 没有做「离线缓存 / 断网重试」;没有做 App 内自动升级(需要的话加个版本检查接口);
4. 扫码只回传**一段文本**(码内容)。工单码内容是 `工单号`(或 `公司代码@工单号@行号`),物料码是 `存货编码|批号` —— 解析交回网页(`parseBarcode` 已实现);
5. 若以后要在网页里用摄像头(不装 App),必须先给 MES 配 **HTTPS**。
