import { BimViewerApp } from "./BimViewerApp";

const CONTAINER_ID = "container";
let bimApp: BimViewerApp | null = null;

// Initialize the application
async function initializeApp(): Promise<void> {
  try {
    console.log("Initializing BIM Viewer...");

    // Create the BIM viewer app instance
    bimApp = await BimViewerApp.create(CONTAINER_ID);

    // Make app globally available for debugging and external access
    (window as any).bimApp = bimApp;

    console.log("BIM Viewer Application started successfully!");

    // Optional: Set up additional event listeners or configurations
    //  setupAdditionalFeatures();
  } catch (error) {
    console.error("Failed to start BIM Viewer Application:", error);
  } finally {
    // Hide the loading spinner
    hideLoadingSpinner();
  }
}

// Hide loading spinner
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

// Graceful cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (bimApp) {
    bimApp.dispose();
    bimApp = null;  
  }
});

// Start the application when the DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
