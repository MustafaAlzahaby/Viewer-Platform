import { DataProcessor } from "./DataProcessor";
import { Highlighter } from "./Highlighter";
import type { ModelManager } from "./ModelManager";
import type { HiderPanel } from "./HiderPanel";

// Define interfaces for better type safety
interface ParameterGroup {
  zone: string;
  level: string;
  category: any; // Adjust type based on your category structure
  originalStatus: "IN_PROGRESS" | "COMPLETED"; // Preserve original status
}

interface ProcessedData {
  inProgress: ParameterGroup[];
  completed: ParameterGroup[];
  both: ParameterGroup[]; // Will contain items with their original status preserved
}

interface ColorConfig {
  [key: string]: string;
}

export class HighlightController {
  public dataProcessor: DataProcessor;
  public highlighter: Highlighter;

  private controlsContainer: HTMLElement | null = null;
  private statusIndicator: HTMLElement | null = null;
  private applyingOverlay: HTMLDivElement | null = null;

  private statusTimer: NodeJS.Timeout | null = null;
  private STATUS_DISPLAY_DURATION = 3000; // 3 seconds

  // Pre-processed data structures
  private processedData: ProcessedData = {
    inProgress: [],
    completed: [],
    both: [],
  };

  // Checkbox state (independent toggles)
  private inProgressOn = false;
  private completedOn = false;

  // rAF guard to avoid piling up re-applies
  private pendingApply: number | null = null;

  // Color configuration from config.json
  private colorConfig: ColorConfig | null = null;

  constructor(modelManager: ModelManager, hider: HiderPanel) {
    this.dataProcessor = new DataProcessor();
    this.highlighter = new Highlighter(modelManager, hider);

    this.createHorizontalControls();
    this.injectHorizontalStyles();
  }

  public async initializeAfterModelLoad(): Promise<void> {
    console.log("🔄 Initializing params map after model load...");
    await this.populateHighlightParamsMap();
    console.log(
      `✅ Params map populated with ${this.highlighter.highlightParamsToIds.size} entries`
    );
  }

  /**
   * Initialize the data processor with config and Excel data, and load category data
   */
  // In your HighlightController.ts file, replace the initialize method with this:

