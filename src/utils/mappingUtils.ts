import type { Config, MappedResult } from "../types";

export class MappingUtils {
  static matchKeyword(
    text: string,
    map: Record<string, string[]>
  ): string | undefined {
    const lowerText = text.toLowerCase();
    for (const [key, keywords] of Object.entries(map)) {
      if (keywords.some((k) => lowerText.includes(k.toLowerCase()))) {
        return key;
      }
    }
    return undefined;
  }

  static matchCategoryKeywords(
    text: string,
    categoryMap: Record<string, string[]>
  ): string[] {
    const lowerText = text.toLowerCase();
    const matchedCategories: string[] = [];
    
    for (const [key, keywords] of Object.entries(categoryMap)) {
      if (keywords.some((k) => lowerText.includes(k.toLowerCase()))) {
        // Parse the key - it could be a JSON array string like '["IFCWALL","IFCWALLSTANDARDCASE"]'
        try {
          const categories = JSON.parse(key);
          if (Array.isArray(categories)) {
            matchedCategories.push(...categories);
          } else {
            matchedCategories.push(categories);
          }
        } catch {
          // If parsing fails, treat as single category
          matchedCategories.push(key);
        }
      }
    }
    
    return [...new Set(matchedCategories)]; // Remove duplicates
  }

  // New method to check if text contains force in-progress keywords
  static shouldForceInProgress(
    text: string,
    forceInProgressKeywords: string[]
  ): boolean {
    const lowerText = text.toLowerCase();
    return forceInProgressKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  static mapRow(row: any[], config: Config): MappedResult | undefined {
    const name = String(row[1] ?? "").toLowerCase();
    const progress = Number(row[2]);

    const zone = this.matchKeyword(name, config.zones);
    const level = this.matchKeyword(name, config.levels);
    const categories = this.matchCategoryKeywords(name, config.category);

    let status: MappedResult["status"] | undefined;
    
    // Check if this row should be forced to IN_PROGRESS
    const shouldForceInProgress = config.forceInProgressKeywords && 
      this.shouldForceInProgress(name, config.forceInProgressKeywords);

    if (shouldForceInProgress) {
      // Force to IN_PROGRESS regardless of progress percentage
      status = "IN_PROGRESS";
    } else {
      // Normal status logic
      if (progress > 0 && progress < 100) status = "IN_PROGRESS";
      else if (progress === 100) status = "COMPLETED";
    }

    if (zone && level && categories.length > 0 && status) {
      return { zone, level, category: categories, status };
    }
    return undefined;
  }

  static removeDuplicates(results: MappedResult[]): MappedResult[] {
    return Array.from(
      new Map(results.map((obj) => [JSON.stringify(obj), obj])).values()
    );
  }
}