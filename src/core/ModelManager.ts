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
    
    // Test if we can access the public folder and log the base URL
    console.log('[ModelManager] Current window location:', window.location.href);
    console.log('[ModelManager] Base URL:', window.location.origin);
    try {
      const testResponse = await fetch('/Rowad-Logo.ico', { method: 'HEAD' });
      console.log('[ModelManager] Public folder accessibility test:', testResponse.ok ? 'OK' : 'FAILED', testResponse.status);
      if (!testResponse.ok) {
        console.error('[ModelManager] Public folder test failed with status:', testResponse.status, testResponse.statusText);
      }
    } catch (e) {
      console.error('[ModelManager] Public folder test failed:', e);
    }

    const loadResults = await Promise.allSettled(
      fragPaths.map(async (path) => {
        const modelId = path.split("/").pop()?.split(".").shift();
        if (!modelId) {
          throw new Error(`Invalid model path: ${path}`);
        }

        console.log(`[ModelManager] Fetching model from: ${path}`);
        
        // Add timeout to fetch (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        let file: Response;
        try {
          console.log(`[ModelManager] Starting fetch for ${path}...`);
          const fetchStartTime = Date.now();
          file = await fetch(path, { 
            signal: controller.signal,
            cache: 'no-cache' // Ensure we're not getting cached errors
          });
          const fetchDuration = Date.now() - fetchStartTime;
          console.log(`[ModelManager] Fetch completed for ${path} in ${fetchDuration}ms, status: ${file.status}`);
          clearTimeout(timeoutId);
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          console.error(`[ModelManager] Fetch error for ${path}:`, fetchError);
          if (fetchError.name === 'AbortError') {
            throw new Error(`Timeout loading ${path} (30s)`);
          } else {
            throw new Error(`Network error loading ${path}: ${fetchError.message || 'Unknown error'}`);
          }
        }
        
        console.log(`[ModelManager] Checking response for ${path}, ok: ${file.ok}, status: ${file.status}`);
        if (!file.ok) {
          const errorMsg = `HTTP ${file.status}: ${file.statusText}`;
          console.error(`[ModelManager] Failed to load ${path}: ${errorMsg}`);
          console.error(`[ModelManager] Response headers:`, Object.fromEntries(file.headers.entries()));
          throw new Error(errorMsg);
        }
        
        console.log(`[ModelManager] Converting response to arrayBuffer for ${path}...`);
        const buffer = await file.arrayBuffer();
        console.log(`[ModelManager] Loaded ${path}, size: ${buffer.byteLength} bytes`);

        if (buffer.byteLength === 0) {
          throw new Error(`Empty file loaded from ${path}`);
        }

        console.log(`[ModelManager] Loading fragment into core for ${modelId}...`);
        this.modelIds.push(modelId); // Save the modelId
        const fragmentLoadStart = Date.now();
        const loadedFragment = await fragments.core.load(buffer, { modelId });
        const fragmentLoadDuration = Date.now() - fragmentLoadStart;
        console.log(`[ModelManager] Successfully loaded fragment for model: ${modelId} in ${fragmentLoadDuration}ms`);
        return loadedFragment;
      })
    );
    
    // Process results from Promise.allSettled
    const results = loadResults.map((result, index) => {
      const path = fragPaths[index];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`[ModelManager] Failed to load ${path}:`, reason);
        return null;
      }
    });
    
    const successfulLoads = results.filter(r => r !== null).length;
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
