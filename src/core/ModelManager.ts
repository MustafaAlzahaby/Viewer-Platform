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
    
    // Read project data from sessionStorage (set by parent window)
    const projectData = (window as any).currentProject || JSON.parse(sessionStorage.getItem('currentProject') || '{}');
    
    let fragPaths: string[] = [];
    
    // Check for model_url or model_object_path (support both field names)
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
      // Fallback to default models (all 5 zones - original fast loading)
      fragPaths = ["/models/z5.frag", "/models/z2.frag", "/models/z3.frag", "/models/z4.frag", "/models/z1.frag"];
      console.log('[ModelManager] Using default models:', fragPaths);
    }
    
    // Ensure all paths are absolute (start with /)
    fragPaths = fragPaths.map(path => {
      const cleanPath = path.replace(/^\.\//, '');
      return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    });

    // Original simple parallel loading (fast and efficient)
    const loadResults = await Promise.all(
      fragPaths.map(async (path) => {
        const modelId = path.split("/").pop()?.split(".").shift();
        if (!modelId) {
          console.warn(`[ModelManager] Invalid model path: ${path}`);
          return null;
        }

        try {
          console.log(`[ModelManager] Fetching ${path}...`);
          const file = await fetch(path);
          if (!file.ok) {
            console.warn(`[ModelManager] Failed to load ${path}: ${file.statusText}`);
            return null;
          }
          const buffer = await file.arrayBuffer();
          console.log(`[ModelManager] Loaded ${path}, size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

          this.modelIds.push(modelId);
          const loadedFragment = await fragments.core.load(buffer, { modelId });
          console.log(`[ModelManager] Fragment loaded for model: ${modelId}`);
          
          // Ensure the model is added to the scene
          if (loadedFragment && loadedFragment.object) {
            const cam = this.world.camera.three;
            if (cam && (cam.type === 'PerspectiveCamera' || cam.type === 'OrthographicCamera')) {
              loadedFragment.useCamera(cam as any);
              this.world.scene.three.add(loadedFragment.object);
              console.log(`[ModelManager] Model ${modelId} added to scene`);
            }
          }
          
          return loadedFragment;
        } catch (error) {
          console.error(`[ModelManager] Error loading ${path}:`, error);
          return null;
        }
      })
    );

    const successfulLoads = loadResults.filter(r => r !== null).length;
    console.log(`[ModelManager] Successfully loaded ${successfulLoads} out of ${fragPaths.length} models`);
    
    // Update fragments core after all models are loaded
    if (fragments.core && fragments.core.update) {
      fragments.core.update(true);
      console.log(`[ModelManager] Fragments core updated`);
    }

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
    if (!fragments) {
      throw new Error("FragmentManager not initialized");
    }
    fragments.init(workerUrl);

    // Store reference for closure - TypeScript knows fragments is not null after check
    const fragmentsRef = fragments!; // Non-null assertion after null check
    if (this.world.camera.controls) {
      this.world.camera.controls.addEventListener("rest", () => {
        if (fragmentsRef?.core?.update) {
          fragmentsRef.core.update(true);
        }
      });
    }

    this.world.onCameraChanged.add((camera) => {
      const cam = camera.three;
      if (cam && (cam.type === 'PerspectiveCamera' || cam.type === 'OrthographicCamera')) {
        for (const [, model] of fragments.list) {
          model.useCamera(cam as any);
        }
        if (fragments.core) {
          fragments.core.update(true);
        }
      }
    });

    fragments.list.onItemSet.add(({ value: model }) => {
      const cam = this.world.camera.three;
      if (cam && (cam.type === 'PerspectiveCamera' || cam.type === 'OrthographicCamera')) {
        model.useCamera(cam as any);
        this.world.scene.three.add(model.object);
        if (fragments.core && fragments.core.update) {
          fragments.core.update(true);
        }
      }
    });

    return fragments;
  }
}
