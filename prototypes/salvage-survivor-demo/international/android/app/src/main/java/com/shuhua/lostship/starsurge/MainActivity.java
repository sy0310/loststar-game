package com.shuhua.lostship.starsurge;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import java.io.ByteArrayInputStream;

public final class MainActivity extends Activity {
    private WebView game;
    private boolean showingExitDialog;
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(23, 23, 43));
        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(23, 23, 43));
        frame.addView(game, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        configureInsets(frame);

        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        game.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = loader.shouldInterceptRequest(request.getUrl());
                if (local != null) return local;
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found",
                    java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                    && uri.getPath() != null && uri.getPath().startsWith("/assets/"));
            }
        });
        game.loadUrl(START);
    }

    private void configureInsets(FrameLayout frame) {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
            frame.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsetsIgnoringVisibility(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    @Override
    protected void onPause() {
        game.evaluateJavascript("window.dispatchEvent(new Event('lostship:native-pause'));", null);
        game.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (game != null) game.onResume();
    }

    @Override
    public void onBackPressed() {
        if (showingExitDialog) return;
        game.evaluateJavascript("(function(){var p=document.getElementById('pause');"
            + "var b=document.getElementById('pauseBtn');var h=document.getElementById('hud');"
            + "if(h&&!h.hidden&&p&&p.hidden&&b&&!b.hidden){b.click();return true;}return false;})()",
            handled -> {
                if ("true".equals(handled) || isFinishing()) return;
                showingExitDialog = true;
                new AlertDialog.Builder(this)
                    .setTitle("Leave Lostship?")
                    .setMessage("Your saved progress will be available when you return.")
                    .setNegativeButton("Stay", (dialog, which) -> {})
                    .setPositiveButton("Exit", (dialog, which) -> finish())
                    .setOnDismissListener(dialog -> showingExitDialog = false)
                    .show();
            });
    }

    @Override
    protected void onDestroy() {
        game.destroy();
        super.onDestroy();
    }
}
