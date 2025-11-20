import * as BUI from "@thatopen/ui";
import { HiderPanel } from "./HiderPanel";
import { ViewsManager } from "./ViewsManager";

export class RightPanelsContainer {
  private container: HTMLElement | null = null;
  private hiderPanel: HiderPanel;
  private viewsManager: ViewsManager;

  constructor(hiderPanel: HiderPanel, viewsManager: ViewsManager) {
    this.hiderPanel = hiderPanel;
    this.viewsManager = viewsManager;
  }

  public async initialize(): Promise<void> {
    try {
      console.log("[RightPanelsContainer] Initializing...");
      BUI.Manager.init();

      // Initialize both panels first
      console.log("[RightPanelsContainer] Initializing hider panel...");
      const hiderPanelElement = await this.hiderPanel.init();
      console.log("[RightPanelsContainer] Hider panel initialized:", !!hiderPanelElement);
      
      console.log("[RightPanelsContainer] Initializing views manager...");
      await this.viewsManager.initialize();
      const viewsPanelElement = this.viewsManager.getPanel();
      console.log("[RightPanelsContainer] Views panel initialized:", !!viewsPanelElement);

      // Create the container
      console.log("[RightPanelsContainer] Creating container...");
      this.container = BUI.Component.create(() => {
        return BUI.html`
          <div class="right-panels-container">
            <div class="panels-header">
              <div class="panels-title">
                <svg class="panels-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                <span>Controls</span>
              </div>
              <div class="panels-actions">
                <button class="collapse-all-btn" @click=${() => this.collapseAll()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </button>
                <button class="expand-all-btn" @click=${() => this.expandAll()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="18,15 12,9 6,15"></polyline>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="panels-content">
              ${viewsPanelElement || ''}
              ${hiderPanelElement || ''}
            </div>
          </div>
        `;
      });

      // Position the container
      Object.assign(this.container.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: "1000",
        maxHeight: "calc(100vh - 40px)",
        width: "320px",
        display: "block", // Ensure it's visible
        visibility: "visible", // Ensure it's visible
        opacity: "1" // Ensure it's visible
      });

      document.body.append(this.container);
      console.log("[RightPanelsContainer] Container appended to body:", !!this.container);
      console.log("[RightPanelsContainer] Container element:", this.container);
      
      this.createMobileToggle();
      console.log("[RightPanelsContainer] ✅ Initialization complete");
    } catch (error) {
      console.error("[RightPanelsContainer] ❌ Initialization failed:", error);
      throw error; // Re-throw to be caught by caller
    }
  }

  private createMobileToggle(): void {
    const button = BUI.Component.create(() => {
      return BUI.html`
        <bim-button class="right-panels-toggler" icon="solar:settings-bold"
          @click="${() => {
            if (this.container?.classList.contains("right-panels-visible")) {
              this.container.classList.remove("right-panels-visible");
            } else {
              this.container?.classList.add("right-panels-visible");
            }
          }}">
        </bim-button>
      `;
    });

    Object.assign(button.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "1001",
      display: "none",
    });

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleMediaQuery = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        button.style.display = "block";
        if (this.container) this.container.style.display = "none";
      } else {
        button.style.display = "none";
        if (this.container) this.container.style.display = "block";
      }
    };

    mediaQuery.addListener(handleMediaQuery);
    handleMediaQuery(mediaQuery);
    document.body.append(button);
  }

  private collapseAll(): void {
    this.hiderPanel.setCollapsed(true);
    this.viewsManager.setCollapsed(true);
  }

  private expandAll(): void {
    this.hiderPanel.setCollapsed(false);
    this.viewsManager.setCollapsed(false);
  }

  public dispose(): void {
    if (this.container) {
      this.container.remove();
    }
    // ViewsManager doesn't have a dispose method
  }
}