import * as XLSX from "xlsx";
import type { Config } from "../types";

export class FileUtils {
  static async loadJSONConfig(url: string): Promise<Config> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load config from ${url}`);
    }
    return response.json();
  }

  static async loadExcelData(url: string): Promise<any[][]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load Excel data from ${url}`);
    }
    const buffer = await response.arrayBuffer();
    return this.loadExcelDataFromBuffer(buffer);
  }

  static async loadExcelDataFromBuffer(buffer: ArrayBuffer): Promise<any[][]> {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  }

  static async processExcelFile(
    url: string,
    requiredKeywords: string[]
  ): Promise<ArrayBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const data: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

    const filteredData = data.filter((row) => {
      const hasValidData =
        row["Activity ID"] !== undefined &&
        row["Activity ID"] !== "" &&
        row["Activity Name"] !== undefined &&
        row["Activity Name"] !== "" &&
        row["Performance % Complete"] !== undefined &&
        row["Performance % Complete"] !== "" &&
        Number(row["Performance % Complete"]) !== 0;

      const activityName = String(row["Activity Name"]).toLowerCase();
      const hasRequiredKeyword = requiredKeywords.some((keyword) =>
        activityName.includes(keyword.toLowerCase())
      );

      return hasValidData && hasRequiredKeyword;
    });

    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtered");

    return XLSX.write(wb, { bookType: "xlsx", type: "array" });
  }
}
