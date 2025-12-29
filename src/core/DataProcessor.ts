import type { Config, MappedResult } from "../types";
import { FileUtils } from "../utils/fileUtils";
import { MappingUtils } from "../utils/mappingUtils";

export class DataProcessor {
  private config: Config | null = null;
  private filteredBuffer: ArrayBuffer | null = null;
  
  public inProgressResults: MappedResult[] = [];
  public completedResults: MappedResult[] = [];
  
  // Map to store raw Excel rows and their corresponding extracted parameters
  public rawToMappedResults: Map<any[], MappedResult> = new Map();

  async initialize(configUrl: string, dataUrl: string): Promise<void> {
    try {
      this.config = await FileUtils.loadJSONConfig(configUrl);
      this.filteredBuffer = await FileUtils.processExcelFile(dataUrl, this.config.filter);
      await this.processData();
    } catch (error) {
      console.error("Failed to initialize data processor:", error);
      // Don't throw - allow viewer to continue without data processing
      // Set empty results so the viewer can still function
      this.inProgressResults = [];
      this.completedResults = [];
      console.warn("Data processor initialized with empty results - viewer will work but highlighting features will be limited");
    }
  }

  private async processData(): Promise<void> {
    if (!this.config || !this.filteredBuffer) {
      throw new Error("Data processor not properly initialized");
    }

    const excelData = await FileUtils.loadExcelDataFromBuffer(this.filteredBuffer);
    
    // Clear existing mapping
    this.rawToMappedResults.clear();
    
    // Process rows and create mapping
    const results: MappedResult[] = [];
    excelData.forEach((row) => {
      const mappedResult = MappingUtils.mapRow(row, this.config!);
      if (mappedResult) {
        results.push(mappedResult);
        // Store the mapping between raw row and extracted parameters
        this.rawToMappedResults.set(row, mappedResult);
      }
    });

    const uniqueResults = MappingUtils.removeDuplicates(results);
    
    this.inProgressResults = uniqueResults.filter((r) => r.status === "IN_PROGRESS");
    this.completedResults = uniqueResults.filter((r) => r.status === "COMPLETED");

    console.log("In Progress Results:", this.inProgressResults);
    console.log("Completed Results:", this.completedResults);
  }

  getResultsByStatus(status: "in-progress" | "completed"): MappedResult[] {
    return status === "in-progress" ? this.inProgressResults : this.completedResults;
  }
}