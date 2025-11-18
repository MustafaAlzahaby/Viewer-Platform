import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import * as THREE from "three";

export class ViewsManager {
  private components: OBC.Components;
  private views: OBC.Views;
  private world: OBC.World;
  private caster: OBC.SimpleRaycaster;
  private panel: HTMLElement | null = null;
  private fragmentManager: any;

  // Keep for tracking which models were highlighted so we can reset cleanly
  private originalSlabMaterials: Map<string, any> = new Map();
  // Optional: still keep mesh refs for logging/utility controls
  private slabElements: Set<THREE.Mesh> = new Set();
  private is2DViewActive: boolean = false;

  constructor(components: OBC.Components, world: OBC.World) {
    this.components = components;
    this.world = world;

    // Initialize Views
    this.views = components.get(OBC.Views);
    OBC.Views.defaultRange = 100;
    this.views.world = world;

    // Fragments manager
    this.fragmentManager = components.get(OBC.FragmentsManager);

    // Raycaster (not used for this feature but kept for your future needs)
    const casters = components.get(OBC.Raycasters);
    this.caster = casters.get(world);

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
      console.log("Re-scanning for slab elements after delay...");
      this.fragmentManager.list.forEach((model: any) => {
        this.identifySlabElements(model);
      });
      console.log(`Total slab elements found after delay: ${this.slabElements.size}`);
    }, 2000);
  }

  async initialize(): Promise<void> {
    // Try multiple strategies to create storey views
    let storeyViewsCreated = false;

    // Approach 1: regex of modelIds
    try {
      const modelIds = Array.from(this.fragmentManager.list.keys());
      console.log("Available model IDs:", modelIds);

      if (modelIds.length > 0) {
        const modelRegexes = modelIds.map((id) => new RegExp(id));
        await this.views.createFromIfcStoreys({
          modelIds: modelRegexes,
          offset: 1.5,
        });
        storeyViewsCreated = true;
      }
    } catch (error) {
      console.warn("Approach 1 failed:", error);
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
        console.warn("Approach 2 failed:", error);
      }
    }

    // Approach 3: manual default views
    if (!storeyViewsCreated) {
      console.log("Trying manual storey view creation...");
      await this.createAdvancedManualStoreyViews();
    }

    // Elevations (Front/Back/Left/Right)
    try {
      this.views.createElevations({ combine: true });
    } catch (error) {
      console.warn("Could not create elevation views:", error);
    }

    // UI
    this.createUI();

    // Final slab scan after init
    setTimeout(() => {
      console.log("Final slab scan after initialization...");
      this.scanAllFragmentsForSlabs();
    }, 3000);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Slab detection utilities (kept for diagnostics; coloring uses local IDs)
  // ────────────────────────────────────────────────────────────────────────
  private scanAllFragmentsForSlabs(): void {
    console.log("=== COMPREHENSIVE SLAB SCAN ===");
    this.slabElements.clear();

    const fragments = this.fragmentManager.list;
    fragments.forEach((fragment: any, modelId: string) => {
      console.log(`Scanning fragment ${modelId} for slabs...`);
      this.identifySlabElements(fragment);
    });

    console.log(`Total slab elements found: ${this.slabElements.size}`);
    if (this.slabElements.size === 0) {
      console.log("No slabs found with standard method, trying alternative approaches...");
      this.tryAlternativeSlabDetection();
    }
  }

  private tryAlternativeSlabDetection(): void {
    console.log("Trying alternative slab detection...");
    const fragments = this.fragmentManager.list;
    fragments.forEach((fragment: any, modelId: string) => {
      const fragmentObject = fragment.object;
      if (!fragmentObject) return;

      fragmentObject.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          if (this.isLikelySlabByGeometry(child) || this.isSlabByAnyPattern(child)) {
            this.slabElements.add(child);
            console.log(`🔍 Alternative detection found slab: ${child.name || "unnamed"}`);
          }
        }
      });
    });
    console.log(`Alternative detection found ${this.slabElements.size} total slab elements`);
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

      console.log(`Identifying slab elements in fragment: ${fragment.modelId || "unknown"}`);
      let foundSlabs = 0;
      let totalMeshes = 0;

      fragmentObject.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          totalMeshes++;
          if (this.isSlabElement(child) || this.isLikelySlabByGeometry(child)) {
            this.slabElements.add(child);
            foundSlabs++;
            console.log(`✓ Identified slab element: ${child.name || "unnamed"} (${(child.material as any)?.type || "unknown material"})`);
          }
        }
      });

      console.log(`Found ${foundSlabs} slab elements out of ${totalMeshes} total meshes in this fragment.`);
      console.log(`Total slabs across all fragments: ${this.slabElements.size}`);
    } catch (error) {
      console.warn("Error identifying slab elements:", error);
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
      console.log(
        `🎯 SLAB DETECTED: "${mesh.name}" - Name:${nameMatches} Type:${typeMatches} Material:${materialMatches} Pattern:${hasLevelPattern || hasSlabPattern}`
      );
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

    for (const [modelId, fragment] of this.fragmentManager.list as Map<string, any>) {
      try {
        if (typeof fragment.getItemsOfCategories !== "function") continue;

        const byCat = await fragment.getItemsOfCategories(categoryRegexes);
        // byCat looks like { IfcSlab: number[], IfcCovering: number[] ... }
        const ids = Object.values(byCat)
          .flat()
          .filter((n) => Number.isFinite(n));

        if (ids.length > 0) {
          result.set(modelId, ids);
        }
      } catch (err) {
        console.warn(`getItemsOfCategories failed for model ${modelId}`, err);
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
          console.warn(`Highlight failed for model ${modelId}`, e);
        }
      }

      this.fragmentManager.core.update(true);
      console.log(`✅ Applied light gray highlighting to ${total} slab items`);
    } catch (error) {
      console.error("Error in applySlabHighlighting:", error);
    }
  }

  /** Wrapper that applies highlighting and flips the active flag. */
  private async applySlabStyling(): Promise<void> {
    // If for any reason slabs set is empty (mesh-based), still proceed; we use category IDs
    if (this.slabElements.size === 0) {
      console.log("No slab meshes recorded; proceeding with category-based highlighting.");
    }
    await this.applySlabHighlighting();
    this.is2DViewActive = true;
  }

  /** Reset highlighting across all models (no direct material restoration needed). */
  private restoreSlabMaterials(): void {
    try {
      console.log("Restoring original slab materials (resetHighlight)...");
      this.fragmentManager.list.forEach((fragment: any, modelId: string) => {
        if (this.originalSlabMaterials.has(`${modelId}_highlighted`)) {
          try {
            fragment.resetHighlight();
            console.log(`✅ Reset highlighting for model: ${modelId}`);
          } catch (error) {
            console.warn(`Could not reset highlight for model ${modelId}:`, error);
          }
          this.originalSlabMaterials.delete(`${modelId}_highlighted`);
        }
      });

      this.fragmentManager.core.update(true);
      this.is2DViewActive = false;
    } catch (error) {
      console.warn("Error restoring slab materials:", error);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // View open/close
  // ────────────────────────────────────────────────────────────────────────

  public openView(viewName: string): void {
    console.log(`Opening 2D view: ${viewName}`);

    // Make sure we have slabs identified (for logs / panel info)
    console.log("Rescanning for slabs before opening view...");
    this.scanAllFragmentsForSlabs();

    this.views.open(viewName);

    // Apply light gray highlighting with a couple of retries
    setTimeout(async () => {
      console.log("Attempting to apply light gray slab styling...");
      await this.applySlabStyling();
    }, 200);

    setTimeout(async () => {
      console.log("Second attempt at styling slabs...");
      await this.applySlabStyling();
    }, 800);

    setTimeout(async () => {
      if (!this.is2DViewActive) {
        console.log("Final attempt: comprehensive slab detection...");
        this.scanAllFragmentsForSlabs();
        await this.applySlabStyling();
      }
    }, 1500);
  }

  public closeCurrentView(): void {
    console.log("Closing current 2D view and restoring original materials");
    this.restoreSlabMaterials();
    this.views.close();
  }

  // ────────────────────────────────────────────────────────────────────────
  // Manual / fallback storey views
  // ────────────────────────────────────────────────────────────────────────

  private async createAdvancedManualStoreyViews(): Promise<void> {
    try {
      console.log("Starting advanced manual storey view creation...");

      const fragments = this.fragmentManager.list;
      if (fragments.size === 0) {
        console.warn("No fragments available for manual storey view creation");
        return;
      }

      const [modelId, fragment] = Array.from(fragments.entries())[0];
      console.log(`Processing fragment: ${modelId}`);

      let spatialElements: any[] = [];

      if (fragment.spatialStructure) {
        spatialElements = this.extractSpatialElements(fragment.spatialStructure);
      } else if (fragment._dataManager) {
        spatialElements = await this.extractFromDataManager(fragment._dataManager);
      } else if (fragment.ifcMetadata) {
        spatialElements = this.extractFromIfcMetadata(fragment.ifcMetadata);
      }

      if (spatialElements.length === 0) {
        console.log("No spatial elements found, creating default level views...");
        await this.createDefaultLevelViews(fragment);
        return;
      }

      for (const element of spatialElements) {
        await this.createViewForSpatialElement(element, fragment);
      }
    } catch (error) {
      console.error("Error in advanced manual storey view creation:", error);
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
      console.log(`Found ${elements.length} spatial elements`);
    } catch (error) {
      console.warn("Error extracting spatial elements:", error);
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
      console.log(`Data manager found ${elements.length} elements`);
    } catch (error) {
      console.warn("Error extracting from data manager:", error);
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
      console.log(`IFC metadata found ${elements.length} elements`);
    } catch (error) {
      console.warn("Error extracting from IFC metadata:", error);
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
      });

      console.log(`Created view: ${name} at elevation ${elevation}`);
    } catch (error) {
      console.warn(`Could not create view for spatial element:`, error);
    }
  }

  private async createDefaultLevelViews(fragment?: any): Promise<void> {
    console.log("Creating default level views...");

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
          });

          console.log(`Created default view: ${level.name}`);
        } catch (error) {
          console.warn(`Failed to create default view ${level.name}:`, error);
        }
      }
    } catch (error) {
      console.error("Error creating default level views:", error);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // UI Panel
  // ────────────────────────────────────────────────────────────────────────

  private createUI(): void {
  BUI.Manager.init();

  type ViewsListTableData = { Name: string; Actions: string };
  interface ViewsListState { components: OBC.Components }

  const viewsTemplate: BUI.StatefullComponent<ViewsListState> = (state) => {
    const views = state.components.get(OBC.Views);
    const onCreated = (e?: Element) => {
      if (!e) return;
      const table = e as BUI.Table<ViewsListTableData>;
      table.data = [...views.list.keys()].map((key) => ({
        data: { Name: key, Actions: "" },
      }));
    };
    return BUI.html`<bim-table ${BUI.ref(onCreated)}></bim-table>`;
  };

  const [viewsTable, updateViewsTable] = BUI.Component.create<
    BUI.Table<ViewsListTableData>,
    ViewsListState
  >(viewsTemplate, { components: this.components });

  viewsTable.headersHidden = true;
  viewsTable.noIndentation = true;
  viewsTable.columns = ["Name", { name: "Actions", width: "auto" }];

  viewsTable.dataTransform = {
    Actions: (_, rowData) => {
      const { Name } = rowData;
      if (!Name) return _;
      const views = this.components.get(OBC.Views);
      const view = views.list.get(Name);
      if (!view) return _;

      const onOpen = () => this.openView(Name);

      return BUI.html`
        <bim-button label-hidden icon="solar:cursor-bold" @click=${onOpen}></bim-button>
      `;
    },
  };

  const refresh = () => updateViewsTable();
  this.views.list.onItemSet.add(refresh);
  this.views.list.onItemDeleted.add(refresh);
  this.views.list.onItemUpdated.add(refresh);
  this.views.list.onCleared.add(refresh);

  this.panel = BUI.Component.create<BUI.PanelSection>(() => {
    const onClose = () => this.closeCurrentView();
    const onInspect = () => this.inspectModels();
    const onToggleSlabs = () => this.toggleSlabVisibility();
    const onSetLightOpacity = () => this.setSlabOpacity(0.2);
    const onSetMediumOpacity = () => this.setSlabOpacity(0.5);
    const onRestoreMaterials = () => this.restoreSlabMaterials();
    const onForceSlabStyling = () => this.applySlabStyling();
    const onListAllMeshes = () => this.listAllMeshes();
    const onRescanSlabs = () => this.scanAllFragmentsForSlabs();

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
          <div class="views-table-container">
            ${viewsTable}
          </div>
        </div>
      </div>
    `;
  });

  // Set the panel as collapsed by default
  this.setCollapsed(true);

  return this.panel;
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
    console.log(`Set slab opacity to ${clamped} (mesh-based; highlighted slabs use definition)`);
  }

  public toggleSlabVisibility(): void {
    this.slabElements.forEach((mesh) => {
      mesh.visible = !mesh.visible;
    });
    console.log("Toggled slab visibility (mesh-based)");
  }

  public inspectModels(): void {
    console.log("=== DETAILED MODEL INSPECTION ===");

    const fragments = this.fragmentManager.list;
    console.log(`Total fragments: ${fragments.size}`);
    console.log(`Total slab elements identified: ${this.slabElements.size}`);

    console.log("Re-identifying slab elements...");
    fragments.forEach((fragment: any) => {
      this.identifySlabElements(fragment);
    });
    console.log(`After re-identification: ${this.slabElements.size} slab elements`);

    fragments.forEach((fragment: any, modelId: string) => {
      console.log(`\n=== Model ID: ${modelId} ===`);
      console.log("Fragment type:", fragment.constructor.name);
      console.log("Fragment properties:", Object.keys(fragment));

      this.inspectFragmentProperty(fragment, "_dataManager", "Data Manager");
      this.inspectFragmentProperty(fragment, "spatialStructure", "Spatial Structure");
      this.inspectFragmentProperty(fragment, "ifcMetadata", "IFC Metadata");
      this.inspectFragmentProperty(fragment, "_itemsManager", "Items Manager");
      this.inspectFragmentProperty(fragment, "_bbox", "Bounding Box");

      this.tryGetStoreyData(fragment, modelId);
    });

    console.log("=== END DETAILED INSPECTION ===");
  }

  private inspectFragmentProperty(fragment: any, propertyName: string, displayName: string): void {
    try {
      if (fragment[propertyName]) {
        console.log(`\n${displayName}:`, typeof fragment[propertyName]);
        if (typeof fragment[propertyName] === "object") {
          console.log(`${displayName} properties:`, Object.keys(fragment[propertyName]));
          if (propertyName === "_bbox" && fragment[propertyName]) {
            try {
              const bbox = fragment[propertyName];
              if (bbox.min && bbox.max) {
                console.log("BBox min:", bbox.min);
                console.log("BBox max:", bbox.max);
              }
            } catch {
              console.log("Could not read bbox details");
            }
          }
        }
      }
    } catch (error) {
      console.log(`Error inspecting ${displayName}:`, error);
    }
  }

  private tryGetStoreyData(fragment: any, modelId: string): void {
    console.log(`\n--- Trying to get storey data for ${modelId} ---`);

    const methods = ["getStoreys", "getLevels", "getFloors", "getSpatialElements"];
    for (const method of methods) {
      try {
        if (typeof fragment[method] === "function") {
          const result = fragment[method]();
          console.log(`${method}() returned:`, result);
          if (result && Array.isArray(result)) {
            console.log(`${method}() found ${result.length} items`);
            result.slice(0, 3).forEach((item: any, index: number) => {
              console.log(`  Item ${index}:`, item);
            });
          }
        }
      } catch (error) {
        console.log(`${method}() failed:`, error);
      }
    }

    if (fragment._dataManager) {
      console.log("Checking data manager...");
      const dataManager = fragment._dataManager;
      const dmMethods = ["getStoreys", "getLevels", "getSpatialElements", "getAllItems"];

      for (const method of dmMethods) {
        try {
          if (typeof dataManager[method] === "function") {
            const result = dataManager[method]();
            console.log(`DataManager.${method}():`, result);
          }
        } catch (error) {
          console.log(`DataManager.${method}() failed:`, error);
        }
      }
    }

    if (fragment._itemsManager) {
      console.log("Checking items manager...");
      try {
        const itemsManager = fragment._itemsManager;
        if (itemsManager.groups) {
          console.log("Items manager groups:", itemsManager.groups);
        }
        if (itemsManager.list) {
          console.log("Items manager list size:", itemsManager.list.size);
        }
      } catch (error) {
        console.log("Items manager check failed:", error);
      }
    }
  }

  public listAllMeshes(): void {
    console.log("=== LISTING ALL MESHES IN MODEL ===");

    const fragments = this.fragmentManager.list;
    fragments.forEach((fragment: any, modelId: string) => {
      console.log(`\n--- Meshes in fragment: ${modelId} ---`);

      const fragmentObject = fragment.object;
      if (!fragmentObject) {
        console.log("No fragment object found");
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
            console.log(
              `${meshCount}. "${name}" | IFC: "${ifcType}" | Material: "${materialName}" (${materialType}) | Vertices: ${child.geometry?.attributes?.position?.count || 0}`
            );
          }
        }
      });

      console.log(`Total meshes found: ${meshCount}`);
      if (meshCount > 20) {
        console.log(`... and ${meshCount - 20} more meshes (see "meshDetails" array)`);
        console.log("Full mesh details:", meshDetails);
      }

      const ifcTypes = meshDetails.reduce((acc: any, mesh) => {
        const type = mesh.ifcType;
        if (!acc[type]) acc[type] = [];
        acc[type].push(mesh.name);
        return acc;
      }, {});
      console.log("Meshes grouped by IFC type:", ifcTypes);
    });

    console.log("=== END MESH LISTING ===");
  }
}
