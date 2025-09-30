import * as THREE from "three";
import type { ModelManager } from "./ModelManager";
import type { HiderPanel } from "./HiderPanel";

interface GroupedData {
  [key: string]: string[];
}

interface ColorConfig {
  [key: string]: string;
}

export class Highlighter {
  private modelManager: ModelManager;
  private highlightedItems = new Map<string, Set<number>>(); // modelId -> Set of localIds
  private hider: HiderPanel;
  private categoryData: GroupedData | null = null;
  private colorConfig: ColorConfig | null = null;

  constructor(modelManager: ModelManager, hider: HiderPanel) {
    this.modelManager = modelManager;
    this.hider = hider;
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
      console.log("Category data loaded successfully");
    } catch (error) {
      console.error("Error loading category data:", error);
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
        throw new Error(
          `Failed to fetch color config: ${response.statusText}`
        );
      }
      const config = await response.json();
      this.colorConfig = config.colorKey || {};
      console.log("Color configuration loaded successfully");
    } catch (error) {
      console.error("Error loading color configuration:", error);
      throw error;
    }
  }

  /**
   * Determine the primary category from a list of categories to get the appropriate color
   */
  private getPrimaryCategoryKey(categories: string[]): string {
    if (!categories || categories.length === 0) {
      return 'default';
    }

    // Remove brackets and quotes from category names to match colorKey
    const cleanCategories = categories.map(cat => 
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
   * Get color for a category with appropriate opacity based on progress status
   */
  private getCategoryColor(categories: string[], progressStatus?: 'IN_PROGRESS' | 'COMPLETED'): THREE.Color {
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
  private getOpacityForStatus(progressStatus?: 'IN_PROGRESS' | 'COMPLETED'): number {
    if (progressStatus === 'COMPLETED') {
      return 1; // Full opacity for completed
    } else if (progressStatus === 'IN_PROGRESS') {
      return 0.2; // Reduced opacity for in progress
    }
    return 0.6; // Default opacity
  }

public async highlight(
  modelId?: string,
  levels: string[] = [],
  categories: string[] = [],
  progressStatus?: 'IN_PROGRESS' | 'COMPLETED'
): Promise<void> {
  console.log(`Highlight called with: modelId=${modelId}, levels=[${levels.join(', ')}], categories=[${categories.join(', ')}], status=${progressStatus}`);

  // If modelId is specified, check if it exists in fragment manager
  if (modelId) {
    const model = this.modelManager.fragmentManager.list.get(modelId);
    if (!model) {
      console.log(`Model ${modelId} not loaded, skipping highlight`);
      return;
    }
  }

  let itemsToHighlight = new Map<string, Set<number>>();

  if (categories.length > 0 && levels.length > 0) {
    console.log('Getting intersection of categories and levels');
    const categoryItems = await this.getItemsByCategoryFromJson(categories, modelId);
    const levelItems = await this.getItemsByLevel(levels, modelId);
    itemsToHighlight = this.getIntersection(categoryItems, levelItems);
    console.log('Intersection result:', itemsToHighlight);
  } else if (categories.length > 0) {
    console.log('Getting items by categories only');
    itemsToHighlight = await this.getItemsByCategoryFromJson(categories, modelId);
  } else if (levels.length > 0) {
    console.log('Getting items by levels only');
    itemsToHighlight = await this.getItemsByLevel(levels, modelId);
  }

  if (itemsToHighlight.size === 0) {
    return;
  }

  console.log(`Items to highlight:`, itemsToHighlight);

  // Get category-based color and opacity
  const categoryColor = this.getCategoryColor(categories, progressStatus);
  const opacity = this.getOpacityForStatus(progressStatus);

  const materialDefinition = {
    color: categoryColor,
    opacity: opacity,
    transparent: true,
    renderedFaces: 0,
  };

  console.log(`Using color: ${categoryColor.getHexString()}, opacity: ${opacity}, for categories: [${categories.join(', ')}], status: ${progressStatus}`);

  // Highlight items in each model
  for (const [targetModelId, localIds] of itemsToHighlight) {
    const model = this.modelManager.fragmentManager.list.get(targetModelId);
    if (!model) {
      continue;
    }

    const localIdsArray = Array.from(localIds);
    console.log(`Highlighting ${localIdsArray.length} items in model ${targetModelId}`);
    
    try {
      model.highlight(localIdsArray, materialDefinition);
      this.modelManager.fragmentManager.core.update(true);
      console.log(`Successfully highlighted ${localIdsArray.length} items in model ${targetModelId}`);
      this.highlightedItems.set(targetModelId, localIds);
    } catch (error) {
      continue;
    }
  }

  console.log('Highlighting completed');
}

  /**
   * Get items by category from external JSON file
   */
private async getItemsByCategoryFromJson(
  categories: string[],
  targetModelId?: string
): Promise<Map<string, Set<number>>> {
  if (!this.categoryData) {
    throw new Error('Category data not loaded. Call loadCategoryData() first.');
  }

  console.log(`Getting items for categories: ${categories.join(', ')}`);
  const itemsMap = new Map<string, Set<number>>();

  for (const category of categories) {
    const guidList = this.categoryData[category];
    if (!guidList || guidList.length === 0) {
      continue;
    }

    console.log(`Found ${guidList.length} GUIDs for category '${category}'`);

    try {
      const modelIdMap = await this.modelManager.fragmentManager.guidsToModelIdMap(guidList);
      
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

        console.log(`Adding ${localIdsArray.length} items from model ${modelId} for category '${category}'`);

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

  console.log(`Final items map for categories:`, itemsMap);
  return itemsMap;
}

private getIntersection(
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
  private async getItemsByCategory(
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

private async getItemsByLevel(
  levels: string[],
  targetModelId?: string
): Promise<Map<string, Set<number>>> {
  console.log(`Getting items for levels: ${levels.join(', ')}`);
  
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

    console.log(`Found level '${level}' in classification`);

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

        console.log(`Adding ${localIdsArray.length} items from model ${modelId} for level '${level}'`);

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

  console.log(`Final items map for levels:`, itemsMap);
  return itemsMap;
}

  // Highlighter.ts â€” replace the existing resetHighlight() with this:
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

  // âœ… Force a render right away so colors disappear immediately
  try {
    this.modelManager.fragmentManager.core.update(true);
  } catch {}
}

  public dispose(): void {
    this.resetHighlight();
    this.highlightedItems.clear();
    this.modelManager.fragmentManager.core.update(true);
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