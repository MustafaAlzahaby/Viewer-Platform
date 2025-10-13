import { BimViewerApp } from "./BimViewerApp";
import { restoreViewerSession } from "../lib/supabase-viewer";

const CONTAINER_ID = "container";
let bimApp: BimViewerApp | null = null;

// ✅ Flag to indicate this is a viewer tab (set by viewer.html)
declare global {
  interface Window {
    isViewerTab?: boolean;
    currentProject?: any;
    restoredSession?: any;
    bimApp?: BimViewerApp;
  }
}

function getQueryParam(param: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

async function initializeApp(): Promise<void> {
  try {
    console.log('[Viewer] Initializing in isolated mode...');
    
    // ✅ STEP 1: Restore viewer session (now with isolation)
    console.log('[Viewer] Restoring session from main window...');
    await restoreViewerSession();
    console.log('[Viewer] Session restored successfully');

    // ✅ STEP 2: Get project data from sessionStorage OR window object (set by viewer.html)
    let projectData = null;
    let project = getQueryParam("project") || "z06"; // fallback
    
    // Try getting from window object first (set by viewer.html inline script)
    if (window.currentProject) {
      projectData = window.currentProject;
      console.log('[Viewer] Loaded project from window:', projectData.name);
    } else {
      // Fallback to sessionStorage
      const projectDataStr = sessionStorage.getItem('currentProject');
      if (projectDataStr) {
        try {
          projectData = JSON.parse(projectDataStr);
          console.log('[Viewer] Loaded project from sessionStorage:', projectData.name);
        } catch (parseError) {
          console.warn('[Viewer] Could not parse project data:', parseError);
        }
      }
    }
    
    // Extract project identifier
    if (projectData) {
      project = projectData.id || projectData.name || project;
      console.log('[Viewer] Using project:', project);
      console.log('[Viewer] Model URL:', projectData.model_url);
      console.log('[Viewer] Excel URL:', projectData.excel_url);
    } else {
      console.warn('[Viewer] No project data found, using fallback:', project);
    }

    // ✅ STEP 3: Initialize BIM viewer with project data
    bimApp = await BimViewerApp.create(CONTAINER_ID, project);
    window.bimApp = bimApp;
    
    // ✅ STEP 4: If you have additional project data, configure the viewer
    if (projectData) {
      // Example: Load specific model URL if available
      if (projectData.model_url && bimApp.loadModel) {
        console.log('[Viewer] Loading model from URL:', projectData.model_url);
        // await bimApp.loadModel(projectData.model_url);
      }
      
      // Example: Load Excel data if available
      if (projectData.excel_url && bimApp.loadExcelData) {
        console.log('[Viewer] Loading Excel data from:', projectData.excel_url);
        // await bimApp.loadExcelData(projectData.excel_url);
      }
    }
    
    console.log('[Viewer] BIM Viewer initialized successfully');
    
    // ✅ STEP 5: Clean up temporary session data after successful load
    setTimeout(() => {
      sessionStorage.removeItem('supabaseSession');
      console.log('[Viewer] Temporary session data cleared for security');
    }, 2000);
    
  } catch (error) {
    console.error("[Viewer] Error initializing viewer:", error);
    
    // Show user-friendly error message
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; color: #ef4444; text-align: center; padding: 20px;">
          <svg style="width: 64px; height: 64px; margin-bottom: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">Failed to Load Viewer</h2>
          <p style="color: #9ca3af; margin-bottom: 16px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
          <button onclick="window.location.reload()" style="background: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer;">
            Retry
          </button>
        </div>
      `;
    }
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

// ✅ Cleanup on tab close
window.addEventListener("beforeunload", () => {
  console.log('[Viewer] Cleaning up viewer resources...');
  
  // Dispose BIM viewer
  if (bimApp) {
    bimApp.dispose();
    bimApp = null;
  }
  
  // Clear all session data
  sessionStorage.removeItem('currentProject');
  sessionStorage.removeItem('supabaseSession');
  
  console.log('[Viewer] Cleanup complete');
});

// ✅ Handle visibility changes (tab switching)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('[Viewer] Tab hidden - pausing viewer');
    // Optional: Pause rendering or animations
    if (bimApp && (bimApp as any).pause) {
      (bimApp as any).pause();
    }
  } else {
    console.log('[Viewer] Tab visible - resuming viewer');
    // Optional: Resume rendering
    if (bimApp && (bimApp as any).resume) {
      (bimApp as any).resume();
    }
  }
});

// ✅ Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}