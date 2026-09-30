package jp.kachimake.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * ホーム画面のウィジェット: 今月の収支・勝敗・回収率。
 * アプリが Preferences(SharedPreferences "CapacitorStorage")に保存した記入をそのまま読む。
 * アプリを閉じたとき(MainActivity.onPause)と30分ごとに描き直す。
 */
public class MonthWidget extends AppWidgetProvider {
    private static final String PREFS = "CapacitorStorage";
    private static final String KEY = "kachimake.data.v1";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    /** アプリ側から呼ぶ。置かれているウィジェットを全部描き直す */
    public static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MonthWidget.class));
        if (ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_month);
        Calendar now = Calendar.getInstance();
        int month = now.get(Calendar.MONTH) + 1;
        String prefix = String.format(Locale.US, "%04d-%02d-", now.get(Calendar.YEAR), month);
        long invest = 0, payout = 0;
        int wins = 0, losses = 0, count = 0;
        boolean inkWin = false;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String json = prefs.getString(KEY, null);
            if (json != null) {
                JSONObject data = new JSONObject(json);
                JSONArray sessions = data.optJSONArray("sessions");
                for (int i = 0; sessions != null && i < sessions.length(); i++) {
                    JSONObject s = sessions.getJSONObject(i);
                    if (!s.optString("date").startsWith(prefix)) continue;
                    long in = s.optLong("invest"), out = s.optLong("payout");
                    invest += in;
                    payout += out;
                    count++;
                    if (out > in) wins++;
                    else if (out < in) losses++;
                }
                JSONObject settings = data.optJSONObject("settings");
                inkWin = settings != null && "blue".equals(settings.optString("winColor"));
            }
        } catch (Exception e) {
            // 読めなければ 0 のまま出す(ウィジェットで落ちない)
        }
        long profit = payout - invest;
        NumberFormat nf = NumberFormat.getIntegerInstance(Locale.JAPAN);
        String amount = profit > 0 ? "+¥" + nf.format(profit) : profit < 0 ? "-¥" + nf.format(-profit) : "±¥0";
        int color = profit > 0 ? (inkWin ? 0xFF1C1C1E : 0xFF1F7CF0) : profit < 0 ? 0xFFF0383B : 0xFF8A8A8F;
        v.setTextViewText(R.id.widget_title, month + "月の収支");
        v.setTextViewText(R.id.widget_amount, amount);
        v.setTextColor(R.id.widget_amount, color);
        String meta = count == 0 ? "タップして記入"
            : wins + "勝" + losses + "敗" + (invest > 0 ? "・回収率 " + Math.round(payout * 100.0 / invest) + "%" : "");
        v.setTextViewText(R.id.widget_meta, meta);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        return v;
    }
}
