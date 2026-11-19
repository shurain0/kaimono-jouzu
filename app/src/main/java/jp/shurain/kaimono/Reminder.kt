package jp.shurain.kaimono

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * 通知のしくみ。
 * 「いつ・何を通知するか」の一覧（schedule.json）は画面側が保存のたびに作り直す。
 * ここでは毎日決まった時刻に起きて、日付が来たものを通知するだけ。
 * → 通知の種類やタイミングを変えるアップデートは画面側（JavaScript）だけで済む。
 */
object Reminder {
    const val CH_RATE = "rate"
    const val CH_GIFT = "gift"
    private const val LOOKBACK_DAYS = 14L

    fun hour(ctx: Context): Int = Store.prefs(ctx).getInt("hour", 20)

    fun setHour(ctx: Context, h: Int) {
        Store.prefs(ctx).edit().putInt("hour", h.coerceIn(0, 23)).apply()
        schedule(ctx)
    }

    fun channels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(
            NotificationChannel(CH_RATE, "満足度の記録", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "買ったものの満足度を記録するタイミングのお知らせ"
            }
        )
        nm.createNotificationChannel(
            NotificationChannel(CH_GIFT, "プレゼントの予定", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "誕生日などプレゼントを渡す日が近づいたときのお知らせ"
            }
        )
    }

    /** 次の「毎日の確認」を予約する（省電力中でも動く方法・特別な権限は不要） */
    fun schedule(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val now = LocalDateTime.now()
        var next = now.toLocalDate().atTime(hour(ctx), 0)
        if (!next.isAfter(now.plusSeconds(30))) next = next.plusDays(1)
        val at = next.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val pi = PendingIntent.getBroadcast(
            ctx, 1, Intent(ctx, AlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.cancel(pi)
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }

    fun allowed(ctx: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return false
        return nm.areNotificationsEnabled()
    }

    /** 日付が来た通知を出す。返り値は出した件数 */
    fun check(ctx: Context): Int {
        if (!allowed(ctx)) return 0
        channels(ctx)
        val list = Store.loadSchedule(ctx)
        val today = LocalDate.now()
        val from = today.minusDays(LOOKBACK_DAYS)
        val prefs = Store.prefs(ctx)
        val done = HashSet(prefs.getStringSet("notified", emptySet()) ?: emptySet())
        val alive = HashSet<String>()
        var count = 0
        for (i in 0 until list.length()) {
            val o = list.optJSONObject(i) ?: continue
            val key = o.optString("key")
            if (key.isEmpty()) continue
            alive.add(key)
            if (done.contains(key)) continue
            val at = try {
                LocalDate.parse(o.optString("at"))
            } catch (_: Exception) {
                continue
            }
            if (at.isAfter(today) || at.isBefore(from)) continue
            // 「あと◯日」のように、その日を過ぎると意味がなくなる通知は期限つき
            val until = o.optString("until")
            if (until.isNotEmpty()) {
                val u = try {
                    LocalDate.parse(until)
                } catch (_: Exception) {
                    null
                }
                if (u != null && today.isAfter(u)) continue
            }
            post(
                ctx, key, o.optString("title"), o.optString("text"),
                o.optString("route"), o.optString("ch", CH_RATE)
            )
            done.add(key)
            count++
        }
        // もう一覧にないもの（記録済みなど）は忘れて、記録が増え続けないようにする
        done.retainAll(alive)
        prefs.edit().putStringSet("notified", done).apply()
        return count
    }

    fun post(ctx: Context, key: String, title: String, text: String, route: String, ch: String) {
        channels(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        val open = Intent(ctx, MainActivity::class.java).apply {
            putExtra("route", route)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            ctx, key.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val n = Notification.Builder(ctx, if (ch == CH_GIFT) CH_GIFT else CH_RATE)
            .setSmallIcon(R.drawable.ic_notify)
            .setColor(0xFFD9653B.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        nm.notify(key.hashCode(), n)
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        try {
            Reminder.check(context)
        } finally {
            Reminder.schedule(context)
        }
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        Reminder.schedule(context)
    }
}
