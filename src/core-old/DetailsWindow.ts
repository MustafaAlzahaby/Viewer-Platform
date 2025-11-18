import type { ModelManager } from "./ModelManager";
import type { SceneManager } from "./SceneManager";
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import type { HighlightController } from "./HighlightController";

export class DetailsWindow {
  private sceneManager: SceneManager;
  private casters: OBC.Raycasters;
  private modelManager: ModelManager;
  private popupElement: HTMLElement | null = null;
  private highlightController: HighlightController;

  constructor(sceneManager: SceneManager, modelManager: ModelManager, highlightController: HighlightController) {
    this.sceneManager = sceneManager;
    this.modelManager = modelManager;
    this.highlightController = highlightController;
    this.init();
  }

  private init() {
    this.casters = this.sceneManager.components.get(OBC.Raycasters);
    const caster = this.casters.get(this.sceneManager.world);

    // We set a selection callback, so we can decide what
    // happen with the selected element later
    let onSelectCallback = (_modelIdMap: OBC.ModelIdMap) => {};

    this.sceneManager.container.addEventListener("dblclick", async (event) => {
      const result = (await caster.castRay()) as any;

      if (!result) {
        // If no element is hit, hide the popup
        this.hidePopup();
        return;
      }

      // The modelIdMap is how selections are represented in the engine.
      // The keys are modelIds, while the values are sets of localIds (items within the model)
      const modelIdMap = {
        [result.fragments.modelId]: new Set([result.localId]),
      };

      // Pass the mouse coordinates for popup positioning
      onSelectCallback(modelIdMap, event);
    });

    let onItemSelected = () => {};
    let attributes: FRAGS.ItemData | undefined;

    // We set the color outside just to be able to change it from the UI
    const color = new THREE.Color("purple");

    onSelectCallback = async (modelIdMap, event?: MouseEvent) => {
      const modelId = Object.keys(modelIdMap)[0];
      if (modelId && this.modelManager.fragmentManager.list.get(modelId)) {
        const model = this.modelManager.fragmentManager.list.get(modelId)!;
        const localIds = [...modelIdMap[modelId]];
        const [data] = await model.getItemsData(localIds);
        attributes = data;

        // console.log("Attributes:", attributes);

        // Get activity name from activity map
        const localId = localIds[0];
        const elementLocalId = attributes?._localId?.value || attributes?._localId;

        // console.log("Element LocalId:", elementLocalId);

        // Find activity information using the localId
        let activityName = "Not Started Yet";

        if (elementLocalId && this.highlightController) {
          // Get the maps from HighlightController
          const highlightParamsToIds = this.highlightController.highlighter?.highlightParamsToIds;
          const rawToMappedResults = this.highlightController.dataProcessor?.rawToMappedResults;

          // console.log("HighlightParamsToIds:", highlightParamsToIds);
          // console.log("RawToMappedResults:", rawToMappedResults);

          if (highlightParamsToIds && rawToMappedResults) {
            // Find the parameter key that contains this localId
            let matchingParamKey = null;
            for (const [paramKey, ids] of highlightParamsToIds) {
              // console.log("Checking paramKey:", paramKey, "with ids:", ids);
              if (Array.isArray(ids) && ids.includes(elementLocalId)) {
                matchingParamKey = paramKey;
                // console.log("Found matching paramKey:", matchingParamKey);
                break;
              }
            }

            if (matchingParamKey) {
              // Parse the parameter key to get the mapped parameters
              try {
                const mappedParams = JSON.parse(matchingParamKey);
                // console.log("Mapped params:", mappedParams);

                // Find the corresponding raw activity data
                for (const [rawKey, mappedValue] of rawToMappedResults) {
                  // console.log("Checking rawKey:", rawKey, "with mappedValue:", mappedValue);
                  
                  // Check if the mapped parameters match
                  if (
                    mappedValue.zone === mappedParams.zone &&
                    mappedValue.level === mappedParams.level &&
                    mappedValue.status === mappedParams.status &&
                    JSON.stringify(mappedValue.category.sort()) ===
                      JSON.stringify(mappedParams.category.sort())
                  ) {
                    // console.log("Found matching activity!");
                    // Extract activity name from raw key (assuming it's in the second position)
                    if (Array.isArray(rawKey) && rawKey.length > 1) {
                      activityName = rawKey[1]; // Activity name is at index 1
                      // console.log("Activity name:", activityName);
                    }
                    break;
                  }
                }
              } catch (error) {
                // console.error("Error parsing parameter key:", error);
              }
            } else {
              // console.log("No matching parameter key found for localId:", elementLocalId);
            }
          } else {
            // console.log("Maps not available:", { highlightParamsToIds, rawToMappedResults });
          }
        } else {
          // console.log("ElementLocalId or HighlightController not available:", { elementLocalId, highlightController: this.highlightController });
        }

        // Show popup with element details
        this.showPopup({
          // Fix: Access the value property of ObjectType or Name
          familyName:
            attributes?.ObjectType?.value ||
            attributes?.Name?.value ||
            "Unknown Family",
          activityName: activityName,
          mouseEvent: event,
        });
      }

      onItemSelected();
    };
  }

