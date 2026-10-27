
import { PhpCgiWorker } from "php-cgi-wasm/PhpCgiWorker";
import * as mbstring from "php-wasm-mbstring";

const BASE_PATH_RAW = new URL(self.registration.scope).pathname;
const BASE_PATH = BASE_PATH_RAW.endsWith("/") ? BASE_PATH_RAW : `${BASE_PATH_RAW}/`;

const PREFIX = BASE_PATH.replace(/\/$/, "") || "/";

console.log("[pukiwiki-wasm] Run cgi-worker.js");
console.log("[pukiwiki-wasm] scope:", self.registration.scope);
console.log("[pukiwiki-wasm] prefix:", PREFIX);

const php = new PhpCgiWorker({
  version: "8.4",
  prefix: PREFIX,
  docroot: "/persist/www",
  sharedLibs: [mbstring],

  types: {
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    txt: "text/plain",
    xml: "application/xml",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    ico: "image/x-icon",
    webp: "image/webp",
  },

  env: {
    SERVER_NAME: new URL(self.registration.scope).hostname,
    SERVER_PORT: new URL(self.registration.scope).port ||
      (new URL(self.registration.scope).protocol === "https:" ? "443" : "80"),
  },

  exclude: [
    `${BASE_PATH}index.html`,
    `${BASE_PATH}assets`,
    `${BASE_PATH}src`,
    `${BASE_PATH}pukiwiki`,
    `${BASE_PATH}pukiwiki-manifest.json`,
    `${BASE_PATH}cgi-worker.js`,
    `${BASE_PATH}settings`,
  ],

  rewrite(path) {
    if (path === PREFIX || path === `${PREFIX}/`)
      return `${PREFIX}/index.php`;

    return path;
  },

  onRequest(request, response) {
    console.log("[PHP-CGI]" + request.url +  "=>" + response.status);
  },

  notFound(request) {
    const url = new URL(request.url);

    const isEntryPoint = url.pathname === PREFIX
     || url.pathname === `${PREFIX}/` || url.pathname === `${PREFIX}/index.php`;

    if (isEntryPoint && request.mode === "navigate") {
      const url = new URL(`${BASE_PATH}index.html`, self.registration.scope);
      return Response.redirect(url, 302);
    }

    console.warn("[PHP-CGI] Not found:", request.url);

    return new Response("PHP-CGI: File not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  },

});

self.addEventListener("install", (event) => {
  php.handleInstallEvent(event);
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  php.handleActivateEvent(event);
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  php.handleFetchEvent(event);
});

self.addEventListener("message", (event) => {
  php.handleMessageEvent(event);
});
