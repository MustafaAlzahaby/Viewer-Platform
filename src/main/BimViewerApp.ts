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

  private projectName: string;

  constructor(containerId: string, projectName: string) {
    this.sceneManager = new SceneManager(containerId);
    this.projectName = projectName;
  }

  public static async create(containerId: string, projectName: string): Promise<BimViewerApp> {
    const app = new BimViewerApp(containerId, projectName);
    await app.initialize();
    return app;
  }

  private async initialize(): Promise<void> {
    console.log(`📦 Initializing with project: ${this.projectName}`);

    this.modelManager = await ModelManager.create(
      this.sceneManager.world,
      this.sceneManager.components,
      this.projectName
    );

    this.hider = new HiderPanel(
      this.sceneManager.components,
      this.modelManager.fragmentManager
    );

    this.controller = new HighlightController(this.modelManager, this.hider);

    // ✅ Use static paths for shared files
    const excelPath = "/excel-sheet/data.xlsx";
    const guidsPath = "./guids/guids.json";

    await this.controller.initialize("./config.json", excelPath, guidsPath);
    (window as any).controller = this.controller;

    this.viewsManager = new ViewsManager(this.sceneManager.components, this.sceneManager.world);

    this.rightPanelsContainer = new RightPanelsContainer(this.hider, this.viewsManager);
    this.rightPanelsContainer.initialize();

    this.excelPanel = new ExcelDataPanel("container");
    await this.excelPanel.loadExcelData(
      excelPath,
      "Activity Name",
      "Performance % Complete"
    );

    this.excelPanel.addSearchBox();
    this.setupExcelIntegration();

    this.detailsWindow = new DetailsWindow(
      this.sceneManager,
      this.modelManager,
      this.controller
    );

    await this.controller.refreshProcessedData();

    this.clipperInit();

    console.log("✅ Viewer fully initialized.");
  }

  private setupExcelIntegration(): void {
    document.addEventListener("excelRowSelected", (event: any) => {
      const { data } = event.detail;
      if (data["Element ID"]) {
        this.highlightBimElement(data["Element ID"], data);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "E" && event.ctrlKey) {
        event.preventDefault();
        this.toggleExcelPanel();
      }
    });
  }

  private highlightBimElement(elementId: string, excelData: any): void {
    try {
      console.log(`🎯 Highlighting BIM element: ${elementId}`, excelData);
      // TODO: Add actual highlight logic if needed
    } catch (error) {
      console.error("Error highlighting BIM element:", error);
    }
  }

  public toggleExcelPanel(): void {
    const panel = document.getElementById("excel-data-panel");
    if (panel) {
      const isVisible = panel.style.display !== "none";
      isVisible ? this.excelPanel.hide() : this.excelPanel.show();
    }
  }

  public showExcelPanel(): void {
    this.excelPanel.show();
  }

  public hideExcelPanel(): void {
    this.excelPanel.hide();
  }

  public async updateExcelData(filePath: string, columnA: string, columnB: string): Promise<void> {
    await this.excelPanel.loadExcelData(filePath, columnA, columnB);
  }

  public dispose(): void {
    this.excelPanel?.dispose();
    this.sceneManager.world.dispose?.();
  }

  public clipperInit(): void {
  const clipper = this.viewsManager.clipper;

  if (!clipper) {
    console.warn("🚫 Clipper is not initialized. Skipping clipper event setup.");
    return;
  }

  clipper.onAfterCreate?.add(() => {
    this.controller.updateStatusIndicator("clipper added");
  });

  clipper.onAfterDelete?.add(() => {
    this.controller.updateStatusIndicator("clipper deleted");
    console.log("✂️ Clipper deleted");
  });

  window.onkeydown = (event) => {
    if (event.code === "Insert" && clipper.enabled) {
      clipper.create(this.sceneManager.world);
    }

    if (event.code === "Delete" || event.code === "Backspace") {
      if (clipper.enabled) {
        clipper.delete(this.sceneManager.world);
      }
    }
  };
}

}
