# 银嘉扫码领料 · Capacitor 版(`android-cap/`)

> **日期**:2026-10-20
> **产物**:`android-cap/dist/yinjia-mes-pick-capacitor-1.0.0.apk`(**28.25 MB**)
> **为什么有这一版**:用户拿了一个参考包 `银嘉扫码领料.apk`,要求「用和它一样的方法把本地系统打包成 APK」。
> 这一版就是**与参考包同构**的版本:Capacitor 容器 + 整个前端内置 + Google ML Kit 条码扫描。

---

## 1. 参考包是怎么跑的(逆向结论)

| 层 | 参考包里是什么 | 证据 |
|---|---|---|
| 容器 | **Capacitor 6/7** | `assets/capacitor.config.json`、`assets/capacitor.plugins.json`、`capacitor.js`、dex 里 165 个 `com/getcapacitor/*` 类 |
| 界面 | **整个前端 dist 打进包**(不是从服务器加载) | `assets/public/` 130 个文件、`assets/public/index.html` |
| 扫码 | **Google ML Kit** 条码识别 | `assets/mlkit_barcode_models/*.tflite` ×3、`lib/*/libbarhopper_v3.so` ×4、dex 里 2548 个 `com/google/mlkit|android/gms/vision` 类 |
| 后端 | **没有** | dex 里 `springframework`=0、`sqlserver/jdbc`=0;包里无 `.jar/.war/.db` |
| 连后端方式 | 前端里写死默认地址 + `localStorage.mes_api_origin` 可改 | 在 `index-*.js` 里提取到 `const tu="http://36.140.66.163:8090"`、`const fr="mes_api_origin"`;`WorkOrderPick-*.js` 里有「服务器地址」输入框 |

**结论:不是「前端带后端」,是「前端 + 容器 + 扫码插件」的纯客户端包;业务与数据库仍在 8090 那台服务器上,走 HTTP。**

## 2. 本版与参考包的一致性

| 项 | 参考包 | 本版 |
|---|---|---|
| 包名 / 版本 | `com.yinjia.mes.pick` / 1.0 | **同** |
| 应用名 | 银嘉扫码领料 | **同** |
| minSdk / targetSdk | 23 / 35 | **同** |
| 容器 | Capacitor | **同**(Capacitor 7.6.9) |
| 扫码插件 | `@capacitor-mlkit/barcode-scanning` | **同**(7.5.0) |
| 前端 | dist 打进 `assets/public` | **同**(124 文件) |
| 体积 | 28.41 MB | **28.25 MB** |
| 签名 | (参考包自己的签名) | `CN=Yinjia MES Debug`(**与手搓版同一把**,两版可互相覆盖安装) |

## 3. 与「手搓版」的区别(两版都留着)

| | 手搓版 `android/` | **Capacitor 版 `android-cap/`** |
|---|---|---|
| 体积 | **2.3 MB** | 28.25 MB |
| 扫码 | ZXing(core jar,纯 Java) | **Google ML Kit**(对反光/曲面/磨损码更稳) |
| 容器 | 手写 Activity + WebView | Capacitor |
| 构建 | SDK 四件套直出,**不需要 Gradle** | Gradle + AGP(需要 JDK 21) |
| 服务器地址 | 原生「设置」弹窗 → SharedPreferences | **登录页「服务器地址」一行** → `localStorage.mes_api_origin` |
| 适合 | 快速发版、包体小 | 要 ML Kit 识别率、与参考包对齐 |

> 两版**共用同一份 `frontend/dist`**,也共用 `android/debug.keystore`。

## 4. 服务器地址怎么配(本版必须配)

Capacitor 的页面 origin 是 `https://localhost`,**没有同源后端**,所以登录页底部会多出一行「服务器地址」:

```
服务器地址  [ http://192.168.1.10:8090        ]  [保存并重连]
```

