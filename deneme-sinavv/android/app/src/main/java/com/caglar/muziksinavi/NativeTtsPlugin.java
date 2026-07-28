package com.caglar.muziksinavi;

import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "NativeTts")
public class NativeTtsPlugin extends Plugin implements TextToSpeech.OnInitListener {
    private TextToSpeech textToSpeech;
    private boolean initialized = false;
    private boolean initializationFailed = false;
    private PluginCall waitingCall;
    private String waitingText;
    private float waitingRate = 0.85f;
    private String activeUtteranceId;

    @Override
    public void load() {
        textToSpeech = new TextToSpeech(getContext(), this);
    }

    @Override
    public void onInit(int status) {
        initialized = status == TextToSpeech.SUCCESS;
        initializationFailed = !initialized;

        if (initialized) {
            textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                }

                @Override
                public void onDone(String utteranceId) {
                    finishCall(utteranceId, false);
                }

                @Override
                public void onError(String utteranceId) {
                    failCall(utteranceId, "Sesli okuma sırasında cihaz motoru hata verdi.");
                }

                @Override
                public void onError(String utteranceId, int errorCode) {
                    failCall(utteranceId, "Sesli okuma sırasında cihaz motoru hata verdi (" + errorCode + ").");
                }

                @Override
                public void onStop(String utteranceId, boolean interrupted) {
                    finishCall(utteranceId, true);
                }
            });
        }

        PluginCall call = waitingCall;
        if (call == null) {
            return;
        }
        if (initializationFailed) {
            clearWaiting();
            call.reject("Android sesli okuma motoru başlatılamadı.");
            return;
        }
        String text = waitingText;
        float rate = waitingRate;
        clearWaiting();
        speakNow(call, text, rate);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.reject("Okunacak metin boş.");
            return;
        }

        double requestedRate = call.getDouble("rate", 0.85);
        float rate = (float) Math.max(0.50, Math.min(2.00, requestedRate));

        stopActiveSpeech();
        if (initializationFailed) {
            call.reject("Android sesli okuma motoru başlatılamadı.");
        } else if (!initialized) {
            if (waitingCall != null) {
                waitingCall.resolve(stoppedResult());
            }
            waitingCall = call;
            waitingText = text;
            waitingRate = rate;
        } else {
            speakNow(call, text, rate);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopActiveSpeech();
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent("com.android.settings.TTS_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception firstError) {
            try {
                Intent intent = new Intent(Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception secondError) {
                call.reject("Sesli okuma ayarları açılamadı.", secondError);
            }
        }
    }

    private void speakNow(PluginCall call, String text, float rate) {
        int languageResult = textToSpeech.setLanguage(new Locale("tr", "TR"));
        if (languageResult == TextToSpeech.LANG_MISSING_DATA
                || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
            call.reject("Cihazda Türkçe ses verisi kurulu değil.");
            return;
        }

        textToSpeech.setSpeechRate(rate);
        textToSpeech.setPitch(1.0f);
        activeUtteranceId = UUID.randomUUID().toString();
        waitingCall = call;

        Bundle parameters = new Bundle();
        int result = textToSpeech.speak(
                text,
                TextToSpeech.QUEUE_FLUSH,
                parameters,
                activeUtteranceId
        );
        if (result == TextToSpeech.ERROR) {
            PluginCall failedCall = waitingCall;
            clearWaiting();
            if (failedCall != null) {
                failedCall.reject("Metin Android sesli okuma motoruna gönderilemedi.");
            }
        }
    }

    private void stopActiveSpeech() {
        if (textToSpeech != null) {
            textToSpeech.stop();
        }
        PluginCall call = waitingCall;
        clearWaiting();
        if (call != null) {
            call.resolve(stoppedResult());
        }
    }

    private void finishCall(String utteranceId, boolean stopped) {
        if (activeUtteranceId == null || !activeUtteranceId.equals(utteranceId)) {
            return;
        }
        PluginCall call = waitingCall;
        clearWaiting();
        if (call != null) {
            JSObject result = new JSObject();
            result.put("stopped", stopped);
            call.resolve(result);
        }
    }

    private void failCall(String utteranceId, String message) {
        if (activeUtteranceId == null || !activeUtteranceId.equals(utteranceId)) {
            return;
        }
        PluginCall call = waitingCall;
        clearWaiting();
        if (call != null) {
            call.reject(message);
        }
    }

    private JSObject stoppedResult() {
        JSObject result = new JSObject();
        result.put("stopped", true);
        return result;
    }

    private void clearWaiting() {
        waitingCall = null;
        waitingText = null;
        activeUtteranceId = null;
    }

    @Override
    protected void handleOnDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        super.handleOnDestroy();
    }
}
