import { HiderPanel } from "../core/HiderPanel";
import { HighlightController } from "../core/HighlightController";
import { Highlighter } from "../core/Highlighter";
import { ModelManager } from "../core/ModelManager";
import { SceneManager } from "../core/SceneManager";
import { ExcelDataPanel } from "../core/ExcelDataPanel";
import { ViewsManager } from "../core/ViewsManager";
import { RightPanelsContainer } from "../core/RightPanelsContainer";
import { DetailsWindow } from "../core/DetailsWindow";

export class BimViewerApp {
  private sceneManager: SceneManager;
  private modelManager!: ModelManager;
  private excelPanel!: ExcelDataPanel;
  private hider!: HiderPanel;
  private controller!: HighlightController;
  private viewsManager!: ViewsManager;
  private rightPanelsContainer!: RightPanelsContainer;
  private detailsWindow!: DetailsWindow;

  constructor(containerId: string) {
    this.sceneManager = new SceneManager(containerId);
  }

  public static async create(containerId: string): Promise<BimViewerApp> {
    const app = new BimViewerApp(containerId);
    await app.initialize();
    return app;
  }

    private async initialize(): Promise<void> {
    // Initialize core components
    this.modelManager = await ModelManager.create(this.sceneManager.world, this.sceneManager.components);
    this.hider = new HiderPanel(this.sceneManager.components, this.modelManager.fragmentManager);

    // ✅ Wait for fragments to finish loading before initializing highlight logic
    await new Promise(resolve => {
      const checkReady = () => {
        if (this.modelManager.fragmentManager.list.size > 0) {
          resolve(true);
        } else {
          setTimeout(checkReady, 100);  // check again in 100ms
        }
      };
      checkReady();
    });

    this.controller = new HighlightController(this.modelManager, this.hider);
    await this.controller.initialize("./config.json", "./excel-sheet/data.xlsx", "./guids/guids.json");
    await this.controller.refreshProcessedData();

    // ✅ Views Manager
    this.viewsManager = new ViewsManager(this.sceneManager.components, this.sceneManager.world);

    if (this.viewsManager.clipper) {
      this.clipperInit();
    }

    // ✅ UI Panels
    this.rightPanelsContainer = new RightPanelsContainer(this.hider, this.viewsManager);
    this.rightPanelsContainer.initialize();

    this.excelPanel = new ExcelDataPanel("container");
    await this.excelPanel.loadExcelData("./excel-sheet/data.xlsx", "Activity Name", "Performance % Complete");
    this.excelPanel.addSearchBox();
    this.setupExcelIntegration();

    this.detailsWindow = new DetailsWindow(this.sceneManager, this.modelManager, this.controller);
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

  public clipperInit(): void {
  if (!this.viewsManager.clipper) {
    console.error("Clipper is not initialized.");
    return;
  }

  console.log("Initializing Clipper...");

  this.viewsManager.clipper.onAfterCreate.add(() => {
    this.controller.updateStatusIndicator("clipper added");
  });

  this.viewsManager.clipper.onAfterDelete.add(() => {
    this.controller.updateStatusIndicator("clipper deleted");
    console.log("deleted");
  });

  window.onkeydown = (event) => {
    if (event.code === "Insert" && this.viewsManager.clipper.enabled) {
      this.viewsManager.clipper.create(this.sceneManager.world);
    }

    if (event.code === "Delete" || event.code === "Backspace") {
      if (this.viewsManager.clipper.enabled) {
        this.viewsManager.clipper.delete(this.sceneManager.world);
      }
    }
  };
}

}