  // ... rest of the methods remain the same
  private createPopupElement(): HTMLElement {
    const popup = document.createElement("div");
    popup.className = "bim-details-popup";
    popup.style.cssText = `
      position: fixed;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      backdrop-filter: blur(20px);
      transform: scale(0.8) translateY(10px);
      opacity: 0;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
      min-width: 280px;
      max-width: 400px;
    `;

    // Add a subtle inner glow
    const innerGlow = document.createElement("div");
    innerGlow.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      pointer-events: none;
    `;
    popup.appendChild(innerGlow);

    return popup;
  }

  private showPopup(details: {
    familyName: string;
    activityName: string;
    mouseEvent?: MouseEvent;
  }) {
    // Hide existing popup if any
    this.hidePopup();

    // Create new popup
    this.popupElement = this.createPopupElement();

    // Create content container
    const content = document.createElement("div");
    content.style.cssText = `
      position: relative;
      z-index: 1;
    `;

    // Title
    const title = document.createElement("div");
    title.textContent = "Element Details";
    title.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      text-align: center;
      letter-spacing: 0.5px;
    `;

    // Family name section
    const familySection = document.createElement("div");
    familySection.style.cssText = `
      margin-bottom: 12px;
    `;

    const familyLabel = document.createElement("div");
    familyLabel.textContent = "Family Name";
    familyLabel.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 4px;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;

    const familyValue = document.createElement("div");
    familyValue.textContent = details.familyName;
    familyValue.style.cssText = `
      font-size: 14px;
      font-weight: 400;
      background: rgba(255, 255, 255, 0.1);
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      word-wrap: break-word;
    `;

    // Activity name section
    const activitySection = document.createElement("div");

    const activityLabel = document.createElement("div");
    activityLabel.textContent = "Activity";
    activityLabel.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 4px;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;

    const activityValue = document.createElement("div");
    activityValue.textContent = details.activityName;
    activityValue.style.cssText = `
      font-size: 14px;
      font-weight: 400;
      background: rgba(255, 255, 255, 0.1);
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      word-wrap: break-word;
      ${
        details.activityName === "No Activity Assigned"
          ? "opacity: 0.7; font-style: italic;"
          : ""
      }
    `;

    // Assemble content
    familySection.appendChild(familyLabel);
    familySection.appendChild(familyValue);
    activitySection.appendChild(activityLabel);
    activitySection.appendChild(activityValue);

    content.appendChild(title);
    content.appendChild(familySection);
    content.appendChild(activitySection);
    this.popupElement.appendChild(content);

    // Add close button
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "×";
    closeButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      color: white;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease;
      z-index: 2;
    `;

    closeButton.addEventListener("mouseenter", () => {
      closeButton.style.background = "rgba(255, 255, 255, 0.3)";
    });

    closeButton.addEventListener("mouseleave", () => {
      closeButton.style.background = "rgba(255, 255, 255, 0.2)";
    });

    closeButton.addEventListener("click", () => {
      this.hidePopup();
    });

    this.popupElement.appendChild(closeButton);

    // Add to document
    document.body.appendChild(this.popupElement);

    // Position popup
    if (details.mouseEvent) {
      const rect = this.sceneManager.container.getBoundingClientRect();
      let x = details.mouseEvent.clientX + 15;
      let y = details.mouseEvent.clientY + 15;

      // Adjust if popup would go off-screen
      const popupRect = this.popupElement.getBoundingClientRect();
      if (x + popupRect.width > window.innerWidth - 20) {
        x = details.mouseEvent.clientX - popupRect.width - 15;
      }
      if (y + popupRect.height > window.innerHeight - 20) {
        y = details.mouseEvent.clientY - popupRect.height - 15;
      }

      this.popupElement.style.left = `${Math.max(10, x)}px`;
      this.popupElement.style.top = `${Math.max(10, y)}px`;
    } else {
      // Center on screen if no mouse event
      this.popupElement.style.left = "50%";
      this.popupElement.style.top = "50%";
      this.popupElement.style.transform = "translate(-50%, -50%) scale(0.8)";
    }

    // Animate in
    requestAnimationFrame(() => {
      if (this.popupElement) {
        this.popupElement.style.opacity = "1";
        this.popupElement.style.transform = details.mouseEvent
          ? "scale(1) translateY(0)"
          : "translate(-50%, -50%) scale(1)";
        this.popupElement.style.pointerEvents = "auto";
      }
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (this.popupElement) {
        this.hidePopup();
      }
    }, 5000);
  }

private hidePopup() {
    if (this.popupElement) {
      const isCentered = this.popupElement.style.left === "50%";
      
      // Disable pointer events immediately
      this.popupElement.style.pointerEvents = "none";
      
      // Animate out with requestAnimationFrame for smoother transition
      requestAnimationFrame(() => {
        if (this.popupElement) {
          this.popupElement.style.opacity = "0";
          this.popupElement.style.transform = isCentered
            ? "translate(-50%, -50%) scale(0.85) translateY(20px)"
            : "scale(0.85) translateY(20px)";
        }
      });

      // Remove after animation completes (match the transition duration)
      setTimeout(() => {
        if (this.popupElement && this.popupElement.parentNode) {
          this.popupElement.parentNode.removeChild(this.popupElement);
        }
        this.popupElement = null;
      }, 250);
    }
  }

  public destroy() {
    this.hidePopup();
    // Remove any event listeners if needed
  }
}