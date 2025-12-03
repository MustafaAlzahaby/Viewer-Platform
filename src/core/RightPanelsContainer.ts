import * as BUI from "@thatopen/ui";
import { HiderPanel } from "./HiderPanel";
import { ViewsManager } from "./ViewsManager";

export class RightPanelsContainer {
  private container: HTMLElement | null = null;
  private hiderPanel: HiderPanel;
  private viewsManager: ViewsManager;
  private isCollapsed: boolean = false;

  constructor(hiderPanel: HiderPanel, viewsManager: ViewsManager) {
    this.hiderPanel = hiderPanel;
    this.viewsManager = viewsManager;
  }

  public async initialize(): Promise<void> {
    BUI.Manager.init();

    // Initialize both panels first
    const hiderPanelElement = await this.hiderPanel.init();
    await this.viewsManager.initialize();
    const viewsPanelElement = this.viewsManager.getPanel();

    // Create the container
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
              <button class="toggle-panels-btn" @click=${() => this.toggleAll()}>
                <svg class="toggle-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 12,15 18,9"></polyline>
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
      width: "320px"
    });

    document.body.append(this.container);
    
    // Set initial arrow state (panels start collapsed, so arrow points down)
    this.isCollapsed = true;
    const arrowIcon = this.container?.querySelector('.toggle-arrow-icon') as SVGElement;
    if (arrowIcon) {
      arrowIcon.classList.remove('expanded'); // Ensure it starts without expanded class
    }
    
    this.createMobileToggle();
  }

  private createMobileToggle(): void {
    const button = BUI.Component.create(() => {
      return BUI.html`
        <bim-button class="right-panels-toggler" icon="solar:settings-bold"
          @click="${() => {
            if (!this.container) return;

            if (this.container.classList.contains("right-panels-visible")) {
              this.container.classList.remove("right-panels-visible");
            } else {
              this.container.classList.add("right-panels-visible");
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
    });

    // Let CSS media queries decide when the button and panel are visible
    document.body.append(button);
  }

  private toggleAll(): void {
    this.isCollapsed = !this.isCollapsed;
    
    // Update button arrow rotation using class
    const arrowIcon = this.container?.querySelector('.toggle-arrow-icon') as SVGElement;
    
    if (arrowIcon) {
      if (this.isCollapsed) {
        // Collapsed: arrow points down (remove expanded class)
        arrowIcon.classList.remove('expanded');
      } else {
        // Expanded: arrow points up (add expanded class)
        arrowIcon.classList.add('expanded');
      }
    }
    
    // Toggle panels
    this.hiderPanel.setCollapsed(this.isCollapsed);
    this.viewsManager.setCollapsed(this.isCollapsed);
  }

  public dispose(): void {
    if (this.container) {
      this.container.remove();
    }
    this.viewsManager.dispose();
  }
}