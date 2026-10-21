package com.yinjia.mes.pick;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.ImageFormat;
import android.hardware.Camera;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.util.Log;
import android.view.Surface;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * 原生扫码页(2026-10-20) —— 用系统 Camera(API1)+ ZXing core 解码,不依赖任何第三方 SDK/联网。
 *
 * 为什么不用网页里的 getUserMedia:
 *   安卓 WebView 把 http:// 视为**不安全上下文**,`navigator.mediaDevices` 直接不存在
 *   (和 Chrome 一个规则)。工厂内网是 http://IP:8090,没证书 ⇒ 网页调不起摄像头。
 *   所以扫码放在原生层做,解出字符串再回传给网页 —— 网页那边只负责把码填进输入框。
 *
 * 支持:QR / CODE_128 / CODE_39 / CODE_93 / EAN_13 / EAN_8 / ITF / DATA_MATRIX。
 * 交互:对准即扫;扫中震动一下并回传;点屏幕切换手电;返回键取消。
 */
public class ScanActivity extends Activity implements SurfaceHolder.Callback {

    private static final String TAG = "YjScan";

    private SurfaceView surface;
    private TextView hint;
    private Camera camera;
    private SurfaceHolder holder;
    private boolean decoding = false;
    private boolean found = false;
    private boolean torchOn = false;

    private final MultiFormatReader reader = new MultiFormatReader();
    private final Handler ui = new Handler(Looper.getMainLooper());
    /** 每 3 帧解一次,省电也够快 */
    private int frameSkip = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        setContentView(com.yinjia.mes.pick.R.layout.activity_scan);

        surface = (SurfaceView) findViewById(com.yinjia.mes.pick.R.id.preview);
        hint = (TextView) findViewById(com.yinjia.mes.pick.R.id.hint);

        holder = surface.getHolder();
        holder.addCallback(this);
        holder.setType(SurfaceHolder.SURFACE_TYPE_PUSH_BUFFERS);

        Map<DecodeHintType, Object> hints = new EnumMap<DecodeHintType, Object>(DecodeHintType.class);
        List<BarcodeFormat> formats = new ArrayList<BarcodeFormat>();
        formats.add(BarcodeFormat.QR_CODE);
        formats.add(BarcodeFormat.CODE_128);
        formats.add(BarcodeFormat.CODE_39);
        formats.add(BarcodeFormat.CODE_93);
        formats.add(BarcodeFormat.EAN_13);
        formats.add(BarcodeFormat.EAN_8);
        formats.add(BarcodeFormat.ITF);
        formats.add(BarcodeFormat.DATA_MATRIX);
        hints.put(DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        hints.put(DecodeHintType.CHARACTER_SET, "UTF-8");
        reader.setHints(hints);

        // 点屏幕:手电开关(仓库光线差时用)
        surface.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { toggleTorch(); }
        });
    }

    private void toggleTorch() {
        if (camera == null) return;
        try {
            Camera.Parameters p = camera.getParameters();
            if (p.getFlashMode() == null) return;
            torchOn = !torchOn;
            p.setFlashMode(torchOn ? Camera.Parameters.FLASH_MODE_TORCH : Camera.Parameters.FLASH_MODE_OFF);
            camera.setParameters(p);
        } catch (Exception ignore) { }
    }

    // ───────────── Surface ─────────────

    @Override
    public void surfaceCreated(SurfaceHolder h) {
        try {
            camera = Camera.open();
        } catch (Exception e) {
            Log.e(TAG, "打开相机失败: " + e.getMessage());
            hint.setText("打不开相机:请检查权限,或用「设置」里的手动输入");
            return;
        }
        try {
            Camera.Parameters p = camera.getParameters();
            p.setPreviewFormat(ImageFormat.NV21);
            Camera.Size size = pickSize(p.getSupportedPreviewSizes());
            if (size != null) p.setPreviewSize(size.width, size.height);
            camera.setParameters(p);
            camera.setDisplayOrientation(90);   // 竖屏
            camera.setPreviewDisplay(h);
            camera.setPreviewCallback(new Camera.PreviewCallback() {
                @Override public void onPreviewFrame(byte[] data, Camera cam) {
                    if (decoding || found || data == null) return;
                    if ((frameSkip++ % 3) != 0) return;
                    decoding = true;
                    try {
                        Camera.Size sz = cam.getParameters().getPreviewSize();
                        decode(data, sz.width, sz.height);
                    } catch (Throwable t) {
                        Log.w(TAG, "解码异常: " + t.getMessage());
                    } finally {
                        decoding = false;
                    }
                }
            });
            camera.startPreview();
            autoFocusLoop();
        } catch (Exception e) {
            Log.e(TAG, "启动预览失败: " + e.getMessage());
        }
    }

    private Camera.Size pickSize(List<Camera.Size> sizes) {
        if (sizes == null || sizes.isEmpty()) return null;
        Camera.Size best = sizes.get(0);
        for (Camera.Size s : sizes) {
            // 目标 1280×720 左右:分辨率够解码,又不至于太慢
            boolean better = Math.abs(s.width * s.height - 1280 * 720) < Math.abs(best.width * best.height - 1280 * 720);
            if (better) best = s;
        }
        return best;
    }

    private void autoFocusLoop() {
        if (camera == null) return;
        try { camera.autoFocus(new Camera.AutoFocusCallback() {
            @Override public void onAutoFocus(boolean ok, Camera cam) {
                ui.postDelayed(new Runnable() { @Override public void run() { autoFocusLoop(); } }, 1200);
            }
        }); } catch (Exception ignore) { }
    }

    private void decode(byte[] data, int width, int height) {
        PlanarYUVLuminanceSource source = new PlanarYUVLuminanceSource(data, width, height, 0, 0, width, height, false);
        BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));
        try {
            Result r = reader.decodeWithState(bitmap);
            onDecoded(r.getText());
        } catch (Exception notFound) {
            // 正常:这一帧没扫到
        } finally {
            reader.reset();
        }
    }

    private void onDecoded(final String text) {
        if (found || text == null || text.trim().length() == 0) return;
        found = true;
        try {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) v.vibrate(60);
        } catch (Exception ignore) { }
        ui.post(new Runnable() {
            @Override public void run() {
                hint.setText("已扫到:" + text);
                Intent out = new Intent();
                out.putExtra("code", text);
                setResult(RESULT_OK, out);
                ui.postDelayed(new Runnable() { @Override public void run() { finish(); } }, 250);
            }
        });
    }

    @Override
    public void surfaceChanged(SurfaceHolder h, int format, int w, int hh) { }

    @Override
    public void surfaceDestroyed(SurfaceHolder h) { release(); }

    private void release() {
        if (camera != null) {
            try { camera.setPreviewCallback(null); } catch (Exception ignore) { }
            try { camera.stopPreview(); } catch (Exception ignore) { }
            try { camera.release(); } catch (Exception ignore) { }
            camera = null;
        }
    }

    @Override
    protected void onPause() { super.onPause(); release(); }
    @Override
    protected void onDestroy() { super.onDestroy(); release(); }
}
