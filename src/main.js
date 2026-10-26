import { Client } from "quickbus";

const BASE_URL = import.meta.env.BASE_URL;
const APP_BASE = new URL(BASE_URL, window.location.href);

const DOCUMENT_ROOT = "/persist/www";
const MARKER = `${DOCUMENT_ROOT}/.pukiwiki-wasm-installed`;

async function ensureDirectory(bus, directory) {
  const parts = directory.split("/").filter(Boolean);
  let current = "";

  for (const part of parts) {
    current += `/${part}`;

    try {
      await bus.readdir(current);
    } catch {
      await bus.mkdir(current);
    }
  }
}

async function isInstalled(bus) {
  try {
    await bus.readFile(MARKER);
    return true;
  } catch {
    return false;
  }
}

async function installPukiWiki(bus) {
  const manifestUrl = new URL("pukiwiki-manifest.json", APP_BASE);
  const manifestResponse = await fetch(manifestUrl);

  if (!manifestResponse.ok)
    throw new Error(`Failed to fetch manifest: HTTP ${manifestResponse.status}`);

  const manifest = await manifestResponse.json();

  if (!manifest.files.includes("index.php"))
    throw new Error("Manifest does not contain index.php");

  await ensureDirectory(bus, DOCUMENT_ROOT);

  for (const directory of manifest.dirs) {
    await ensureDirectory(bus, `${DOCUMENT_ROOT}/${directory}`);
  }

  for (const file of manifest.files) {
    const encodedPath = file.split("/").map(encodeURIComponent).join("/");
    const sourceUrl = new URL(`pukiwiki/${encodedPath}`, APP_BASE);
    const response = await fetch(sourceUrl);

    if (!response.ok)
      throw new Error(`Failed to fetch file: ${file} (HTTP ${response.status})`);

    const bytes = new Uint8Array(await response.arrayBuffer());
    await bus.writeFile(`${DOCUMENT_ROOT}/${file}`, bytes);
  }

  await bus.writeFile(MARKER, "installed");
}

async function main() {
  if (!("serviceWorker" in navigator))
    throw new Error("This browser does not support Service Workers.");

  const workerFile = (import.meta.env.DEV ? "src/" : "") + "cgi-worker.js";
  const workerUrl = new URL(workerFile, APP_BASE);
  const registration = await navigator.serviceWorker.register(workerUrl, {
    type: "module",
    scope: APP_BASE.pathname,
  });

  await navigator.serviceWorker.ready;

  if (!registration.active)
    throw new Error("Service Worker is not active yet. Please reload the page.");

  const bus = navigator.serviceWorker.controller
    ? Client.forServiceWorker(navigator.serviceWorker)
    : Client.forServiceWorkerRegistration(registration);

  if (!(await isInstalled(bus))) await installPukiWiki(bus);
  window.location.href = new URL("?", APP_BASE).href;
}

main().catch((error) => {
  console.error("[pukiwiki-wasm] Failed to initialize:", error);
});