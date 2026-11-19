package jp.shurain.kaimono

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import java.io.File
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * データの保存場所。
 * 画面側（JavaScript）が作ったJSONを丸ごとファイルに保存するだけにしてあるので、
 * 項目を増やすアップデートをしてもネイティブ側の変更はいらない。
 */
object Store {
    private const val DATA = "data.json"
    private const val SCHEDULE = "schedule.json"
    private const val BACKUP_DIR = "backups"
    private const val KEEP_BACKUPS = 20

    fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences("kaimono", Context.MODE_PRIVATE)

    fun load(ctx: Context): String {
        val f = File(ctx.filesDir, DATA)
        return if (f.exists()) f.readText(Charsets.UTF_8) else ""
    }

    @Synchronized
    fun save(ctx: Context, json: String): Boolean {
        return try {
            writeAtomic(File(ctx.filesDir, DATA), json)
            backupDaily(ctx, json)
            true
        } catch (e: Exception) {
            false
        }
    }

    fun saveSchedule(ctx: Context, json: String) {
        try {
            writeAtomic(File(ctx.filesDir, SCHEDULE), json)
        } catch (_: Exception) {
        }
    }

    fun loadSchedule(ctx: Context): JSONArray {
        val f = File(ctx.filesDir, SCHEDULE)
        if (!f.exists()) return JSONArray()
        return try {
            JSONArray(f.readText(Charsets.UTF_8))
        } catch (_: Exception) {
            JSONArray()
        }
    }

    /** 1日1つ、自動でバックアップを残す（最新20日分） */
    private fun backupDaily(ctx: Context, json: String) {
        val dir = File(ctx.filesDir, BACKUP_DIR)
        if (!dir.exists()) dir.mkdirs()
        val name = "data-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + ".json"
        writeAtomic(File(dir, name), json)
        val files = dir.listFiles()?.filter { it.name.startsWith("data-") }?.sortedBy { it.name } ?: return
        if (files.size > KEEP_BACKUPS) files.take(files.size - KEEP_BACKUPS).forEach { it.delete() }
    }

    fun listBackups(ctx: Context): JSONArray {
        val arr = JSONArray()
        val dir = File(ctx.filesDir, BACKUP_DIR)
        dir.listFiles()?.filter { it.name.startsWith("data-") }?.sortedByDescending { it.name }
            ?.forEach { arr.put(it.name) }
        return arr
    }

    fun readBackup(ctx: Context, name: String): String {
        if (!name.matches(Regex("""data-\d{8}\.json"""))) return ""
        val f = File(File(ctx.filesDir, BACKUP_DIR), name)
        return if (f.exists()) f.readText(Charsets.UTF_8) else ""
    }

    private fun writeAtomic(f: File, text: String) {
        val tmp = File(f.parentFile, f.name + ".tmp")
        tmp.writeText(text, Charsets.UTF_8)
        if (!tmp.renameTo(f)) {
            f.delete()
            tmp.renameTo(f)
        }
    }
}
