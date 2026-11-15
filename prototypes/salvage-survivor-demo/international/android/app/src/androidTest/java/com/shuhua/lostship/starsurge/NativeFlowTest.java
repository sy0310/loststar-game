package com.shuhua.lostship.starsurge;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Device tests operate the signed release through native touch and Android Back. */
public final class NativeFlowTest {
    private final Instrumentation instrument = InstrumentationRegistry.getInstrumentation();
    private WebView web;
    private Activity activity;

    private void launch() throws Exception {
        Intent intent = instrument.getTargetContext().getPackageManager()
            .getLaunchIntentForPackage("com.shuhua.lostship.starsurge");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Instrumentation.ActivityMonitor launched = instrument.addMonitor(MainActivity.class.getName(), null, false);
        instrument.getTargetContext().startActivity(intent);
        activity = launched.waitForActivityWithTimeout(20000);
        instrument.removeMonitor(launched);
        assertNotNull("Release activity did not launch", activity);
        FrameLayout content = activity.findViewById(android.R.id.content);
        web = (WebView) ((FrameLayout) content.getChildAt(0)).getChildAt(0);
        waitFor("!!window.SurvivorDemo && SurvivorDemo.ready()");
        // Android's first-run immersive-mode notice belongs to System UI.
        android.view.accessibility.AccessibilityNodeInfo root = instrument.getUiAutomation().getRootInActiveWindow();
        if (root != null) {
            for (android.view.accessibility.AccessibilityNodeInfo node : root.findAccessibilityNodeInfosByText("Got it")) {
                node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK);
            }
        }
        SystemClock.sleep(300);
        visualReady();
        eval("document.addEventListener('click',function(e){window.nativeTestLastClick={id:e.target.id,text:e.target.textContent.slice(0,70),x:e.clientX,y:e.clientY};},true)");
    }

    private String eval(String expression) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        instrument.runOnMainSync(() -> web.evaluateJavascript(expression, value -> {
            result.set(value);
            done.countDown();
        }));
        assertTrue("WebView callback timed out", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void visualReady() throws Exception {
        CountDownLatch rendered = new CountDownLatch(1);
        instrument.runOnMainSync(() -> web.postVisualStateCallback(1, new WebView.VisualStateCallback() {
            @Override public void onComplete(long requestId) { rendered.countDown(); }
        }));
        assertTrue("WebView visual state timed out", rendered.await(20, TimeUnit.SECONDS));
    }

    private void waitFor(String expression) throws Exception {
        long deadline = SystemClock.uptimeMillis() + 20000;
        while (SystemClock.uptimeMillis() < deadline) {
            if ("true".equals(eval("Boolean(" + expression + ")"))) return;
            SystemClock.sleep(100);
        }
        fail("Timed out: " + expression);
    }

    private float[] point(String selector, double fraction) throws Exception {
        eval("document.querySelector(" + JSONObject.quote(selector) + ").scrollIntoView({block:'center'})");
        visualReady();
        JSONObject box = new JSONObject(eval("(function(){var r=document.querySelector("
            + JSONObject.quote(selector) + ").getBoundingClientRect();return {x:r.left+r.width*"
            + fraction + ",y:r.top+r.height/2,w:r.width,vw:innerWidth};})()"));
        assertTrue("Target is hidden", box.getDouble("w") > 0);
        int[] origin = new int[2];
        instrument.runOnMainSync(() -> web.getLocationOnScreen(origin));
        double scale = web.getWidth() / box.getDouble("vw");
        return new float[]{(float)(origin[0] + box.getDouble("x") * scale),
                           (float)(origin[1] + box.getDouble("y") * scale)};
    }

    private void send(int action, long down, float x, float y) {
        MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0);
        event.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
        // Avoid Instrumentation's render-idle wait turning a short press into a long press.
        assertTrue(instrument.getUiAutomation().injectInputEvent(event, true));
        event.recycle();
    }

    private void tap(String selector) throws Exception {
        float[] p = point(selector, 0.5);
        long down = SystemClock.uptimeMillis();
        send(MotionEvent.ACTION_DOWN, down, p[0], p[1]);
        SystemClock.sleep(80);
        send(MotionEvent.ACTION_UP, down, p[0], p[1]);
        SystemClock.sleep(300);
        android.util.Log.i("NativeFlow", selector + " " + p[0] + "," + p[1] + " -> " + eval("window.nativeTestLastClick || null"));
    }

    private File directory() {
        File folder = new File(instrument.getTargetContext().getExternalFilesDir(null), "international-evidence");
        assertTrue(folder.isDirectory() || folder.mkdirs());
        return folder;
    }

    private void screenshot(String name) throws Exception {
        Bitmap frame = instrument.getUiAutomation().takeScreenshot();
        assertNotNull(frame);
        try (FileOutputStream output = new FileOutputStream(new File(directory(), name + ".png"))) {
            assertTrue(frame.compress(Bitmap.CompressFormat.PNG, 100, output));
        }
        frame.recycle();
    }

    private void report(String name, JSONObject data) throws Exception {
        data.put("build", new JSONObject(eval("SurvivorBuild")));
        data.put("environment", "Android 15 arm64 emulator, signed release APK, native MotionEvent input");
        try (FileOutputStream output = new FileOutputStream(new File(directory(), name + ".json"))) {
            output.write(data.toString(2).getBytes(StandardCharsets.UTF_8));
        }
    }

    @Test
    public void prepareAndPause() throws Exception {
        launch();
        if ("false".equals(eval("document.getElementById('results').hidden"))) {
            tap("#menuBtn");
            waitFor("!document.getElementById('start').hidden");
        }
        if ("\"zh-CN\"".equals(eval("SurvivorI18n.getLocale()"))) tap("#start [data-language-toggle]");
        screenshot("01-start");
        JSONObject before = new JSONObject(eval("SurvivorDemo.profile()"));
        tap("#start [data-language-toggle]");
        waitFor("SurvivorI18n.getLocale()==='zh-CN'");
        assertEquals("\"zh-CN\"", eval("SurvivorI18n.getLocale()"));
        tap("#start [data-language-toggle]");
        waitFor("SurvivorI18n.getLocale()==='en'");
        assertEquals(before.toString(), new JSONObject(eval("SurvivorDemo.profile()")).toString());
        tap("#dockBtn");
        screenshot("02-refits");
        tap("#chooseLaunchBtn");
        tap("[data-launch-weapon='prism']");
        screenshot("03-starting-weapons");
        tap("#closeLaunchBtn");
        waitFor("!document.getElementById('dock').hidden");
        tap("#closeDockBtn");
        waitFor("!document.getElementById('start').hidden");
        tap("#startBtn");
        waitFor("SurvivorDemo.state()?.mode==='play' && !SurvivorDemo.saving()");
        JSONObject start = new JSONObject(eval("SurvivorDemo.state().p"));
        int[] origin = new int[2];
        instrument.runOnMainSync(() -> web.getLocationOnScreen(origin));
        float x = origin[0] + web.getWidth() * 0.78f;
        float y = origin[1] + web.getHeight() * 0.83f;
        long down = SystemClock.uptimeMillis();
        send(MotionEvent.ACTION_DOWN, down, x, y);
        for (int step = 0; step < 36; step++) {
            send(MotionEvent.ACTION_MOVE, down, x + web.getWidth() * 0.13f, y - web.getHeight() * 0.025f);
            SystemClock.sleep(45);
        }
        send(MotionEvent.ACTION_UP, down, x, y);
        JSONObject moved = new JSONObject(eval("SurvivorDemo.state().p"));
        double distance = Math.hypot(moved.getDouble("x") - start.getDouble("x"), moved.getDouble("y") - start.getDouble("y"));
        assertTrue("Native drag did not move the ship", distance > 50);
        screenshot("04-native-combat");
        instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
        waitFor("SurvivorDemo.state().mode==='pause' && !SurvivorDemo.saving()");
        screenshot("05-pause-audio");
        JSONObject paused = new JSONObject(eval("SurvivorDemo.store()"));
        tap("#pause [data-language-toggle]");
        tap("#pause [data-language-toggle]");
        assertEquals(paused.toString(), new JSONObject(eval("SurvivorDemo.store()")).toString());
        JSONObject result = new JSONObject().put("nativeDragWorldPixels", distance)
            .put("pauseViaAndroidBack", true).put("localeKeepsStore", true)
            .put("savedTime", paused.getJSONObject("active").getJSONObject("snapshot").getJSONObject("game").getDouble("time"))
            .put("missingTranslations", new org.json.JSONArray(eval("SurvivorI18n.missing()")));
        report("native-first-session", result);
        instrument.runOnMainSync(() -> activity.finish());
    }

    @Test
    public void resumeAfterProcessRestart() throws Exception {
        launch();
        screenshot("00-resume-start");
        waitFor("!document.getElementById('continueBtn').hidden");
        assertEquals("\"en\"", eval("SurvivorI18n.getLocale()"));
        JSONObject saved = new JSONObject(eval("SurvivorDemo.store()"));
        double time = saved.getJSONObject("active").getJSONObject("snapshot").getJSONObject("game").getDouble("time");
        tap("#continueBtn");
        waitFor("SurvivorDemo.state()?.mode==='play' && !SurvivorDemo.saving()");
        assertTrue(Double.parseDouble(eval("SurvivorDemo.state().time")) >= time);
        instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
        waitFor("SurvivorDemo.state().mode==='pause' && !SurvivorDemo.saving()");
        tap("#leaveBtn");
        waitFor("!document.getElementById('results').hidden && !SurvivorDemo.saving()");
        screenshot("06-native-results");
        assertEquals("null", eval("SurvivorDemo.store().active"));
        report("native-second-session", new JSONObject().put("resumeAfterProcessRestart", true)
            .put("restoredAtLeastSeconds", time).put("settledOnce", true)
            .put("profile", new JSONObject(eval("SurvivorDemo.profile()"))));
        instrument.runOnMainSync(() -> activity.finish());
    }
}
