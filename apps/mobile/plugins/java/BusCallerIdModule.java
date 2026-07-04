package com.bus.app;

import android.app.Activity;
import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BusCallerIdModule extends ReactContextBaseJavaModule implements ActivityEventListener {

    private static final int REQUEST_CODE = 4242;
    private Promise pendingPromise;

    public BusCallerIdModule(ReactApplicationContext ctx) {
        super(ctx);
        ctx.addActivityEventListener(this);
    }

    @Override
    public String getName() { return "BusCallerId"; }

    /** Ask Android to grant the CALL_SCREENING role to this app. */
    @ReactMethod
    public void requestCallScreeningRole(Promise promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.resolve("UNSUPPORTED");
            return;
        }
        Activity activity = getCurrentActivity();
        if (activity == null) { promise.reject("NO_ACTIVITY", "No current activity"); return; }

        RoleManager rm = (RoleManager) activity.getSystemService(Context.ROLE_SERVICE);
        if (rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
            promise.resolve("GRANTED");
            return;
        }
        pendingPromise = promise;
        activity.startActivityForResult(
            rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), REQUEST_CODE);
    }

    @ReactMethod
    public void isCallScreeningEnabled(Promise promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.resolve(false);
            return;
        }
        Activity activity = getCurrentActivity();
        if (activity == null) { promise.resolve(false); return; }
        RoleManager rm = (RoleManager) activity.getSystemService(Context.ROLE_SERVICE);
        promise.resolve(rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING));
    }

    /**
     * Called after contact sync — stores hash→name map in SharedPreferences
     * so BusCallScreeningService can identify callers without network access.
     */
    @ReactMethod
    public void updateContactCache(String json, Promise promise) {
        prefs().edit().putString(BusCallScreeningService.KEY_CACHE, json).apply();
        promise.resolve(null);
    }

    /**
     * Stores the JWT access token and API base URL so BusCallScreeningService
     * can fall back to the API for callers not in the local cache.
     * countryIso: 2-letter ISO e.g. "ET" used for phone number normalization.
     */
    @ReactMethod
    public void saveCredentials(String token, String apiUrl, String countryIso, Promise promise) {
        prefs().edit()
            .putString(BusCallScreeningService.KEY_TOKEN, token)
            .putString(BusCallScreeningService.KEY_API_URL, apiUrl)
            .putString(BusCallScreeningService.KEY_COUNTRY, countryIso)
            .apply();
        promise.resolve(null);
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_CODE && pendingPromise != null) {
            pendingPromise.resolve(resultCode == Activity.RESULT_OK ? "GRANTED" : "DENIED");
            pendingPromise = null;
        }
    }

    @Override
    public void onNewIntent(Intent intent) {}

    private SharedPreferences prefs() {
        return getReactApplicationContext()
            .getSharedPreferences(BusCallScreeningService.PREFS_NAME, Context.MODE_PRIVATE);
    }
}
