import { HiderPanel } from "../core/HiderPanel";
import { HighlightController } from "../core/HighlightController";
import { Highlighter } from "../core/Highlighter";
import { ModelManager } from "../core/ModelManager";
import { SceneManager } from "../core/SceneManager";
import { ExcelDataPanel } from "../core/ExcelDataPanel";
import { ViewsManager } from "../core/ViewsManager";
import { RightPanelsContainer } from "../core/RightPanelsContainer";
import { DetailsWindow } from "../core/DetailsWindow";

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

export class BimViewerApp {
  private sceneManager: SceneManager;
  private modelManager!: ModelManager;
  private excelPanel!: ExcelDataPanel;
  private hider!: HiderPanel;
  private controller!: HighlightController;
  private viewsManager!: ViewsManager;
  private rightPanelsContainer!: RightPanelsContainer;
  private detailsWindow!: DetailsWindow;
  private projectData: ProjectData | null;

  constructor(containerId: string, projectData: ProjectData | null = null) {
    this.sceneManager = new SceneManager(containerId);
    this.projectData = projectData;
  }

  public static async create(containerId: string, projectData: ProjectData | null = null): Promise<BimViewerApp> {
    const app = new BimViewerApp(containerId, projectData);
    await app.initialize();
    return app;
  }

    private async initialize(): Promise<void> {
    console.log("[BimViewerApp] Starting initialization...");

    if (this.projectData) {
      console.log("[BimViewerApp] Loading project:", this.projectData.name);
    } else {
      console.log("[BimViewerApp] No project data - using default paths");
    }

    // Determine paths based on project data or use defaults
    const excelUrl = this.projectData?.excel_url || "./excel-sheet/data.xlsx";
    const configUrl = "./config.json";
    const guidsUrl = "./guids/guids.json";

    console.log("[BimViewerApp] Excel URL:", excelUrl);

    // Initialize core components
    this.modelManager = await ModelManager.create(this.sceneManager.world, this.sceneManager.components);
    console.log("[BimViewerApp] ModelManager created");

    this.hider = new HiderPanel(this.sceneManager.components, this.modelManager.fragmentManager);
    console.log("[BimViewerApp] HiderPanel created");

    // ✅ Wait for ALL fragments to fully load and be ready
    console.log("[BimViewerApp] Waiting for fragments to load...");
    await new Promise<void>(resolve => {
      let lastSize = 0;
      let stableCount = 0;

      const checkReady = () => {
        const currentSize = this.modelManager.fragmentManager.list.size;

        // Check if we have fragments and the count has stabilized
        if (currentSize > 0) {
          if (currentSize === lastSize) {
            stableCount++;
            // Wait for 3 consecutive checks with same size (300ms total)
            if (stableCount >= 3) {
              console.log(`[BimViewerApp] Fragments loaded and stable (${currentSize} fragments)`);
              // Add extra delay to ensure all geometry is processed
              setTimeout(() => resolve(), 500);
              return;
            }
          } else {
            stableCount = 0;
            lastSize = currentSize;
          }
        }

        setTimeout(checkReady, 100);
      };

      checkReady();
    });

    // ✅ Initialize highlight controller AFTER fragments are ready
    console.log("[BimViewerApp] Initializing HighlightController...");
    this.controller = new HighlightController(this.modelManager, this.hider);

    console.log("[BimViewerApp] Loading config and data from:", excelUrl);
    await this.controller.initialize(configUrl, excelUrl, guidsUrl);

    console.log("[BimViewerApp] Refreshing processed data...");
    await this.controller.refreshProcessedData();

    console.log("[BimViewerApp] HighlightController ready");

    // ✅ Views Manager
    this.viewsManager = new ViewsManager(this.sceneManager.components, this.sceneManager.world);

    // ✅ UI Panels
    this.rightPanelsContainer = new RightPanelsContainer(this.hider, this.viewsManager);
    this.rightPanelsContainer.initialize();

    console.log("[BimViewerApp] Loading Excel panel from:", excelUrl);
    this.excelPanel = new ExcelDataPanel("container");
    await this.excelPanel.loadExcelData(excelUrl, "Activity Name", "Performance % Complete");
    this.excelPanel.addSearchBox();
    this.setupExcelIntegration();
    console.log("[BimViewerApp] Excel panel ready");

    this.detailsWindow = new DetailsWindow(this.sceneManager, this.modelManager, this.controller);

    console.log("[BimViewerApp] Initialization complete!");
  }


  private setupExcelIntegration(): void {
    // Listen for Excel row selection events
    document.addEventListener("excelRowSelected", (event: any) => {
      const { data, index } = event.detail;
      console.log("Excel row selected in BIM viewer:", data);

      // Example: Highlight BIM elements based on Excel data
      // You can customize this based on your specific requirements
      if (data["Element ID"]) {
        this.highlightBimElement(data["Element ID"], data);
      }
    });

    // Example: Add keyboard shortcuts for Excel panel
    document.addEventListener("keydown", (event) => {
      if (event.key === "E" && event.ctrlKey) {
        event.preventDefault();
        this.toggleExcelPanel();
      }
    });
  }

  private highlightBimElement(elementId: string, excelData: any): void {
    // Example implementation - customize based on your highlighting logic
    try {
      // You can use your existing Highlighter or HighlightController here
      // const highlight = new Highlighter(this.modelManager, this.hider);
      // highlight.highlight(elementId, levels, types, status);

      console.log(`Highlighting BIM element: ${elementId}`, excelData);

      // Example: Update BIM model based on Excel data
      // This is where you'd integrate with your existing highlighting system
    } catch (error) {
      console.error("Error highlighting BIM element:", error);
    }
  }

  // Public methods for controlling the Excel panel
  public toggleExcelPanel(): void {
    const panel = document.getElementById("excel-data-panel");
    if (panel) {
      const isVisible = panel.style.display !== "none";
      if (isVisible) {
        this.excelPanel.hide();
      } else {
        this.excelPanel.show();
      }
    }
  }

  public showExcelPanel(): void {
    this.excelPanel.show();
  }

  public hideExcelPanel(): void {
    this.excelPanel.hide();
  }

  public async updateExcelData(
    filePath: string,
    columnA: string,
    columnB: string
  ): Promise<void> {
    await this.excelPanel.loadExcelData(filePath, columnA, columnB);
  }

  public dispose(): void {
    // Cleanup existing resources
    this.excelPanel?.dispose();
    this.sceneManager.world.dispose?.();
  }

}
