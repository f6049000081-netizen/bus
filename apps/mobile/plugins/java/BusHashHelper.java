package com.bus.app;

import android.telephony.PhoneNumberUtils;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * SHA-256 hash helper used by BusCallScreeningService (no React Native dependency).
 * Must match mobile hashing.ts: SHA256('bus-contacts-v1:' + e164).
 */
public class BusHashHelper {

    public static String hashForLookup(String rawNumber, String countryIso) {
        if (rawNumber == null || rawNumber.isEmpty()) return null;
        String stripped = rawNumber.trim().replaceAll("[\\s\\-().]", "");
        String e164 = null;

        if (stripped.startsWith("+")) {
            e164 = stripped;
        } else {
            try {
                e164 = PhoneNumberUtils.formatNumberToE164(
                    stripped, countryIso != null ? countryIso.toUpperCase() : "US");
            } catch (Exception ignored) {}
        }
        if (e164 == null) return null;

        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(("bus-contacts-v1:" + e164).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
