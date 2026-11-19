package jp.shurain.kaimono

import android.text.Html
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.Charset

/** ネット関係（商品ページからの情報取得・アップデート確認） */
object Net {
    const val REPO = "shurain0/kaimono-jouzu"
    private const val UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"

    private class Page(val url: String, val code: Int, val body: ByteArray, val contentType: String?)

    private fun get(start: String, accept: String, maxBytes: Int): Page {
        var url = start
        var hops = 0
        while (true) {
            val c = URL(url).openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 10000
            c.readTimeout = 15000
            c.setRequestProperty("User-Agent", UA)
            c.setRequestProperty("Accept", accept)
            c.setRequestProperty("Accept-Language", "ja-JP,ja;q=0.9,en;q=0.5")
            val code = c.responseCode
            if (code in 300..399 && hops < 8) {
                val loc = c.getHeaderField("Location")
                c.disconnect()
                if (loc.isNullOrEmpty()) return Page(url, code, ByteArray(0), null)
                url = URL(URL(url), loc).toString()
                hops++
                continue
            }
            val stream = (if (code >= 400) c.errorStream else c.inputStream)
            val out = ByteArrayOutputStream()
            stream?.use { s ->
                val buf = ByteArray(16384)
                while (out.size() < maxBytes) {
                    val n = s.read(buf)
                    if (n < 0) break
                    out.write(buf, 0, n)
                }
            }
            val ct = c.contentType
            c.disconnect()
            return Page(url, code, out.toByteArray(), ct)
        }
    }

    // ---------- 商品ページ ----------

    fun fetchMeta(url: String): JSONObject {
        val res = JSONObject()
        try {
            val p = get(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", 2_500_000)
            res.put("url", p.url)
            res.put("code", p.code)
            val html = decode(p.body, p.contentType)
            val title = firstOf(
                meta(html, "og:title"),
                byId(html, "productTitle"),
                byId(html, "title"),
                Regex("""<title[^>]*>([\s\S]*?)</title>""", RegexOption.IGNORE_CASE).find(html)?.groupValues?.get(1)
            )
            if (title != null) res.put("title", cleanTitle(title))
            val price = findPrice(html)
            if (price != null) res.put("price", price)
            val img = firstOf(
                Regex("""data-old-hires="(https[^"]+)"""").find(html)?.groupValues?.get(1),
                Regex(""""hiRes":"(https[^"]+)"""").find(html)?.groupValues?.get(1),
                meta(html, "og:image"),
                Regex("""id="landingImage"[^>]*src="(https[^"]+)"""").find(html)?.groupValues?.get(1)
            )
            if (img != null) res.put("image", img)
            res.put("ok", title != null)
        } catch (e: Exception) {
            res.put("ok", false)
            res.put("error", e.javaClass.simpleName + ": " + (e.message ?: ""))
        }
        return res
    }

    private fun decode(b: ByteArray, contentType: String?): String {
        var cs = contentType?.let { Regex("""charset=([\w-]+)""", RegexOption.IGNORE_CASE).find(it)?.groupValues?.get(1) }
        if (cs == null) {
            val head = String(b, 0, minOf(b.size, 4096), Charsets.ISO_8859_1)
            cs = Regex("""charset=["']?([\w-]+)""", RegexOption.IGNORE_CASE).find(head)?.groupValues?.get(1)
        }
        val charset = try {
            Charset.forName(cs ?: "UTF-8")
        } catch (_: Exception) {
            Charsets.UTF_8
        }
        return String(b, charset)
    }

    private fun meta(html: String, prop: String): String? {
        val p = Regex.escape(prop)
        val a = Regex("""<meta[^>]+(?:property|name)=["']$p["'][^>]*content=["']([^"']*)["']""", RegexOption.IGNORE_CASE)
        val b = Regex("""<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']$p["']""", RegexOption.IGNORE_CASE)
        return (a.find(html) ?: b.find(html))?.groupValues?.get(1)?.takeIf { it.isNotBlank() }
    }

    private fun byId(html: String, id: String): String? {
        val m = Regex("""<[a-z0-9]+[^>]*\bid=["']${Regex.escape(id)}["'][^>]*>([\s\S]{1,600}?)</""", RegexOption.IGNORE_CASE)
            .find(html) ?: return null
        val t = m.groupValues[1].replace(Regex("<[^>]+>"), " ").trim()
        return t.ifEmpty { null }
    }

    private fun findPrice(html: String): Int? {
        val cands = listOf(
            Regex("""class="a-price-whole">\s*([\d,]+)"""),
            Regex(""""priceAmount"\s*:\s*([\d.]+)"""),
            Regex("""(?:product|og):price:amount["'][^>]*content=["']([\d.,]+)"""),
            Regex("""itemprop=["']price["'][^>]*content=["']([\d.,]+)"""),
            Regex(""""price"\s*:\s*"?([\d.]+)"?""")
        )
        for (r in cands) {
            val s = r.find(html)?.groupValues?.get(1) ?: continue
            val v = s.replace(",", "").toDoubleOrNull() ?: continue
            if (v >= 1 && v < 100_000_000) return v.toInt()
        }
        return null
    }

    private fun firstOf(vararg s: String?): String? = s.firstOrNull { !it.isNullOrBlank() }

    @Suppress("DEPRECATION")
    private fun cleanTitle(raw: String): String {
        var t = Html.fromHtml(raw, Html.FROM_HTML_MODE_LEGACY).toString()
        t = t.replace(Regex("""\s+"""), " ").trim()
        t = t.replace(Regex("""^Amazon\.co\.jp\s*[:：]\s*"""), "")
        t = t.replace(Regex("""^Amazon\.co\.jp\s*[|｜]\s*"""), "")
        // 「商品名 : カテゴリ」の後ろを落とす
        t = t.replace(Regex("""\s+:\s+[^:]{1,40}$"""), "")
        t = t.replace(Regex("""\s*[|｜]\s*(Amazon|楽天市場|Yahoo!ショッピング)[^|｜]*$"""), "")
        t = t.replace(Regex("""^【楽天市場】"""), "")
        return t.trim()
    }

    // ---------- アップデート確認 ----------

    fun latestRelease(): JSONObject {
        val res = JSONObject()
        try {
            val p = get("https://api.github.com/repos/$REPO/releases/latest", "application/vnd.github+json", 1_000_000)
            if (p.code != 200) {
                res.put("ok", false)
                res.put("error", "HTTP ${p.code}")
                return res
            }
            val j = JSONObject(String(p.body, Charsets.UTF_8))
            val tag = j.optString("tag_name")
            res.put("ok", true)
            res.put("tag", tag)
            res.put("number", tag.filter { it.isDigit() }.toIntOrNull() ?: 0)
            res.put("body", j.optString("body"))
            res.put("page", j.optString("html_url"))
            val assets = j.optJSONArray("assets")
            if (assets != null) {
                for (i in 0 until assets.length()) {
                    val a = assets.getJSONObject(i)
                    if (a.optString("name").endsWith(".apk")) {
                        res.put("apk", a.optString("browser_download_url"))
                        break
                    }
                }
            }
        } catch (e: Exception) {
            res.put("ok", false)
            res.put("error", e.javaClass.simpleName)
        }
        return res
    }
}
