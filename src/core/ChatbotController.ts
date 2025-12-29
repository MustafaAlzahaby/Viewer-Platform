import type { HighlightController } from "./HighlightController";
import type { ViewsManager } from "./ViewsManager";
import type { HiderPanel } from "./HiderPanel";

/**
 * Command types that the chatbot can execute
 */
export type CommandType = 
  | "show-completed" 
  | "show-in-progress" 
  | "show-both" 
  | "clear" 
  | "status" 
  | "help" 
  | "show-level-basement"
  | "show-level-ground"
  | "show-level-first-floor"
  | "show-level-second-floor"
  | "show-level-roof"
  | "filter-level-status"
  | "reset-levels"
  | "show-2d-front"
  | "show-2d-back"
  | "show-2d-left"
  | "show-2d-right"
  | "reset-2d-views"
  | "filter-category"
  | "filter-category-status"
  | "reset-category-filter"
  | "reset-all"
  | "completion-percentage"
  | "unknown";

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  message: string;
  commandType: CommandType;
}

/**
 * Command handler interface for extensibility
 */
export interface CommandHandler {
  canHandle(input: string): boolean;
  execute(controller: HighlightController): Promise<CommandResult>;
  getDescription(): string;
}

/**
 * Base command handler with common functionality
 */
abstract class BaseCommandHandler implements CommandHandler {
  protected keywords: string[];
  public readonly commandType: CommandType;
  protected description: string;

  constructor(keywords: string[], commandType: CommandType, description: string) {
    this.keywords = keywords;
    this.commandType = commandType;
    this.description = description;
  }

  canHandle(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    return this.keywords.some(keyword => normalized.includes(keyword));
  }

  abstract execute(controller: HighlightController): Promise<CommandResult>;

  getDescription(): string {
    return this.description;
  }
}

/**
 * Show completed elements command handler (additive-aware)
 */
class ShowCompletedHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      ["completed", "done", "finished", "complete", "completed elements", "completed too", "completed with", "show completed"],
      "show-completed",
      "Show completed elements"
    );
    this.controller = controller;
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    const states = controller.getCheckboxStates();

    // Detect if this command is additive ("too", "also", "as well", etc.)
    const input = this.controller.getLastInput();
    const isAdditive = this.controller.isAdditiveCommand(input);

    // If already showing completed (and no in-progress) and it's not additive, do nothing
    if (!isAdditive && states.completed && !states.inProgress) {
      return {
        success: true,
        message: "Completed elements are already highlighted.",
        commandType: this.commandType,
      };
    }

    // In non-additive mode, keep status exclusive (turn off in-progress)
    if (!isAdditive && states.inProgress) {
      await controller.toggleInProgress(false);
    }

    // Turn on completed (in additive mode we just add it on top)
    await controller.toggleCompleted(true);

    const message = isAdditive
      ? "I've added the completed elements to your current highlights."
      : "I've highlighted all completed elements for you.";

    return {
      success: true,
      message,
      commandType: this.commandType,
    };
  }
}

/**
 * Show in-progress elements command handler (additive-aware)
 */
class ShowInProgressHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      ["in progress", "in-progress", "progress", "ongoing", "working", "active", "in progress elements", "in progress too", "in progress with", "show in progress"],
      "show-in-progress",
      "Show in-progress elements"
    );
    this.controller = controller;
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    const states = controller.getCheckboxStates();

    // Detect if this command is additive ("too", "also", "as well", etc.)
    const input = this.controller.getLastInput();
    const isAdditive = this.controller.isAdditiveCommand(input);

    // If already showing in-progress (and no completed) and it's not additive, do nothing
    if (!isAdditive && states.inProgress && !states.completed) {
      return {
        success: true,
        message: "In-progress elements are already highlighted.",
        commandType: this.commandType,
      };
    }

    // In non-additive mode, keep status exclusive (turn off completed)
    if (!isAdditive && states.completed) {
      await controller.toggleCompleted(false);
    }

    // Turn on in-progress (in additive mode we just add it on top)
    await controller.toggleInProgress(true);

    const message = isAdditive
      ? "I've added the in-progress elements to your current highlights."
      : "I've highlighted all in-progress elements for you.";

    return {
      success: true,
      message,
      commandType: this.commandType,
    };
  }
}

/**
 * Show both completed and in-progress elements command handler
 */
class ShowBothHandler extends BaseCommandHandler {
  constructor() {
    super(
      ["both", "all", "everything", "show all"],
      "show-both",
      "Show both completed and in-progress elements"
    );
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    await controller.setMode("both");
    return {
      success: true,
      message: "I've highlighted both completed and in-progress elements.",
      commandType: this.commandType,
    };
  }
}

/**
 * Clear highlights command handler
 */
class ClearHandler extends BaseCommandHandler {
  constructor() {
    super(
      ["clear", "reset", "hide", "remove", "none", "model", "default"],
      "clear",
      "Clear all highlights and show the model"
    );
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    await controller.setMode("model");
    return {
      success: true,
      message: "All highlights have been cleared. The model is back to its default view.",
      commandType: this.commandType,
    };
  }
}

/**
 * Remove status highlight colors (in‑progress / completed) but keep current filters
 */
class RemoveHighlightsHandler extends BaseCommandHandler {
  constructor() {
    super(
      [
        // Common direct phrases
        "remove highlight", "remove highlights", "remove the highlights",
        "clear highlights", "clear the highlights",
        "remove colors", "remove the colors", "clear colors", "clear the colors",
        "remove colouring", "remove coloring", "clear colouring", "clear coloring",
        "remove status colors", "clear status colors",

        // Progress-related
        "remove in progress elements", "remove in-progress elements",
        "remove the in progress elements", "remove the in-progress elements",
        "remove the progressing elements", "clear in progress elements",
        "clear progressing elements",

        // More natural combos
        "remove the highlighted elements", "clear the highlighted elements",
        "turn off the highlights", "turn off highlights",
        "turn off the colors", "switch off the colors",
        "get rid of the highlights", "get rid of the colors"
      ],
      "clear",
      "Clear status highlight colors but keep the current filters"
    );
  }

  // More flexible detection than plain substring of keywords
  canHandle(input: string): boolean {
    const normalized = input.toLowerCase();

    const verbs = [
      "remove", "clear", "hide", "turn off", "switch off",
      "stop showing", "get rid of", "reset", "drop", "disable"
    ];

    const targets = [
      "highlight", "highlights", "highlighted",
      "color", "colors", "colour", "colours", "coloring", "colouring",
      "status color", "status colors",
      "in progress elements", "in-progress elements",
      "progressing elements",
      "completed elements",
      "highlighted elements", "colored elements", "coloured elements"
    ];

    const hasVerb = verbs.some(v => normalized.includes(v));
    const hasTarget = targets.some(t => normalized.includes(t));

    return hasVerb && hasTarget;
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    const states = controller.getCheckboxStates();

    if (!states.inProgress && !states.completed) {
      return {
        success: true,
        message: "There are no status highlights active at the moment.",
        commandType: this.commandType,
      };
    }

    // Turn off both status highlight modes, but keep levels/categories/2D views as they are
    if (states.inProgress) {
      await controller.toggleInProgress(false);
    }
    if (states.completed) {
      await controller.toggleCompleted(false);
    }

    return {
      success: true,
      message: "I've removed the status highlight colors and kept your current view and filters.",
      commandType: this.commandType,
    };
  }
}

/**
 * Status command handler - shows statistics
 */
class StatusHandler extends BaseCommandHandler {
  constructor() {
    super(
      ["status", "statistics", "stats", "info", "information", "count"],
      "status",
      "Show project status and statistics"
    );
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    const stats = controller.getDataStatistics();
    const currentMode = controller.getCurrentMode();
    
    const message = `Current view: ${currentMode}\n` +
      `In Progress: ${stats.inProgress} elements\n` +
      `Completed: ${stats.completed} elements\n` +
      `Total: ${stats.inProgress + stats.completed} elements`;

    return {
      success: true,
      message,
      commandType: this.commandType,
    };
  }
}

/**
 * Completion percentage command handler
 */
class CompletionPercentageHandler extends BaseCommandHandler {
  constructor() {
    super(
      ["completion percentage", "completion %", "percentage", "completion", "project completion", "progress percentage", "completion rate"],
      "completion-percentage",
      "Show project completion percentage"
    );
  }