  async initialize(
    configUrl: string,
    dataUrl: string,
    categoryJsonUrl?: string
  ): Promise<void> {
    try {
      await this.dataProcessor.initialize(configUrl, dataUrl);
    } catch (error) {
      console.error("Failed to initialize data processor:", error);
      // Continue - data processor will have empty results
    }

    // Load color configuration from config.json
    try {
      await this.loadColorConfig(configUrl);
    } catch (error) {
      console.error("Failed to load color config:", error);
      // Continue with default colors
    }

    if (categoryJsonUrl) {
      try {
        await this.highlighter.loadCategoryData(categoryJsonUrl);
        console.log("Category data loaded from:", categoryJsonUrl);
      } catch (error) {
        console.error("Failed to load category data:", error);
        // Continue without category data
      }
    }

    try {
      await this.preprocessExcelData();
    } catch (error) {
      console.error("Failed to preprocess Excel data:", error);
      // Continue with empty processed data
    }

    // ⚠️ DON'T populate here - models aren't loaded yet!
    // await this.populateHighlightParamsMap();

    console.log("✅ HighlightController initialization complete");
    console.log("⏳ Waiting for model load to populate params map...");
  }
  /**
   * Load color configuration from config.json
   */
  private async loadColorConfig(configUrl: string): Promise<void> {
    try {
      const response = await fetch(configUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch color config: ${response.statusText}`);
      }
      const config = await response.json();
      this.colorConfig = config.colorKey || {};

      // Also pass color config to highlighter
      await this.highlighter.loadColorConfig(configUrl);

      // console.log("Color configuration loaded successfully");
    } catch (error) {
      // console.error("Error loading color configuration:", error);
      throw error;
    }
  }

  /**
   * Get the primary category key from category data
   */
  private getPrimaryCategoryKey(categories: any): string {
    if (!categories) return "default";

    let categoryArray: string[] = [];

    if (typeof categories === "string") {
      // Handle string format like "[\"ff\"]"
      try {
        const parsed = JSON.parse(categories);
        categoryArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        categoryArray = [categories];
      }
    } else if (Array.isArray(categories)) {
      categoryArray = categories;
    } else {
      return "default";
    }

    // Remove brackets and quotes from category names to match colorKey
    const cleanCategories = categoryArray.map((cat) =>
      cat.replace(/^\["?|"?\]$/g, "").replace(/"/g, "")
    );

    // Find the first category that has a color mapping
    for (const category of cleanCategories) {
      if (this.colorConfig && this.colorConfig[category]) {
        return category;
      }
    }

    // Fallback to first category if no color mapping found
    return cleanCategories[0] || "default";
  }

  /**
   * Get color for a category
   */
  private getCategoryColor(categories: any): string {
    const categoryKey = this.getPrimaryCategoryKey(categories);

    if (this.colorConfig && this.colorConfig[categoryKey]) {
      return this.colorConfig[categoryKey];
    }

    return "#87CEEB"; // Default sky blue
  }

  /**
   * Pre-process Excel data and organize into separate data structures with constraints
   */
  private async preprocessExcelData(): Promise<void> {
    // console.log("Pre-processing Excel data...");

    const inProgressResults =
      this.dataProcessor.getResultsByStatus("in-progress");
    const completedResults = this.dataProcessor.getResultsByStatus("completed");

    const inProgressGroups: ParameterGroup[] = inProgressResults.map(
      (result) => ({
        zone: result.zone,
        level: result.level,
        category: result.category,
        originalStatus: "IN_PROGRESS",
      })
    );

    const completedGroups: ParameterGroup[] = completedResults.map(
      (result) => ({
        zone: result.zone,
        level: result.level,
        category: result.category,
        originalStatus: "COMPLETED",
      })
    );

    this.processedData = this.applyConstraintsAndOrganize(
      inProgressGroups,
      completedGroups
    );

    console.log("Data pre-processing completed:");
    console.log(
      `- In Progress: ${this.processedData.inProgress.length} groups`
    );
    console.log(`- Completed: ${this.processedData.completed.length} groups`);
    console.log(`- Both: ${this.processedData.both.length} groups`);
  }

  /**
   * Apply constraints and organize parameter groups
   */
  private applyConstraintsAndOrganize(
    inProgressGroups: ParameterGroup[],
    completedGroups: ParameterGroup[]
  ): ProcessedData {
    const createGroupKey = (group: ParameterGroup): string =>
      `${group.zone}|${group.level}|${JSON.stringify(group.category)}`;

    const completedKeys = new Set(completedGroups.map(createGroupKey));

    const result: ProcessedData = {
      inProgress: [],
      completed: completedGroups,
      both: [],
    };

    let intersectionCount = 0;
    inProgressGroups.forEach((group) => {
      const key = createGroupKey(group);
      if (completedKeys.has(key)) {
        intersectionCount++;
        if (intersectionCount <= 3) {
          //console.log(`  Intersection removed from in-progress: ${key}`);
        }
      } else {
        result.inProgress.push(group);
      }
    });

    result.both = [...result.inProgress, ...result.completed];
    return result;
  }

  /**
   * Load category data separately
   */
  async loadCategoryData(categoryJsonUrl: string): Promise<void> {
    try {
      await this.highlighter.loadCategoryData(categoryJsonUrl);
      await this.preprocessExcelData();
      await this.applyHighlightsFromToggles();
    } catch (error) {
      console.error("Failed to load category data:", error);
      throw error;
    }
  }

  /**
   * Create horizontal controls (updated to support dynamic category colors)
   */
  private createHorizontalControls(): void {
    this.controlsContainer = document.createElement("div");
    this.controlsContainer.className = "horizontal-highlight-controls";
    this.controlsContainer.innerHTML = `
      <div class="horizontal-highlight-panel">
        <div class="horizontal-options">
          <div class="highlight-option-horizontal" data-type="in-progress">
            <label class="modern-horizontal-checkbox">
              <input 
                type="checkbox"
                class="horizontal-checkbox-input"
                data-highlight="in-progress"
              />
              <span class="horizontal-checkbox-custom">
                <svg class="horizontal-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
              </span>
              <span class="horizontal-option-label">In Progress</span>
            </label>
          </div>

          <div class="highlight-separator"></div>

          <div class="highlight-option-horizontal" data-type="completed">
            <label class="modern-horizontal-checkbox">
              <input 
                type="checkbox"
                class="horizontal-checkbox-input"
                data-highlight="completed"
              />
              <span class="horizontal-checkbox-custom">
                <svg class="horizontal-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
              </span>
              <span class="horizontal-option-label">Completed</span>
            </label>
          </div>
        </div>
      </div>
    `;

    this.statusIndicator = document.createElement("div");
    this.statusIndicator.className = "modern-status-indicator";
    this.statusIndicator.id = "status-indicator";

    document.body.appendChild(this.controlsContainer);
    document.body.appendChild(this.statusIndicator);

    this.updateStatusIndicator("Highlighting: none");
    this.addHorizontalToggleListeners();
  }

  private showApplyingOverlay(): void {
    if (this.applyingOverlay) return;
    const div = document.createElement("div");
    div.className = "highlight-applying-overlay";
    div.innerHTML = `
      <svg style="position: absolute; width: 0; height: 0;">
        <defs>
          <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.6" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:0.6" />
          </linearGradient>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
          </linearGradient>
        </defs>
      </svg>
      <div class="highlight-applying-card">
        <div class="ai-sync-container">
          <!-- AI Brain Icon with Neural Network -->
          <div class="ai-brain-wrapper">
            <svg class="ai-brain-icon" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
              <!-- Neural network nodes -->
              <circle class="neural-node" cx="30" cy="30" r="4" />
              <circle class="neural-node" cx="60" cy="20" r="4" />
              <circle class="neural-node" cx="90" cy="30" r="4" />
              <circle class="neural-node" cx="30" cy="60" r="4" />
              <circle class="neural-node" cx="60" cy="60" r="6" />
              <circle class="neural-node" cx="90" cy="60" r="4" />
              <circle class="neural-node" cx="30" cy="90" r="4" />
              <circle class="neural-node" cx="60" cy="100" r="4" />
              <circle class="neural-node" cx="90" cy="90" r="4" />
              <!-- Neural connections -->
              <line class="neural-connection" x1="30" y1="30" x2="60" y2="20" />
              <line class="neural-connection" x1="60" y1="20" x2="90" y2="30" />
              <line class="neural-connection" x1="30" y1="30" x2="60" y2="60" />
              <line class="neural-connection" x1="60" y1="20" x2="60" y2="60" />
              <line class="neural-connection" x1="90" y1="30" x2="60" y2="60" />
              <line class="neural-connection" x1="30" y1="60" x2="60" y2="60" />
              <line class="neural-connection" x1="90" y1="60" x2="60" y2="60" />
              <line class="neural-connection" x1="30" y1="60" x2="30" y2="90" />
              <line class="neural-connection" x1="60" y1="60" x2="60" y2="100" />
              <line class="neural-connection" x1="90" y1="60" x2="90" y2="90" />
              <line class="neural-connection" x1="30" y1="90" x2="60" y2="100" />
              <line class="neural-connection" x1="60" y1="100" x2="90" y2="90" />
              <!-- Brain outline -->
              <path class="brain-outline" d="M 40 20 Q 60 10 80 20 Q 95 30 100 50 Q 100 70 95 85 Q 85 100 60 105 Q 35 100 25 85 Q 20 70 20 50 Q 20 30 40 20 Z" />
            </svg>
          </div>
          
          <!-- Data Flow Particles -->
          <div class="data-flow-container">
            <div class="data-particle" style="--delay: 0s"></div>
            <div class="data-particle" style="--delay: 0.2s"></div>
            <div class="data-particle" style="--delay: 0.4s"></div>
            <div class="data-particle" style="--delay: 0.6s"></div>
            <div class="data-particle" style="--delay: 0.8s"></div>
            <div class="data-particle" style="--delay: 1s"></div>
          </div>
          
          <!-- P6 Source Indicator -->
          <div class="p6-source">
            <div class="p6-icon">P6</div>
            <div class="p6-pulse"></div>
          </div>
        </div>
        
        <div class="highlight-applying-content">
          <span class="highlight-applying-title">
            <span class="ai-badge">AI</span>
            <span class="title-text">Syncing with Primavera P6</span>
          </span>
          <span class="highlight-applying-subtitle">
            <span class="subtitle-dynamic">Analyzing project data...</span>
          </span>
        </div>
        
        <!-- Progress Ring -->
        <div class="progress-ring-wrapper">
          <svg class="progress-ring" viewBox="0 0 36 36">
            <circle class="progress-ring-bg" cx="18" cy="18" r="16" />
            <circle class="progress-ring-fill" cx="18" cy="18" r="16" />
          </svg>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    this.applyingOverlay = div;
    
    // Animate subtitle text dynamically
    this.animateSubtitleText();
  }

  private animateSubtitleText(): void {
    if (!this.applyingOverlay) return;
    
    const subtitleEl = this.applyingOverlay.querySelector('.subtitle-dynamic') as HTMLElement;
    if (!subtitleEl) return;
    
    const messages = [
      'Analyzing project data...',
      'Processing schedules...',
      'Mapping elements...',
      'Applying AI filters...',
      'Synchronizing visualization...',
      'Finalizing updates...'
    ];
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (!this.applyingOverlay || !subtitleEl) {
        clearInterval(interval);
        return;
      }
      
      subtitleEl.style.opacity = '0';
      setTimeout(() => {
        if (!subtitleEl) return;
        currentIndex = (currentIndex + 1) % messages.length;
        subtitleEl.textContent = messages[currentIndex];
        subtitleEl.style.opacity = '1';
      }, 200);
    }, 800);
    
    // Store interval ID to clear it when overlay is hidden
    (this.applyingOverlay as any).__subtitleInterval = interval;
  }

