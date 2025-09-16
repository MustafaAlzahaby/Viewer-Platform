// ExcelDataPanel.ts - Optimized Version with Finish Column
import * as XLSX from "xlsx";

export interface ExcelRowData {
  [key: string]: any;
}

export class ExcelDataPanel {
  private container: HTMLElement;
  private data: ExcelRowData[] = [];
  private columnA: string = "";
  private columnB: string = "";
  private columnC: string = ""; // New column for Finish
  private expandedRows: Set<number> = new Set();
  private isCollapsed: boolean = false;
  private selectedRowIndex: number = -1;
  private tableBody: HTMLTableSectionElement | null = null;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) || document.body;
    this.createPanel();
    this.addSearchBox();
    // Collapse the panel by default
    this.isCollapsed = false; // Ensure toggleCollapse works as expected
    this.toggleCollapse();
  }

  private createPanel(): void {
    // Create the main panel container
    const panel = document.createElement("div");
    panel.id = "excel-data-panel";
    panel.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      bottom: 20px;
      width: 500px;
      height: calc(100vh - 40px);
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(15px);
      border: 1px solid rgba(226, 232, 240, 0.8);
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      z-index: 1000;
      font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      resize: horizontal;
      overflow: hidden;
      min-width: 400px;
      display: flex;
      flex-direction: column;
      color: #1e293b;
      animation: slideInFromLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    // Create header
    const header = document.createElement("div");
    header.style.cssText = `
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-bottom: 1px solid rgba(226, 232, 240, 0.2);
      border-radius: 16px 16px 0 0;
      font-weight: 600;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 1rem;
      letter-spacing: -0.02em;
    `;

    // Add hover effect to header
    header.addEventListener("mouseenter", () => {
      header.style.background =
        "linear-gradient(135deg, #5a67d8 0%, #6b46a8 100%)";
    });
    header.addEventListener("mouseleave", () => {
      header.style.background =
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    });

    // Create title and collapse button container
    const headerContent = document.createElement("div");
    headerContent.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    `;

    const title = document.createElement("span");
    title.textContent = "Activity-Progress-Finish";
    title.style.cssText = `
      flex: 1;
      font-weight: 600;
      color: white;
      font-size: 1rem;
      letter-spacing: -0.02em;
    `;

    // Create collapse arrow
    const collapseArrow = document.createElement("div");
    collapseArrow.id = "collapse-arrow";
    collapseArrow.innerHTML = "▼";
    collapseArrow.style.cssText = `
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    collapseArrow.addEventListener("mouseenter", () => {
      collapseArrow.style.background = "rgba(255, 255, 255, 0.25)";
      collapseArrow.style.transform = "scale(1.05)";
    });
    collapseArrow.addEventListener("mouseleave", () => {
      collapseArrow.style.background = "rgba(255, 255, 255, 0.15)";
      collapseArrow.style.transform = "scale(1)";
    });

    headerContent.appendChild(title);
    headerContent.appendChild(collapseArrow);
    header.appendChild(headerContent);

    // Add click handler for collapse/expand
    header.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleCollapse();
    });

    // Add resize handle to the panel
    const panelResizeHandle = document.createElement("div");
    panelResizeHandle.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 100%;
      cursor: ew-resize;
      background: linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.3), transparent);
      z-index: 10;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    panel.addEventListener("mouseenter", () => {
      panelResizeHandle.style.opacity = "1";
    });
    panel.addEventListener("mouseleave", () => {
      panelResizeHandle.style.opacity = "0";
    });

    this.addPanelResizeHandler(panelResizeHandle, panel);

    // Create content container
    const content = document.createElement("div");
    content.id = "excel-content";
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 0;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      max-height: none;
      opacity: 1;
      background: rgba(255, 255, 255, 0.95);
    `;

    // Create table with thead and tbody for better performance
    const table = document.createElement("table");
    table.id = "excel-table";
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      table-layout: fixed;
      font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;

    // Create table head
    const thead = document.createElement("thead");
    table.appendChild(thead);

    // Create table body
    this.tableBody = document.createElement("tbody");
    table.appendChild(this.tableBody);

    content.appendChild(table);
    panel.appendChild(header);
    panel.appendChild(content);
    panel.appendChild(panelResizeHandle);
    this.container.appendChild(panel);
  }

  private addPanelResizeHandler(handle: HTMLElement, panel: HTMLElement): void {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(
        document.defaultView!.getComputedStyle(panel).width,
        10
      );
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      e.preventDefault();
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const width = startWidth + e.clientX - startX;
      const minWidth = 400;
      const maxWidth = window.innerWidth * 0.8;
      if (width >= minWidth && width <= maxWidth) {
        panel.style.width = width + "px";
      }
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }

  public async loadExcelData(
    filePath: string,
    columnAName: string,
    columnBName: string,
    columnCName: string = "Finish" // New parameter for third column
  ): Promise<void> {
    try {
      // Show loading state
      const panel = document.getElementById("excel-data-panel");
      if (panel) panel.classList.add("loading");

      // Fetch the Excel file
      const response = await fetch(filePath);
      const arrayBuffer = await response.arrayBuffer();

      // Parse Excel file
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length === 0) {
        console.error("No data found in Excel file");
        return;
      }

      // Get headers (first row)
      const headers = jsonData[0] as string[];
      const columnAIndex = headers.findIndex((header) =>
        header.toLowerCase().includes(columnAName.toLowerCase())
      );
      const columnBIndex = headers.findIndex((header) =>
        header.toLowerCase().includes(columnBName.toLowerCase())
      );
      const columnCIndex = headers.findIndex((header) =>
        header.toLowerCase().includes(columnCName.toLowerCase())
      );

      if (columnAIndex === -1 || columnBIndex === -1 || columnCIndex === -1) {
        console.error(
          `Columns "${columnAName}", "${columnBName}", or "${columnCName}" not found`
        );
        return;
      }

      // Extract data rows
      this.data = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        const valueA = row[columnAIndex];
        const valueB = row[columnBIndex];
        const valueC = row[columnCIndex];

        // Skip rows where the first column (columnA) is empty/undefined
        if (valueA !== undefined && valueA !== null && valueA !== "") {
          this.data.push({
            [columnAName]: valueA || "",
            [columnBName]:
              valueB !== undefined && valueB !== null ? valueB : "", // Handle 0 values properly
            [columnCName]:
              valueC !== undefined && valueC !== null ? valueC : "", // Handle 0 values properly
          });
        }
      }

      this.columnA = columnAName;
      this.columnB = columnBName;
      this.columnC = columnCName;
      this.renderTable();
    } catch (error) {
      console.error("Error loading Excel data:", error);
    } finally {
      // Remove loading state
      const panel = document.getElementById("excel-data-panel");
      if (panel) panel.classList.remove("loading");
    }
  }

  private renderTable(): void {
    const table = document.getElementById("excel-table") as HTMLTableElement;
    if (!table || !this.tableBody) return;

    // Clear existing content
    const thead = table.querySelector("thead");
    const tbody = this.tableBody;

    if (thead) thead.innerHTML = "";
    tbody.innerHTML = "";

    // Create header row only once
    this.createTableHeader(thead!);

    // Create data rows with optimized rendering
    this.createTableRows(tbody);
  }

  private createTableHeader(thead: HTMLTableSectionElement): void {
    const headerRow = thead.insertRow();
    headerRow.style.cssText = `
      background: rgba(248, 250, 252, 0.95);
      font-weight: 600;
      border-bottom: 2px solid rgba(226, 232, 240, 0.8);
      color: #1e293b;
      position: sticky;
      top: 0;
      z-index: 10;
    `;

    // First column (Activity) - wider
    const th1 = document.createElement("th");
    th1.textContent = this.columnA;
    th1.style.cssText = `
      padding: 16px 20px;
      text-align: left;
      border-right: 1px solid rgba(226, 232, 240, 0.6);
      width: 50%;
      position: relative;
      font-weight: 600;
      color: #1e293b;
      font-size: 0.95rem;
      letter-spacing: -0.01em;
      background: rgba(248, 250, 252, 0.95);
    `;

    // Add resize handle to first column header
    const resizeHandle = document.createElement("div");
    resizeHandle.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      background: linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.4), transparent);
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    th1.addEventListener("mouseenter", () => {
      resizeHandle.style.opacity = "1";
    });
    th1.addEventListener("mouseleave", () => {
      resizeHandle.style.opacity = "0";
    });

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(
        document.defaultView!.getComputedStyle(th1).width,
        10
      );
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      e.preventDefault();
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const width = startWidth + e.clientX - startX;
      const minWidth = 100;
      const maxWidth = 600;
      if (width > minWidth && width < maxWidth) {
        th1.style.width = width + "px";
        // Update all cells in first column efficiently
        const rows = this.tableBody?.querySelectorAll("tr");
        rows?.forEach((row) => {
          const firstCell = row.cells[0];
          if (firstCell) {
            firstCell.style.width = width + "px";
          }
        });
      }
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    th1.appendChild(resizeHandle);

    // Second column (Progress)
    const th2 = document.createElement("th");
    th2.textContent = this.columnB;
    th2.style.cssText = `
      padding: 16px 20px;
      text-align: center;
      border-right: 1px solid rgba(226, 232, 240, 0.6);
      width: 25%;
      font-weight: 600;
      color: #1e293b;
      font-size: 0.95rem;
      letter-spacing: -0.01em;
      background: rgba(248, 250, 252, 0.95);
    `;

    // Third column (Finish)
    const th3 = document.createElement("th");
    th3.textContent = this.columnC;
    th3.style.cssText = `
      padding: 16px 20px;
      text-align: center;
      width: 25%;
      font-weight: 600;
      color: #1e293b;
      font-size: 0.95rem;
      letter-spacing: -0.01em;
      background: rgba(248, 250, 252, 0.95);
    `;

    headerRow.appendChild(th1);
    headerRow.appendChild(th2);
    headerRow.appendChild(th3);
  }

  private createTableRows(tbody: HTMLTableSectionElement): void {
    // Use DocumentFragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();

    this.data.forEach((row, index) => {
      const dataRow = this.createSingleRow(row, index);
      fragment.appendChild(dataRow);
    });

    // Single DOM update
    tbody.appendChild(fragment);
  }

  private createSingleRow(
    row: ExcelRowData,
    index: number
  ): HTMLTableRowElement {
    const dataRow = document.createElement("tr");
    const isExpanded = this.expandedRows.has(index);
    const isSelected = this.selectedRowIndex === index;

    dataRow.style.cssText = `
      border-bottom: 1px solid rgba(226, 232, 240, 0.5);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      background: ${
        index % 2 === 0
          ? "rgba(255, 255, 255, 0.95)"
          : "rgba(248, 250, 252, 0.8)"
      };
      ${
        isSelected
          ? "background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; color: white !important; transform: translateX(4px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
          : ""
      }
    `;

    // Add optimized hover effects using CSS classes instead of inline styles
    dataRow.classList.add("excel-row");
    if (isSelected) dataRow.classList.add("selected");
    dataRow.dataset.index = index.toString();

    // Add click handler for row selection and expansion
    dataRow.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRowClickOptimized(row, index, dataRow);
    });

    // First column (Activity)
    const cell1 = dataRow.insertCell();
    const valueA = row[this.columnA];
    cell1.textContent =
      valueA !== undefined && valueA !== null ? valueA.toString() : "";
    cell1.style.cssText = `
      padding: 16px 20px;
      border-right: 1px solid ${
        isSelected ? "rgba(255, 255, 255, 0.2)" : "rgba(226, 232, 240, 0.4)"
      };
      width: 50%;
      overflow: ${isExpanded ? "visible" : "hidden"};
      text-overflow: ${isExpanded ? "clip" : "ellipsis"};
      white-space: ${isExpanded ? "pre-wrap" : "nowrap"};
      word-break: ${isExpanded ? "break-word" : "normal"};
      vertical-align: top;
      color: ${isSelected ? "white" : "#1e293b"};
      font-weight: 500;
      line-height: 1.4;
    `;

    // Second column (Progress)
    const cell2 = dataRow.insertCell();
    let displayValueB = "";
    const rawValueB = row[this.columnB];

    if (rawValueB !== null && rawValueB !== undefined) {
      if (rawValueB === "" || rawValueB === 0) {
        displayValueB = rawValueB === 0 ? "0%" : "";
      } else {
        const numValue = parseFloat(rawValueB);
        if (!isNaN(numValue)) {
          displayValueB = Math.round(numValue) + "%";
        } else {
          displayValueB = rawValueB.toString();
        }
      }
    }

    cell2.textContent = displayValueB;
    cell2.style.cssText = `
      padding: 16px 20px;
      border-right: 1px solid ${
        isSelected ? "rgba(255, 255, 255, 0.2)" : "rgba(226, 232, 240, 0.4)"
      };
      width: 25%;
      text-align: center;
      overflow: ${isExpanded ? "visible" : "hidden"};
      text-overflow: ${isExpanded ? "clip" : "ellipsis"};
      white-space: ${isExpanded ? "pre-wrap" : "nowrap"};
      word-break: ${isExpanded ? "break-word" : "normal"};
      vertical-align: top;
      color: ${isSelected ? "rgba(255, 255, 255, 0.9)" : "#667eea"};
      font-weight: 600;
    `;

    // Third column (Finish) - Date formatting
    const cell3 = dataRow.insertCell();
    let displayValueC = "";
    const rawValueC = row[this.columnC];

    if (rawValueC !== null && rawValueC !== undefined && rawValueC !== "") {
      const dateString = rawValueC.toString().trim();

      // Handle Excel date serial numbers
      if (typeof rawValueC === "number" && rawValueC > 40000) {
        // Excel date serial number (days since 1900-01-01)
        const excelDate = new Date((rawValueC - 25569) * 86400 * 1000);
        displayValueC = excelDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
      // Handle format like "31-May-25 A" or "18-Jun-25 A"
      else if (/^\d{1,2}-[A-Za-z]{3}-\d{2}\s*[A-Za-z]*$/.test(dateString)) {
        // Extract the date part (remove trailing letters like " A")
        const datePart = dateString.replace(/\s*[A-Za-z]*$/, "");
        const parts = datePart.split("-");
        if (parts.length === 3) {
          const day = parts[0];
          const month = parts[1];
          const year = "20" + parts[2]; // Convert 25 to 2025

          // Create date string in a format JavaScript can parse
          const parseableDate = `${month} ${day}, ${year}`;
          const dateValue = new Date(parseableDate);

          if (!isNaN(dateValue.getTime())) {
            displayValueC = dateValue.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
          } else {
            displayValueC = dateString; // Fallback to original
          }
        } else {
          displayValueC = dateString;
        }
      }
      // Handle standard formats like "Sep 18, 2025"
      else if (rawValueC instanceof Date) {
        displayValueC = rawValueC.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } else {
        // Try to parse as standard date string
        const dateValue = new Date(dateString);
        if (!isNaN(dateValue.getTime())) {
          displayValueC = dateValue.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        } else {
          // If not a valid date, display as-is
          displayValueC = dateString;
        }
      }
    }

    cell3.textContent = displayValueC;
    cell3.style.cssText = `
      padding: 16px 20px;
      width: 25%;
      text-align: center;
      overflow: ${isExpanded ? "visible" : "hidden"};
      text-overflow: ${isExpanded ? "clip" : "ellipsis"};
      white-space: ${isExpanded ? "pre-wrap" : "nowrap"};
      word-break: ${isExpanded ? "break-word" : "normal"};
      vertical-align: top;
      color: ${isSelected ? "rgba(255, 255, 255, 0.9)" : "#10b981"};
      font-weight: 600;
    `;

    return dataRow;
  }

  private onRowClickOptimized(
    rowData: ExcelRowData,
    index: number,
    rowElement: HTMLTableRowElement
  ): void {
    console.log("Row clicked:", rowData, "Index:", index);

    // Toggle row expansion
    const wasExpanded = this.expandedRows.has(index);
    if (wasExpanded) {
      this.expandedRows.delete(index);
    } else {
      this.expandedRows.add(index);
    }

    // Update selection efficiently
    const previouslySelected = this.selectedRowIndex;
    this.selectedRowIndex = index;

    // Remove selection from previously selected row
    if (previouslySelected !== -1 && this.tableBody) {
      const prevRow = this.tableBody.querySelector(
        `tr[data-index="${previouslySelected}"]`
      ) as HTMLTableRowElement;
      if (prevRow) {
        this.updateRowSelection(prevRow, previouslySelected, false);
      }
    }

    // Update current row selection and expansion
    this.updateRowSelection(rowElement, index, true);

    // Update row expansion state
    this.updateRowExpansion(rowElement, index, !wasExpanded);

    // Emit custom event for integration with BIM viewer
    const event = new CustomEvent("excelRowSelected", {
      detail: { data: rowData, index },
    });
    document.dispatchEvent(event);
  }

  private updateRowSelection(
    rowElement: HTMLTableRowElement,
    index: number,
    isSelected: boolean
  ): void {
    const cell1 = rowElement.cells[0];
    const cell2 = rowElement.cells[1];
    const cell3 = rowElement.cells[2];

    if (isSelected) {
      rowElement.style.background =
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      rowElement.style.color = "white";
      rowElement.style.transform = "translateX(4px)";
      rowElement.style.boxShadow =
        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
      rowElement.classList.add("selected");

      if (cell1) {
        cell1.style.color = "white";
        cell1.style.borderRight = "1px solid rgba(255, 255, 255, 0.2)";
      }
      if (cell2) {
        cell2.style.color = "rgba(255, 255, 255, 0.9)";
        cell2.style.borderRight = "1px solid rgba(255, 255, 255, 0.2)";
      }
      if (cell3) {
        cell3.style.color = "rgba(255, 255, 255, 0.9)";
      }
    } else {
      rowElement.style.background =
        index % 2 === 0
          ? "rgba(255, 255, 255, 0.95)"
          : "rgba(248, 250, 252, 0.8)";
      rowElement.style.color = "#1e293b";
      rowElement.style.transform = "translateX(0)";
      rowElement.style.boxShadow = "none";
      rowElement.classList.remove("selected");

      if (cell1) {
        cell1.style.color = "#1e293b";
        cell1.style.borderRight = "1px solid rgba(226, 232, 240, 0.4)";
      }
      if (cell2) {
        cell2.style.color = "#667eea";
        cell2.style.borderRight = "1px solid rgba(226, 232, 240, 0.4)";
      }
      if (cell3) {
        cell3.style.color = "#10b981";
      }
    }
  }

  private updateRowExpansion(
    rowElement: HTMLTableRowElement,
    index: number,
    isExpanded: boolean
  ): void {
    const cell1 = rowElement.cells[0];
    const cell2 = rowElement.cells[1];
    const cell3 = rowElement.cells[2];

    [cell1, cell2, cell3].forEach((cell) => {
      if (cell) {
        cell.style.overflow = isExpanded ? "visible" : "hidden";
        cell.style.textOverflow = isExpanded ? "clip" : "ellipsis";
        cell.style.whiteSpace = isExpanded ? "pre-wrap" : "nowrap";
        cell.style.wordBreak = isExpanded ? "break-word" : "normal";
      }
    });
  }

  public filterData(searchTerm: string): void {
    if (!this.tableBody) return;

    const rows = this.tableBody.querySelectorAll("tr");

    rows.forEach((row, index) => {
      const rowData = this.data[index];
      if (rowData) {
        const matches = Object.values(rowData).some(
          (value) =>
            value !== null &&
            value !== undefined &&
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (matches || searchTerm === "") {
          (row as HTMLElement).style.display = "";
        } else {
          (row as HTMLElement).style.display = "none";
        }
      }
    });
  }

  public addSearchBox(): void {
    const panel = document.getElementById("excel-data-panel");
    if (!panel) return;

    const searchContainer = document.createElement("div");
    searchContainer.id = "search-container";
    searchContainer.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.6);
      background: rgba(248, 250, 252, 0.95);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    `;

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search data...";
    searchInput.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      border: 1px solid rgba(226, 232, 240, 0.8);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.95);
      color: #1e293b;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;

    // Add focus styles
    searchInput.addEventListener("focus", () => {
      searchInput.style.borderColor = "#667eea";
      searchInput.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
      searchInput.style.transform = "translateY(-1px)";
    });

    searchInput.addEventListener("blur", () => {
      searchInput.style.borderColor = "rgba(226, 232, 240, 0.8)";
      searchInput.style.boxShadow = "none";
      searchInput.style.transform = "translateY(0)";
    });

    // Debounced search for better performance
    let searchTimeout: NodeJS.Timeout;
    searchInput.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.filterData(target.value);
      }, 150); // 150ms debounce
    });

    searchContainer.appendChild(searchInput);

    // Insert after header
    const header = panel.firstChild;
    if (header && header.nextSibling) {
      panel.insertBefore(searchContainer, header.nextSibling);
    }
  }

  public hide(): void {
    const panel = document.getElementById("excel-data-panel");
    if (panel) panel.style.display = "none";
  }

  public show(): void {
    const panel = document.getElementById("excel-data-panel");
    if (panel) panel.style.display = "block";
  }

  private toggleCollapse(): void {
    console.log("Toggle collapse called, current state:", this.isCollapsed);

    const panel = document.getElementById("excel-data-panel");
    const content = document.getElementById("excel-content");
    const arrow = document.getElementById("collapse-arrow");

    if (!panel || !content || !arrow) {
      console.error("Required elements not found:", {
        panel: !!panel,
        content: !!content,
        arrow: !!arrow,
      });
      return;
    }

    this.isCollapsed = !this.isCollapsed;
    console.log("New collapse state:", this.isCollapsed);

    // Find search container by looking for the input element
    const searchContainer = panel.querySelector(
      'input[placeholder="Search data..."]'
    )?.parentElement as HTMLElement;

    if (this.isCollapsed) {
      // Collapse
      content.style.maxHeight = "0";
      content.style.padding = "0";
      content.style.opacity = "0";
      content.style.overflow = "hidden";
      arrow.style.transform = "rotate(-90deg)";
      arrow.innerHTML = "▶"; // Right arrow when collapsed

      // Hide search container if it exists
      if (searchContainer) {
        searchContainer.style.maxHeight = "0";
        searchContainer.style.padding = "0";
        searchContainer.style.overflow = "hidden";
        searchContainer.style.opacity = "0";
      }

      // Adjust panel to fit only header
      panel.style.height = "auto";
      panel.style.minHeight = "auto";
      panel.style.maxHeight = "72px"; // Just enough for header
      panel.style.bottom = "auto";
      panel.classList.add("collapsed");
    } else {
      // Expand
      content.style.maxHeight = "";
      content.style.padding = "0";
      content.style.opacity = "1";
      content.style.overflow = "auto";
      arrow.style.transform = "rotate(0deg)";
      arrow.innerHTML = "▼"; // Down arrow when expanded

      // Show search container if it exists
      if (searchContainer) {
        searchContainer.style.maxHeight = "";
        searchContainer.style.padding = "16px 20px";
        searchContainer.style.overflow = "visible";
        searchContainer.style.opacity = "1";
      }

      // Restore panel to full height
      panel.style.height = "calc(100vh - 40px)";
      panel.style.minHeight = "200px";
      panel.style.maxHeight = "";
      panel.style.bottom = "20px";
      panel.classList.remove("collapsed");
    }
  }

  public getCollapseState(): boolean {
    return this.isCollapsed;
  }

  public setCollapseState(collapsed: boolean): void {
    if (this.isCollapsed !== collapsed) {
      this.toggleCollapse();
    }
  }

  public dispose(): void {
    const panel = document.getElementById("excel-data-panel");
    if (panel) panel.remove();
  }
}
