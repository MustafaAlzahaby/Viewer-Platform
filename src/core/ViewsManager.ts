import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import * as THREE from "three";

export class ViewsManager {
  private views: OBC.Views;
  private world: OBC.World;
  public clipper: OBC.Clipper;
  private panel: HTMLElement | null = null;
  private fragmentManager: any;
  private levelNameToGroup: Record<string, string> = {};
  private groupToLevels: Record<string, string[]> = {};

  // Keep for tracking which models were highlighted so we can reset cleanly
  private originalSlabMaterials: Map<string, any> = new Map();
  // Optional: still keep mesh refs for logging/utility controls
  private slabElements: Set<THREE.Mesh> = new Set();
  private is2DViewActive: boolean = false;
  private slabsInitialized = false;

  constructor(components: OBC.Components, world: OBC.World) {
    this.world = world;

    // Initialize Views
    this.views = components.get(OBC.Views);
    OBC.Views.defaultRange = 100;
    this.views.world = world;

    // Fragments manager
    this.fragmentManager = components.get(OBC.FragmentsManager);

    this.clipper = components.get(OBC.Clipper);
    this.clipper.enabled = true;
    

    // ─── Normalize rotation for current and future fragments ──────────────
    const TILT_DEGREES = 0;
    const tiltRad = THREE.MathUtils.degToRad(TILT_DEGREES);

    this.fragmentManager.list.forEach((model: any) => {
      model.object.rotateY(tiltRad);
    });

    this.fragmentManager.list.onItemSet.add(({ value: model }: any) => {
      model.object.rotateY(tiltRad);
      this.identifySlabElements(model);
    });

    // Identify slabs in already-loaded models
    this.fragmentManager.list.forEach((model: any) => {
      this.identifySlabElements(model);
    });

    // Re-scan after short delay to catch late loaders
    setTimeout(() => {
      // console.log("Re-scanning for slab elements after delay...");
      this.fragmentManager.list.forEach((model: any) => {
        this.identifySlabElements(model);
      });
      // console.log(`Total slab elements found after delay: ${this.slabElements.size}`);
    }, 2000);
  }

