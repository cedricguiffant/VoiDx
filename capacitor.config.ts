import type { CapacitorConfig } from "@capacitor/cli";

/**
 * VoiDx est une app Next.js avec des routes API serveur (auth, récompenses)
 * et Supabase : elle NE PEUT PAS tourner entièrement dans l'APK.
 * L'APK est donc un shell natif qui charge l'app web depuis un serveur.
 *
 * Configure l'URL du serveur via la variable CAP_SERVER_URL au moment du
 * `npx cap sync`, sinon on utilise l'IP LAN de la machine de dev (utile pour
 * tester sur un téléphone connecté au même WiFi avec `npm run dev -H 0.0.0.0`).
 *
 * En production : mets une URL HTTPS (ton hébergement) et retire cleartext.
 */
const serverUrl = process.env.CAP_SERVER_URL || "http://192.168.1.17:3000";
const isHttps = serverUrl.startsWith("https://");

const config: CapacitorConfig = {
  appId: "app.voidx.mobile",
  appName: "VoiDx",
  webDir: "www",
  server: {
    url: serverUrl,
    // Autorise le HTTP en clair uniquement pour le dev LAN (http://...).
    cleartext: !isHttps,
    androidScheme: isHttps ? "https" : "http",
  },
};

export default config;
