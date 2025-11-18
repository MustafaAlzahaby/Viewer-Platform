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
  private dataProcessor: DataProcessor;
  private highlighter: Highlighter;

  private controlsContainer: HTMLElement | null = null;
  private statusIndicator: HTMLElement | null = null;

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

  /**
   * Initialize the data processor with config and Excel data, and load category data
   */
  async initialize(configUrl: string, dataUrl: string, categoryJsonUrl?: string): Promise<void> {
    await this.dataProcessor.initialize(configUrl, dataUrl);

    // Load color configuration from config.json
    await this.loadColorConfig(configUrl);

    if (categoryJsonUrl) {
      try {
        await this.highlighter.loadCategoryData(categoryJsonUrl);
        console.log("Category data loaded from:", categoryJsonUrl);
      } catch (error) {
        console.error("Failed to load category data:", error);
      }
    }

    await this.preprocessExcelData();
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
      
      console.log("Color configuration loaded successfully");
    } catch (error) {
      console.error("Error loading color configuration:", error);
      throw error;
    }
  }

  /**
   * Get the primary category key from category data
   */
  private getPrimaryCategoryKey(categories: any): string {
    if (!categories) return 'default';
    
    let categoryArray: string[] = [];
    
    if (typeof categories === 'string') {
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
      return 'default';
    }

    // Remove brackets and quotes from category names to match colorKey
    const cleanCategories = categoryArray.map(cat => 
      cat.replace(/^\["?|"?\]$/g, '').replace(/"/g, '')
    );

    // Find the first category that has a color mapping
    for (const category of cleanCategories) {
      if (this.colorConfig && this.colorConfig[category]) {
        return category;
      }
    }

    // Fallback to first category if no color mapping found
    return cleanCategories[0] || 'default';
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
    console.log("Pre-processing Excel data...");

    const inProgressResults = this.dataProcessor.getResultsByStatus("in-progress");
    const completedResults = this.dataProcessor.getResultsByStatus("completed");

    const inProgressGroups: ParameterGroup[] = inProgressResults.map((result) => ({
      zone: result.zone,
      level: result.level,
      category: result.category,
      originalStatus: "IN_PROGRESS",
    }));

    const completedGroups: ParameterGroup[] = completedResults.map((result) => ({
      zone: result.zone,
      level: result.level,
      category: result.category,
      originalStatus: "COMPLETED",
    }));

    this.processedData = this.applyConstraintsAndOrganize(inProgressGroups, completedGroups);

    console.log("Data pre-processing completed:");
    console.log(`- In Progress: ${this.processedData.inProgress.length} groups`);
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
        if (intersectionCount <= 3) console.log(`  Intersection removed from in-progress: ${key}`);
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
    const allCategories = [...this.processedData.inProgress, ...this.processedData.completed];
    const categoryColors = new Set<string>();

    allCategories.forEach(group => {
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
          shadowAlpha: 0.18
        },
        completed: { 
          from: primaryColor, 
          to: primaryColor, 
          accent: primaryColor,
          shadowAlpha: 0.15
        }
      });
    }
  }

  /**
   * Add event listeners for the horizontal checkboxes
   */
  private addHorizontalToggleListeners(): void {
    if (!this.controlsContainer) return;

    const checkboxes = this.controlsContainer.querySelectorAll(".horizontal-checkbox-input");

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

        // Instant clear
        this.highlighter.resetHighlight();

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

    if (this.inProgressOn) {
      parts.push("In Progress");
      tasks.push(this.highlightPreprocessedDataBatched(this.processedData.inProgress, "IN_PROGRESS"));
    }
    if (this.completedOn) {
      parts.push("Completed");
      tasks.push(this.highlightPreprocessedDataBatched(this.processedData.completed, "COMPLETED"));
    }

    if (tasks.length === 0) {
      this.updateStatusIndicator("Highlighting: none");
      return;
    }

    await Promise.all(tasks);
    this.updateStatusIndicator(`Highlighting: ${parts.join(" + ")}`);
  }

  /**
   * Highlight parameters with their original statuses preserved – BATCHED
   */
  private async highlightWithOriginalStatusesBatched(parameterGroups: ParameterGroup[]): Promise<void> {
    if (!parameterGroups.length) return;

    const inProgressItems = parameterGroups.filter((g) => g.originalStatus === "IN_PROGRESS");
    const completedItems = parameterGroups.filter((g) => g.originalStatus === "COMPLETED");

    await Promise.all([
      this.highlightPreprocessedDataBatched(inProgressItems, "IN_PROGRESS"),
      this.highlightPreprocessedDataBatched(completedItems, "COMPLETED"),
    ]);
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
      const key = `${g.zone}|${g.level}|${JSON.stringify(g.category)}|${progressStatus}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (let i = 0; i < unique.length; i += batchSize) {
      const slice = unique.slice(i, i + batchSize);
      await Promise.all(
        slice.map((group) =>
          this.highlighter.highlight(group.zone, [group.level], group.category, progressStatus)
        )
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public helpers to sync UI colors with your Highlighter colors
  // ─────────────────────────────────────────────────────────────────────────

  /** Set UI checkbox colors from code (so they match your element highlight color exactly). */
  public setUIColors(c: {
    inProgress?: { from: string; to: string; accent?: string; shadowAlpha?: number };
    completed?: { from: string; to: string; accent?: string; shadowAlpha?: number };
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
      root.style.setProperty(`--hc-${prefix}-shadow`, this.hexToRgba(accent ?? to, shadowAlpha));
    };

    if (c.inProgress) setGroup("inprogress", c.inProgress.from, c.inProgress.to, c.inProgress.accent, c.inProgress.shadowAlpha);
    if (c.completed) setGroup("completed", c.completed.from, c.completed.to, c.completed.accent, c.completed.shadowAlpha);
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
    if (mode === "model")       { this.inProgressOn = false; this.completedOn = false; }
    else if (mode === "in-progress") { this.inProgressOn = true;  this.completedOn = false; }
    else if (mode === "completed")   { this.inProgressOn = false; this.completedOn = true; }
    else if (mode === "both")        { this.inProgressOn = true;  this.completedOn = true; }

    if (this.controlsContainer) {
      const ip = this.controlsContainer.querySelector('[data-highlight="in-progress"]') as HTMLInputElement | null;
      const cp = this.controlsContainer.querySelector('[data-highlight="completed"]') as HTMLInputElement | null;
      if (ip) ip.checked = this.inProgressOn;
      if (cp) cp.checked = this.completedOn;
    }

    // Update UI colors based on current data
    this.updateUIColorsFromData();

    this.highlighter.resetHighlight();
    await this.applyHighlightsFromToggles();
  }

  public async setMode(mode: "model" | "in-progress" | "completed" | "both"): Promise<void> {
    await this.handleModeChange(mode);
  }

  public getCurrentMode(): "model" | "in-progress" | "completed" | "both" {
    if (this.inProgressOn && this.completedOn) return "both";
    if (this.inProgressOn) return "in-progress";
    if (this.completedOn) return "completed";
    return "model";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Debug helpers
  // ─────────────────────────────────────────────────────────────────────────

  public debugDataProcessing(): void {
    const rawInProgress = this.dataProcessor.getResultsByStatus("in-progress");
    const rawCompleted = this.dataProcessor.getResultsByStatus("completed");
    console.log(`Raw in-progress: ${rawInProgress.length}, Raw completed: ${rawCompleted.length}`);
    console.log(`Processed in-progress: ${this.processedData.inProgress.length}`);
    console.log(`Processed completed: ${this.processedData.completed.length}`);
    console.log(`Processed both: ${this.processedData.both.length}`);
  }

  public getDataStatistics(): { inProgress: number; completed: number; both: number } {
    return {
      inProgress: this.processedData.inProgress.length,
      completed: this.processedData.completed.length,
      both: this.processedData.both.length,
    };
  }

  public async refreshProcessedData(): Promise<void> {
    await this.preprocessExcelData();
    this.highlighter.resetHighlight();
    
    // Update UI colors when data refreshes
    this.updateUIColorsFromData();
    
    await this.applyHighlightsFromToggles();
  }

  public toggleControls(visible: boolean): void {
    if (this.controlsContainer) this.controlsContainer.style.display = visible ? "block" : "none";
    if (this.statusIndicator)   this.statusIndicator.style.display   = visible ? "block" : "none";
  }

  private updateStatusIndicator(text: string): void {
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
          if (this.statusIndicator) this.statusIndicator.style.visibility = "hidden";
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
}