  async execute(_controller: HighlightController): Promise<CommandResult> {
    try {
      // Get Excel URL from project data
      const projectData = (window as any).currentProject || JSON.parse(sessionStorage.getItem('currentProject') || '{}');
      const excelUrl = projectData.excel_url || "./excel-sheet/data.xlsx";
      
      // Load Excel file
      const response = await fetch(excelUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Parse Excel file
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet); 
      
      if (!jsonData || jsonData.length === 0) {
        return {
          success: false,
          message: "Unable to calculate completion percentage. No data found in Excel file.",
          commandType: this.commandType,
        };
      }
      
      // Find the "Performance % Complete" column
      const firstRow = jsonData[0] as any;
      let completionColumn: string | null = null;
      
      for (const key in firstRow) {
        if (key.toLowerCase().includes("performance") && key.toLowerCase().includes("complete")) {
          completionColumn = key;
          break;
        }
      }
      
      if (!completionColumn) {
        return {
          success: false,
          message: "Unable to find completion percentage column in Excel file.",
          commandType: this.commandType,
        };
      }
      
      // Count total activities and completed activities (100%)
      let totalActivities = 0;
      let completedActivities = 0;
      
      for (const row of jsonData as any[]) {
        const completionValue = row[completionColumn];
        if (completionValue !== undefined && completionValue !== null && completionValue !== "") {
          totalActivities++;
          const percentage = Number(completionValue);
          if (!isNaN(percentage) && percentage === 100) {
            completedActivities++;
          }
        }
      }
      
      if (totalActivities === 0) {
        return {
          success: false,
          message: "No valid activities found in Excel file.",
          commandType: this.commandType,
        };
      }
      
      const percentage = Math.round((completedActivities / totalActivities) * 100);
      
      const message = `${percentage}%`;
      
      return {
        success: true,
        message,
        commandType: this.commandType,
      };
    } catch (error) {
      console.error("[ChatbotController] Error calculating completion percentage:", error);
      return {
        success: false,
        message: "Sorry, I couldn't calculate the completion percentage. Please try again later.",
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Help command handler
 */
class HelpHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      ["help", "commands", "what can you do", "available commands"],
      "help",
      "Show available commands"
    );
    this.controller = controller;
  }

  canHandle(input: string): boolean {
    const lower = input.toLowerCase();

    // Match whole words / clear help phrases, not substrings like "show"
    if (/\bhelp\b/.test(lower)) return true;
    if (/\bcommands?\b/.test(lower)) return true;
    if (lower.includes("what can you do")) return true;
    if (lower.includes("available commands")) return true;

    return false;
  }

  async execute(_controller: HighlightController): Promise<CommandResult> {
    const handlers = this.controller['handlers'];
    const commands = handlers
      .filter(h => h.getDescription())
      .map(h => `• ${h.getDescription()}`)
      .join("\n");

    const message = `Available commands:\n\n${commands}\n\n` +
      `You can use natural language like:\n` +
      `"Show me completed elements"\n` +
      `"Display in progress items"\n` +
      `"Show first floor"\n` +
      `"Show front view"\n` +
      `"Clear highlights"`;

    return {
      success: true,
      message,
      commandType: this.commandType,
    };
  }
}

/**
 * Main Chatbot Controller with clean architecture
 * 
 * Responsibilities:
 * - Parse user input
 * - Match commands to handlers
 * - Execute commands
 * - Provide extensible command system
 */
export class ChatbotController {
  private highlightController: HighlightController;
  private viewsManager: ViewsManager | null;
  private hiderPanel: HiderPanel | null;
  private handlers: CommandHandler[];
  private lastInput: string = "";

  constructor(
    highlightController: HighlightController,
    viewsManager?: ViewsManager,
    hiderPanel?: HiderPanel,
    handlers?: CommandHandler[]
  ) {
    this.highlightController = highlightController;
    this.viewsManager = viewsManager || null;
    this.hiderPanel = hiderPanel || null;
    // Defer handler creation until after 'this' is fully constructed
    // This prevents circular reference issues
    this.handlers = handlers || this.createDefaultHandlers();
  }

  /**
   * Create default command handlers (instance method to avoid circular reference)
   */
  private createDefaultHandlers(): CommandHandler[] {
    return [
      // Reset all handler (highest priority for reset commands)
      new ResetAllHandler(this),

      // MOST SPECIFIC: category + level + status
      new FilterCategoryLevelStatusHandler(this),

      // Level + Status combined handler
      new FilterLevelStatusHandler(this),

      // Category + Level (no explicit status)
      new FilterCategoryLevelHandler(this),

      // Level handlers (no category mentioned)
      new ShowLevelHandler(this, "Basement"),
      new ShowLevelHandler(this, "Ground"),
      new ShowLevelHandler(this, "First Floor"),
      new ShowLevelHandler(this, "Second Floor"),
      new ShowLevelHandler(this, "Roof"),
      new ResetLevelsHandler(this),

      // Category + status (no explicit level)
      new FilterCategoryStatusHandler(this),

      // Category only
      new FilterCategoryHandler(this),
      new ResetCategoryFilterHandler(this),

      // Status handlers
      new ShowCompletedHandler(this),
      new ShowInProgressHandler(this),
      new ShowBothHandler(),

      // Remove status highlight colors but keep filters
      new RemoveHighlightsHandler(),

      // Clear highlight mode completely
      new ClearHandler(),
      new StatusHandler(),
      new CompletionPercentageHandler(),
      new HelpHandler(this),
      // 2D View handlers (improved to handle natural language)
      new Show2DViewHandler(this, "Front"),
      new Show2DViewHandler(this, "Back"),
      new Show2DViewHandler(this, "Left"),
      new Show2DViewHandler(this, "Right"),
      new Reset2DViewsHandler(this),
    ];
  }

  /**
   * Get default command handlers (static method for external use if needed)
   */
  static getDefaultHandlers(controller: ChatbotController): CommandHandler[] {
    return controller.createDefaultHandlers();
  }

  /**
   * Register a new command handler
   */
  registerHandler(handler: CommandHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Process user input and execute the appropriate command
   */
  async processInput(input: string): Promise<CommandResult> {
    const normalizedInput = input.trim();
    this.lastInput = input; // Store for handlers to use

    if (!normalizedInput) {
      return {
        success: false,
        message: "Please enter a command",
        commandType: "unknown",
      };
    }

    // Find the first handler that can process this input
    const handler = this.handlers.find(h => h.canHandle(normalizedInput));

    if (!handler) {
      return {
        success: false,
        message: "Sorry, I didn't quite understand that. Please choose an option below:",
        commandType: "unknown",
      };
    }

    try {
      return await handler.execute(this.highlightController);
    } catch (error) {
      console.error("[ChatbotController] Error executing command:", error);
      return {
        success: false,
        message: "An error occurred while executing the command. Please try again.",
        commandType: handler instanceof BaseCommandHandler ? handler.commandType : "unknown",
      };
    }
  }

  /**
   * Get all available command descriptions (for help/autocomplete)
   */
  getAvailableCommands(): string[] {
    return this.handlers
      .map(h => h.getDescription())
      .filter(desc => desc.length > 0);
  }

  /**
   * Get views manager (for handlers to access)
   */
  getViewsManager(): ViewsManager | null {
    return this.viewsManager;
  }

  /**
   * Get hider panel (for handlers to access)
   */
  getHiderPanel(): HiderPanel | null {
    return this.hiderPanel;
  }

  /**
   * Get last input (for handlers to parse)
   */
  getLastInput(): string {
    return this.lastInput;
  }

  /**
   * Check if input contains additive keywords
   */
  isAdditiveCommand(input: string): boolean {
    const normalized = input.toLowerCase();
    const additiveKeywords = [
      "too", "also", "as well", "either", "additionally", 
      "and", "plus", "along with", "together with"
    ];
    return additiveKeywords.some(keyword => normalized.includes(keyword));
  }

  /**
   * Get currently selected level groups from HiderPanel
   */
  getCurrentLevelGroups(): string[] {
    const hiderPanel = this.getHiderPanel();
    if (!hiderPanel) return [];
    return hiderPanel.getCurrentLevelGroups();
  }

  /**
   * Get currently selected categories from HiderPanel
   */
  getCurrentCategories(): string[] {
    const hiderPanel = this.getHiderPanel();
    if (!hiderPanel) return [];
    return hiderPanel.getCurrentCategories();
  }
}

/**
 * Show level handler - opens a specific level view
 */
class ShowLevelHandler extends BaseCommandHandler {
  private controller: ChatbotController;
  private levelName: string;

