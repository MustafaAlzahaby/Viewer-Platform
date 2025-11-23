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
    const fragments = await this.initializeWorker();
    
    // Read project data from sessionStorage (set by parent window) - KEEP AUTH LOGIC
    const projectData = (window as any).currentProject || JSON.parse(sessionStorage.getItem('currentProject') || '{}');
    
    let fragPaths: string[] = [];
    
    // Check for model_url or model_object_path (support both field names) - KEEP PROJECT DATA LOGIC
    const modelPath = projectData.model_url || projectData.model_object_path;
    
    if (modelPath) {
      // If project has a model path, use it
      // Support both single file and array of files
      if (Array.isArray(modelPath)) {
        fragPaths = modelPath;
      } else {
        fragPaths = [modelPath];
      }
      console.log('[ModelManager] Loading model from project:', fragPaths);
    } else {
      // Fallback to default models (original working paths - relative, no leading slash)
      fragPaths = ["models/z5.frag", "models/z2.frag", "models/z3.frag", "models/z4.frag", "models/z1.frag"];
      console.log('[ModelManager] Using default models:', fragPaths);
    }

    // Original simple parallel loading (from working version - fast and efficient)
    await Promise.all(
      fragPaths.map(async (path) => {
        const modelId = path.split("/").pop()?.split(".").shift();
        if (!modelId) return null;

        const file = await fetch(path);
        const buffer = await file.arrayBuffer();

        this.modelIds.push(modelId); // Save the modelId
        return fragments.core.load(buffer, { modelId });
      })
    );

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