  async initialize(): Promise<void> {
    await this.loadLevelGroupsConfig();

    // Try multiple strategies to create storey views
    let storeyViewsCreated = false;

    // Approach 1: regex of modelIds
    try {
      const modelIds = Array.from(this.fragmentManager.list.keys());
      // console.log("Available model IDs:", modelIds);

      if (modelIds.length > 0) {
        const modelRegexes = modelIds.map((id) => new RegExp(String(id)));
        await this.views.createFromIfcStoreys({
          modelIds: modelRegexes,
          offset: 1.5,
        });
        storeyViewsCreated = true;
      }
    } catch (error) {
      // console.warn("Approach 1 failed:", error);
    }

    // Approach 2: known storey name patterns
    if (!storeyViewsCreated) {
      try {
        const commonStoreyPatterns = [
          /LEVEL/i, /FLOOR/i, /STOREY/i, /STORY/i,
          /L0/, /L1/, /L2/, /L3/, /L4/, /L5/,
          /LEVEL 0/, /LEVEL 1/, /LEVEL 2/, /LEVEL 3/, /LEVEL 4/, /LEVEL 5/,
          /00/, /01/, /02/, /03/, /04/, /05/,
        ];

        await this.views.createFromIfcStoreys({
          storeyNames: commonStoreyPatterns,
          offset: 1.5,
        });
        storeyViewsCreated = true;
      } catch (error) {
        // console.warn("Approach 2 failed:", error);
      }
    }

    // Approach 3: manual default views
    if (!storeyViewsCreated) {
      // console.log("Trying manual storey view creation...");
      await this.createAdvancedManualStoreyViews();
    }

    // Elevations (Front/Back/Left/Right)
    try {
      this.views.createElevations({ combine: true });
    } catch (error) {
      // console.warn("Could not create elevation views:", error);
    }

    // UI
    this.createUI();

    // Final slab scan after init
    setTimeout(() => {
      // console.log("Final slab scan after initialization...");
      this.scanAllFragmentsForSlabs();
    }, 3000);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Slab detection utilities (kept for diagnostics; coloring uses local IDs)
  // ────────────────────────────────────────────────────────────────────────
  private scanAllFragmentsForSlabs(): void {
    // console.log("=== COMPREHENSIVE SLAB SCAN ===");
    this.slabElements.clear();

    const fragments = this.fragmentManager.list;
    fragments.forEach((fragment: any, _modelId: string) => {
      // console.log(`Scanning fragment ${_modelId} for slabs...`);
      this.identifySlabElements(fragment);
    });

    // console.log(`Total slab elements found: ${this.slabElements.size}`);
    if (this.slabElements.size === 0) {
      // console.log("No slabs found with standard method, trying alternative approaches...");
      this.tryAlternativeSlabDetection();
    }

    this.slabsInitialized = true;
  }

  private ensureSlabsPrepared(): void {
    if (!this.slabsInitialized) {
      this.scanAllFragmentsForSlabs();
    }
  }

  private tryAlternativeSlabDetection(): void {
    // console.log("Trying alternative slab detection...");
    const fragments = this.fragmentManager.list;
    fragments.forEach((fragment: any, _modelId: string) => {
      const fragmentObject = fragment.object;
      if (!fragmentObject) return;

      fragmentObject.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          if (this.isLikelySlabByGeometry(child) || this.isSlabByAnyPattern(child)) {
            this.slabElements.add(child);
            // console.log(`🔍 Alternative detection found slab: ${child.name || "unnamed"}`);
          }
        }
      });
    });
    // console.log(`Alternative detection found ${this.slabElements.size} total slab elements`);
  }

  private isLikelySlabByGeometry(mesh: THREE.Mesh): boolean {
    try {
      if (!mesh.geometry) return false;
      const bbox = mesh.geometry.boundingBox;
      if (!bbox) return false;

      const size = new THREE.Vector3();
      bbox.getSize(size);

      const isFlat = size.x > size.y * 1.5 && size.z > size.y * 1.5;
      const isBigEnough = size.x > 1 && size.z > 1;
      const isHorizontal = Math.abs(mesh.rotation.x) < 0.5 && Math.abs(mesh.rotation.z) < 0.5;

      return isFlat && isBigEnough && isHorizontal;
    } catch {
      return false;
    }
  }

  private isSlabByAnyPattern(mesh: THREE.Mesh): boolean {
    const name = mesh.name?.toLowerCase() || "";
    const userData = mesh.userData || {};
    const ifcType = userData.ifcType?.toLowerCase() || userData.type?.toLowerCase() || "";
    const materialName = (mesh.material as THREE.Material)?.name?.toLowerCase() || "";

    const patterns = [
      /slab/, /floor/, /deck/, /roof/, /ceiling/,
      /ifcslab/, /ifcfloor/, /ifcroof/, /ifcceiling/,
      /dalle/, /plancher/, /boden/, /vloer/, /suelo/,
      /plate/, /panel/, /sheet/, /surface/, /horizontal/,
      /structural/, /concrete/, /foundation/, /base/,
      /level/, /story/, /storey/, /ground/, /l\d+/, /floor\s*\d+/, /basement/,
      /buildingelement/, /building_element/, /element/, /component/, /assembly/, /structure/,
      /reinforced/, /cast/, /precast/, /composite/,
      /\d+.*\d+/, /^[a-z]\d+/, /element_\d+/, /item/, /part/, /piece/, /section/,
    ];

    const textToCheck = `${name} ${ifcType} ${materialName}`;
    return patterns.some((p) => p.test(textToCheck));
  }

  private identifySlabElements(fragment: any): void {
    try {
      const fragmentObject = fragment.object;
      if (!fragmentObject) return;

      // console.log(`Identifying slab elements in fragment: ${fragment.modelId || "unknown"}`);
      let foundSlabs = 0;
      let totalMeshes = 0;

      fragmentObject.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          totalMeshes++;
          if (this.isSlabElement(child) || this.isLikelySlabByGeometry(child)) {
            this.slabElements.add(child);
            foundSlabs++;
            // console.log(`✓ Identified slab element: ${child.name || "unnamed"} (${(child.material as any)?.type || "unknown material"})`);
          }
        }
      });

      // console.log(`Found ${foundSlabs} slab elements out of ${totalMeshes} total meshes in this fragment.`);
      // console.log(`Total slabs across all fragments: ${this.slabElements.size}`);
    } catch (error) {
      // console.warn("Error identifying slab elements:", error);
    }
  }

  private isSlabElement(mesh: THREE.Mesh): boolean {
    const name = mesh.name?.toLowerCase() || "";
    const userData = mesh.userData || {};

    const slabKeywords = [
      "slab", "floor", "deck", "plate", "flooring", "roof", "roofing",
      "ifcslab", "ifcfloor", "ifcroof", "ifcbuildingelementproxy", "floorplate",
      "structural_slab", "concrete_slab", "floor_slab", "roof_slab", "ceiling", "ifcceiling",
      "dalle", "plancher", "sol", "boden", "vloer", "suelo", "pavimento",
      "structural", "foundation", "base", "platform", "surface",
      "horizontal", "level", "story", "storey",
      "buildingelement", "building_element", "element", "component", "panel", "sheet", "membrane",
      "concrete", "steel", "wood", "composite", "precast", "reinforced", "cast", "poured",
    ];

    const nameMatches = slabKeywords.some((k) => name.includes(k));
    const ifcType = userData.ifcType?.toLowerCase() || userData.type?.toLowerCase() || "";
    const typeMatches = slabKeywords.some((k) => ifcType.includes(k));
    const material = mesh.material as THREE.Material;
    const materialName = material?.name?.toLowerCase() || "";
    const materialMatches = slabKeywords.some((k) => materialName.includes(k));
    const hasLevelPattern =
      /level|l\d+|floor\d+|\d+f|storey|story|ground|basement/i.test(name);
    const hasSlabPattern = /\d+.*\d+|panel|plate|sheet|horizontal/i.test(name);

    const result = nameMatches || typeMatches || materialMatches || hasLevelPattern || hasSlabPattern;

    if (result) {
/*       console.log(
        `🎯 SLAB DETECTED: "${mesh.name}" - Name:${nameMatches} Type:${typeMatches} Material:${materialMatches} Pattern:${hasLevelPattern || hasSlabPattern}`
      ); */
    }
    return result;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Robust slab highlighting: ONLY via fragment.highlight/local IDs
  // ────────────────────────────────────────────────────────────────────────

  /** Collect slab local IDs per model using IFC categories (robust + safe). */
  private async getSlabLocalIdsByModel(): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();

    // Typical slab-ish categories across IFCs
    const categoryRegexes = [/^IfcSlab$/i, /^IfcCovering$/i, /^IfcPlate$/i, /^IfcFloor$/i];

    const fragments = this.fragmentManager.list as Map<string, any>;
    for (const [modelId, fragment] of fragments.entries()) {
      try {
        if (typeof fragment.getItemsOfCategories !== "function") continue;

        const byCat = await fragment.getItemsOfCategories(categoryRegexes);
        // byCat looks like { IfcSlab: number[], IfcCovering: number[] ... }
        const rawValues = Object.values(byCat) as unknown[];
        const ids = rawValues
          .flat()
          .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

        if (ids.length > 0) {
          result.set(modelId, ids);
        }
      } catch (err) {
        // console.warn(`getItemsOfCategories failed for model ${modelId}`, err);
      }
    }
    return result;
  }

  /** Async highlighter that NEVER assigns raw Three.js materials. */
  private async applySlabHighlighting(): Promise<void> {
    try {
      const lightGrayMaterialDefinition = {
        color: new THREE.Color("#E5E7EB"), // lighter than #d3d3d3
        opacity: 0.35,
        transparent: true,
        renderedFaces: 0,
      };

      const idsPerModel = await this.getSlabLocalIdsByModel();
      let total = 0;

      for (const [modelId, localIds] of idsPerModel) {
        const fragment = this.fragmentManager.list.get(modelId);
        if (!fragment || !localIds?.length) continue;

        try {
          // mark so we can reset later with resetHighlight()
          if (!this.originalSlabMaterials.has(`${modelId}_highlighted`)) {
            this.originalSlabMaterials.set(`${modelId}_highlighted`, true);
          }
          fragment.highlight(localIds, lightGrayMaterialDefinition);
          total += localIds.length;
        } catch (e) {
          // console.warn(`Highlight failed for model ${modelId}`, e);
        }
      }

      this.fragmentManager.core.update(true);
      // console.log(`✅ Applied light gray highlighting to ${total} slab items`);
    } catch (error) {
      // console.error("Error in applySlabHighlighting:", error);
    }
  }

  /** Wrapper that applies highlighting and flips the active flag. */
  private async applySlabStyling(): Promise<void> {
    // If for any reason slabs set is empty (mesh-based), still proceed; we use category IDs
    if (this.slabElements.size === 0) {
      // console.log("No slab meshes recorded; proceeding with category-based highlighting.");
    }
    await this.applySlabHighlighting();
    this.is2DViewActive = true;
  }

  /** Reset highlighting across all models (no direct material restoration needed). */
  private restoreSlabMaterials(): void {
    try {
      // console.log("Restoring original slab materials (resetHighlight)...");
      this.fragmentManager.list.forEach((fragment: any, modelId: string) => {
        if (this.originalSlabMaterials.has(`${modelId}_highlighted`)) {
          try {
            fragment.resetHighlight();
            // console.log(`✅ Reset highlighting for model: ${modelId}`);
          } catch (error) {
            // console.warn(`Could not reset highlight for model ${modelId}:`, error);
          }
          this.originalSlabMaterials.delete(`${modelId}_highlighted`);
        }
      });

      this.fragmentManager.core.update(true);
      this.is2DViewActive = false;
    } catch (error) {
      // console.warn("Error restoring slab materials:", error);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // View open/close
  // ────────────────────────────────────────────────────────────────────────

  public openView(groupOrViewKey: string, fallbackViewKey?: string): void {
    this.ensureSlabsPrepared();

    const underlyingViews = this.getUnderlyingViewsForGroup(groupOrViewKey);
    const viewToOpen = underlyingViews[0] ?? fallbackViewKey ?? groupOrViewKey;

    this.views.open(viewToOpen);

    setTimeout(async () => {
      await this.applySlabStyling();
    }, 200);

    setTimeout(async () => {
      await this.applySlabStyling();
    }, 800);

    setTimeout(async () => {
      if (!this.is2DViewActive) {
        await this.applySlabStyling();
      }
    }, 1500);
  }

  public closeCurrentView(): void {
    // console.log("Closing current 2D view and restoring original materials");
    this.restoreSlabMaterials();
    this.views.close();
  }

  // ────────────────────────────────────────────────────────────────────────
  // Manual / fallback storey views
  // ────────────────────────────────────────────────────────────────────────

  private async createAdvancedManualStoreyViews(): Promise<void> {
    try {
      // console.log("Starting advanced manual storey view creation...");

      const fragments = this.fragmentManager.list as Map<string, any>;
      if (fragments.size === 0) {
        // console.warn("No fragments available for manual storey view creation");
        return;
      }

      const [_modelId, fragment] = Array.from(fragments.entries())[0];
      // console.log(`Processing fragment: ${_modelId}`);

      let spatialElements: any[] = [];

      if (fragment.spatialStructure) {
        spatialElements = this.extractSpatialElements(fragment.spatialStructure);
      } else if (fragment._dataManager) {
        spatialElements = await this.extractFromDataManager(fragment._dataManager);
      } else if (fragment.ifcMetadata) {
        spatialElements = this.extractFromIfcMetadata(fragment.ifcMetadata);
      }

      if (spatialElements.length === 0) {
        // console.log("No spatial elements found, creating default level views...");
        await this.createDefaultLevelViews(fragment);
        return;
      }

      for (const element of spatialElements) {
        await this.createViewForSpatialElement(element, fragment);
      }
    } catch (error) {
      // console.error("Error in advanced manual storey view creation:", error);
      await this.createDefaultLevelViews();
    }
  }

  private extractSpatialElements(spatialStructure: any): any[] {
    const elements: any[] = [];
    try {
      if (Array.isArray(spatialStructure)) {
        elements.push(...spatialStructure);
      } else if (spatialStructure.storeys) {
        elements.push(...spatialStructure.storeys);
      } else if (spatialStructure.levels) {
        elements.push(...spatialStructure.levels);
      } else if (spatialStructure.floors) {
        elements.push(...spatialStructure.floors);
      }
      // console.log(`Found ${elements.length} spatial elements`);
    } catch (error) {
      // console.warn("Error extracting spatial elements:", error);
    }
    return elements;
  }

  private async extractFromDataManager(dataManager: any): Promise<any[]> {
    const elements: any[] = [];
    try {
      if (dataManager.getStoreys) {
        const storeys = await dataManager.getStoreys();
        elements.push(...storeys);
      } else if (dataManager.getSpatialElements) {
        const spatial = await dataManager.getSpatialElements();
        elements.push(...spatial);
      }
      // console.log(`Data manager found ${elements.length} elements`);
    } catch (error) {
      // console.warn("Error extracting from data manager:", error);
    }
    return elements;
  }

  private extractFromIfcMetadata(metadata: any): any[] {
    const elements: any[] = [];
    try {
      const storeyTypes = ["IfcBuildingStorey", "IfcLevel", "IfcFloor"];
      for (const type of storeyTypes) {
        if (metadata[type]) {
          const typeElements = Array.isArray(metadata[type]) ? metadata[type] : [metadata[type]];
          elements.push(...typeElements);
        }
      }
      // console.log(`IFC metadata found ${elements.length} elements`);
    } catch (error) {
      // console.warn("Error extracting from IFC metadata:", error);
    }
    return elements;
  }

  private async createViewForSpatialElement(element: any, fragment: any): Promise<void> {
    try {
      const name = element.Name || element.name || element.LongName || `Level_${element.GlobalId || Math.random()}`;
      const elevation = element.Elevation || element.elevation || 0;

      const bbox = fragment.getBoundingBox ? fragment.getBoundingBox() : null;
      let center = new THREE.Vector3(0, 0, 0);

      if (bbox) {
        center.copy(bbox.getCenter(new THREE.Vector3()));
      }

      const position = center.clone();
      position.y = elevation + 10;

      const target = center.clone();
      target.y = elevation;

      await this.views.create({
        name: String(name),
        world: this.world,
        camera: {
          position,
          target,
          up: new THREE.Vector3(0, 0, -1),
        },
      } as any);

      // console.log(`Created view: ${name} at elevation ${elevation}`);
    } catch (error) {
      // console.warn(`Could not create view for spatial element:`, error);
    }
  }

  private async createDefaultLevelViews(fragment?: any): Promise<void> {
    // console.log("Creating default level views...");

    try {
      const defaultLevels = [
        { name: "Level 00", elevation: 0 },
        { name: "Level 01", elevation: 3000 },
        { name: "Level 02", elevation: 6000 },
        { name: "Level 03", elevation: 9000 },
        { name: "Ground Floor", elevation: 0 },
        { name: "First Floor", elevation: 3000 },
        { name: "Second Floor", elevation: 6000 },
      ];

      let center = new THREE.Vector3(0, 0, 0);
      let size = new THREE.Vector3(50, 50, 50);

      if (fragment && fragment.getBoundingBox) {
        const bbox = fragment.getBoundingBox();
        center.copy(bbox.getCenter(new THREE.Vector3()));
        size.copy(bbox.getSize(new THREE.Vector3()));
      }

      for (const level of defaultLevels) {
        try {
          const position = center.clone();
          position.y = level.elevation + Math.max(size.y, size.z) * 0.5;

          const target = center.clone();
          target.y = level.elevation;

          await this.views.create({
            name: level.name,
            world: this.world,
            camera: {
              position,
              target,
              up: new THREE.Vector3(0, 0, -1),
            },
          } as any);

          // console.log(`Created default view: ${level.name}`);
        } catch (error) {
          // console.warn(`Failed to create default view ${level.name}:`, error);
        }
      }
    } catch (error) {
      // console.error("Error creating default level views:", error);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // UI Panel
  // ────────────────────────────────────────────────────────────────────────

  private createUI(): HTMLElement | null {
    return this.createGroupedViewsPanel();
  }

  private createGroupedViewsPanel(): HTMLElement | null {
    BUI.Manager.init();
    const rows = this.getDisplayRows();

    this.panel = BUI.Component.create<BUI.PanelSection>(() => {
      return BUI.html`
        <div class="right-panel-section views-section">
          <div class="panel-header" @click=${() => this.togglePanel()}>
            <div class="panel-header-content">
              <div class="panel-title">
                <svg class="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                </svg>
                <span>2D Views</span>
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
                    <span class="reset-title">Reset 2D Views</span>
                    <span class="reset-description">Restore default view</span>
                  </div>
                  <button class="modern-reset-btn" @click=${() => this.closeCurrentView()}>
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
          <div class="views-list">
            ${rows.map(
              (row) => BUI.html`
                <div class="view-item">
                  <div class="view-item-content">
                    <div class="view-item-info">
                      <span class="view-item-name">${row.displayName}</span>
                    </div>
                    <button
                      class="view-item-button"
                      @click=${(event: MouseEvent) => {
                        event.stopPropagation();
                        this.openView(row.displayName, row.viewKey);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="8,5 16,12 8,19"></polyline>
                      </svg>
                    </button>
                  </div>
                </div>
              `
            )}
          </div>
        </div>
        </div>
      `;
    });

    this.setCollapsed(true);
    return this.panel;
  }

  private normalizeLevelName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  private async loadLevelGroupsConfig(): Promise<void> {
    this.groupToLevels = {};
    this.levelNameToGroup = {};

    try {
      const response = await fetch("./config.json");
      if (!response.ok) {
        console.warn(`config.json returned ${response.status}; using raw view names`);
        return;
      }

      const config = await response.json();
      const groups = config?.levelGroups;

      if (groups && typeof groups === "object") {
        this.groupToLevels = groups as Record<string, string[]>;

        for (const groupName in groups) {
          const levelNames = groups[groupName];
          if (!Array.isArray(levelNames)) continue;

          for (const level of levelNames) {
            if (typeof level === "string" && level.trim().length > 0) {
              const normalized = this.normalizeLevelName(level);
              this.levelNameToGroup[normalized] = groupName;
            }
          }
        }
      } else {
        console.warn("levelGroups missing in config.json; using raw view names");
      }
    } catch (error) {
      console.warn("Could not load levelGroups for Views panel:", error);
    }
  }

  private getDisplayRows(): Array<{ displayName: string; viewKey: string; subLevels: string[] }> {
    const viewNames = [...this.views.list.keys()];

    const normalizedMap = new Map<string, string>();
    for (const name of viewNames) {
      const normalized = this.normalizeLevelName(name);
      if (!normalizedMap.has(normalized)) {
        normalizedMap.set(normalized, name);
      }
    }

    const used = new Set<string>();
    const rows: Array<{ displayName: string; viewKey: string; subLevels: string[] }> = [];

    const groupOrder = ["Basement", "Ground", "First Floor", "Second Floor", "Roof"];

    for (const groupName of groupOrder) {
      const rawLevels = this.groupToLevels[groupName];
      if (!Array.isArray(rawLevels)) continue;

      const matchedViews: string[] = [];

      for (const levelName of rawLevels) {
        const normalized = this.normalizeLevelName(levelName);

        const exact = normalizedMap.get(normalized);
        const actual =
          exact ??
          viewNames.find((v) =>
            this.normalizeLevelName(v).includes(normalized)
          );

        if (!actual || used.has(actual)) continue;

        matchedViews.push(actual);
        used.add(actual);
      }

      if (matchedViews.length > 0) {
        rows.push({
          displayName: groupName,
          viewKey: matchedViews[0],
          subLevels: matchedViews,
        });
      }
    }

    const orientations = [
      { keyword: "front", label: "Front" },
      { keyword: "back",  label: "Back"  },
      { keyword: "left",  label: "Left"  },
      { keyword: "right", label: "Right" },
    ];

    for (const { keyword, label } of orientations) {
      const view = viewNames.find((name) => {
        if (used.has(name)) return false;
        return this.normalizeLevelName(name).includes(keyword);
      });

      if (view) {
        used.add(view);
        rows.push({
          displayName: label,
          viewKey: view,
          subLevels: [view],
        });
      }
    }

    return rows;
  }

  private getUnderlyingViewsForGroup(groupName: string): string[] {
    const allViewNames = [...this.views.list.keys()];
    const levelNames = this.groupToLevels[groupName];

    if (!levelNames || !Array.isArray(levelNames)) {
      return [];
    }

    const matchingViews: string[] = [];

    for (const levelName of levelNames) {
      const normalized = this.normalizeLevelName(levelName);

      const matchingView = allViewNames.find(viewName =>
        this.normalizeLevelName(viewName) === normalized ||
        this.normalizeLevelName(viewName).includes(normalized)
      );

      if (matchingView && !matchingViews.includes(matchingView)) {
        matchingViews.push(matchingView);
      }
    }

    return matchingViews;
  }

  private togglePanel(): void {
    if (this.panel) this.panel.classList.toggle("collapsed");
  }

  public getViewsList(): string[] {
    return [...this.views.list.keys()];
  }

  public getPanel(): HTMLElement | null {
    return this.panel;
  }

  public setCollapsed(collapsed: boolean): void {
    if (!this.panel) return;
    if (collapsed) this.panel.classList.add("collapsed");
    else this.panel.classList.remove("collapsed");
  }

  // ────────────────────────────────────────────────────────────────────────
  // Utility actions (these still act on meshes; used for quick debug)
  // ────────────────────────────────────────────────────────────────────────

  public setSlabOpacity(opacity: number): void {
    const clamped = Math.max(0, Math.min(1, opacity));
    this.slabElements.forEach((mesh) => {
      const material = mesh.material as THREE.Material;
      if (material && "opacity" in material) {
        (material as any).opacity = clamped;
        (material as any).transparent = clamped < 1;
        material.needsUpdate = true;
      }
    });
    // console.log(`Set slab opacity to ${clamped} (mesh-based; highlighted slabs use definition)`);
  }

  public toggleSlabVisibility(): void {
    this.slabElements.forEach((mesh) => {
      mesh.visible = !mesh.visible;
    });
    // console.log("Toggled slab visibility (mesh-based)");
  }

  public inspectModels(): void {
    // console.log("=== DETAILED MODEL INSPECTION ===");

    const fragments = this.fragmentManager.list;
    // console.log(`Total fragments: ${fragments.size}`);
    // console.log(`Total slab elements identified: ${this.slabElements.size}`);

    // console.log("Re-identifying slab elements...");
    fragments.forEach((fragment: any) => {
      this.identifySlabElements(fragment);
    });
    // console.log(`After re-identification: ${this.slabElements.size} slab elements`);

    fragments.forEach((fragment: any, modelId: string) => {
/*       console.log(`\n=== Model ID: ${modelId} ===`);
      console.log("Fragment type:", fragment.constructor.name);
      console.log("Fragment properties:", Object.keys(fragment)); */

      this.inspectFragmentProperty(fragment, "_dataManager", "Data Manager");
      this.inspectFragmentProperty(fragment, "spatialStructure", "Spatial Structure");
      this.inspectFragmentProperty(fragment, "ifcMetadata", "IFC Metadata");
      this.inspectFragmentProperty(fragment, "_itemsManager", "Items Manager");
      this.inspectFragmentProperty(fragment, "_bbox", "Bounding Box");

      this.tryGetStoreyData(fragment, modelId);
    });

    // console.log("=== END DETAILED INSPECTION ===");
  }

  private inspectFragmentProperty(fragment: any, propertyName: string, _displayName: string): void {
    try {
      if (fragment[propertyName]) {
        // console.log(`\n${displayName}:`, typeof fragment[propertyName]);
        if (typeof fragment[propertyName] === "object") {
          // console.log(`${displayName} properties:`, Object.keys(fragment[propertyName]));
          if (propertyName === "_bbox" && fragment[propertyName]) {
            try {
              const bbox = fragment[propertyName];
              if (bbox.min && bbox.max) {
                // console.log("BBox min:", bbox.min);
                // console.log("BBox max:", bbox.max);
              }
            } catch {
              // console.log("Could not read bbox details");
            }
          }
        }
      }
    } catch (error) {
      // console.log(`Error inspecting ${displayName}:`, error);
    }
  }

  private tryGetStoreyData(fragment: any, _modelId: string): void {
    // console.log(`\n--- Trying to get storey data for ${_modelId} ---`);

    const methods = ["getStoreys", "getLevels", "getFloors", "getSpatialElements"];
    for (const method of methods) {
      try {
        if (typeof fragment[method] === "function") {
          const _result = fragment[method]();
          // console.log(`${method}() returned:`, _result);
          if (_result && Array.isArray(_result)) {
            // console.log(`${method}() found ${_result.length} items`);
            _result.slice(0, 3).forEach((_item: any, _index: number) => {
              // console.log(`  Item ${_index}:`, _item);
            });
          }
        }
      } catch (error) {
        // console.log(`${method}() failed:`, error);
      }
    }

    if (fragment._dataManager) {
      // console.log("Checking data manager...");
      const dataManager = fragment._dataManager;
      const dmMethods = ["getStoreys", "getLevels", "getSpatialElements", "getAllItems"];

      for (const method of dmMethods) {
        try {
          if (typeof dataManager[method] === "function") {
            dataManager[method]();
            // console.log(`DataManager.${method}():`, result);
          }
        } catch (error) {
          // console.log(`DataManager.${method}() failed:`, error);
        }
      }
    }

    if (fragment._itemsManager) {
      // console.log("Checking items manager...");
      try {
        const itemsManager = fragment._itemsManager;
        if (itemsManager.groups) {
          // console.log("Items manager groups:", itemsManager.groups);
        }
        if (itemsManager.list) {
          // console.log("Items manager list size:", itemsManager.list.size);
        }
      } catch (error) {
        // console.log("Items manager check failed:", error);
      }
    }
  }

  public listAllMeshes(): void {
    // console.log("=== LISTING ALL MESHES IN MODEL ===");

    const fragments = this.fragmentManager.list;
    fragments.forEach((fragment: any, _modelId: string) => {
      // console.log(`\n--- Meshes in fragment: ${_modelId} ---`);

      const fragmentObject = fragment.object;
      if (!fragmentObject) {
        // console.log("No fragment object found");
        return;
      }

      let meshCount = 0;
      const meshDetails: any[] = [];

      fragmentObject.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          meshCount++;
          const name = child.name || "unnamed";
          const userData = child.userData || {};
          const ifcType = userData.ifcType || userData.type || "unknown";
          const materialName = (child.material as THREE.Material)?.name || "unknown";
          const materialType = (child.material as THREE.Material)?.type || "unknown";

          meshDetails.push({
            index: meshCount,
            name,
            ifcType,
            materialName,
            materialType,
            visible: child.visible,
            hasGeometry: !!child.geometry,
            vertices: child.geometry?.attributes?.position?.count || 0,
          });

          if (meshCount <= 20) {
/*             console.log(
              `${meshCount}. "${name}" | IFC: "${ifcType}" | Material: "${materialName}" (${materialType}) | Vertices: ${child.geometry?.attributes?.position?.count || 0}`
            ); */
          }
        }
      });

      // console.log(`Total meshes found: ${meshCount}`);
      if (meshCount > 20) {
/*         console.log(`... and ${meshCount - 20} more meshes (see "meshDetails" array)`);
        console.log("Full mesh details:", meshDetails); */
      }

      meshDetails.reduce((acc: any, mesh) => {
        const type = mesh.ifcType;
        if (!acc[type]) acc[type] = [];
        acc[type].push(mesh.name);
        return acc;
      }, {});
      // console.log("Meshes grouped by IFC type:", ifcTypes);
    });

    // console.log("=== END MESH LISTING ===");
  }

  public dispose(): void {
    // Cleanup if needed
    this.panel = null;
    this.slabElements.clear();
    this.originalSlabMaterials.clear();
  }
}
