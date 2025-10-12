import { BimViewerApp } from "./BimViewerApp";
import { restoreViewerSession } from "../lib/supabase-viewer";

const CONTAINER_ID = "container";
let bimApp: BimViewerApp | null = null;

function getQueryParam(param: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

async function initializeApp(): Promise<void> {
  try {
    // ✅ STEP 1: Restore viewer session from sessionStorage
    console.log('[Viewer] Restoring session from main window...');
    await restoreViewerSession();
    console.log('[Viewer] Session restored successfully');

    // ✅ STEP 2: Get project data from sessionStorage (set by main window)
    const projectDataStr = sessionStorage.getItem('currentProject');
    let project = getQueryParam("project") || "z06"; // fallback
    
    if (projectDataStr) {
      try {
        const projectData = JSON.parse(projectDataStr);
        console.log('[Viewer] Loaded project from session:', projectData.name);
        // You can use projectData.id, projectData.model_url, etc.
        project = projectData.id || project;
      } catch (parseError) {
        console.warn('[Viewer] Could not parse project data:', parseError);
      }
    } else {
      console.warn('[Viewer] No project data found in sessionStorage');
    }

    // ✅ STEP 3: Initialize BIM viewer with project
    bimApp = await BimViewerApp.create(CONTAINER_ID, project);
    (window as any).bimApp = bimApp;
    
    console.log('[Viewer] BIM Viewer initialized successfully');
  } catch (error) {
    console.error("[Viewer] Error initializing viewer:", error);
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
  console.log('[Viewer] Cleaning up viewer resources...');
  bimApp?.dispose();
  bimApp = null;
  
  // Optional: Clear session data when viewer closes
  sessionStorage.removeItem('currentProject');
  sessionStorage.removeItem('supabaseSession');
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}