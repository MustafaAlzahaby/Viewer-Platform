import type { Config, MappedResult } from "../types";
import { FileUtils } from "../utils/fileUtils";
import { MappingUtils } from "../utils/mappingUtils";

export class DataProcessor {
  private config: Config | null = null;
  private filteredBuffer: ArrayBuffer | null = null;
  
  public inProgressResults: MappedResult[] = [];
  public completedResults: MappedResult[] = [];

  async initialize(configUrl: string, dataUrl: string): Promise<void> {
    try {
      this.config = await FileUtils.loadJSONConfig(configUrl);
      this.filteredBuffer = await FileUtils.processExcelFile(dataUrl, this.config.filter);
      await this.processData();
    } catch (error) {
      console.error("Failed to initialize data processor:", error);
      throw error;
    }
  }

  private async processData(): Promise<void> {
    if (!this.config || !this.filteredBuffer) {
      throw new Error("Data processor not properly initialized");
    }

    const excelData = await FileUtils.loadExcelDataFromBuffer(this.filteredBuffer);
    const results = excelData
      .map((row) => MappingUtils.mapRow(row, this.config!))
      .filter((r): r is MappedResult => r !== undefined);

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
