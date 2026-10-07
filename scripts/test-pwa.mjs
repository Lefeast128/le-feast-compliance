import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`PWA test failed: ${message}`);
};

const manifest = JSON.parse(read("public/manifest.webmanifest"));
assert(manifest.name === "Le Feast Compliance", "manifest name");
assert(manifest.short_name === "Le Feast", "manifest short name");
assert(manifest.start_url === "/", "manifest start URL");
assert(manifest.scope === "/", "manifest scope");
assert(manifest.display === "standalone", "manifest standalone display");
assert(manifest.orientation === "any", "manifest orientation");
assert(manifest.theme_color === "#ffde59", "manifest theme colour");

const iconSizes = new Set();
for (const icon of manifest.icons) {
  const iconPath = resolve(root, `public${icon.src}`);
  assert(existsSync(iconPath), `manifest icon exists: ${icon.src}`);
  const png = readFileSync(iconPath);
  assert(
    png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    `PNG signature: ${icon.src}`,
  );
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert(`${width}x${height}` === icon.sizes, `PNG dimensions: ${icon.src}`);
  iconSizes.add(icon.sizes);
}
assert(iconSizes.has("192x192"), "192 icon");
assert(iconSizes.has("512x512"), "512 icon");
assert(manifest.icons.some((icon) => icon.purpose === "maskable"), "maskable icon");
assert(existsSync(resolve(root, "public/icons/apple-touch-icon.png")), "Apple touch icon");

const index = read("index.html");
assert(index.includes('apple-mobile-web-app-capable" content="yes"'), "iOS capable metadata");
assert(index.includes('apple-mobile-web-app-status-bar-style" content="default"'), "iOS status bar metadata");
assert(index.includes('apple-touch-icon"'), "Apple touch icon link");
assert(index.includes("viewport-fit=cover"), "safe-area viewport metadata");

const viteConfig = read("vite.config.ts");
assert(viteConfig.includes('fileName: "sw.js"'), "production service worker emitted");
assert(viteConfig.includes("__APP_VERSION__"), "build version injected");

const serviceWorker = read("src/pwa/sw-template.js");
assert(serviceWorker.includes("cache.addAll(SHELL_ASSETS)"), "static shell precache");
assert(serviceWorker.includes(".filter("), "old cache cleanup");
assert(serviceWorker.includes('url.pathname.startsWith("/api/")'), "API requests excluded");
assert(!serviceWorker.includes("indexedDB"), "no offline database");
assert(!serviceWorker.includes("sync"), "no background mutation sync");
assert(!serviceWorker.includes("/api/documents"), "private documents not precached");

const pwaRegister = read("src/pwa/register.ts");
assert(pwaRegister.includes('.register("/sw.js"'), "service worker registration");
assert(pwaRegister.includes("SKIP_WAITING"), "controlled update message");
assert(pwaRegister.includes("display-mode: standalone"), "standalone detection");

const pwaStatus = read("src/components/PwaStatus.tsx");
assert(pwaStatus.includes("offline") && pwaStatus.includes("Reconnect to continue"), "offline banner");
assert(pwaStatus.includes("beforeinstallprompt"), "install prompt capture");
assert(pwaStatus.includes("Share → Add to Home Screen"), "iOS install guidance");
assert(pwaStatus.includes("A new version of Le Feast Compliance is available."), "update notice");
assert(pwaStatus.includes("Version {APP_VERSION}"), "build version visibility");

const apiClient = read("src/lib/api-client.ts");
assert(apiClient.includes("OFFLINE_MUTATION_MESSAGE"), "offline mutation message");
assert(apiClient.includes('navigator.onLine === false'), "offline mutation guard");
assert(apiClient.includes('["GET", "HEAD", "OPTIONS"]'), "read methods remain available offline");
assert(!apiClient.includes("indexedDB"), "no mutation queue in API client");

const css = read("src/index.css");
assert(css.includes("100dvh"), "dynamic viewport height");
assert(css.includes("safe-area-inset"), "safe-area CSS support");

console.log("PWA foundation tests passed");
