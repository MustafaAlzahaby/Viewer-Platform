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

  // Static factory method - this is the recommended approach
  public static async create(
    world: OBC.World,
    components: OBC.Components
  ): Promise<ModelManager> {
    const manager = new ModelManager(world, components);
    await manager.initialize();
    return manager;
  }

  private async initialize(): Promise<OBC.FragmentsManager> {
    console.log("[ModelManager] Initializing worker...");
    const fragments = await this.initializeWorker();

    // const fragPaths = ["models/z1.frag", "models/z2.frag", "models/z3.frag", "models/z4.frag", "models/z5.frag", "models/z6.frag"];
    const fragPaths = ["models/z6.frag"];

    console.log(`[ModelManager] Loading ${fragPaths.length} fragment file(s)...`);

    // Load all fragments
    await Promise.all(
      fragPaths.map(async (path, index) => {
        const modelId = path.split("/").pop()?.split(".").shift();
        if (!modelId) return null;

        console.log(`[ModelManager] Fetching ${path}...`);
        const file = await fetch(path);
        const buffer = await file.arrayBuffer();
        console.log(`[ModelManager] Loaded ${path} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

        this.modelIds.push(modelId);
        console.log(`[ModelManager] Loading fragment ${index + 1}/${fragPaths.length}: ${modelId}`);
        const result = await fragments.core.load(buffer, { modelId });
        console.log(`[ModelManager] Fragment ${modelId} loaded successfully`);
        return result;
      })
    );

    console.log("[ModelManager] All fragments loaded");

    // Wait for fragments to be added to the scene
    await new Promise<void>(resolve => {
      const checkAdded = () => {
        if (fragments.list.size === fragPaths.length) {
          console.log(`[ModelManager] All ${fragments.list.size} fragments added to scene`);
          resolve();
        } else {
          setTimeout(checkAdded, 50);
        }
      };
      checkAdded();
    });

    return fragments;
  }

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

    this.world.camera.controls.addEventListener("rest", () =>
      fragments.core.update(true)
    );

    this.world.onCameraChanged.add((camera) => {
      for (const [, model] of fragments.list) {
        model.useCamera(camera.three);
      }
      fragments.core.update(true);
    });

    fragments.list.onItemSet.add(({ value: model }) => {
      model.useCamera(this.world.camera.three);
      this.world.scene.three.add(model.object);
      fragments.core.update(true);
    });

    return fragments;
  }
}
