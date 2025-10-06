import { BimViewerApp } from "./BimViewerApp";

const CONTAINER_ID = "container";
let bimApp: BimViewerApp | null = null;

interface ProjectData {
  id: string;
  name: string;
  description?: string;
  model_url?: string;
  excel_url?: string;
  baseline_data?: any;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Initialize the application
async function initializeApp(): Promise<void> {
  try {
    console.log("Initializing BIM Viewer...");

    // Check if project data was passed from the dashboard
    const projectDataString = sessionStorage.getItem('currentProject');
    let projectData: ProjectData | null = null;

    if (projectDataString) {
      try {
        projectData = JSON.parse(projectDataString);
        console.log("Project data found:", projectData);
        // Clear it so it doesn't persist
        sessionStorage.removeItem('currentProject');
      } catch (error) {
        console.error("Failed to parse project data:", error);
      }
    } else {
      console.warn("No project data found in sessionStorage - using default paths");
    }

    const containerElement = document.getElementById(CONTAINER_ID);
    if (!containerElement) {
      console.error("Container element not found");
    } else {
      console.log("Container found, initializing BIM Viewer...");
    }

    // Create the BIM viewer app instance with project data
    bimApp = await BimViewerApp.create(CONTAINER_ID, projectData);

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

function delayedInitializeApp() {
  setTimeout(() => {
    initializeApp();
  }, 1000); // 1 second delay to let files load
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", delayedInitializeApp);
} else {
  delayedInitializeApp();
}

