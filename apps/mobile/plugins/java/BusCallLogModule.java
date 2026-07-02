package com.bus.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CallLog;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.HashMap;
import java.util.Map;

/**
 * Reads Android call log + SMS inbox to produce per-contact communication
 * frequency counts for the last 7, 30, and 90 days.
 * Exposed to JS as NativeModules.BusCallLog.
 */
public class BusCallLogModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public BusCallLogModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() { return "BusCallLog"; }

    @ReactMethod
    public void getFrequencies(Promise promise) {
        try {
            long now       = System.currentTimeMillis();
            long weekAgo   = now - 7L  * 86_400_000L;
            long monthAgo  = now - 30L * 86_400_000L;
            long ninetyAgo = now - 90L * 86_400_000L;

            // number -> [weekCount, monthCount, totalCount]
            Map<String, int[]> counts = new HashMap<>();
            ContentResolver cr = reactContext.getContentResolver();

            // ── Call log ─────────────────────────────────────────────────
            if (ContextCompat.checkSelfPermission(reactContext,
                    Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED) {
                try (Cursor c = cr.query(
                        CallLog.Calls.CONTENT_URI,
                        new String[]{CallLog.Calls.NUMBER, CallLog.Calls.DATE},
                        CallLog.Calls.DATE + " > ?",
                        new String[]{String.valueOf(ninetyAgo)},
                        null)) {
                    if (c != null) {
                        int iNum  = c.getColumnIndexOrThrow(CallLog.Calls.NUMBER);
                        int iDate = c.getColumnIndexOrThrow(CallLog.Calls.DATE);
                        while (c.moveToNext()) {
                            String num = c.getString(iNum);
                            long   ts  = c.getLong(iDate);
                            if (num == null || num.isEmpty()) continue;
                            int[] cnt = getOrCreate(counts, num);
                            cnt[2]++;
                            if (ts >= monthAgo) cnt[1]++;
                            if (ts >= weekAgo)  cnt[0]++;
                        }
                    }
                }
            }

            // ── SMS (sent + received) ─────────────────────────────────────
            boolean hasSms = ContextCompat.checkSelfPermission(reactContext,
                    Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
            if (hasSms) {
                for (String box : new String[]{"content://sms/inbox", "content://sms/sent"}) {
                    try (Cursor c = cr.query(
                            Uri.parse(box),
                            new String[]{"address", "date"},
                            "date > ?",
                            new String[]{String.valueOf(ninetyAgo)},
                            null)) {
                        if (c != null) {
                            int iAddr = c.getColumnIndex("address");
                            int iDate = c.getColumnIndex("date");
                            if (iAddr < 0 || iDate < 0) continue;
                            while (c.moveToNext()) {
                                String num = c.getString(iAddr);
                                long   ts  = c.getLong(iDate);
                                if (num == null || num.isEmpty()) continue;
                                int[] cnt = getOrCreate(counts, num);
                                cnt[2]++;
                                if (ts >= monthAgo) cnt[1]++;
                                if (ts >= weekAgo)  cnt[0]++;
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }

            // ── Build JS result ───────────────────────────────────────────
            WritableArray result = Arguments.createArray();
            for (Map.Entry<String, int[]> e : counts.entrySet()) {
                WritableMap item = Arguments.createMap();
                item.putString("number",      e.getKey());
                item.putInt("weekCount",  e.getValue()[0]);
                item.putInt("monthCount", e.getValue()[1]);
                item.putInt("totalCount", e.getValue()[2]);
                result.pushMap(item);
            }
            promise.resolve(result);

        } catch (Exception e) {
            promise.reject("ERR_CALL_LOG", e.getMessage(), e);
        }
    }

    private static int[] getOrCreate(Map<String, int[]> map, String key) {
        int[] v = map.get(key);
        if (v == null) { v = new int[3]; map.put(key, v); }
        return v;
    }
}
