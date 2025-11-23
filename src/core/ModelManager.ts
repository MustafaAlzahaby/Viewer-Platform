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

  public static async create(
    world: OBC.World,
    components: OBC.Components
  ): Promise<ModelManager> {
    const manager = new ModelManager(world, components);
    await manager.initialize();
    return manager;
  }

  // -------------------------------------------------------------
  // STATIC VERSION — Loads ONLY the required FRAG files
  // -------------------------------------------------------------
  private async initialize(): Promise<OBC.FragmentsManager> {
    const fragments = await this.initializeWorker();

    // STATIC MODEL LIST — NO ZONE 6
    const fragPaths = [
      "/models/z1.frag",
      "/models/z2.frag",
      "/models/z3.frag",
      "/models/z4.frag",
      "/models/z5.frag"
    ];

    console.log("[ModelManager] Loading static models:", fragPaths);

    await Promise.all(
      fragPaths.map(async (path) => {
        const modelId = path.split("/").pop()?.split(".")[0];
        if (!modelId) return null;

        try {
          const res = await fetch(path);
          if (!res.ok) {
            console.error(`[ModelManager] ❌ Failed loading ${path}`);
            return null;
          }

          const buffer = await res.arrayBuffer();
          this.modelIds.push(modelId);

          return fragments.core.load(buffer, { modelId });
        } catch (err) {
          console.error(`[ModelManager] ❌ Error loading ${path}:`, err);
          return null;
        }
      })
    );

    return fragments;
  }

  // -------------------------------------------------------------
  // WORKER INITIALIZATION (unchanged)
  // -------------------------------------------------------------
  private async initializeWorker(): Promise<OBC.FragmentsManager> {
    const workerUrlRemote =
      "https://thatopen.github.io/engine_fragment/resources/worker.mjs";

    const fetched = await fetch(workerUrlRemote);
    const blob = await fetched.blob();

    const workerFile = new File([blob], "worker.mjs", {
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
