import * as THREE from "three";
import type { ModelManager } from "./ModelManager";
import type { HiderPanel } from "./HiderPanel";

interface GroupedData {
  [key: string]: string[];
}

interface ColorConfig {
  [key: string]: string;
}

interface HighlightParams {
  zone?: string;
  level?: string;
  category?: string[];
  status?: "IN_PROGRESS" | "COMPLETED";
}

export class Highlighter {
  private modelManager: ModelManager;
  private highlightedItems = new Map<string, Set<number>>(); // modelId -> Set of localIds
  private hider: HiderPanel;
  private categoryData: GroupedData | null = null;
  private colorConfig: ColorConfig | null = null;
  // Batch rendering flags to avoid incremental repaints while applying many highlights
  private batchMode = false;
  private pendingUpdate = false;

  // Changed to use string keys instead of objects for uniqueness
  public highlightParamsToIds = new Map<string, number[]>();

  constructor(modelManager: ModelManager, hider: HiderPanel) {
    this.modelManager = modelManager;
    this.hider = hider;
  }

  /**
   * Create a unique string key from highlight parameters
   */
  private createParamsKey(params: HighlightParams): string {
    const sortedCategories = params.category ? [...params.category].sort() : [];
    return JSON.stringify({
      zone: params.zone || "",
      level: params.level || "",
      category: sortedCategories,
      status: params.status || ""
    });
  }