  private hideApplyingOverlay(): void {
    if (!this.applyingOverlay) return;
    
    // Clear subtitle animation interval
    const interval = (this.applyingOverlay as any).__subtitleInterval;
    if (interval) {
      clearInterval(interval);
    }
    
    this.applyingOverlay.remove();
    this.applyingOverlay = null;
  }

  /**
   * Inject horizontal styles (updated to support dynamic category colors)
   */
  private injectHorizontalStyles(): void {
    const styleElement = document.createElement("style");
    styleElement.textContent = `
      /* === Dynamic color variables === */
      :root {
        --hc-inprogress-from: #87CEEB;
        --hc-inprogress-to:   #87CEEB;
        --hc-inprogress-accent: #87CEEB;
        --hc-inprogress-shadow: rgba(135, 206, 235, 0.18);

        --hc-completed-from: #10b981;
        --hc-completed-to:   #059669;
        --hc-completed-accent: #10b981;
        --hc-completed-shadow: rgba(16, 185, 129, 0.15);
      }

      /* Horizontal Highlight Controls */
      .horizontal-highlight-controls {
        position: fixed !important;
        top: 14px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 1000 !important;
        background: rgba(255, 255, 255, 0.98) !important;
        backdrop-filter: blur(12px) !important;
        border-radius: 18px !important;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1) !important;
        border: 1px solid rgba(226, 232, 240, 0.8) !important;
        font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        animation: slideInFromTop 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
      }

      @keyframes slideInFromTop {
        from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      .horizontal-highlight-panel { padding: 0; background: transparent; }

      .horizontal-options {
        display: flex;
        align-items: center;
        gap: 0;
        padding: 8px 12px;
      }

      .highlight-option-horizontal {
        opacity: 0;
        transform: translateY(8px);
        animation: slideInUp 0.3s ease forwards;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .highlight-option-horizontal:nth-child(1) { animation-delay: 0s; }
      .highlight-option-horizontal:nth-child(3) { animation-delay: 0.06s; }

      .highlight-separator {
        width: 1px;
        height: 18px;
        background: linear-gradient(180deg, transparent 0%, rgba(226, 232, 240, 0.9) 20%, rgba(226, 232, 240, 0.9) 80%, transparent 100%);
        margin: 0 12px;
        opacity: 0.7;
      }

      .modern-horizontal-checkbox {
        display: flex;
        align-items: center;
        cursor: pointer;
        gap: 10px;
        padding: 6px 10px;
        border-radius: 14px;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        user-select: none;
      }

      .modern-horizontal-checkbox:hover {
        background: rgba(102, 126, 234, 0.07);
        transform: translateY(-1px);
      }

      .horizontal-checkbox-input {
        position: absolute;
        opacity: 0;
        cursor: pointer;
        width: 0;
        height: 0;
      }

      .horizontal-checkbox-custom {
        width: 18px;
        height: 18px;
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid rgba(203, 213, 225, 0.9);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .horizontal-checkbox-custom::before {
        content: '';
        position: absolute;
        inset: 0;
        opacity: 0;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 4px;
      }

      .horizontal-checkbox-icon {
        width: 10px;
        height: 10px;
        color: white;
        opacity: 0;
        transform: scale(0.5);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 1;
        position: relative;
      }

      .horizontal-option-label {
        font-size: 0.82rem;
        font-weight: 500;
        color: #1e293b;
        letter-spacing: -0.01em;
        font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* === IN PROGRESS (uses variables) === */
      .highlight-option-horizontal[data-type="in-progress"] 
      .horizontal-checkbox-input:checked + .horizontal-checkbox-custom::before {
        background: linear-gradient(135deg, var(--hc-inprogress-from) 0%, var(--hc-inprogress-to) 100%);
        opacity: 1;
      }
      .highlight-option-horizontal[data-type="in-progress"] 
      .horizontal-checkbox-input:checked + .horizontal-checkbox-custom {
        border-color: var(--hc-inprogress-accent);
        box-shadow: 0 0 0 3px var(--hc-inprogress-shadow);
        background: color-mix(in srgb, var(--hc-inprogress-accent) 12%, transparent);
      }
      .highlight-option-horizontal[data-type="in-progress"] 
      .horizontal-checkbox-input:checked ~ .horizontal-option-label {
        color: var(--hc-inprogress-accent);
        font-weight: 600;
      }
      .highlight-option-horizontal[data-type="in-progress"] 
      .modern-horizontal-checkbox:hover .horizontal-checkbox-custom {
        border-color: var(--hc-inprogress-accent);
        box-shadow: 0 0 0 3px var(--hc-inprogress-shadow);
      }
      .highlight-option-horizontal[data-type="in-progress"] 
      .modern-horizontal-checkbox:hover {
        background: color-mix(in srgb, var(--hc-inprogress-accent) 10%, transparent);
      }

      /* === COMPLETED === */
      .highlight-option-horizontal[data-type="completed"] 
      .horizontal-checkbox-input:checked + .horizontal-checkbox-custom::before {
        background: linear-gradient(135deg, var(--hc-completed-from) 0%, var(--hc-completed-to) 100%);
        opacity: 1;
      }
      .highlight-option-horizontal[data-type="completed"] 
      .horizontal-checkbox-input:checked + .horizontal-checkbox-custom {
        border-color: var(--hc-completed-accent);
        box-shadow: 0 0 0 3px var(--hc-completed-shadow);
        background: color-mix(in srgb, var(--hc-completed-accent) 12%, transparent);
      }
      .highlight-option-horizontal[data-type="completed"] 
      .horizontal-checkbox-input:checked ~ .horizontal-option-label {
        color: var(--hc-completed-to);
        font-weight: 600;
      }
      .highlight-option-horizontal[data-type="completed"] 
      .modern-horizontal-checkbox:hover .horizontal-checkbox-custom {
        border-color: var(--hc-completed-accent);
        box-shadow: 0 0 0 3px var(--hc-completed-shadow);
      }
      .highlight-option-horizontal[data-type="completed"] 
      .modern-horizontal-checkbox:hover {
        background: color-mix(in srgb, var(--hc-completed-accent) 10%, transparent);
      }

      /* Common checked state */
      .horizontal-checkbox-input:checked + .horizontal-checkbox-custom .horizontal-checkbox-icon {
        opacity: 1;
        transform: scale(1);
      }
      .horizontal-checkbox-input:checked + .horizontal-checkbox-custom {
        animation: horizontalCheckboxPulse 0.25s ease;
      }
      @keyframes horizontalCheckboxPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      @keyframes slideInUp { to { opacity: 1; transform: translateY(0); } }

      /* Status Indicator */
      .modern-status-indicator {
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        padding: 8px 14px;
        border-radius: 16px;
        font-size: 0.78rem;
        font-weight: 500;
        color: #1e293b;
        box-shadow: 0 6px 22px -4px rgba(0, 0, 0, 0.1), 0 8px 8px -4px rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(226, 232, 240, 0.8);
        transition: all 0.25s ease-in-out;
        font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        letter-spacing: -0.01em;
      }

      /* Overlay while applying highlights in batch */
      .highlight-applying-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.25);
        backdrop-filter: blur(12px);
        z-index: 1500;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: all;
        animation: overlayFadeIn 0.3s ease-out;
      }

      @keyframes overlayFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .highlight-applying-card {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 28px 40px;
        border-radius: 24px;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%);
        border: 1px solid rgba(226, 232, 240, 0.95);
        box-shadow:
          0 24px 60px rgba(15, 23, 42, 0.25),
          0 8px 20px rgba(15, 23, 42, 0.15),
          inset 0 1px 0 rgba(255, 255, 255, 0.9);
        font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        position: relative;
        overflow: hidden;
        min-width: 520px;
        animation: cardSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes cardSlideUp {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .highlight-applying-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(99, 102, 241, 0.1),
          transparent
        );
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }

      /* AI Sync Container */
      .ai-sync-container {
        position: relative;
        width: 120px;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .ai-brain-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .ai-brain-icon {
        width: 100%;
        height: 100%;
        filter: drop-shadow(0 4px 12px rgba(99, 102, 241, 0.3));
        animation: brainPulse 2s ease-in-out infinite;
      }

      @keyframes brainPulse {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.05);
          opacity: 0.9;
        }
      }

      .brain-outline {
        fill: none;
        stroke: url(#brainGradient);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.8;
        animation: brainGlow 2s ease-in-out infinite;
      }

      @keyframes brainGlow {
        0%, 100% {
          stroke-opacity: 0.6;
        }
        50% {
          stroke-opacity: 1;
        }
      }

      .neural-node {
        fill: url(#nodeGradient);
        filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.4));
        animation: nodePulse 1.5s ease-in-out infinite;
        transform-origin: center;
      }

      .neural-node:nth-child(5) {
        animation-delay: 0s;
      }

      .neural-node:nth-child(1),
      .neural-node:nth-child(3),
      .neural-node:nth-child(7),
      .neural-node:nth-child(9) {
        animation-delay: 0.3s;
      }

      .neural-node:nth-child(2),
      .neural-node:nth-child(4),
      .neural-node:nth-child(6),
      .neural-node:nth-child(8) {
        animation-delay: 0.6s;
      }

      @keyframes nodePulse {
        0%, 100% {
          transform: scale(1);
          opacity: 0.7;
        }
        50% {
          transform: scale(1.25);
          opacity: 1;
        }
      }

      .neural-connection {
        stroke: url(#connectionGradient);
        stroke-width: 1.5;
        stroke-opacity: 0.4;
        animation: connectionFlow 2s ease-in-out infinite;
      }

      @keyframes connectionFlow {
        0%, 100% {
          stroke-opacity: 0.3;
        }
        50% {
          stroke-opacity: 0.7;
        }
      }

      /* Data Flow Particles */
      .data-flow-container {
        position: absolute;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      .data-particle {
        position: absolute;
        width: 8px;
        height: 8px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 50%;
        box-shadow: 0 0 12px rgba(99, 102, 241, 0.8);
        animation: dataFlow 2s ease-in-out infinite;
        animation-delay: var(--delay);
        left: 20%;
        top: 50%;
        transform: translateY(-50%);
      }

      @keyframes dataFlow {
        0% {
          left: 20%;
          opacity: 0;
          transform: translateY(-50%) scale(0.5);
        }
        50% {
          opacity: 1;
          transform: translateY(-50%) scale(1);
        }
        100% {
          left: 80%;
          opacity: 0;
          transform: translateY(-50%) scale(0.5);
        }
      }

      /* P6 Source Indicator */
      .p6-source {
        position: absolute;
        left: -10px;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .p6-icon {
        position: relative;
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: -0.5px;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        z-index: 2;
      }

      .p6-pulse {
        position: absolute;
        width: 36px;
        height: 36px;
        background: rgba(99, 102, 241, 0.3);
        border-radius: 8px;
        animation: p6Pulse 1.5s ease-out infinite;
      }

      @keyframes p6Pulse {
        0% {
          transform: scale(1);
          opacity: 0.8;
        }
        100% {
          transform: scale(2);
          opacity: 0;
        }
      }

      .highlight-applying-content {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
      }

      .highlight-applying-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.02em;
      }

      .ai-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 10px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        font-size: 0.7rem;
        font-weight: 800;
        border-radius: 6px;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        animation: badgeGlow 2s ease-in-out infinite;
      }

      @keyframes badgeGlow {
        0%, 100% {
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }
        50% {
          box-shadow: 0 2px 16px rgba(99, 102, 241, 0.6);
        }
      }

      .title-text {
        background: linear-gradient(135deg, #0f172a, #475569);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .highlight-applying-subtitle {
        font-size: 0.85rem;
        color: #64748b;
        font-weight: 500;
      }

      .subtitle-dynamic {
        transition: opacity 0.2s ease;
      }

      /* Progress Ring */
      .progress-ring-wrapper {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .progress-ring {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .progress-ring-bg {
        fill: none;
        stroke: rgba(226, 232, 240, 0.5);
        stroke-width: 3;
      }

      .progress-ring-fill {
        fill: none;
        stroke: url(#progressGradient);
        stroke-width: 3;
        stroke-linecap: round;
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
        animation: progressRing 2s ease-in-out infinite;
      }

      @keyframes progressRing {
        0% {
          stroke-dashoffset: 100;
        }
        50% {
          stroke-dashoffset: 30;
        }
        100% {
          stroke-dashoffset: 100;
        }
      }

      /* Mobile Responsive */
      @media (max-width: 768px) {
        .highlight-applying-card {
          min-width: auto;
          width: calc(100vw - 32px);
          max-width: 400px;
          padding: 20px 24px;
          gap: 16px;
        }
        
        .ai-sync-container {
          width: 80px;
          height: 80px;
        }
        
        .highlight-applying-title {
          font-size: 0.95rem;
        }
        
        .title-text {
          display: block;
        }
        
        .highlight-applying-subtitle {
          font-size: 0.75rem;
        }
      }

      /* Mobile */
      @media (max-width: 768px) {
        .horizontal-highlight-controls {
          position: fixed !important;
          bottom: 16px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          top: unset !important;
          width: calc(100vw - 32px) !important;
          max-width: 320px !important;
        }
        .horizontal-options { padding: 8px 10px; }
        .highlight-separator { margin: 0 10px; height: 16px; }
        .modern-horizontal-checkbox { padding: 6px 8px; gap: 8px; }
        .horizontal-checkbox-custom { width: 18px; height: 18px; }
        .horizontal-checkbox-icon { width: 10px; height: 10px; }
        .horizontal-option-label { font-size: 0.8rem; }
      }

      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .horizontal-highlight-controls {
          background: rgba(30, 41, 59, 0.98) !important;
          border: 1px solid rgba(51, 65, 85, 0.8) !important;
        }
        .horizontal-checkbox-custom {
          background: rgba(30, 41, 59, 0.95);
          border: 2px solid rgba(71, 85, 105, 0.9);
        }
        .horizontal-option-label { color: #f1f5f9; }
        .modern-horizontal-checkbox:hover { background: rgba(102, 126, 234, 0.12) !important; }
        .highlight-separator {
          background: linear-gradient(180deg, transparent 0%, rgba(51, 65, 85, 0.85) 20%, rgba(51, 65, 85, 0.85) 80%, transparent 100%);
        }
        .modern-status-indicator {
          background: rgba(30, 41, 59, 0.95);
          border: 1px solid rgba(51, 65, 85, 0.8);
          color: #f1f5f9;
        }
        .highlight-option-horizontal[data-type="in-progress"] 
        .horizontal-checkbox-input:checked ~ .horizontal-option-label {
          color: var(--hc-inprogress-from);
        }
        .highlight-option-horizontal[data-type="completed"] 
        .horizontal-checkbox-input:checked ~ .horizontal-option-label {
          color: var(--hc-completed-from);
        }
      }

      /* Focus & press */
      .horizontal-checkbox-input:focus + .horizontal-checkbox-custom {
        outline: 2px solid #667eea;
        outline-offset: 2px;
      }
      .highlight-option-horizontal:active { transform: scale(0.98); }
    `;
    document.head.appendChild(styleElement);
  }

