import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";

// Define your custom level grouping mapping here
interface LevelGroupMapping {
  [groupName: string]: string[]; // Group name maps to array of actual level names
}

export class HiderPanel {
  private hider: OBC.Hider;
  private fragments: OBC.FragmentsManager;
  public classifier: OBC.Classifier;
  private panel: HTMLElement | null = null;
  private levelGroups: LevelGroupMapping = {};
  private validatedLevelGroups: LevelGroupMapping = {};
  private levelsClassification: any = null; // Classification from classifier.list.get("Levels")
  private currentCategories: string[] = []; // Track current filtered categories

  constructor(components: OBC.Components, fragments: OBC.FragmentsManager) {
    this.hider = components.get(OBC.Hider);
    this.fragments = fragments;
    this.classifier = components.get(OBC.Classifier);
  }

  /**
   * Load level groups configuration from config.json
   */
  private async loadLevelGroupsConfig(): Promise<LevelGroupMapping> {
    try {
      const response = await fetch('./config.json');
      if (!response.ok) {
        throw new Error(`Failed to load config.json: ${response.statusText}`);
      }
      const config = await response.json();
      
      if (config.levelGroups && typeof config.levelGroups === 'object') {
        console.log("✅ Level groups loaded from config.json:", config.levelGroups);
        return config.levelGroups as LevelGroupMapping;
      } else {
        console.warn("⚠️ No 'levelGroups' found in config.json, using empty mapping");
        return {};
      }
    } catch (error) {
      console.error("❌ Error loading config.json:", error);
      console.log("Using empty level groups mapping");
      return {};
    }
  }

