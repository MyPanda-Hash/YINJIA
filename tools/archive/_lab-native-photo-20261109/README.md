# _lab-native-photo-20261109 —— 「拍照上传附件」改走原生相机 的验证取证

> 用户口径:「点击拍照上传附件,并没有调用摄像机,摄像机就同一沿用之前的就行。」
> 交付:APK **1.0.8 / versionCode 9**(`android/dist/yinjia-mes-1.0.8.apk`),
> 源码:`android/app/src/.../ScanActivity.java`(photo 模式)、`MainActivity.java`(桥 + onShowFileChooser)、
> `frontend/src/business/nativeCamera.js`(网页侧桥)+ `views/mobile/MobileLabRecord.vue`(按钮接桥)。
> 说明:`android/README.md` §0 与 §8.4。

## 为什么必须原生

页面跑在 `file:///android_asset/www/index.html`;安卓 WebView 对 `<input type=file accept="image/*" capture>`
**不会拉起相机**,而壳原先连 `WebChromeClient.onShowFileChooser` 都没实现 ⇒ 点「拍照/上传附件」什么都不会发生。

## 做法(复用扫码那台相机)

1. `ScanActivity` 增加 **photo 模式**(Intent extra `photo=true`):同一套 `Camera.open()` 预览 +
   自动对焦 + 点屏幕开关手电,只是不再解码;底部多一颗大号「拍照」按钮。
2. 按快门 → `takePicture` → 压到长边 ≤1280 / JPEG 80 → 存 App 缓存 → 回 `photoPath`。
3. `MainActivity` 读文件 → base64 → `window.__yjPhotoResult('data:image/jpeg;base64,…', 'yj_photo_xxx.jpg')`。
4. 网页 `nativeCamera.js` 转成 `File`,走既有 `/attachment/upload`(锚点 `手机照片-<行id>`);
   非 APK 环境 `hasNativeCamera()` 为 false ⇒ 自动退回 `<input type=file>`。

## 验证(Android 14 模拟器,AVD `hsmes`)

| 步 | 证据 | 结果 |
|---|---|---|
| 装包/启动 | `06-app-page.png` | 覆盖安装成功;壳内加载本地前端,底部「服务连接正常」(后端 `http://10.0.2.2:8090` 可达) |
| 版本/签名 | `dumpsys package` / `apksigner verify` | `versionCode=9`、`versionName=1.0.8`;证书 SHA-256 `b455080b…9cbc`(与 1.0.6/1.0.7 同一把钥匙) |
| 相机权限 | `11-photo-page.png` | 首次点拍照弹出系统「允许拍照」对话框(权限流程正常) |
| 拍照页 | `14-camera.png` | 相机预览出现、底部大号「拍照」按钮 + 提示语(模拟器为虚拟镜头) |
| 按快门 | `16-back-to-app.png` + `logcat` | 拍完**自动回到主界面**,`logcat` 无 FATAL、无 `YjPhoto` 报错 |
| dex 编译产物 | `classes.dex` 字符串 | 含 `takePhoto` / `hasCamera` / `__yjPhotoResult` / `btn_shoot` / `yj_photo_` / `photoPath` |
| 前端产物 | APK 内 `assets/www/assets/MobileLabRecord-*.js` | 含 `takePhoto` / `__yjPhotoResult`(桥已接上) |

> ⚠ 模拟器没有真实镜头,**"拍照 → 上传 → 电脑端回填"整链仍须在真机上走一遍**:
> 装 1.0.8 → 进「手机扫码 → 实验室记录手机登记」→ 某行「拍照/上传附件」→ 相机页按「拍照」→
> 行上出现附件名 → 保存草稿 → 电脑端同面板该行可见并能下载。

## 复跑要点

```powershell
# 1) 出包(仓库根)
powershell -NoProfile -ExecutionPolicy Bypass -File .\android\build.ps1
# 2) 覆盖安装(真机) / 模拟器
adb install -r android\dist\yinjia-mes-1.0.8.apk
```

> 模拟器里 `10.0.2.2` = 宿主机回环:壳里「接口地址」填 `http://10.0.2.2:8090` 才能连本机后端。
