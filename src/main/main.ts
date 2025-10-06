import { BimViewerApp } from "./BimViewerApp";

const CONTAINER_ID = "container";
let bimApp: BimViewerApp | null = null;

function getQueryParam(param: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

async function initializeApp(): Promise<void> {
  try {
    const project = getQueryParam("project") || "z06";
    bimApp = await BimViewerApp.create(CONTAINER_ID, project);
    (window as any).bimApp = bimApp;
  } catch (error) {
    console.error("Error initializing viewer:", error);
  } finally {
    hideLoadingSpinner();
  }
}

function hideLoadingSpinner(): void {
  const spinner = document.getElementById("loading-spinner");
  if (spinner) {
    spinner.style.transition = "opacity 0.5s ease";
    spinner.style.opacity = "0";
    setTimeout(() => {
      spinner.style.display = "none";
    }, 500);
  }
}

window.addEventListener("beforeunload", () => {
  bimApp?.dispose();
  bimApp = null;
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
