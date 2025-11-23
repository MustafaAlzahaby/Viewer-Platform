import * as OBC from "@thatopen/components";

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

  // Factory method
  public static async create(
    world: OBC.World,
    components: OBC.Components
  ): Promise<ModelManager> {
    const manager = new ModelManager(world, components);
    await manager.initialize();
    return manager;
  }

  // -------------------------------------------------------------
  // INITIALIZATION (Vercel-safe)
  // -------------------------------------------------------------
  private async initialize(): Promise<OBC.FragmentsManager> {
    const fragments = await this.initializeWorker();

    // IMPORTANT for Vercel: Always use absolute paths (served from /public/)
    const base = "/models/";

    // Full correct default model list INCLUDING z6
    const defaultModels = [
      base + "z1.frag",
      base + "z2.frag",
      base + "z3.frag",
      base + "z4.frag",
      base + "z5.frag",
      base + "z6.frag"
    ];

    let fragPaths: string[] = [];

    // Load project model config
    const projectData =
      (window as any).currentProject ||
      JSON.parse(sessionStorage.getItem("currentProject") || "{}");

    const projectModelPath =
      projectData.model_url || projectData.model_object_path;

    // Use project model if available
    if (projectModelPath) {
      if (Array.isArray(projectModelPath)) {
        fragPaths = projectModelPath.map((p: string) =>
          p.startsWith("/") ? p : "/" + p
        );
      } else {
        fragPaths = [
          projectModelPath.startsWith("/")
            ? projectModelPath
            : "/" + projectModelPath
        ];
      }

      console.log("[ModelManager] Loading project models:", fragPaths);
    } else {
      fragPaths = defaultModels;
      console.log("[ModelManager] Using default models:", fragPaths);
    }

    // -------------------------------------------------------------
    // LOAD MODEL FRAGMENTS
    // -------------------------------------------------------------
    const loadResults = await Promise.all(
      fragPaths.map(async (path) => {
        const modelId = path.split("/").pop()?.split(".")[0];
        if (!modelId) return null;

        try {
          const res = await fetch(path);

          if (!res.ok) {
            console.warn(`[ModelManager] Failed loading ${path}`);
            return null;
          }

          const buffer = await res.arrayBuffer();
          this.modelIds.push(modelId);

          return fragments.core.load(buffer, { modelId });
        } catch (err) {
          console.error(`[ModelManager] Error loading ${path}:`, err);
          return null;
        }
      })
    );

    // -------------------------------------------------------------
    // FALLBACK TO DEFAULT MODELS IF PROJECT FILE FAILED
    // -------------------------------------------------------------
    const successful = loadResults.filter((r) => r !== null).length;

    if (successful === 0 && projectModelPath) {
      console.warn(
        "[ModelManager] Project model failed. Falling back to full default model set (zones 1–6)."
      );

      await Promise.all(
        defaultModels.map(async (path) => {
          const modelId = path.split("/").pop()?.split(".")[0];
          if (!modelId) return null;

          try {
            const res = await fetch(path);
            if (!res.ok) return null;

            const buffer = await res.arrayBuffer();
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
  // WORKER INITIALIZATION
  // -------------------------------------------------------------
  private async initializeWorker(): Promise<OBC.FragmentsManager> {
    const workerUrlRemote =
      "https://thatopen.github.io/engine_fragment/resources/worker.mjs";

    const fetched = await fetch(workerUrlRemote);
    const blob = await fetched.blob();

    const workerFile = new File([blob], "worker.mjs", {
      type: "text/javascript"
    });

    const workerUrl = URL.createObjectURL(workerFile);

    const fragments = this.fragmentManager;
    fragments.init(workerUrl);

    // Camera update listeners
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
