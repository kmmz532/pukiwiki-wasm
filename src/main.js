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

async function downloadWorker(manifest, downloadedFiles, getNextIndex, onComplete) {
  while (true) {
    const index = getNextIndex();

    if (index >= manifest.files.length) return;

    const file = manifest.files[index];
    const encodedPath = file.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(new URL(`pukiwiki/${encodedPath}`, APP_BASE));

    if (!response.ok)
      throw new Error(`Failed to fetch file: ${file} (HTTP ${response.status})`);

    downloadedFiles[index] = {
      file,
      bytes: new Uint8Array(await response.arrayBuffer()),
    };

    onComplete();
  }
}

function getConcurrency() {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(4, Math.min(16, cores * 2));
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

  const concurrency = getConcurrency();
  let nextIndex = 0;
  let completed = 0;
  const downloadedFiles = new Array(manifest.files.length);

  const getNextIndex = () => nextIndex++;

  const onComplete = () => {
    completed++;
    if (completed % 25 === 0 || completed === manifest.files.length)
      console.log(`[pukiwiki-wasm] Downloaded ${completed}/${manifest.files.length} files`);
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, manifest.files.length) }, 
    () => downloadWorker(manifest, downloadedFiles, getNextIndex, onComplete)));

  for (const { file, bytes } of downloadedFiles) {
    await bus.writeFile(`${DOCUMENT_ROOT}/${file}`, bytes);
  }

  await bus.writeFile(MARKER, "installed");

  console.log(`[pukiwiki-wasm] Installed ${manifest.files.length} files`);
}

async function main() {
if (window.location.pathname !== APP_BASE.pathname) return;

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
