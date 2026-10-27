import { Client } from "quickbus";

const status = document.querySelector("#status");
const uninstallButton = document.querySelector("#uninstall");

uninstallButton.addEventListener("click", async () => {
  setStatus("Uninstalling...");
  uninstallButton.disabled = true;
  try {
      const registration = await navigator.serviceWorker.ready;
      const bus = navigator.serviceWorker.controller ? Client.forServiceWorker(navigator.serviceWorker) : Client.forServiceWorkerRegistration(registration);

      await bus.rm("/persist");
      setStatus("Successfully uninstalled. Reloading...");
      location.reload();
  } catch (e) {
      console.error("[pukiwiki-wasm] Uninstallation failed:", e);
      uninstallButton.disabled = false;
  }
});

function setStatus(msg) {
  status.textContent = msg;
}