  constructor(controller: ChatbotController, levelName: string) {
    const levelKeywords = getLevelKeywords(levelName);
    const commandTypeMap: Record<string, CommandType> = {
      "Basement": "show-level-basement",
      "Ground": "show-level-ground",
      "First Floor": "show-level-first-floor",
      "Second Floor": "show-level-second-floor",
      "Roof": "show-level-roof",
    };
    super(
      levelKeywords,
      commandTypeMap[levelName] || "unknown",
      `Show ${levelName} level`
    );
    this.controller = controller;
    this.levelName = levelName;
  }

  canHandle(input: string): boolean {
    const parsed = parseNaturalLanguageCommand(input);
    // If a category (beams, columns, walls, etc.) is mentioned, let the category handlers take over
    if (parsed.category && parsed.category.length > 0) {
      return false;
    }
    // Otherwise behave like the base handler (match level keywords)
    return super.canHandle(input);
  }

  async execute(_controller: HighlightController): Promise<CommandResult> {
    const hiderPanel = this.controller.getHiderPanel();
    if (!hiderPanel) {
      return {
        success: false,
        message: "Level Groups feature is not available",
        commandType: this.commandType,
      };
    }

    // Use improved natural language parsing to detect level from input
    // This allows the handler to work with Level Groups from config.json
    const input = this.controller.getLastInput();
    const parsed = parseNaturalLanguageCommand(input);
    
    // If natural language parser found a level, use it (more accurate)
    // This enables detection of "level 1", "first floor", "the first floor", etc.
    let levelToShow = this.levelName;
    if (parsed.level) {
      levelToShow = parsed.level;
    }

    // Check if this is an additive command
    const isAdditive = this.controller.isAdditiveCommand(input);
    
    // If additive, get current levels to preserve them
    const currentLevels = isAdditive ? this.controller.getCurrentLevelGroups() : [];
    
    // If the level is already selected and not additive, just return
    if (!isAdditive && currentLevels.includes(levelToShow) && currentLevels.length === 1) {
      return {
        success: true,
        message: `${levelToShow} is already open.`,
        commandType: this.commandType,
      };
    }

    try {
      // Apply level filter (additive if requested)
      await hiderPanel.filterByLevelGroups([levelToShow], isAdditive);
      
      // Get current status to preserve it if additive
      const currentStates = _controller.getCheckboxStates();
      const preserveStatus = isAdditive && (currentStates.inProgress || currentStates.completed);
      
      // If status is also detected, apply it
      if (parsed.status) {
        // Clear existing status first (unless preserving)
        if (!preserveStatus) {
          if (currentStates.inProgress) {
            await _controller.toggleInProgress(false);
          }
          if (currentStates.completed) {
            await _controller.toggleCompleted(false);
          }
        }
        
        // Apply the requested status
        if (parsed.status === "in-progress") {
          if (!preserveStatus || !currentStates.inProgress) {
            await _controller.toggleInProgress(true);
          }
        } else if (parsed.status === "completed") {
          if (!preserveStatus || !currentStates.completed) {
            await _controller.toggleCompleted(true);
          }
        } else if (parsed.status === "both") {
          await _controller.toggleInProgress(true);
          await _controller.toggleCompleted(true);
        }
        
        const statusText = parsed.status === "in-progress" ? "in progress" : 
                           parsed.status === "completed" ? "completed" : "both";
        const finalLevels = isAdditive ? [...new Set([...currentLevels, levelToShow])] : [levelToShow];
        const levelsText = finalLevels.length > 1 ? finalLevels.join(", ") : levelToShow;
        const message = isAdditive
          ? `I've added ${levelToShow} to your view. Now showing ${levelsText} with ${statusText} elements highlighted.`
          : `I've opened the ${levelToShow} and highlighted the ${statusText} elements.`;
        return {
          success: true,
          message,
          commandType: this.commandType,
        };
      }
      
      // No status, just level
      const finalLevels = isAdditive ? [...new Set([...currentLevels, levelToShow])] : [levelToShow];
      const levelsText = finalLevels.length > 1 ? finalLevels.join(", ") : levelToShow;
      const message = isAdditive
        ? `I've added ${levelToShow} to your view. Now showing ${levelsText}.`
        : `I've opened the ${levelToShow} for you.`;
      
      return {
        success: true,
        message,
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Could not show ${levelToShow} level`,
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Reset levels handler - closes current level view
 */
class ResetLevelsHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      ["reset level", "reset levels", "close level", "close levels", "exit level", "exit levels"],
      "reset-levels",
      "Reset/close level view"
    );
    this.controller = controller;
  }

  async execute(_controller: HighlightController): Promise<CommandResult> {
    const hiderPanel = this.controller.getHiderPanel();
    if (!hiderPanel) {
      return {
        success: false,
        message: "Level Groups feature is not available",
        commandType: this.commandType,
      };
    }

    try {
      // Reset level groups by unchecking all checkboxes
      await hiderPanel.filterByLevelGroups([], false);
      return {
        success: true,
        message: "I've reset the level filters. The full model is now visible.",
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: "Could not reset level groups",
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Show 2D view handler - opens a specific 2D view (Front, Back, Left, Right)
 */
class Show2DViewHandler extends BaseCommandHandler {
  private controller: ChatbotController;
  private viewName: string;

  constructor(controller: ChatbotController, viewName: string) {
    const viewKeywords = get2DViewKeywords(viewName);
    const commandTypeMap: Record<string, CommandType> = {
      "Front": "show-2d-front",
      "Back": "show-2d-back",
      "Left": "show-2d-left",
      "Right": "show-2d-right",
    };
    super(
      viewKeywords,
      commandTypeMap[viewName] || "unknown",
      `Show ${viewName} view`
    );
    this.controller = controller;
    this.viewName = viewName;
  }

  canHandle(input: string): boolean {
    const parsed = parseNaturalLanguageCommand(input);
    // Only handle if it's an explicit 2D view request (not a level)
    // This prevents "first floor" from being interpreted as a 2D view
    return parsed.view !== undefined && 
           parsed.is2DView === true && 
           parsed.level === undefined;
  }

  async execute(_controller: HighlightController): Promise<CommandResult> {
    const viewsManager = this.controller.getViewsManager();
    if (!viewsManager) {
      return {
        success: false,
        message: "2D views feature is not available",
        commandType: this.commandType,
      };
    }

    // Use improved natural language parsing to detect view from input
    const input = this.controller.getLastInput();
    const parsed = parseNaturalLanguageCommand(input);
    
    // If natural language parser found a view, use it (more accurate)
    let viewToShow = this.viewName;
    if (parsed.view) {
      // Map parsed view to our view names
      const viewMap: Record<string, string> = {
        "front": "Front",
        "back": "Back",
        "left": "Left",
        "right": "Right"
      };
      viewToShow = viewMap[parsed.view] || this.viewName;
    }

    try {
      // Force 2D view mode (skip Level Groups check)
      viewsManager.openView(viewToShow, undefined, true);
      return {
        success: true,
        message: `I've opened the ${viewToShow} 2D view for you.`,
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Could not open ${viewToShow} view`,
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Reset 2D views handler - closes current 2D view
 */
class Reset2DViewsHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      ["reset view", "reset views", "close view", "close views", "exit view", "exit views", "reset 2d", "close 2d"],
      "reset-2d-views",
      "Reset/close 2D view"
    );
    this.controller = controller;
  }

  async execute(_controller: HighlightController): Promise<CommandResult> {
    const viewsManager = this.controller.getViewsManager();
    if (!viewsManager) {
      return {
        success: false,
        message: "2D views feature is not available",
        commandType: this.commandType,
      };
    }

    try {
      viewsManager.closeCurrentView();
      return {
        success: true,
        message: "I've closed the 2D view and returned to the 3D model.",
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: "Could not close 2D view",
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Filter by category handler - filters model by IFC category
 */
class FilterCategoryHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      [
        "show", "display", "filter", "find", "get", "see", "show me",
        "beam", "beams", "wall", "walls", "column", "columns",
        "slab", "slabs", "door", "doors", "window", "windows",
        "roof", "roofs", "ceiling", "ceilings", "stair", "stairs",
        "pipe", "pipes", "duct", "ducts", "plate", "plates"
      ],
      "filter-category",
      "Filter by IFC category (e.g., 'show me the beams')"
    );
    this.controller = controller;
  }

  canHandle(input: string): boolean {
    const parsed = parseNaturalLanguageCommand(input);
    // Don't handle if a level is detected (level commands take priority)
    if (parsed.level !== undefined) {
      return false;
    }
    // Can handle if it has a category but no status (status-only commands handled separately)
    return parsed.category !== undefined && parsed.category.length > 0 && parsed.status === undefined;
  }

  async execute(_controller: HighlightController): Promise<CommandResult> {
    const hiderPanel = this.controller.getHiderPanel();
    if (!hiderPanel) {
      return {
        success: false,
        message: "Category filtering is not available",
        commandType: this.commandType,
      };
    }

    const input = this.controller.getLastInput();
    const parsed = parseNaturalLanguageCommand(input);
    
    if (!parsed.category || parsed.category.length === 0) {
      return {
        success: false,
        message: "I couldn't identify which category you're looking for. Could you try again? For example, 'show me the beams' or 'display the walls'.",
        commandType: this.commandType,
      };
    }

    // Check if user wants to add categories (enhanced additive detection)
    const normalized = input.toLowerCase();
    const isAdditive = normalized.includes("too") || 
                       normalized.includes("also") || 
                       normalized.includes("as well") ||
                       normalized.includes("either") ||
                       normalized.includes("additionally") ||
                       (normalized.includes("and") && parsed.category.length > 0);

    // If user says things like "columns only", clear level filters so we show them everywhere
    const shouldClearLevels =
      !isAdditive &&
      (normalized.includes(" only") ||
       normalized.startsWith("only ") ||
       normalized.includes(" just "));

    try {
      if (shouldClearLevels) {
        // Remove any active level filters so we show the category in the whole model
        await hiderPanel.filterByLevelGroups([], false);
      }

      await hiderPanel.filterByCategories(parsed.category, isAdditive);
      const categoryNames = getCategoryDisplayNames(parsed.category);
      const message = isAdditive 
        ? `I've added ${categoryNames} to your current filter.`
        : `I've filtered the view to show only ${categoryNames}.`;
      
      return {
        success: true,
        message,
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Could not filter by category: ${error instanceof Error ? error.message : "Unknown error"}`,
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Filter by category + level + status handler
 * Handles things like:
 *  - "show in progress beams in 1st floor"
 *  - "completed columns on the second floor"
 *  - "walls in level 1 that are in progress"
 */
class FilterCategoryLevelStatusHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      [
        // General verbs
        "show", "display", "filter", "find", "get", "see", "show me",
        // Connectors between category, level and status
        "in", "on", "at", "for", "that are", "which are",
        // Level / floor words
        "level", "floor", "basement", "ground", "roof",
        // Status words
        "in progress", "in-progress", "progress", "ongoing", "working", "active",
        "completed", "done", "finished", "complete",
        // Category words (keep in sync with mapNaturalLanguageToIFCCategory)
        "beam", "beams", "wall", "walls", "column", "columns",
        "slab", "slabs", "door", "doors", "window", "windows",
        "roof", "roofs", "ceiling", "ceilings", "stair", "stairs",
        "pipe", "pipes", "duct", "ducts", "plate", "plates"
      ],
      "filter-category-status",
      "Filter by category, level, and status (e.g., 'in progress beams in the first floor')"
    );
    this.controller = controller;
  }

  canHandle(input: string): boolean {
    const parsed = parseNaturalLanguageCommand(input);
    // Require category + level + status all present
    return parsed.category !== undefined &&
           parsed.category.length > 0 &&
           parsed.level !== undefined &&
           parsed.status !== undefined;
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    const hiderPanel = this.controller.getHiderPanel();
    if (!hiderPanel) {
      return {
        success: false,
        message: "Level Groups or category filtering is not available",
        commandType: this.commandType,
      };
    }

    const input = this.controller.getLastInput();
    const parsed = parseNaturalLanguageCommand(input);

    if (!parsed.category || parsed.category.length === 0 || !parsed.level || !parsed.status) {
      return {
        success: false,
        message: "I couldn't fully understand the category, level, and status. For example, try 'in progress beams in first floor' or 'completed columns on level 2'.",
        commandType: this.commandType,
      };
    }

    // Additive support (beams then "columns too" on same level/status)
    const normalized = input.toLowerCase();
    const isAdditive = this.controller.isAdditiveCommand(input);

    // If user says "only", optionally clear other levels
    const shouldClearLevels =
      !isAdditive &&
      (normalized.includes(" only") ||
       normalized.startsWith("only ") ||
       normalized.includes(" just "));

    try {
      if (shouldClearLevels) {
        await hiderPanel.filterByLevelGroups([], false);
      }

      // 1) Apply level filter (additive if requested)
      await hiderPanel.filterByLevelGroups([parsed.level], isAdditive);

      // 2) Apply category filter (additive if requested)
      await hiderPanel.filterByCategories(parsed.category, isAdditive);

      // 3) Apply status highlighting (respect additive mode)
      const currentStates = controller.getCheckboxStates();
      const preserveStatus = isAdditive && (currentStates.inProgress || currentStates.completed);

      if (!preserveStatus) {
        if (currentStates.inProgress) {
          await controller.toggleInProgress(false);
        }
        if (currentStates.completed) {
          await controller.toggleCompleted(false);
        }
      }

      if (parsed.status === "in-progress") {
        if (!preserveStatus || !currentStates.inProgress) {
          await controller.toggleInProgress(true);
        }
      } else if (parsed.status === "completed") {
        if (!preserveStatus || !currentStates.completed) {
          await controller.toggleCompleted(true);
        }
      } else if (parsed.status === "both") {
        await controller.toggleInProgress(true);
        await controller.toggleCompleted(true);
      }

      const categoryNames = getCategoryDisplayNames(parsed.category);
      const levelName = parsed.level;
      const statusText = parsed.status === "in-progress" ? "in progress" :
                         parsed.status === "completed" ? "completed" : "both";

      const message = isAdditive
        ? `I've added ${categoryNames} on ${levelName} that are ${statusText} to your current filter.`
        : `I've filtered the view to show only ${categoryNames} on ${levelName} that are ${statusText}.`;

      return {
        success: true,
        message,
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Could not apply category + level + status filter: ${error instanceof Error ? error.message : "Unknown error"}`,
        commandType: this.commandType,
      };
    }
  }
}
/**
 * Filter by category and level handler - combines category filter with level filter
 * Handles commands like "the beams in level 1", "columns on the first floor", etc.
 */
class FilterCategoryLevelHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      [
        // General verbs
        "show", "display", "filter", "find", "get", "see", "show me",
        // Connectors between category and level
        "in", "on", "at", "for",
        // Level / floor words
        "level", "floor",
        // Category words (keep in sync with mapNaturalLanguageToIFCCategory)
        "beam", "beams", "wall", "walls", "column", "columns",
        "slab", "slabs", "door", "doors", "window", "windows",
        "roof", "roofs", "ceiling", "ceilings", "stair", "stairs",
        "pipe", "pipes", "duct", "ducts", "plate", "plates"
      ],
      "filter-category",
      "Filter by category within a specific level (e.g., 'show beams in level 1')"
    );
    this.controller = controller;
  }

  canHandle(input: string): boolean {
    const parsed = parseNaturalLanguageCommand(input);
    // Handle only if BOTH category and level are detected, but no status
    return parsed.category !== undefined &&
           parsed.category.length > 0 &&
           parsed.level !== undefined &&
           parsed.status === undefined;
  }

  async execute(_controller: HighlightController): Promise<CommandResult> {
    const hiderPanel = this.controller.getHiderPanel();
    if (!hiderPanel) {
      return {
        success: false,
        message: "Level Groups or category filtering is not available",
        commandType: this.commandType,
      };
    }

    const input = this.controller.getLastInput();
    const parsed = parseNaturalLanguageCommand(input);

    if (!parsed.category || parsed.category.length === 0 || !parsed.level) {
      return {
        success: false,
        message: "I couldn't identify both the category and the level. For example, try 'the beams in level 1' or 'columns on the first floor'.",
        commandType: this.commandType,
      };
    }

    const isAdditive = this.controller.isAdditiveCommand(input);

    try {
      // Step 1: apply level filter (additive if requested)
      await hiderPanel.filterByLevelGroups([parsed.level], isAdditive);

      // Step 2: apply category filter (additive if requested)
      await hiderPanel.filterByCategories(parsed.category, isAdditive);

      const categoryNames = getCategoryDisplayNames(parsed.category);
      const levelName = parsed.level;
      const message = isAdditive
        ? `I've added ${categoryNames} on ${levelName} to your current filter.`
        : `I've filtered the view to show only ${categoryNames} on ${levelName}.`;

      return {
        success: true,
        message,
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Could not apply category + level filter: ${error instanceof Error ? error.message : "Unknown error"}`,
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Filter by category and status handler - combines category filter with progress status
 */
class FilterCategoryStatusHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      [
        "show", "display", "filter", "find", "get", "see", "show me",
        "which", "that are", "in progress", "completed", "which in progress",
        "that in progress", "which completed", "that completed"
      ],
      "filter-category-status",
      "Filter by category and status (e.g., 'show me the beams which in progress')"
    );
    this.controller = controller;
  }

  canHandle(input: string): boolean {
    const parsed = parseNaturalLanguageCommand(input);
    return parsed.category !== undefined && parsed.category.length > 0 && parsed.status !== undefined;
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    const hiderPanel = this.controller.getHiderPanel();
    if (!hiderPanel) {
      return {
        success: false,
        message: "Category filtering is not available",
        commandType: this.commandType,
      };
    }

    const input = this.controller.getLastInput();
    const parsed = parseNaturalLanguageCommand(input);
    
    if (!parsed.category || parsed.category.length === 0) {
      return {
        success: false,
        message: "I couldn't identify which category you're looking for. Could you try again? For example, 'show me the beams' or 'display the walls'.",
        commandType: this.commandType,
      };
    }

    if (!parsed.status) {
      return {
        success: false,
        message: "I couldn't identify the status. Try saying 'in progress', 'completed', or 'both'.",
        commandType: this.commandType,
      };
    }

    // Check if additive (enhanced detection - preserve existing status)
    const normalized = input.toLowerCase();
    const isAdditive = normalized.includes("too") || 
                       normalized.includes("also") || 
                       normalized.includes("as well") ||
                       normalized.includes("either") ||
                       normalized.includes("additionally") ||
                       (normalized.includes("and") && parsed.category.length > 0);

    // If user says "only", clear level filters so we show the status/category everywhere
    const shouldClearLevels =
      !isAdditive &&
      (normalized.includes(" only") ||
       normalized.startsWith("only ") ||
       normalized.includes(" just "));

    try {
      // Get current status to preserve it if additive
      const currentStates = controller.getCheckboxStates();
      const preserveStatus = isAdditive && (currentStates.inProgress || currentStates.completed);

      if (shouldClearLevels) {
        await hiderPanel.filterByLevelGroups([], false);
      }
      
      // Filter by category (additive if requested)
      await hiderPanel.filterByCategories(parsed.category, isAdditive);
      
      // Apply status highlighting
      if (!preserveStatus) {
        // Clear existing status filters if not preserving
        if (currentStates.inProgress) {
          await controller.toggleInProgress(false);
        }
        if (currentStates.completed) {
          await controller.toggleCompleted(false);
        }
      }
      
      // Apply the requested status (additive - keep existing if preserving)
      if (parsed.status === "in-progress") {
        if (!preserveStatus || !currentStates.inProgress) {
          await controller.toggleInProgress(true);
        }
      } else if (parsed.status === "completed") {
        if (!preserveStatus || !currentStates.completed) {
          await controller.toggleCompleted(true);
        }
      } else if (parsed.status === "both") {
        await controller.toggleInProgress(true);
        await controller.toggleCompleted(true);
      }
      
      const categoryNames = getCategoryDisplayNames(parsed.category);
      const statusText = parsed.status === "in-progress" ? "in progress" : 
                         parsed.status === "completed" ? "completed" : "both";
      const message = isAdditive
        ? `I've added ${categoryNames} (${statusText}) to your current filter.`
        : `I've filtered the ${categoryNames} and highlighted the ones that are ${statusText}.`;
      
      return {
        success: true,
        message,
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Could not apply filter: ${error instanceof Error ? error.message : "Unknown error"}`,
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Reset all handler - resets all filters and returns to 3D model view
 */
class ResetAllHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      [
        "reset", "reset all", "reset everything", "reset model",
        "3d model", "3d view", "show 3d", "back to 3d",
        "reset view", "reset filters", "clear all", "clear everything","full model","full view","full model view","original model","original view","original model view","original"
      ],
      "reset-all",
      "Reset all filters and return to 3D model view"
    );
    this.controller = controller;
  }

  // Override canHandle to catch any input containing "3d"
  canHandle(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    
    // If input contains "3d" anywhere, always reset
    if (normalized.includes("3d")) {
      return true;
    }
    
    // Otherwise, check for other reset keywords
    return this.keywords.some(keyword => normalized.includes(keyword));
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    try {
      // Reset category filter
      const hiderPanel = this.controller.getHiderPanel();
      if (hiderPanel) {
        await hiderPanel.resetCategoryFilter();
        // Reset level groups
        await hiderPanel.filterByLevelGroups([], false);
      }

      // Reset status highlights
      const states = controller.getCheckboxStates();
      if (states.inProgress) {
        await controller.toggleInProgress(false);
      }
      if (states.completed) {
        await controller.toggleCompleted(false);
      }

      // Close 2D views
      const viewsManager = this.controller.getViewsManager();
      if (viewsManager) {
        viewsManager.closeCurrentView();
      }

      return {
        success: true,
        message: "I've reset all filters. The full 3D model is now visible.",
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: "Could not reset filters",
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Filter by level and status handler - combines level filter with progress status
 * Handles commands like "in progress elements in the first level", "completed on second floor", etc.
 */
class FilterLevelStatusHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      [
        // Comprehensive keywords covering 90% of natural language variations
        "in progress", "in-progress", "progress", "ongoing", "working", "active",
        "completed", "done", "finished", "complete",
        "first floor", "second floor", "ground", "basement", "roof",
        "level 1", "level 2", "level 0", "level one", "level two",
        "first level", "second level", "ground level", "basement level", "roof level",
        "on the", "in the", "of the", "at the", "for the",
        "elements", "items", "components", "parts", "objects"
      ],
      "filter-level-status",
      "Filter by level and status (e.g., 'in progress elements in the first level')"
    );
    this.controller = controller;
  }

  canHandle(input: string): boolean {
    const parsed = parseNaturalLanguageCommand(input);
    // Handle if both level AND status are detected
    return parsed.level !== undefined && parsed.status !== undefined;
  }

  async execute(controller: HighlightController): Promise<CommandResult> {
    const hiderPanel = this.controller.getHiderPanel();
    if (!hiderPanel) {
      return {
        success: false,
        message: "Level Groups feature is not available",
        commandType: this.commandType,
      };
    }

    const input = this.controller.getLastInput();
    const parsed = parseNaturalLanguageCommand(input);
    
    if (!parsed.level) {
      return {
        success: false,
        message: "I couldn't identify which level you're looking for. Try saying 'first floor', 'second floor', 'ground', 'basement', or 'roof'.",
        commandType: this.commandType,
      };
    }

    if (!parsed.status) {
      return {
        success: false,
        message: "I couldn't identify the status. Try saying 'in progress', 'completed', or 'both'.",
        commandType: this.commandType,
      };
    }

    // Check if this is an additive command
    const isAdditive = this.controller.isAdditiveCommand(input);
    
    // If additive, get current levels to preserve them
    const currentLevels = isAdditive ? this.controller.getCurrentLevelGroups() : [];
    
    // Get current status to preserve it if additive
    const currentStates = controller.getCheckboxStates();
    const preserveStatus = isAdditive && (currentStates.inProgress || currentStates.completed);

    try {
      // Step 1: Apply level filter (additive if requested)
      await hiderPanel.filterByLevelGroups([parsed.level], isAdditive);
      
      // Step 2: Apply status highlighting
      // Clear existing status filters first (unless preserving)
      if (!preserveStatus) {
        if (currentStates.inProgress) {
          await controller.toggleInProgress(false);
        }
        if (currentStates.completed) {
          await controller.toggleCompleted(false);
        }
      }
      
      // Apply the requested status
      if (parsed.status === "in-progress") {
        if (!preserveStatus || !currentStates.inProgress) {
          await controller.toggleInProgress(true);
        }
      } else if (parsed.status === "completed") {
        if (!preserveStatus || !currentStates.completed) {
          await controller.toggleCompleted(true);
        }
      } else if (parsed.status === "both") {
        await controller.toggleInProgress(true);
        await controller.toggleCompleted(true);
      }
      
      const statusText = parsed.status === "in-progress" ? "in progress" : 
                         parsed.status === "completed" ? "completed" : "both";
      const finalLevels = isAdditive ? [...new Set([...currentLevels, parsed.level])] : [parsed.level];
      const levelsText = finalLevels.length > 1 ? finalLevels.join(", ") : parsed.level;
      const message = isAdditive
        ? `I've added ${parsed.level} to your view. Now showing ${levelsText} with ${statusText} elements highlighted.`
        : `I've opened the ${parsed.level} and highlighted the ${statusText} elements.`;
      
      return {
        success: true,
        message,
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Could not apply filter: ${error instanceof Error ? error.message : "Unknown error"}`,
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Reset category filter handler
 */
class ResetCategoryFilterHandler extends BaseCommandHandler {
  private controller: ChatbotController;

  constructor(controller: ChatbotController) {
    super(
      [
        "reset category", "reset categories", "reset filter", "reset filters",
        "clear category", "clear categories", "show all", "show everything",
        "remove filter", "remove filters"
      ],
      "reset-category-filter",
      "Reset category filter (show all elements)"
    );
    this.controller = controller;
  }

  async execute(_controller: HighlightController): Promise<CommandResult> {
    const hiderPanel = this.controller.getHiderPanel();
    if (!hiderPanel) {
      return {
        success: false,
        message: "Category filtering is not available",
        commandType: this.commandType,
      };
    }

    try {
      await hiderPanel.resetCategoryFilter();
      return {
        success: true,
        message: "I've reset the category filter. All elements are now visible.",
        commandType: this.commandType,
      };
    } catch (error) {
      return {
        success: false,
        message: "Could not reset category filter",
        commandType: this.commandType,
      };
    }
  }
}

/**
 * Helper function to get keywords for levels
 */
function getLevelKeywords(levelName: string): string[] {
  const keywordMap: Record<string, string[]> = {
    "Basement": [
      "basement", "basement level", "basement floor", "level b", "b level", 
      "lower level", "underground", "sub level", "sublevel", "show basement",
      "show me basement", "show basement please", "show me basement please",
      "get basement", "get me basement"
    ],
    "Ground": [
      "ground", "ground level", "ground floor", "level 0", "level zero", 
      "zero level", "g level", "g floor", "main floor", "main level", "show ground",
      "the ground", "the ground floor", "the ground level", "show me ground",
      "show me ground floor", "show me level 0",
      "show ground please", "show me ground please", "show me ground floor please",
      "get ground", "get me ground", "get ground floor", "get me ground floor"
    ],
    "First Floor": [
      "first", "first floor", "first level", "level 1", "level one", 
      "one level", "1st floor", "1st level", "floor 1", "level first", 
      "first floor level", "show first floor", "show first",
      "the first floor", "the first level", "the first", "show me first floor",
      "show me level 1", "show me level one", "show me floor 1",
      "show me the first floor", "show me the first level",
      "show first floor please", "show me first floor please",
      "get first floor", "get me first floor", "get first", "get me first"
    ],
    "Second Floor": [
      "second", "second floor", "second level", "level 2", "level two", 
      "two level", "2nd floor", "2nd level", "floor 2", "level second",
      "second floor level", "show second floor", "show second",
      "the second floor", "the second level", "the second", "show me second floor",
      "show me level 2", "show me level two", "show me floor 2",
      "show me the second floor", "show me the second level",
      "show second floor please", "show me second floor please",
      "get second floor", "get me second floor", "get second", "get me second"
    ],
    "Roof": [
      "roof", "roof level", "roof floor", "top level", "top floor", 
      "upper level", "uppermost", "ceiling level", "show roof",
      "show me roof", "show roof please", "show me roof please",
      "the roof", "show the roof", "show me the roof",
      "show the roof please", "show me the roof please",
      "get roof", "get me roof", "get the roof", "get me the roof"
    ],
  };
  
  return keywordMap[levelName] || [levelName.toLowerCase()];
}

/**
 * Helper function to get keywords for 2D views
 */
function get2DViewKeywords(viewName: string): string[] {
  const keywordMap: Record<string, string[]> = {
    "Front": [
      "front", "front view", "front elevation", "front side", "forward", 
      "facing front", "north", "north view", "show front", "front view",
      "front of", "front side of", "front side of the building",
      "show me the front", "show me the front side", "show me the front view",
      "display front", "display the front", "view from front",
      "front elevation view", "front facing", "front facing view",
      "the front", "the front side", "the front view", "the front of the building"
    ],
    "Back": [
      "back", "back view", "back elevation", "back side", "rear", "rear view", 
      "behind", "south", "south view", "show back", "back view",
      "back of", "back side of", "back side of the building", "rear side",
      "show me the back", "show me the back side", "show me the back view",
      "display back", "display the back", "view from back",
      "back elevation view", "rear facing", "rear facing view",
      "the back", "the back side", "the back view", "the back of the building",
      "the rear", "the rear side", "the rear view", "the rear of the building"
    ],
    "Left": [
      "left", "left view", "left elevation", "left side", "west", "west view",
      "show left", "left view", "left side of", "left of", "left side of the building",
      "show me the left", "show me the left side", "show me the left view",
      "display left", "display the left", "view from left",
      "left elevation view", "left facing", "left facing view",
      "the left", "the left side", "the left view", "the left of the building",
      "west side", "west side of the building"
    ],
    "Right": [
      "right", "right view", "right elevation", "right side", "east", "east view",
      "show right", "right view", "right side of", "right of", "right side of the building",
      "show me the right", "show me the right side", "show me the right view",
      "display right", "display the right", "view from right",
      "right elevation view", "right facing", "right facing view",
      "the right", "the right side", "the right view", "the right of the building",
      "east side", "east side of the building"
    ],
  };
  
  return keywordMap[viewName] || [viewName.toLowerCase()];
}

/**
 * Interface for parsed command results
 */
interface ParsedCommand {
  category?: string[];
  status?: "in-progress" | "completed" | "both";
  view?: "front" | "back" | "left" | "right";
  level?: string;
  is2DView?: boolean; // Indicates explicit 2D view request
}

/**
 * Convert IFC category codes to human-readable names
 */
function getCategoryDisplayName(categoryCode: string): string {
  const categoryDisplayMap: Record<string, string> = {
    "IFCBEAM": "beams",
    "IFCWALL": "walls",
    "IFCWALLSTANDARDCASE": "walls",
    "IFCCOLUMN": "columns",
    "IFCSLAB": "slabs",
    "IFCFLOOR": "floors",
    "IFCDOOR": "doors",
    "IFCWINDOW": "windows",
    "IFCROOF": "roofs",
    "IFCCOVERING": "ceilings",
    "IFCSTAIR": "stairs",
    "IFCPLATE": "plates",
    "IFCPIPESEGMENT": "pipes",
    "IFCDUCTSEGMENT": "ducts",
  };
  
  return categoryDisplayMap[categoryCode] || categoryCode.toLowerCase();
}

/**
 * Convert array of IFC category codes to human-readable names
 */
function getCategoryDisplayNames(categories: string[]): string {
  const displayNames = categories
    .map(cat => getCategoryDisplayName(cat))
    .filter((name, index, arr) => arr.indexOf(name) === index); // Remove duplicates
  
  if (displayNames.length === 0) return "";
  if (displayNames.length === 1) return displayNames[0];
  if (displayNames.length === 2) return `${displayNames[0]} and ${displayNames[1]}`;
  return `${displayNames.slice(0, -1).join(", ")}, and ${displayNames[displayNames.length - 1]}`;
}

// Structural + Architectural IFC categories (used to derive MEP set)
const STRUCTURAL_ARCH_IFC = new Set<string>([
  "IFCBEAM",
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCCOLUMN",
  "IFCSLAB",
  "IFCFLOOR",
  "IFCDOOR",
  "IFCWINDOW",
  "IFCROOF",
  "IFCCOVERING",
  "IFCPLATE",
  "IFCSTAIR",
  "IFCSTAIRFLIGHT",
  "IFCRAILING",
]);

// All IFC categories known to the chatbot.
// NOTE: adjust this list to match the IFC types in your project as needed.
const ALL_IFC_CATEGORY_CODES: string[] = [
  // Structural / Architectural
  "IFCBEAM",
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCCOLUMN",
  "IFCSLAB",
  "IFCFLOOR",
  "IFCDOOR",
  "IFCWINDOW",
  "IFCROOF",
  "IFCCOVERING",
  "IFCPLATE",
  "IFCSTAIR",
  "IFCSTAIRFLIGHT",
  "IFCRAILING",

  // MEP / services (extend if your model uses more types)
  "IFCPIPESEGMENT",
  "IFCDUCTSEGMENT",
  "IFCPIPEFITTING",
  "IFCDUCTFITTING",
  "IFCFLOWSEGMENT",
  "IFCFLOWFITTING",
  "IFCFLOWTERMINAL",
  "IFCFLOWCONTROLLER",
  "IFCFLOWTREATMENTDEVICE",
  "IFCFLOWSTORAGEDEVICE",
  "IFCDISTRIBUTIONELEMENT",
  "IFCELECTRICDISTRIBUTIONBOARD",
  "IFCELECTRICFLOWSTORAGEDEVICE",
  "IFCFIRESUPPRESSIONTERMINAL",
];

// MEP = all IFC categories except structural/architectural
const MEP_IFC_CATEGORIES: string[] = ALL_IFC_CATEGORY_CODES.filter(
  (code) => !STRUCTURAL_ARCH_IFC.has(code)
);

// Structural group: beams, walls, columns, slabs/floors, foundations / base
const STRUCTURAL_IFC_CATEGORIES: string[] = [
  "IFCBEAM",
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCCOLUMN",
  "IFCSLAB",
  "IFCFLOOR",
  "IFCFOOTING",
  "IFCPILE",
  "IFCFOUNDATION",
];

// Architectural group: only explicitly architectural elements
const ARCHITECTURAL_IFC_CATEGORIES: string[] = [
  "IFCDOOR",
  "IFCWINDOW",
  "IFCROOF",
  //"IFCCOVERING",
  "IFCRAILING",
  // Add more purely architectural IFC types here if needed
];

/**
 * Map natural language to IFC categories
 */
function mapNaturalLanguageToIFCCategory(text: string): string[] {
  const normalized = text.toLowerCase().trim();
  
  // Check if "floor" is part of a level phrase (like "first floor", "second floor", "ground floor")
  // If so, don't treat it as a category
  const levelPhrases = [
    "first floor", "second floor", "third floor", "fourth floor", "fifth floor",
    "ground floor", "basement floor", "top floor", "roof floor",
    "level 0", "level 1", "level 2", "level 3", "level 4", "level 5",
    "level one", "level two", "level three", "level four", "level five",
    "1st floor", "2nd floor", "3rd floor", "4th floor", "5th floor",
    "floor 1", "floor 2", "floor 3", "floor 4", "floor 5",
    "the first floor", "the second floor", "the third floor",
    "the ground floor", "the basement floor"
  ];
  
  const isLevelPhrase = levelPhrases.some(phrase => normalized.includes(phrase));
  
  const categoryMap: Record<string, string[]> = {
    // Beams
    "beam": ["IFCBEAM"],
    "beams": ["IFCBEAM"],
    "girder": ["IFCBEAM"],
    "girders": ["IFCBEAM"],
    
    // Walls
    "wall": ["IFCWALL", "IFCWALLSTANDARDCASE"],
    "walls": ["IFCWALL", "IFCWALLSTANDARDCASE"],
    
    // Columns
    "column": ["IFCCOLUMN"],
    "columns": ["IFCCOLUMN"],
    "pillar": ["IFCCOLUMN"],
    "pillars": ["IFCCOLUMN"],
    
    // Slabs
    "slab": ["IFCSLAB"],
    "slabs": ["IFCSLAB"],
    "floor": ["IFCSLAB", "IFCFLOOR"],
    "floors": ["IFCSLAB", "IFCFLOOR"],
    
    // Doors
    "door": ["IFCDOOR"],
    "doors": ["IFCDOOR"],
    
    // Windows
    "window": ["IFCWINDOW"],
    "windows": ["IFCWINDOW"],
    
    // Roofs
    "roof": ["IFCROOF"],
    "roofs": ["IFCROOF"],
    
    // Ceilings
    "ceiling": ["IFCCOVERING"],
    "ceilings": ["IFCCOVERING"],
    
    // Stairs
    "stair": ["IFCSTAIR"],
    "stairs": ["IFCSTAIR"],
    "staircase": ["IFCSTAIR"],
    
    // Plates
    "plate": ["IFCPLATE"],
    "plates": ["IFCPLATE"],
    
    // Pipes
    "pipe": ["IFCPIPESEGMENT"],
    "pipes": ["IFCPIPESEGMENT"],
    
    // Ducts
    "duct": ["IFCDUCTSEGMENT"],
    "ducts": ["IFCDUCTSEGMENT"],

    // MEP group (all non-structural/architectural IFC categories)
    "mep": MEP_IFC_CATEGORIES,
    "mep elements": MEP_IFC_CATEGORIES,
    "mep works": MEP_IFC_CATEGORIES,
    "mep work": MEP_IFC_CATEGORIES,
    "mep systems": MEP_IFC_CATEGORIES,
    "mep services": MEP_IFC_CATEGORIES,

    // Structural view group (beams, columns, walls, slabs/floors, foundations, base)
    "structural": STRUCTURAL_IFC_CATEGORIES,
    "structure": STRUCTURAL_IFC_CATEGORIES,
    "structural elements": STRUCTURAL_IFC_CATEGORIES,
    "structural works": STRUCTURAL_IFC_CATEGORIES,
    "structural work": STRUCTURAL_IFC_CATEGORIES,

    // Architectural view group (everything else that is not structural or MEP)
    "architectural": ARCHITECTURAL_IFC_CATEGORIES,
    "architecture": ARCHITECTURAL_IFC_CATEGORIES,
    "architectural elements": ARCHITECTURAL_IFC_CATEGORIES,
    "architectural works": ARCHITECTURAL_IFC_CATEGORIES,
    "architectural work": ARCHITECTURAL_IFC_CATEGORIES,
  };
  
  // Check for exact matches first
  if (categoryMap[normalized]) {
    return categoryMap[normalized];
  }
  
  // Check for partial matches (word boundaries)
  const words = normalized.split(/\s+/);
  for (const word of words) {
    if (categoryMap[word]) {
      // If this word is "floor" or "floors" and it's part of a level phrase
      // (e.g., "first floor", "2nd floor", "floor 1"), skip treating it as a category
      if ((word === "floor" || word === "floors") && isLevelPhrase) {
        continue;
      }
      return categoryMap[word];
    }
  }
  
  // Check for partial matches in full text
  // But skip "floor" and "floors" if it's part of a level phrase
  for (const [key, categories] of Object.entries(categoryMap)) {
    if (normalized.includes(key)) {
      // If this is "floor" or "floors" and it's part of a level phrase, skip it
      if ((key === "floor" || key === "floors") && isLevelPhrase) {
        continue;
      }
      return categories;
    }
  }
  
  return [];
}

/**
 * Parse natural language command to extract intent
 */
function parseNaturalLanguageCommand(input: string): ParsedCommand {
  const normalized = input.toLowerCase();
  const result: ParsedCommand = {};
  
  // Check for explicit 2D view requests (e.g., "2d view", "2d", "elevation", "orthographic")
  const is2DViewRequest = normalized.includes("2d view") || 
                          normalized.includes("2d") ||
                          normalized.includes("two d") ||
                          normalized.includes("two-dimensional") ||
                          normalized.includes("elevation") ||
                          normalized.includes("orthographic");
  
  // Enhanced 2D view detection patterns
  // Patterns that indicate a 2D view request (not a level)
  const viewIndicators = [
    "side", "view", "elevation", "facing", "from", "of the building", 
    "of the structure", "show me the", "display the", "view from"
  ];
  
  const hasViewIndicator = viewIndicators.some(indicator => normalized.includes(indicator));
  
  // Parse 2D views with enhanced detection
  // Right side/view
  if (normalized.includes("right side") || 
      normalized.includes("right side of") ||
      normalized.includes("right of the building") ||
      normalized.includes("right of the structure") ||
      normalized.includes("show me the right") ||
      normalized.includes("show me the right side") ||
      normalized.includes("show me the right view") ||
      normalized.includes("display the right") ||
      normalized.includes("view from right") ||
      normalized.includes("right facing") ||
      normalized.includes("right elevation") ||
      (normalized.includes("right") && (hasViewIndicator || normalized.includes("east")))) {
    result.view = "right";
    result.is2DView = is2DViewRequest || hasViewIndicator || normalized.includes("side") || normalized.includes("view") || normalized.includes("east");
  } 
  // Left side/view
  else if (normalized.includes("left side") || 
           normalized.includes("left side of") ||
           normalized.includes("left of the building") ||
           normalized.includes("left of the structure") ||
           normalized.includes("show me the left") ||
           normalized.includes("show me the left side") ||
           normalized.includes("show me the left view") ||
           normalized.includes("display the left") ||
           normalized.includes("view from left") ||
           normalized.includes("left facing") ||
           normalized.includes("left elevation") ||
           (normalized.includes("left") && (hasViewIndicator || normalized.includes("west")))) {
    result.view = "left";
    result.is2DView = is2DViewRequest || hasViewIndicator || normalized.includes("side") || normalized.includes("view") || normalized.includes("west");
  } 
  // Front side/view
  else if (normalized.includes("front side") ||
           normalized.includes("front side of") ||
           normalized.includes("front of the building") ||
           normalized.includes("front of the structure") ||
           normalized.includes("show me the front") ||
           normalized.includes("show me the front side") ||
           normalized.includes("show me the front view") ||
           normalized.includes("display the front") ||
           normalized.includes("view from front") ||
           normalized.includes("front facing") ||
           normalized.includes("front elevation") ||
           normalized.includes("front") || 
           normalized.includes("forward") || 
           normalized.includes("north")) {
    result.view = "front";
    result.is2DView = is2DViewRequest || hasViewIndicator || normalized.includes("side") || normalized.includes("view") || normalized.includes("north");
  } 
  // Back side/view
  else if (normalized.includes("back side") ||
           normalized.includes("back side of") ||
           normalized.includes("rear side") ||
           normalized.includes("rear side of") ||
           normalized.includes("back of the building") ||
           normalized.includes("back of the structure") ||
           normalized.includes("rear of the building") ||
           normalized.includes("rear of the structure") ||
           normalized.includes("show me the back") ||
           normalized.includes("show me the back side") ||
           normalized.includes("show me the back view") ||
           normalized.includes("show me the rear") ||
           normalized.includes("display the back") ||
           normalized.includes("view from back") ||
           normalized.includes("back facing") ||
           normalized.includes("back elevation") ||
           normalized.includes("rear elevation") ||
           normalized.includes("back") || 
           normalized.includes("rear") || 
           normalized.includes("behind") || 
           normalized.includes("south")) {
    result.view = "back";
    result.is2DView = is2DViewRequest || hasViewIndicator || normalized.includes("side") || normalized.includes("view") || normalized.includes("south");
  }
  
  // Parse status
  if (normalized.includes("in progress") || normalized.includes("in-progress") || 
      (normalized.includes("progress") && !normalized.includes("completed")) || 
      normalized.includes("ongoing") || normalized.includes("working")) {
    result.status = "in-progress";
  } else if (normalized.includes("completed") || normalized.includes("done") || 
             normalized.includes("finished") || normalized.includes("complete")) {
    result.status = "completed";
  } else if (normalized.includes("both") || normalized.includes("all")) {
    result.status = "both";
  }
  
  // Parse IFC categories
  const categories = mapNaturalLanguageToIFCCategory(input);
  if (categories.length > 0) {
    result.category = categories;
  }
  
  // Enhanced level parsing - detect floor/level numbers and names
  // Only parse levels if no 2D view was detected (to avoid conflicts)
  if (!result.view || !result.is2DView) {
    // Check for explicit basement
    if (normalized.includes("basement") || normalized.includes("level b") || normalized.includes("b level")) {
      result.level = "Basement";
    }
    // Check for explicit roof
    else if ((normalized.includes("roof") && !normalized.includes("roofs")) || 
             normalized.includes("top level") || normalized.includes("top floor")) {
      result.level = "Roof";
    }
    // Check for ground/level 0
    else if (normalized.includes("ground") || normalized.includes("level 0") || 
             normalized.includes("level zero") || normalized.includes("zero level") ||
             normalized.includes("g level") || normalized.includes("g floor")) {
      result.level = "Ground";
    }
    // Check for first floor / level 1 - enhanced detection
    else if (normalized.includes("first floor") || normalized.includes("first level") ||
             normalized.includes("level 1") || normalized.includes("level one") ||
             normalized.includes("1st floor") || normalized.includes("1st level") ||
             normalized.includes("floor 1") || normalized.includes("level first") ||
             /(?:^|\s)(?:the\s+)?first(?:\s+floor|\s+level)?(?:\s|$)/.test(normalized) ||
             /(?:^|\s)level\s+1(?:\s|$)/.test(normalized) ||
             /(?:^|\s)floor\s+1(?:\s|$)/.test(normalized) ||
             /(?:^|\s)level\s+one(?:\s|$)/.test(normalized) ||
             /(?:^|\s)floor\s+one(?:\s|$)/.test(normalized)) {
      result.level = "First Floor";
    }
    // Check for second floor / level 2 - enhanced detection
    else if (normalized.includes("second floor") || normalized.includes("second level") ||
             normalized.includes("level 2") || normalized.includes("level two") ||
             normalized.includes("2nd floor") || normalized.includes("2nd level") ||
             normalized.includes("floor 2") || normalized.includes("level second") ||
             /(?:^|\s)(?:the\s+)?second(?:\s+floor|\s+level)?(?:\s|$)/.test(normalized) ||
             /(?:^|\s)level\s+2(?:\s|$)/.test(normalized) ||
             /(?:^|\s)floor\s+2(?:\s|$)/.test(normalized) ||
             /(?:^|\s)level\s+two(?:\s|$)/.test(normalized) ||
             /(?:^|\s)floor\s+two(?:\s|$)/.test(normalized)) {
      result.level = "Second Floor";
    }
    // Check for numeric patterns (level 1, floor 1, etc.) - fallback matching
    else {
      // Match patterns like "level 1", "floor 1", "level one", "the first floor"
      const levelMatch = normalized.match(/(?:level|floor)\s+(\d+|one|two|three|first|second|third)/);
      if (levelMatch) {
        const levelValue = levelMatch[1].toLowerCase();
        const numberToLevel: Record<string, string> = {
          "0": "Ground", "zero": "Ground",
          "1": "First Floor", "one": "First Floor", "first": "First Floor",
          "2": "Second Floor", "two": "Second Floor", "second": "Second Floor",
          "3": "Second Floor", "three": "Second Floor", "third": "Second Floor",
        };
        if (numberToLevel[levelValue]) {
          result.level = numberToLevel[levelValue];
        }
      }
      // Match standalone ordinal numbers when context suggests floor/level
      else if (/(?:^|\s)(?:the\s+)?(first|second|third|one|two|three)(?:\s+floor|\s+level|\s|$)/.test(normalized)) {
        const match = normalized.match(/(?:^|\s)(?:the\s+)?(first|second|third|one|two|three)(?:\s+floor|\s+level|\s|$)/);
        if (match) {
          const levelValue = match[1].toLowerCase();
          const numberToLevel: Record<string, string> = {
            "one": "First Floor", "first": "First Floor",
            "two": "Second Floor", "second": "Second Floor",
            "three": "Second Floor", "third": "Second Floor",
          };
          if (numberToLevel[levelValue]) {
            result.level = numberToLevel[levelValue];
          }
        }
      }
      // Match standalone digits when context suggests floor/level
      else if (/(?:^|\s)(?:the\s+)?(\d+)(?:\s+floor|\s+level|\s|$)/.test(normalized)) {
        const match = normalized.match(/(?:^|\s)(?:the\s+)?(\d+)(?:\s+floor|\s+level|\s|$)/);
        if (match) {
          const levelValue = match[1];
          const numberToLevel: Record<string, string> = {
            "0": "Ground",
            "1": "First Floor",
            "2": "Second Floor",
            "3": "Second Floor",
          };
          if (numberToLevel[levelValue]) {
            result.level = numberToLevel[levelValue];
          }
        }
      }
    }
  }
  
  return result;
}

