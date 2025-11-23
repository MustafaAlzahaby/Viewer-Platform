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
    
    if (projectData.model_url) {
      // If project has a model_url, use it
      // Support both single file and array of files
      if (Array.isArray(projectData.model_url)) {
        fragPaths = projectData.model_url;
      } else {
        fragPaths = [projectData.model_url];
      }
      console.log('[ModelManager] Loading model from project:', fragPaths);
    } else {
      // Fallback to default models (use absolute paths)
      fragPaths = ["/models/z5.frag", "/models/z2.frag", "/models/z3.frag", "/models/z4.frag", "/models/z1.frag"];
      console.log('[ModelManager] Using default models:', fragPaths);
    }
    
    // Ensure all paths are absolute (start with /)
    fragPaths = fragPaths.map(path => {
      // Remove leading ./ if present
      const cleanPath = path.replace(/^\.\//, '');
      // Add leading / if not present
      return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    });
    
    console.log('[ModelManager] Final model paths:', fragPaths);

    const loadResults = await Promise.all(
      fragPaths.map(async (path) => {
        const modelId = path.split("/").pop()?.split(".").shift();
        if (!modelId) {
          console.warn(`[ModelManager] Invalid model path: ${path}`);
          return null;
        }

        try {
          console.log(`[ModelManager] Fetching model from: ${path}`);
          const file = await fetch(path);
          if (!file.ok) {
            console.error(`[ModelManager] Failed to load ${path}: ${file.status} ${file.statusText}`);
            return null;
          }
          const buffer = await file.arrayBuffer();
          console.log(`[ModelManager] Loaded ${path}, size: ${buffer.byteLength} bytes`);

          this.modelIds.push(modelId); // Save the modelId
          const loadedFragment = await fragments.core.load(buffer, { modelId });
          console.log(`[ModelManager] Successfully loaded fragment for model: ${modelId}`);
          return loadedFragment;
        } catch (error) {
          console.error(`[ModelManager] Error loading ${path}:`, error);
          return null;
        }
      })
    );
    
    const successfulLoads = loadResults.filter(r => r !== null).length;
    console.log(`[ModelManager] Loaded ${successfulLoads} out of ${fragPaths.length} models`);
    
    if (successfulLoads === 0) {
      console.error('[ModelManager] ⚠️ No models were successfully loaded!');
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
