import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";

export class HiderPanel {
  private hider: OBC.Hider;
  private fragments: OBC.FragmentsManager;
  public classifier: OBC.Classifier;
  private panel: HTMLElement | null = null;

  constructor(components: OBC.Components, fragments: OBC.FragmentsManager) {
    this.hider = components.get(OBC.Hider);
    this.fragments = fragments;
    this.classifier = components.get(OBC.Classifier);
  }

  public async init() {
    BUI.Manager.init();

    // 1) Prepare your "Levels" classification so we know all level names
    await this.classifier.byCategory();
    await this.classifier.byIfcBuildingStorey({ classificationName: "Levels" });
    const levelsClassification = this.classifier.list.get("Levels");
    const levelNames = levelsClassification
      ? Array.from(levelsClassification.keys())
      : [];

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

    // 2) Helper to compute a merged ModelIdMap for any selection of levels
    const buildMapForLevels = async (levels: string[]): Promise<OBC.ModelIdMap> => {
      const map: OBC.ModelIdMap = {};
      for (const lvl of levels) {
        const group = levelsClassification!.get(lvl)!;
        const subMap = await group.get();                // { modelId: Set<localId> }
        for (const [mid, ids] of Object.entries(subMap)) {
          if (!map[mid]) map[mid] = new Set<number>();
          for (const id of ids) map[mid].add(id);
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

    // 3) The Isolation logic: if levels[], show union; else reset full model
    const applyIsolationForLevels = async (levels: string[]) => {
      if (!levels.length) {
        await this.hider.set(true);
      } else {
        const modelIdMap = await buildMapForLevels(levels);
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

    // 4) Your existing Hiding logic (unchanged)
    const hideByCategory = async (cats: string[]) => {
      // … your original hideByCategory implementation …
    };
    const hideByLevel = async (lvls: string[]) => {
      // … your original hideByLevel implementation …
    };

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

      // Hiding dropdowns/buttons from your original code
      const categoriesDropdownB = BUI.Component.create<BUI.Dropdown>(
        categoriesDropdownTemplate
      );
      const levelsDropdownB = BUI.Component.create<BUI.Dropdown>(
        levelsDropdownTemplate
      );
      const onHideCategory = async ({ target }: { target: BUI.Button }) => {
        const cats = categoriesDropdownB.value;
        if (!cats.length) return;
        target.loading = true;
        await hideByCategory(cats);
        target.loading = false;
      };
      const onHideLevel = async ({ target }: { target: BUI.Button }) => {
        const lvls = levelsDropdownB.value;
        if (!lvls.length) return;
        target.loading = true;
        await hideByLevel(lvls);
        target.loading = false;
      };

      return BUI.html`
        <div class="filters-container">
          <!-- Levels Filter Panel -->
          <div class="right-panel-section hider-section">
            <div class="panel-header" @click=${() => this.togglePanel()}>
              <div class="panel-header-content">
                <div class="panel-title">
                  <svg class="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  <span>Levels Filter</span>
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

              <!-- Modern Levels Isolation Section -->
              <div class="modern-isolation-section">
                <div class="isolation-container">
                  ${levelNames.map((lvl, index) => BUI.html`
                    <div class="level-item" style="animation-delay: ${index * 0.05}s">
                      <div class="level-content">
                        <div class="level-info">
                          <span class="level-name">${lvl}</span>
                          <span class="level-badge">Level ${index + 1}</span>
                        </div>
                        <label class="modern-checkbox">
                          <input 
                            type="checkbox"
                            class="iso-chk checkbox-input"
                            data-level="${lvl}"
                            @change=${async () => {
                              // gather all checked levels
                              const checked = Array.from(
                                this.panel!.querySelectorAll<HTMLInputElement>("input.iso-chk")
                              )
                                .filter((cb) => cb.checked)
                                .map((cb) => cb.dataset.level!);
                              await applyIsolationForLevels(checked);
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
}

// ─── Your existing dropdown templates, unmodified ────────────────────────

const categoriesDropdownTemplate = () => {
  const onCreated = async (e?: Element) => {
    /* …your original category-dropdown population… */
  };
  return BUI.html`<bim-dropdown multiple ${BUI.ref(onCreated)}></bim-dropdown>`;
};

const levelsDropdownTemplate = () => {
  const onCreated = async (e?: Element) => {
    /* …your original level-dropdown population… */
  };
  return BUI.html`<bim-dropdown multiple ${BUI.ref(onCreated)}></bim-dropdown>`;
};