  /**
   * Update UI colors based on the current dataset's category colors
   */
  private updateUIColorsFromData(): void {
    if (!this.colorConfig) return;

    // Get unique categories from current processed data
    const allCategories = [
      ...this.processedData.inProgress,
      ...this.processedData.completed,
    ];
    const categoryColors = new Set<string>();

    allCategories.forEach((group) => {
      const color = this.getCategoryColor(group.category);
      categoryColors.add(color);
    });

    // If we have mixed categories, use a blended color approach
    // For now, we'll use the first category's color as the primary
    if (categoryColors.size > 0) {
      const primaryColor = Array.from(categoryColors)[0];
      this.setUIColors({
        inProgress: {
          from: primaryColor,
          to: primaryColor,
          accent: primaryColor,
          shadowAlpha: 0.18,
        },
        completed: {
          from: primaryColor,
          to: primaryColor,
          accent: primaryColor,
          shadowAlpha: 0.15,
        },
      });
    }
  }

  /**
   * Add event listeners for the horizontal checkboxes
   */
  private addHorizontalToggleListeners(): void {
    if (!this.controlsContainer) return;

    const checkboxes = this.controlsContainer.querySelectorAll(
      ".horizontal-checkbox-input"
    );

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", async (event) => {
        const target = event.target as HTMLInputElement;
        const highlightType = target.getAttribute("data-highlight");

        // Update state
        if (highlightType === "in-progress") {
          this.inProgressOn = target.checked;
        } else if (highlightType === "completed") {
          this.completedOn = target.checked;
        }

        // Cancel pending re-apply if any
        if (this.pendingApply !== null) {
          cancelAnimationFrame(this.pendingApply);
          this.pendingApply = null;
        }

        // Update UI colors based on current data
        this.updateUIColorsFromData();

        // Re-apply on next frame (instant feel, no flicker)
        this.pendingApply = requestAnimationFrame(() => {
          this.pendingApply = null;
          void this.applyHighlightsFromToggles();
        });
      });
    });
  }

  /**
   * CENTRAL LOGIC:
   * Apply any combination of In Progress and/or Completed that are on.
   */
  private async applyHighlightsFromToggles(): Promise<void> {
    const parts: string[] = [];
    const tasks: Promise<void>[] = [];

    // Determine which groups are active based on toggles
    const activeGroups: ParameterGroup[] = [];

    if (this.inProgressOn) {
      parts.push("In Progress");
      activeGroups.push(...this.processedData.inProgress);
      tasks.push(
        this.highlightPreprocessedDataBatched(
          this.processedData.inProgress,
          "IN_PROGRESS"
        )
      );
    }
    if (this.completedOn) {
      parts.push("Completed");
      activeGroups.push(...this.processedData.completed);
      tasks.push(
        this.highlightPreprocessedDataBatched(
          this.processedData.completed,
          "COMPLETED"
        )
      );
    }

    // No active filters: clear all highlights in a single batched pass
    if (tasks.length === 0) {
      this.showApplyingOverlay();
      this.highlighter.beginBatch();
      try {
        this.highlighter.resetHighlight();
      this.updateStatusIndicator("Highlighting: none");
      } finally {
        this.highlighter.endBatch();
        this.hideApplyingOverlay();
      }
      return;
    }

    // Perform all highlights in a single batch so the user sees only the final state
    this.showApplyingOverlay();
    this.highlighter.beginBatch();

    try {
      // 1) Clear previous highlights (batched - no render yet)
      this.highlighter.resetHighlight();

      // 2) Dim all non-active elements so active ones stand out
      try {
        const activeItems = await this.getCombinedItemsForGroups(activeGroups);
        if (activeItems.size > 0) {
          await this.highlighter.applyDimBackground(activeItems);
        }
      } catch (error) {
        // If background dimming fails, continue with normal highlighting
        console.warn("Failed to apply dim background:", error);
      }

      // 3) Apply the strong colors for the active groups
    await Promise.all(tasks);
    this.updateStatusIndicator(`Highlighting: ${parts.join(" + ")}`);
    } finally {
      this.highlighter.endBatch();
      this.hideApplyingOverlay();
    }
  }

  /**
   * Highlight parameters with their original statuses preserved – BATCHED
   * @deprecated Unused method - kept for potential future use
   */
  // @ts-ignore - Unused method kept for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _highlightWithOriginalStatusesBatched(
    _parameterGroups: ParameterGroup[]
  ): Promise<void> {
    // Method intentionally empty - kept for future use
  }

  /**
   * Batched highlighter to reduce UI lag.
   */
  private async highlightPreprocessedDataBatched(
    parameterGroups: ParameterGroup[],
    progressStatus: "IN_PROGRESS" | "COMPLETED",
    batchSize = 12
  ): Promise<void> {
    if (!parameterGroups.length) return;

    // De-duplicate identical groups
    const seen = new Set<string>();
    const unique = parameterGroups.filter((g) => {
      const key = `${g.zone}|${g.level}|${JSON.stringify(
        g.category
      )}|${progressStatus}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (let i = 0; i < unique.length; i += batchSize) {
      const slice = unique.slice(i, i + batchSize);
      await Promise.all(
        slice.map((group) =>
          this.highlighter.highlight(
            group.zone,
            [group.level],
            group.category,
            progressStatus
          )
        )
      );
    }
  }

  /**
   * Helper to compute the union of items to highlight across many parameter groups.
   * Returns a map of modelId -> set of localIds that are "active" (completed or in-progress).
   */
  private async getCombinedItemsForGroups(
    parameterGroups: ParameterGroup[]
  ): Promise<Map<string, Set<number>>> {
    const combined = new Map<string, Set<number>>();
    if (!parameterGroups.length) return combined;

    for (const group of parameterGroups) {
      const items = await this.getItemsForGroup(group);
      for (const [modelId, ids] of items) {
        if (!combined.has(modelId)) {
          combined.set(modelId, new Set<number>());
        }
        const targetSet = combined.get(modelId)!;
        ids.forEach((id) => targetSet.add(id));
      }
    }

    return combined;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public helpers to sync UI colors with your Highlighter colors
  // ─────────────────────────────────────────────────────────────────────────

  /** Set UI checkbox colors from code (so they match your element highlight color exactly). */
  public setUIColors(c: {
    inProgress?: {
      from: string;
      to: string;
      accent?: string;
      shadowAlpha?: number;
    };
    completed?: {
      from: string;
      to: string;
      accent?: string;
      shadowAlpha?: number;
    };
  }) {
    const root = document.documentElement;

    const setGroup = (
      prefix: "inprogress" | "completed",
      from: string,
      to: string,
      accent?: string,
      shadowAlpha = 0.15
    ) => {
      root.style.setProperty(`--hc-${prefix}-from`, from);
      root.style.setProperty(`--hc-${prefix}-to`, to);
      root.style.setProperty(`--hc-${prefix}-accent`, accent ?? to);
      root.style.setProperty(
        `--hc-${prefix}-shadow`,
        this.hexToRgba(accent ?? to, shadowAlpha)
      );
    };

    if (c.inProgress)
      setGroup(
        "inprogress",
        c.inProgress.from,
        c.inProgress.to,
        c.inProgress.accent,
        c.inProgress.shadowAlpha
      );
    if (c.completed)
      setGroup(
        "completed",
        c.completed.from,
        c.completed.to,
        c.completed.accent,
        c.completed.shadowAlpha
      );
  }

  /** Tiny helper: convert #rrggbb to rgba(r,g,b,a) string */
  private hexToRgba(hex: string, alpha = 0.15): string {
    const h = hex.replace("#", "");
    if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Legacy/compat APIs
  // ─────────────────────────────────────────────────────────────────────────

  private async handleModeChange(
    mode: "model" | "in-progress" | "completed" | "both"
  ): Promise<void> {
    if (mode === "model") {
      this.inProgressOn = false;
      this.completedOn = false;
    } else if (mode === "in-progress") {
      this.inProgressOn = true;
      this.completedOn = false;
    } else if (mode === "completed") {
      this.inProgressOn = false;
      this.completedOn = true;
    } else if (mode === "both") {
      this.inProgressOn = true;
      this.completedOn = true;
    }

    if (this.controlsContainer) {
      const ip = this.controlsContainer.querySelector(
        '[data-highlight="in-progress"]'
      ) as HTMLInputElement | null;
      const cp = this.controlsContainer.querySelector(
        '[data-highlight="completed"]'
      ) as HTMLInputElement | null;
      if (ip) ip.checked = this.inProgressOn;
      if (cp) cp.checked = this.completedOn;
    }

    // Update UI colors based on current data and re-apply in batched flow
    this.updateUIColorsFromData();
    await this.applyHighlightsFromToggles();
  }

  public async setMode(
    mode: "model" | "in-progress" | "completed" | "both"
  ): Promise<void> {
    await this.handleModeChange(mode);
  }

  public getCurrentMode(): "model" | "in-progress" | "completed" | "both" {
    if (this.inProgressOn && this.completedOn) return "both";
    if (this.inProgressOn) return "in-progress";
    if (this.completedOn) return "completed";
    return "model";
  }

  /**
   * Toggle in-progress checkbox (additive mode)
   */
  public async toggleInProgress(enable: boolean): Promise<void> {
    this.inProgressOn = enable;
    
    if (this.controlsContainer) {
      const ip = this.controlsContainer.querySelector(
        '[data-highlight="in-progress"]'
      ) as HTMLInputElement | null;
      if (ip) ip.checked = this.inProgressOn;
    }
    
    this.updateUIColorsFromData();
    await this.applyHighlightsFromToggles();
  }

  /**
   * Toggle completed checkbox (additive mode)
   */
  public async toggleCompleted(enable: boolean): Promise<void> {
    this.completedOn = enable;
    
    if (this.controlsContainer) {
      const cp = this.controlsContainer.querySelector(
        '[data-highlight="completed"]'
      ) as HTMLInputElement | null;
      if (cp) cp.checked = this.completedOn;
    }
    
    this.updateUIColorsFromData();
    await this.applyHighlightsFromToggles();
  }

  /**
   * Get current checkbox states
   */
  public getCheckboxStates(): { inProgress: boolean; completed: boolean } {
    return {
      inProgress: this.inProgressOn,
      completed: this.completedOn,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Debug helpers
  // ─────────────────────────────────────────────────────────────────────────

  public debugDataProcessing(): void {
    const rawInProgress = this.dataProcessor.getResultsByStatus("in-progress");
    const rawCompleted = this.dataProcessor.getResultsByStatus("completed");
    console.log(
      `Raw in-progress: ${rawInProgress.length}, Raw completed: ${rawCompleted.length}`
    );
    console.log(
      `Processed in-progress: ${this.processedData.inProgress.length}`
    );
    console.log(`Processed completed: ${this.processedData.completed.length}`);
    console.log(`Processed both: ${this.processedData.both.length}`);
  }

  public getDataStatistics(): {
    inProgress: number;
    completed: number;
    both: number;
  } {
    return {
      inProgress: this.processedData.inProgress.length,
      completed: this.processedData.completed.length,
      both: this.processedData.both.length,
    };
  }

  public async refreshProcessedData(): Promise<void> {
    await this.preprocessExcelData();

    // Re-populate the highlightParamsToIds map after data refresh
    await this.populateHighlightParamsMap();

    this.updateUIColorsFromData();
    await this.applyHighlightsFromToggles();
  }

  public toggleControls(visible: boolean): void {
    if (this.controlsContainer)
      this.controlsContainer.style.display = visible ? "block" : "none";
    if (this.statusIndicator)
      this.statusIndicator.style.display = visible ? "block" : "none";
  }

  public updateStatusIndicator(text: string): void {
    if (!this.statusIndicator) return;

    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }

    this.statusIndicator.textContent = text;
    this.statusIndicator.style.opacity = "1";
    this.statusIndicator.style.visibility = "visible";

    this.statusTimer = setTimeout(() => {
      if (this.statusIndicator) {
        this.statusIndicator.style.opacity = "0";
        setTimeout(() => {
          if (this.statusIndicator)
            this.statusIndicator.style.visibility = "hidden";
        }, 250);
      }
      this.statusTimer = null;
    }, this.STATUS_DISPLAY_DURATION);
  }

  public showStatusIndicator(): void {
    if (this.statusIndicator) {
      this.statusIndicator.style.opacity = "1";
      this.statusIndicator.style.visibility = "visible";
    }
  }

  public hideStatusIndicator(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    if (this.statusIndicator) {
      this.statusIndicator.style.opacity = "0";
      this.statusIndicator.style.visibility = "hidden";
    }
  }

  public setStatusDisplayDuration(duration: number): void {
    this.STATUS_DISPLAY_DURATION = Math.max(0, duration);
  }

  public dispose(): void {
    if (this.pendingApply !== null) {
      cancelAnimationFrame(this.pendingApply);
      this.pendingApply = null;
    }

    this.highlighter.resetHighlight();

    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }

    if (this.controlsContainer) {
      this.controlsContainer.remove();
      this.controlsContainer = null;
    }
    if (this.statusIndicator) {
      this.statusIndicator.remove();
      this.statusIndicator = null;
    }

    this.processedData = { inProgress: [], completed: [], both: [] };
    this.inProgressOn = false;
    this.completedOn = false;
    this.colorConfig = null;
  }

  // Add this method to your HighlightController class

  /**
   * Pre-populate the highlightParamsToIds map during initialization
   */
  private async populateHighlightParamsMap(): Promise<void> {
    console.log("Pre-populating highlightParamsToIds map...");

    // Clear existing map
    this.highlighter.clearParamsMap();

    // Process in-progress items
    if (this.processedData.inProgress.length > 0) {
      await this.populateParamsForGroups(
        this.processedData.inProgress,
        "IN_PROGRESS"
      );
    }

    // Process completed items
    if (this.processedData.completed.length > 0) {
      await this.populateParamsForGroups(
        this.processedData.completed,
        "COMPLETED"
      );
    }

    console.log(
      `highlightParamsToIds map populated with ${
        this.highlighter.getUniqueParamKeys().length
      } unique parameter sets`
    );
  }

  /**
   * Helper method to populate params for a group of parameter groups
   */
  private async populateParamsForGroups(
    parameterGroups: ParameterGroup[],
    progressStatus: "IN_PROGRESS" | "COMPLETED"
  ): Promise<void> {
    // Group by unique combinations to avoid duplicates
    const uniqueGroups = new Map<string, ParameterGroup>();

    parameterGroups.forEach((group) => {
      const key = `${group.zone}|${group.level}|${JSON.stringify(
        group.category
      )}`;
      uniqueGroups.set(key, group);
    });

    // Process each unique group
    for (const group of uniqueGroups.values()) {
      await this.populateParamsForSingleGroup(group, progressStatus);
    }
  }

  /**
   * Populate params for a single parameter group
   */
  private async populateParamsForSingleGroup(
    group: ParameterGroup,
    progressStatus: "IN_PROGRESS" | "COMPLETED"
  ): Promise<void> {
    try {
      // Get the items that would be highlighted for this group
      const itemsToHighlight = await this.getItemsForGroup(group);

      console.log(
        `🔍 Group ${group.zone}|${group.level}: Found ${itemsToHighlight.size} models with items`
      );

      if (itemsToHighlight.size === 0) {
        console.log(`⚠️ No items found for group ${group.zone}|${group.level}`);
        return;
      }

      // Create the params key (matching the logic in Highlighter.ts)
      const categoryArray = Array.isArray(group.category)
        ? group.category
        : typeof group.category === "string"
        ? [group.category]
        : [];

      const params = {
        zone: group.zone || "",
        level: group.level || "",
        category: [...categoryArray].sort(),
        status: progressStatus,
      };

      const paramsKey = JSON.stringify(params);

      // Collect all local IDs for this params combination
      const allLocalIds: number[] = [];
      for (const [_modelId, localIds] of itemsToHighlight) {
        allLocalIds.push(...Array.from(localIds));
      }

      console.log(
        `✅ Storing ${
          allLocalIds.length
        } localIds for params: ${paramsKey.substring(0, 100)}...`
      );

      // Store in the highlighter's map
      if (allLocalIds.length > 0) {
        if (this.highlighter.highlightParamsToIds.has(paramsKey)) {
          const existingIds =
            this.highlighter.highlightParamsToIds.get(paramsKey)!;
          const mergedIds = [...new Set([...existingIds, ...allLocalIds])];
          this.highlighter.highlightParamsToIds.set(paramsKey, mergedIds);
        } else {
          this.highlighter.highlightParamsToIds.set(paramsKey, allLocalIds);
        }
      }
    } catch (error) {
      console.warn(
        `❌ Failed to populate params for group ${group.zone}|${group.level}:`,
        error
      );
    }
  }
  /**
   * Get items that would be highlighted for a specific parameter group
   * (This uses the public methods from Highlighter without actually highlighting)
   */
  private async getItemsForGroup(
    group: ParameterGroup
  ): Promise<Map<string, Set<number>>> {
    const categoryArray = Array.isArray(group.category)
      ? group.category
      : typeof group.category === "string"
      ? [group.category]
      : [];

    // ⭐ FIX: Parse level if it's a JSON string array like '["Level 01"]'
    let levels: string[] = [];
    if (group.level) {
      if (typeof group.level === "string" && group.level.startsWith("[")) {
        // It's a JSON string array
        try {
          const parsed = JSON.parse(group.level);
          levels = Array.isArray(parsed) ? parsed : [group.level];
        } catch {
          levels = [group.level];
        }
      } else if (Array.isArray(group.level)) {
        levels = group.level;
      } else {
        levels = [group.level];
      }
    }

    console.log(
      `🔧 getItemsForGroup - zone: ${group.zone}, parsed levels:`,
      levels,
      `categories:`,
      categoryArray
    );

    let itemsToHighlight = new Map<string, Set<number>>();

    if (categoryArray.length > 0 && levels.length > 0) {
      // Get intersection of categories and levels using public highlighter methods
      const categoryItems = await this.highlighter.getItemsByCategoryFromJson(
        categoryArray,
        group.zone
      );
      const levelItems = await this.highlighter.getItemsByLevel(
        levels,
        group.zone
      );

      console.log(
        `   📊 Found ${categoryItems.size} models with category items, ${levelItems.size} with level items`
      );

      itemsToHighlight = this.highlighter.getIntersection(
        categoryItems,
        levelItems
      );
    } else if (categoryArray.length > 0) {
      // Get items by categories only
      itemsToHighlight = await this.highlighter.getItemsByCategoryFromJson(
        categoryArray,
        group.zone
      );
    } else if (levels.length > 0) {
      // Get items by levels only
      itemsToHighlight = await this.highlighter.getItemsByLevel(
        levels,
        group.zone
      );
    }

    return itemsToHighlight;
  }
}