  /**
   * Load category data from external JSON file
   */
  public async loadCategoryData(jsonUrl: string): Promise<void> {
    try {
      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch category data: ${response.statusText}`
        );
      }
      this.categoryData = await response.json();
      // console.log("Category data loaded successfully");
    } catch (error) {
      // console.error("Error loading category data:", error);
      throw error;
    }
  }

  /**
   * Load color configuration from config.json
   */
  public async loadColorConfig(configUrl: string): Promise<void> {
    try {
      const response = await fetch(configUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch color config: ${response.statusText}`);
      }
      const config = await response.json();
      this.colorConfig = config.colorKey || {};
      // console.log("Color configuration loaded successfully");
    } catch (error) {
      // console.error("Error loading color configuration:", error);
      throw error;
    }
  }

  /**
   * Determine the primary category from a list of categories to get the appropriate color
   */
  private getPrimaryCategoryKey(categories: string[]): string {
    if (!categories || categories.length === 0) {
      return "default";
    }

    // Remove brackets and quotes from category names to match colorKey
    const cleanCategories = categories.map((cat) =>
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
   * Get color for a category with appropriate opacity based on progress status
   */
  private getCategoryColor(
    categories: string[],
    _progressStatus?: "IN_PROGRESS" | "COMPLETED"
  ): THREE.Color {
    const categoryKey = this.getPrimaryCategoryKey(categories);

    let baseColor = "#87CEEB"; // Default sky blue

    if (this.colorConfig && this.colorConfig[categoryKey]) {
      baseColor = this.colorConfig[categoryKey];
    }

    return new THREE.Color(baseColor);
  }

  /**
   * Get opacity based on progress status
   */
  private getOpacityForStatus(
    progressStatus?: "IN_PROGRESS" | "COMPLETED"
  ): number {
    if (progressStatus === "COMPLETED") {
      return 1; // Full opacity for completed
    } else if (progressStatus === "IN_PROGRESS") {
      return 0.8; // Reduced opacity for in progress
    }
    return 0.6; // Default opacity
  }

  /**
   * Begin a batched highlight operation (no renders until endBatch).
   */
  public beginBatch(): void {
    this.batchMode = true;
    this.pendingUpdate = false;
  }

  /**
   * End a batched highlight operation and flush a single render if needed.
   */
  public endBatch(): void {
    this.batchMode = false;
    if (this.pendingUpdate) {
      try {
        this.modelManager.fragmentManager.core.update(true);
      } catch {
        // ignore
      }
      this.pendingUpdate = false;
    }
  }

  /**
   * Apply a very light, transparent background highlight to all elements
   * that are NOT part of the given activeItems set.
   *
   * This makes active (completed / in-progress) items stand out clearly.
   */
  public async applyDimBackground(
    activeItems: Map<string, Set<number>>,
    opacity: number = 0.1
  ): Promise<void> {
    if (!activeItems.size) return;

    const backgroundMaterialDefinition = {
      color: new THREE.Color("#CBD5E1"), // neutral gray
      opacity,
      transparent: true,
      renderedFaces: 0,
    };

    for (const modelId of this.modelManager.modelIds) {
      const fragment = this.modelManager.fragmentManager.list.get(modelId);
      if (!fragment) continue;

      let allLocalIds: number[];
      try {
        allLocalIds = await fragment.getLocalIds();
      } catch {
        continue;
      }

      if (!allLocalIds || allLocalIds.length === 0) continue;

      const activeForModel = activeItems.get(modelId);
      const backgroundIds: number[] = [];

      if (activeForModel && activeForModel.size > 0) {
        // Dim everything except active IDs
        for (const id of allLocalIds) {
          if (!activeForModel.has(id)) {
            backgroundIds.push(id);
          }
        }
      } else {
        // No active elements in this model: dim the entire model
        backgroundIds.push(...allLocalIds);
      }

      if (!backgroundIds.length) continue;

      try {
        fragment.highlight(backgroundIds, backgroundMaterialDefinition);
      } catch {
        continue;
      }
    }

    if (this.batchMode) {
      this.pendingUpdate = true;
    } else {
      try {
        this.modelManager.fragmentManager.core.update(true);
      } catch {
        // ignore
      }
    }
  }

  public async highlight(
    modelId?: string,
    levels: string[] = [],
    categories: string[] = [],
    progressStatus?: "IN_PROGRESS" | "COMPLETED"
  ): Promise<void> {
    // Parse and flatten levels - handle both JSON strings and regular arrays
    const parsedLevels = levels.map(level => {
      if (typeof level === 'string' && level.startsWith('[')) {
        try {
          return JSON.parse(level);
        } catch {
          return level;
        }
      }
      return level;
    });
    const flattenedLevels = parsedLevels.flat(Infinity) as string[];
    
    // Parse and flatten categories - handle both JSON strings and regular arrays
    const parsedCategories = categories.map(cat => {
      if (typeof cat === 'string' && cat.startsWith('[')) {
        try {
          return JSON.parse(cat);
        } catch {
          return cat;
        }
      }
      return cat;
    });
    const flattenedCategories = parsedCategories.flat(Infinity) as string[];
    
    console.log(
      `Highlight called with: modelId=${modelId}, levels=[${flattenedLevels.join(", ")}], categories=[${flattenedCategories.join(", ")}], status=${progressStatus}`
    );

    // If modelId is specified, check if it exists in fragment manager
    if (modelId) {
      const model = this.modelManager.fragmentManager.list.get(modelId);
      if (!model) {
        console.log(`Model ${modelId} not loaded, skipping highlight`);
        return;
      }
    }

    let itemsToHighlight = new Map<string, Set<number>>();

    if (flattenedCategories.length > 0 && flattenedLevels.length > 0) {
      console.log("Getting intersection of categories and levels");
      const categoryItems = await this.getItemsByCategoryFromJson(
        flattenedCategories,
        modelId
      );
      const levelItems = await this.getItemsByLevel(flattenedLevels, modelId);
      itemsToHighlight = await this.getIntersection(categoryItems, levelItems);
      console.log("Intersection result:", itemsToHighlight);
    } else if (flattenedCategories.length > 0) {
      console.log("Getting items by categories only");
      itemsToHighlight = await this.getItemsByCategoryFromJson(
        flattenedCategories,
        modelId
      );
    } else if (flattenedLevels.length > 0) {
      console.log("Getting items by levels only");
      itemsToHighlight = await this.getItemsByLevel(flattenedLevels, modelId);
    }

    if (itemsToHighlight.size === 0) {
      return;
    }

    console.log(`Items to highlight:`, itemsToHighlight);

    // Get category-based color and opacity
    const categoryColor = this.getCategoryColor(flattenedCategories, progressStatus);
    const opacity = this.getOpacityForStatus(progressStatus);

    const materialDefinition = {
      color: categoryColor,
      opacity: opacity,
      transparent: true,
      renderedFaces: 0,
    };

    console.log(
      `Using color: ${categoryColor.getHexString()}, opacity: ${opacity}, for categories: [${flattenedCategories.join(
        ", "
      )}], status: ${progressStatus}`
    );

    // Highlight items in each model and store params
    for (const [targetModelId, localIds] of itemsToHighlight) {
      const model = this.modelManager.fragmentManager.list.get(targetModelId);
      if (!model) {
        continue;
      }

      const localIdsArray = Array.from(localIds);
      console.log(
        `Highlighting ${localIdsArray.length} items in model ${targetModelId}`
      );

      try {
        model.highlight(localIdsArray, materialDefinition);
        if (this.batchMode) {
          this.pendingUpdate = true;
        } else {
          this.modelManager.fragmentManager.core.update(true);
        }
        console.log(
          `Successfully highlighted ${localIdsArray.length} items in model ${targetModelId}`
        );
        this.highlightedItems.set(targetModelId, localIds);

        // Store params for each level separately using the CLEANED flattened values
        for (const level of flattenedLevels) {
          const params: HighlightParams = {
            zone: targetModelId,
            level: level, // Use cleaned level from flattenedLevels
            category: flattenedCategories, // Use cleaned categories from flattenedCategories
            status: progressStatus,
          };
          
          const paramsKey = this.createParamsKey(params);
          
          // Check if key already exists and merge if needed
          if (this.highlightParamsToIds.has(paramsKey)) {
            const existingIds = this.highlightParamsToIds.get(paramsKey)!;
            const mergedIds = [...new Set([...existingIds, ...localIdsArray])];
            this.highlightParamsToIds.set(paramsKey, mergedIds);
          } else {
            this.highlightParamsToIds.set(paramsKey, localIdsArray);
          }
        }
        
        console.log(`Stored params for model ${targetModelId}:`, {
          levels: flattenedLevels,
          categories: flattenedCategories,
          status: progressStatus
        });
      } catch (error) {
        continue;
      }
    }

    console.log("Highlighting completed");
    console.log('Stored params:', Array.from(this.highlightParamsToIds.entries()));
  }

  /**
   * Get all unique highlight parameter keys
   */
  public getUniqueParamKeys(): string[] {
    return Array.from(this.highlightParamsToIds.keys());
  }

  /**
   * Get highlight parameters object from key
   */
  public getParamsFromKey(key: string): HighlightParams | null {
    try {
      return JSON.parse(key) as HighlightParams;
    } catch {
      return null;
    }
  }

  /**
   * Clear the highlight parameters map
   */
  public clearParamsMap(): void {
    this.highlightParamsToIds.clear();
  }

  /**
   * Get items by category from external JSON file
   */
  public async getItemsByCategoryFromJson(
    categories: string[],
    targetModelId?: string
  ): Promise<Map<string, Set<number>>> {
    if (!this.categoryData) {
      throw new Error(
        "Category data not loaded. Call loadCategoryData() first."
      );
    }

    // console.log(`Getting items for categories: ${categories.join(", ")}`);
    const itemsMap = new Map<string, Set<number>>();

    for (const category of categories) {
      const guidList = this.categoryData[category];
      if (!guidList || guidList.length === 0) {
        continue;
      }

      // console.log(`Found ${guidList.length} GUIDs for category '${category}'`);

      try {
        const modelIdMap =
          await this.modelManager.fragmentManager.guidsToModelIdMap(guidList);

        if (!modelIdMap || Object.keys(modelIdMap).length === 0) {
          continue;
        }

        for (const [modelId, localIds] of Object.entries(modelIdMap)) {
          // STRICT FILTERING: Only process if matches targetModelId or no filter specified
          if (targetModelId && modelId !== targetModelId) {
            continue;
          }

          // Additional check: Ensure model exists in fragment manager
          const model = this.modelManager.fragmentManager.list.get(modelId);
          if (!model) {
            continue;
          }

          let localIdsArray: number[] = [];

          if (Array.isArray(localIds)) {
            localIdsArray = localIds;
          } else if (localIds instanceof Set) {
            localIdsArray = Array.from(localIds);
          } else {
            continue;
          }

          if (localIdsArray.length === 0) {
            continue;
          }

/*           console.log(
            `Adding ${localIdsArray.length} items from model ${modelId} for category '${category}'`
          ); */

          if (!itemsMap.has(modelId)) {
            itemsMap.set(modelId, new Set());
          }

          const existingIds = itemsMap.get(modelId)!;
          localIdsArray.forEach((id) => existingIds.add(id));
        }
      } catch (error) {
        continue;
      }
    }

    // console.log(`Final items map for categories:`, itemsMap);
    return itemsMap;
  }

  public getIntersection(
    map1: Map<string, Set<number>>,
    map2: Map<string, Set<number>>
  ): Map<string, Set<number>> {
    const intersection = new Map<string, Set<number>>();

    // Only check models that exist in both maps
    for (const [modelId, set1] of map1) {
      const set2 = map2.get(modelId);
      if (!set2) continue; // No items in this model for the second criteria

      // Find intersection of the two sets
      const intersectionSet = new Set<number>();
      for (const id of set1) {
        if (set2.has(id)) {
          intersectionSet.add(id);
        }
      }

      // Only add to result if there are items in the intersection
      if (intersectionSet.size > 0) {
        intersection.set(modelId, intersectionSet);
      }
    }

    return intersection;
  }

  /**
   * Legacy method - kept for backward compatibility with built-in methods
   */
  public async getItemsByCategory(
    categories: string[],
    targetModelId?: string
  ): Promise<Map<string, Set<number>>> {
    const itemsMap = new Map<string, Set<number>>();
    const categoriesRegex = categories.map((cat) => new RegExp(`^${cat}$`));

    // If targetModelId is specified, only process that model
    if (targetModelId) {
      const model = this.modelManager.fragmentManager.list.get(targetModelId);
      if (model) {
        const items = await model.getItemsOfCategories(categoriesRegex);
        const localIds = Object.values(items).flat();

        if (localIds.length > 0) {
          itemsMap.set(targetModelId, new Set(localIds));
        }
      }
    } else {
      // Process all models (original behavior)
      for (const [modelId, model] of this.modelManager.fragmentManager.list) {
        const items = await model.getItemsOfCategories(categoriesRegex);
        const localIds = Object.values(items).flat();

        if (localIds.length > 0) {
          itemsMap.set(modelId, new Set(localIds));
        }
      }
    }

    return itemsMap;
  }

  public async getItemsByLevel(
    levels: string[],
    targetModelId?: string
  ): Promise<Map<string, Set<number>>> {
    // console.log(`Getting items for levels: ${levels.join(", ")}`);

    const itemsMap = new Map<string, Set<number>>();

    for (const level of levels) {
      const classification = this.hider.classifier.list.get("Levels");
      if (!classification) {
        continue;
      }

      const groupData = classification.get(level);
      if (!groupData) {
        continue;
      }

      // console.log(`Found level '${level}' in classification`);

      try {
        const modelIdMap = await groupData.get();

        for (const [modelId, localIds] of Object.entries(modelIdMap)) {
          // STRICT FILTERING: Only process if matches targetModelId or no filter specified
          if (targetModelId && modelId !== targetModelId) {
            continue;
          }

          // Additional check: Ensure model exists in fragment manager
          const model = this.modelManager.fragmentManager.list.get(modelId);
          if (!model) {
            continue;
          }

          let localIdsArray: number[] = [];

          if (Array.isArray(localIds)) {
            localIdsArray = localIds;
          } else if (localIds instanceof Set) {
            localIdsArray = Array.from(localIds);
          } else {
            continue;
          }

          if (localIdsArray.length === 0) {
            continue;
          }

/*           console.log(
            `Adding ${localIdsArray.length} items from model ${modelId} for level '${level}'`
          ); */

          if (!itemsMap.has(modelId)) {
            itemsMap.set(modelId, new Set());
          }
          const existingIds = itemsMap.get(modelId)!;
          localIdsArray.forEach((id) => existingIds.add(id));
        }
      } catch (error) {
        continue;
      }
    }

    // console.log(`Final items map for levels:`, itemsMap);
    return itemsMap;
  }

  // Highlighter.ts – replace the existing resetHighlight() with this:
  public resetHighlight(): void {
    // Remove highlighting from all previously highlighted items
    for (const [modelId, _] of this.highlightedItems) {
      const model = this.modelManager.fragmentManager.list.get(modelId);
      if (!model) continue;
      try {
        model.resetHighlight();
      } catch {}
    }
    // Clear the highlighted items map
    this.highlightedItems.clear();

    // … Force a render right away so colors disappear immediately,
    // unless we're inside a batch (in which case defer to endBatch)
    if (this.batchMode) {
      this.pendingUpdate = true;
    } else {
      try {
        this.modelManager.fragmentManager.core.update(true);
      } catch {}
    }
  }

  public dispose(): void {
    this.beginBatch();
    this.resetHighlight();
    this.highlightedItems.clear();
    this.highlightParamsToIds.clear();
    this.endBatch();
  }

  // Helper method to highlight all items in all models (for testing)
  public async highlightAll(): Promise<void> {
    this.resetHighlight();

    const skyBlueMaterialDefinition = {
      color: new THREE.Color("#87CEEB"),
      opacity: 0.8,
      transparent: true,
      renderedFaces: 0,
    };

    const modelIds = this.modelManager.modelIds;

    for (const id of modelIds) {
      const model = this.modelManager.fragmentManager.list.get(id);
      if (!model) continue;

      const localIds = await model.getLocalIds();

      model.highlight(localIds, skyBlueMaterialDefinition);

      // Store highlighted items for cleanup
      this.highlightedItems.set(id, new Set(localIds));
    }
  }
}