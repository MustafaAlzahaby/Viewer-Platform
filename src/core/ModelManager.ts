import * as OBC from "@thatopen/components";
import * as THREE from "three";

export class ModelManager {
  private world: OBC.World;
  private components: OBC.Components;
  public fragmentManager: OBC.FragmentsManager;
  public modelIds: string[] = [];

  constructor(world: OBC.World, components: OBC.Components) {
    this.world = world;
    this.components = components;
    this.fragmentManager = this.components.get(OBC.FragmentsManager);
  }

  // Static factory method
  public static async create(
    world: OBC.World,
    components: OBC.Components
  ): Promise<ModelManager> {
    const manager = new ModelManager(world, components);
    await manager.initialize();
    return manager;
  }

  // -------------------------------------------------------------
  // INITIALIZATION LOGIC (FIXED)
  // -------------------------------------------------------------
  private async initialize(): Promise<OBC.FragmentsManager> {
    const fragments = await this.initializeWorker();

    // 🎯 FIXED DEFAULT MODELS (includes Z6, which was missing!)
    const defaultModels = [
      "models/z1.frag",
      "models/z2.frag",
      "models/z3.frag",
      "models/z4.frag",
      "models/z5.frag",
      "models/z6.frag"  // REQUIRED for IFC storeys
    ];

    let fragPaths: string[] = [];

    // Load project model configs (used by your parent app)
    const projectData =
      (window as any).currentProject ||
      JSON.parse(sessionStorage.getItem("currentProject") || "{}");

    const modelPath = projectData.model_url || projectData.model_object_path;

    if (modelPath) {
      if (Array.isArray(modelPath)) fragPaths = modelPath;
      else fragPaths = [modelPath];

      console.log("[ModelManager] Loading project models:", fragPaths);
    } else {
      fragPaths = defaultModels;
      console.log("[ModelManager] Using default models:", fragPaths);
    }

    // -------------------------------------------------------------
    // MAIN LOADER
    // -------------------------------------------------------------
    const loadResults = await Promise.all(
      fragPaths.map(async (path) => {
        const modelId = path.split("/").pop()?.split(".").shift();
        if (!modelId) return null;

        try {
          const file = await fetch(path);
          if (!file.ok) {
            console.warn(`[ModelManager] Failed loading ${path}`);
            return null;
          }
          const buffer = await file.arrayBuffer();

          this.modelIds.push(modelId);
          return fragments.core.load(buffer, { modelId });
        } catch (error) {
          console.error(`[ModelManager] Error loading ${path}:`, error);
          return null;
        }
      })
    );

    // -------------------------------------------------------------
    // FALLBACK → If project model fails, load all zones (incl. z6)
    // -------------------------------------------------------------
    const successfulLoads = loadResults.filter((r) => r !== null).length;

    if (successfulLoads === 0 && modelPath) {
      console.warn("[ModelManager] Project model failed. Falling back to full default model set (zones 1-6).");

      fragPaths = defaultModels;

      await Promise.all(
        defaultModels.map(async (path) => {
          const modelId = path.split("/").pop()?.split(".").shift();
          if (!modelId) return null;

          try {
            const file = await fetch(path);
            if (!file.ok) return null;

            const buffer = await file.arrayBuffer();
            this.modelIds.push(modelId);

            return fragments.core.load(buffer, { modelId });
          } catch {
            return null;
          }
        })
      );
    }

    return fragments;
  }

  // -------------------------------------------------------------
  // WORKER INITIALIZATION (unchanged)
  // -------------------------------------------------------------
  private async initializeWorker(): Promise<OBC.FragmentsManager> {
    const githubUrl =
      "https://thatopen.github.io/engine_fragment/resources/worker.mjs";

    const fetchedUrl = await fetch(githubUrl);
    const workerBlob = await fetchedUrl.blob();
    const workerFile = new File([workerBlob], "worker.mjs", {
      type: "text/javascript",
    });
    const workerUrl = URL.createObjectURL(workerFile);

    const fragments = this.fragmentManager;
    fragments.init(workerUrl);

    if (this.world.camera.controls) {
      this.world.camera.controls.addEventListener("rest", () =>
        fragments.core.update(true)
      );
    }

    this.world.onCameraChanged.add((camera) => {
      for (const [, model] of fragments.list) {
        model.useCamera(camera.three);
      }
      fragments.core.update(true);
    });

    fragments.list.onItemSet.add(({ value: model }) => {
      model.useCamera(this.world.camera.three as any);
      this.world.scene.three.add(model.object);
      fragments.core.update(true);
    });

    return fragments;
  }
}