- 填**后端**地址(含 `http://` 与端口),点「保存并重连」→ 写 `localStorage.mes_api_origin` 并整页重载;
- 与参考包用**同一个键名**,两包的配置可以互相沿用;
- 网页版(8090/5173)不显示这一行(同源,请求走 `/api`);
- 前端实现见 [request.js](../frontend/src/core/request.js) 的 `apiOrigin()`:
  优先级 `YjNative` > `localStorage.mes_api_origin` > `VITE_API_ORIGIN` > `/api`。

## 5. 构建(本机实测可复现)

```powershell
# 1) 前端产物(仓库根)
cd frontend; npm run build; cd ..

# 2) 同步进 Capacitor 工程
cd android-cap; npx cap copy android; cd android

# 3) 构建(需要 JDK 21 + Gradle + build-tools 35 + platform 35)
$env:JAVA_HOME="D:\YINJIA-main\android-cap\.jdk21\jdk-21.0.2"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME="D:\YINJIA-main\android-cap\.gradle-home"
$env:TEMP="D:\YINJIA-main\android-cap\.tmp"; $env:TMP=$env:TEMP
& "D:\YINJIA-main\android-cap\.gradle-dist\gradle-8.14.3\bin\gradle.bat" `
    --no-daemon "-Djava.io.tmpdir=D:/YINJIA-main/android-cap/.tmp" assembleDebug
```

产物:`android/app/build/outputs/apk/debug/app-debug.apk` → 拷到 `android-cap/dist/`。

### 5.1 本机踩到的 5 个坑(照抄即可复现)

| # | 现象 | 处置 |
|---|---|---|
| 1 | Gradle wrapper 下不动(services.gradle.org 超时) | 用华为云镜像下 `gradle-8.14.3-bin.zip` 解压到 `.gradle-dist/`,直接跑 `bin\gradle.bat` |
| 2 | `Unsupported class file major version 69` | 系统 JDK 是 25,Gradle 8.x 不认 ⇒ 下 **OpenJDK 21**(华为云)放 `.jdk21/`,仅安卓构建用它 |
| 3 | `Failed to find Build Tools revision 35.0.0` / 缺 platform 35 | 手动装 `build-tools_r35_windows.zip`、`platform-35_r02.zip` 到 SDK 目录 |
| 4 | `AccessDeniedException: ...Temp\xxx.tmp`(压缩 assets 时) | 本机 TEMP 被安全策略挡 ⇒ `-Djava.io.tmpdir` + `TEMP/TMP` 全部指向 `android-cap/.tmp` |
| 5 | `AccessDeniedException: C:\Users\...\.android\debug.keystore.lock` | 签名配置显式指向 `android/debug.keystore`(见 `app/build.gradle` 的 `signingConfigs.debug`) |

依赖下载走阿里云 Maven 镜像(见 `android/build.gradle` 的 repositories)。

## 6. 已验证 / 未验证

| 项 | 结果 |
|---|---|
| 构建 | **BUILD SUCCESSFUL**(Gradle 8.14.3 + AGP 8.13.0 + JDK 21 + compileSdk 35) |
| 包信息 | `com.yinjia.mes.pick` · minSdk 23 · targetSdk 35 · label 银嘉扫码领料 · 4 个 dex |
| 内容 | `assets/public` 124 文件含 `index.html`;`mlkit_barcode_models` 3 个模型;`libbarhopper_v3.so` 4 个 ABI |
| 签名 | `apksigner verify` 通过,证书 `CN=Yinjia MES Debug`(与手搓版同一把) |
| 真机 | **未测**(本机无手机连接)—— 相机权限、扫码取景、服务器地址保存都要上机复核 |

## 7. 目录说明

```
android-cap/
├── package.json              # 只装 Capacitor 依赖(npm 走 npmmirror)
├── capacitor.config.json     # appId / webDir=../frontend/dist / cleartext / 扫码格式
├── android/                  # Capacitor 生成的安卓工程(入库)
├── dist/                     # 打好的 APK(不入库)
├── .jdk21/ .gradle-dist/ .gradle-home/ .tmp/   # 本地工具链与缓存(不入库)
└── node_modules/             # (不入库)
```