  public async init() {
    BUI.Manager.init();

    // Load level groups from config.json
    this.levelGroups = await this.loadLevelGroupsConfig();

    // 1) Prepare your "Levels" classification
    await this.classifier.byCategory();
    await this.classifier.byIfcBuildingStorey({ classificationName: "Levels" });
    this.levelsClassification = this.classifier.list.get("Levels") || null;
    const actualLevelNames = this.levelsClassification
      ? Array.from(this.levelsClassification.keys())
      : [];

    // Console log all available levels for easy copying
    console.log("═══════════════════════════════════════════════");
    console.log("📋 ALL AVAILABLE LEVELS IN MODEL:");
    console.log("═══════════════════════════════════════════════");
    actualLevelNames.forEach((level, index) => {
      console.log(`${index + 1}. "${level}"`);
    });
    console.log("═══════════════════════════════════════════════");
    console.log("Copy these level names to configure your levelGroups mapping");
    console.log("═══════════════════════════════════════════════");

    // Validate level groups - only keep groups whose levels exist in the model
    this.validatedLevelGroups = {};
    for (const [groupName, levelList] of Object.entries(this.levelGroups)) {
      const validLevels = levelList.filter(lvl => actualLevelNames.includes(lvl));
      if (validLevels.length > 0) {
        this.validatedLevelGroups[groupName] = validLevels;
      }
    }

    const levelGroupNames = Object.keys(this.validatedLevelGroups);

    // 1.5) Get all available categories from the loaded models
    const modelCategories = new Set<string>();
    for (const [, model] of this.fragments.list) {
      const categories = await model.getItemsWithGeometryCategories();
      for (const category of categories) {
        if (!category) continue;
        modelCategories.add(category);
      }
    }
    const categoryNames = Array.from(modelCategories);

    // 2) Helper to compute a merged ModelIdMap for any selection of actual levels
    const buildMapForLevels = async (levels: string[]): Promise<OBC.ModelIdMap> => {
      const map: OBC.ModelIdMap = {};
      for (const lvl of levels) {
        const group = this.levelsClassification!.get(lvl);
        if (!group) continue;
        const subMap = await group.get();
        for (const [mid, ids] of Object.entries(subMap)) {
          if (!map[mid]) map[mid] = new Set<number>();
          const idsArray = Array.isArray(ids) ? ids : ids instanceof Set ? Array.from(ids) : [];
          for (const id of idsArray) map[mid].add(id as number);
        }
      }
      return map;
    };

    // 2.5) Helper to compute a merged ModelIdMap for any selection of categories
    const buildMapForCategories = async (categories: string[]): Promise<OBC.ModelIdMap> => {
      const map: OBC.ModelIdMap = {};
      const categoriesRegex = categories.map((cat) => new RegExp(`^${cat}$`));

      for (const [, model] of this.fragments.list) {
        const items = await model.getItemsOfCategories(categoriesRegex);
        const localIds = Object.values(items).flat();
        if (localIds.length > 0) {
          if (!map[model.modelId]) map[model.modelId] = new Set<number>();
          for (const id of localIds) map[model.modelId].add(id);
        }
      }
      return map;
    };

    // 3) The Isolation logic for level GROUPS
    const applyIsolationForLevelGroups = async (groupNames: string[]) => {
      if (!groupNames.length) {
        await this.hider.set(true);
      } else {
        // Collect all actual levels from selected groups
        const allActualLevels: string[] = [];
        for (const groupName of groupNames) {
          const levels = this.validatedLevelGroups[groupName] || [];
          allActualLevels.push(...levels);
        }
        // Remove duplicates
        const uniqueLevels = Array.from(new Set(allActualLevels));
        const modelIdMap = await buildMapForLevels(uniqueLevels);
        await this.hider.isolate(modelIdMap);
      }
    };

    // 3.5) The Isolation logic for categories
    const applyIsolationForCategories = async (categories: string[]) => {
      if (!categories.length) {
        await this.hider.set(true);
      } else {
        const modelIdMap = await buildMapForCategories(categories);
        await this.hider.isolate(modelIdMap);
      }
    };

    // 4) Your existing Hiding logic (if needed)
    // const _hideByCategory = async (_cats: string[]) => {
    //   // Your original hideByCategory implementation
    // };
    // const _hideByLevel = async (_lvls: string[]) => {
    //   // Your original hideByLevel implementation
    // };

    // 5) Build the panel
    this.panel = BUI.Component.create<BUI.PanelSection>(() => {
      // Reset button handler: uncheck all + show full model
      const onReset = async ({ target }: { target: any }) => {
        target.loading = true;
        target.classList.add('loading');
        // Uncheck all isolation checkboxes:
        this.panel!
          .querySelectorAll<HTMLInputElement>("input.iso-chk")
          .forEach((cb) => (cb.checked = false));
        this.panel!
          .querySelectorAll<HTMLInputElement>("input.cat-iso-chk")
          .forEach((cb) => (cb.checked = false));
        await this.hider.set(true);
        target.loading = false;
        target.classList.remove('loading');
      };

      return BUI.html`
        <div class="filters-container">
          <!-- Level Groups Filter Panel -->
          <div class="right-panel-section hider-section">
            <div class="panel-header" @click=${() => this.togglePanel()}>
              <div class="panel-header-content">
                <div class="panel-title">
                  <svg class="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  <span>Level Groups</span>
                </div>
                <button class="collapse-toggle">
                  <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="panel-content">
              <!-- Modern Reset Section -->
              <div class="modern-reset-section">
                <div class="reset-container">
                  <div class="reset-item">
                    <div class="reset-content">
                      <div class="reset-info">
                        <span class="reset-title">Reset All Filters</span>
                        <span class="reset-description">Restore full model</span>
                      </div>
                      <button class="modern-reset-btn" @click=${onReset}>
                        <svg class="reset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                          <path d="M21 3v5h-5"/>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                          <path d="M3 21v-5h5"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Modern Level Groups Isolation Section -->
              <div class="modern-isolation-section">
                <div class="isolation-container">
                  ${levelGroupNames.map((groupName, index) => {
                    // const _levelCount = this.validatedLevelGroups[groupName].length;
                    // const _levelList = this.validatedLevelGroups[groupName].join(", ");
                    
                    return BUI.html`
                      <div class="level-item" style="animation-delay: ${index * 0.05}s">
                        <div class="level-content">
                          <div class="level-info">
                            <span class="level-name">${groupName}</span>
                          </div>
                          <label class="modern-checkbox">
                            <input 
                              type="checkbox"
                              class="iso-chk checkbox-input"
                              data-group="${groupName}"
                              @change=${async () => {
                                // gather all checked level groups
                                const checked = Array.from(
                                  this.panel!.querySelectorAll<HTMLInputElement>("input.iso-chk")
                                )
                                  .filter((cb) => cb.checked)
                                  .map((cb) => cb.dataset.group!);
                                await applyIsolationForLevelGroups(checked);
                              }}
                            />
                            <span class="checkbox-custom">
                              <svg class="checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20,6 9,17 4,12"></polyline>
                              </svg>
                            </span>
                          </label>
                        </div>
                        <div class="level-divider"></div>
                      </div>
                    `;
                  })}
                </div>
              </div>
            </div>
          </div>

          <!-- Categories Filter Panel -->
          <div class="right-panel-section category-section">
            <div class="panel-header" @click=${() => this.toggleCategoryPanel()}>
              <div class="panel-header-content">
                <div class="panel-title">
                  <svg class="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 6h16M4 12h16M4 18h16"/>
                  </svg>
                  <span>Category Filter</span>
                </div>
                <button class="collapse-toggle">
                  <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="panel-content">
              <!-- Modern Categories Isolation Section -->
              <div class="modern-isolation-section">
                <div class="isolation-container">
                  ${categoryNames.map((cat, index) => BUI.html`
                    <div class="level-item" style="animation-delay: ${index * 0.05}s">
                      <div class="level-content">
                        <div class="level-info">
                          <span class="level-name">${cat}</span>
                          <span class="level-badge">Category</span>
                        </div>
                        <label class="modern-checkbox">
                          <input 
                            type="checkbox"
                            class="cat-iso-chk checkbox-input"
                            data-category="${cat}"
                            @change=${async () => {
                              // gather all checked categories
                              const checked = Array.from(
                                this.panel!.querySelectorAll<HTMLInputElement>("input.cat-iso-chk")
                              )
                                .filter((cb) => cb.checked)
                                .map((cb) => cb.dataset.category!);
                              await applyIsolationForCategories(checked);
                            }}
                          />
                          <span class="checkbox-custom">
                            <svg class="checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                              <polyline points="20,6 9,17 4,12"></polyline>
                            </svg>
                          </span>
                        </label>
                      </div>
                      <div class="level-divider"></div>
                    </div>
                  `)}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    // Set both panels as collapsed by default
    this.setCollapsed(true);

    return this.panel;
  }

  private togglePanel(): void {
    if (this.panel) {
      const levelsPanel = this.panel.querySelector('.hider-section');
      if (levelsPanel) {
        levelsPanel.classList.toggle('collapsed');
      }
    }
  }

  private toggleCategoryPanel(): void {
    if (this.panel) {
      const categoryPanel = this.panel.querySelector('.category-section');
      if (categoryPanel) {
        categoryPanel.classList.toggle('collapsed');
      }
    }
  }

  public getPanel(): HTMLElement | null {
    return this.panel;
  }

  public setCollapsed(collapsed: boolean): void {
    if (this.panel) {
      const levelsPanel = this.panel.querySelector('.hider-section');
      const categoryPanel = this.panel.querySelector('.category-section');
      
      if (collapsed) {
        levelsPanel?.classList.add('collapsed');
        categoryPanel?.classList.add('collapsed');
      } else {
        levelsPanel?.classList.remove('collapsed');
        categoryPanel?.classList.remove('collapsed');
      }
    }
  }

  /**
   * Public method to filter/isolate by IFC categories programmatically
   * @param categories Array of IFC category names (e.g., ["IFCBEAM", "IFCWALL"])
   * @param additive If true, add to existing categories instead of replacing
   */
  public async filterByCategories(categories: string[], additive: boolean = false): Promise<void> {
    if (!categories.length && !additive) {
      await this.hider.set(true);
      this.currentCategories = [];
      return;
    }

    // If additive, merge with existing categories
    if (additive) {
      const merged = [...new Set([...this.currentCategories, ...categories])];
      this.currentCategories = merged;
    } else {
      this.currentCategories = [...categories];
    }

    if (this.currentCategories.length === 0) {
      await this.hider.set(true);
      return;
    }

    // Build model ID map for the specified categories
    const modelIdMap: OBC.ModelIdMap = {};
    // Use case-insensitive regex to match categories
    const categoriesRegex = this.currentCategories.map((cat) => new RegExp(`^${cat}$`, "i"));

    for (const [, model] of this.fragments.list) {
      try {
        const items = await model.getItemsOfCategories(categoriesRegex);
        const localIds = Object.values(items).flat();
        if (localIds.length > 0) {
          if (!modelIdMap[model.modelId]) modelIdMap[model.modelId] = new Set<number>();
          for (const id of localIds) modelIdMap[model.modelId].add(id);
        }
      } catch (error) {
        // Continue if category filtering fails for a model
        continue;
      }
    }

    await this.hider.isolate(modelIdMap);
  }

  /**
   * Get currently filtered categories
   */
  public getCurrentCategories(): string[] {
    return [...this.currentCategories];
  }

  /**
   * Get currently selected level groups
   */
  public getCurrentLevelGroups(): string[] {
    if (!this.panel) {
      return [];
    }
    
    const checkboxes = this.panel.querySelectorAll<HTMLInputElement>("input.iso-chk");
    return Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.dataset.group!)
      .filter(group => group !== undefined);
  }

  /**
   * Reset all category filters - show full model
   */
  public async resetCategoryFilter(): Promise<void> {
    this.currentCategories = [];
    await this.hider.set(true);
  }

  /**
   * Public method to filter/isolate by level groups programmatically
   * @param groupNames Array of level group names (e.g., ["First Floor", "Roof"])
   * @param additive If true, add to existing level groups instead of replacing
   */
  public async filterByLevelGroups(groupNames: string[], additive: boolean = false): Promise<void> {
    if (!this.panel || !this.levelsClassification) {
      console.warn("HiderPanel not initialized");
      return;
    }

    // Get all level group checkboxes
    const checkboxes = this.panel.querySelectorAll<HTMLInputElement>("input.iso-chk");
    
    if (additive) {
      // Add to existing checked groups
      const currentlyChecked = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.group!);
      
      const merged = [...new Set([...currentlyChecked, ...groupNames])];
      
      // Check all merged groups
      checkboxes.forEach(cb => {
        if (merged.includes(cb.dataset.group!)) {
          cb.checked = true;
        }
      });
    } else {
      // Replace: uncheck all first, then check only the requested groups
      checkboxes.forEach(cb => {
        cb.checked = false;
      });
      
      // Check the requested groups
      checkboxes.forEach(cb => {
        if (groupNames.includes(cb.dataset.group!)) {
          cb.checked = true;
        }
      });
    }

    // Apply isolation directly
    const selectedGroups = additive 
      ? [...new Set([...Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.dataset.group!), ...groupNames])]
      : groupNames;

    if (!selectedGroups.length) {
      await this.hider.set(true);
      return;
    }

    // Collect all actual levels from selected groups
    const allActualLevels: string[] = [];
    for (const groupName of selectedGroups) {
      const levels = this.validatedLevelGroups[groupName] || [];
      allActualLevels.push(...levels);
    }
    // Remove duplicates
    const uniqueLevels = Array.from(new Set(allActualLevels));
    
    // Build model ID map
    const map: OBC.ModelIdMap = {};
    for (const lvl of uniqueLevels) {
      const group = this.levelsClassification!.get(lvl);
      if (!group) continue;
      const modelIdMap = await group.get();
      for (const [modelId, ids] of Object.entries(modelIdMap)) {
        if (!map[modelId]) map[modelId] = new Set<number>();
        const idsArray = Array.isArray(ids) ? ids : ids instanceof Set ? Array.from(ids) : [];
        for (const id of idsArray) map[modelId].add(id as number);
      }
    }
    
    await this.hider.isolate(map);
  }
}

// ─── Your existing dropdown templates (if still needed) ────────────────────
// Commented out unused templates
// const _categoriesDropdownTemplate = () => {
//   const onCreated = async (_e?: Element) => {
//     /* …your original category-dropdown population… */
//   };
//   return BUI.html`<bim-dropdown multiple ${BUI.ref(onCreated)}></bim-dropdown>`;
// };

// const _levelsDropdownTemplate = () => {
//   const onCreated = async (_e?: Element) => {
//     /* …your original level-dropdown population… */
//   };
//   return BUI.html`<bim-dropdown multiple ${BUI.ref(onCreated)}></bim-dropdown>`;
// };