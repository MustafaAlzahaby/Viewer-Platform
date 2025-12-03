import * as OBC from "@thatopen/components";
import * as THREE from "three";

export class ModelManager {
  private world: OBC.World;
  private components: OBC.Components;
  public fragmentManager: OBC.FragmentsManager;
  public modelIds: string[] = [];
  private loadProgress: Map<string, number> = new Map();
  public onProgressUpdate?: (progress: number, loadedModels: number, totalModels: number) => void;

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

  private async initialize(): Promise<OBC.FragmentsManager> {
    const fragments = await this.initializeWorker();
    
    // Prioritize by file size (smallest first for faster initial render)
    const fragPaths = [
      { path: "models/z1.frag", priority: 1, size: 17213 }, // ~17MB
      { path: "models/z3.frag", priority: 1, size: 17279 }, // ~17MB
      { path: "models/z2.frag", priority: 2, size: 20222 }, // ~20MB
      { path: "models/z5.frag", priority: 2, size: 23974 }, // ~24MB
      { path: "models/z4.frag", priority: 2, size: 32605 }, // ~33MB
    ];

    // Load high-priority models first (smallest ones)
    const priority1 = fragPaths.filter(f => f.priority === 1);
    const priority2 = fragPaths.filter(f => f.priority === 2);

    console.log("Loading priority 1 models...");
    await this.loadModelsWithProgress(priority1, fragments);
    
    console.log("Loading priority 2 models...");
    await this.loadModelsWithProgress(priority2, fragments);

    return fragments;
  }

  private async loadModelsWithProgress(
    models: Array<{ path: string; priority: number; size: number }>,
    fragments: OBC.FragmentsManager
  ): Promise<void> {
    const totalModels = models.length;
    
    // Use parallel loading with progress tracking
    await Promise.all(
      models.map(async ({ path }) => {
        const modelId = path.split("/").pop()?.split(".").shift();
        if (!modelId) return null;

        try {
          // Fetch with progress tracking
          const response = await fetch(path);
          if (!response.ok) throw new Error(`Failed to fetch ${path}`);
          
          const contentLength = response.headers.get('content-length');
          const total = contentLength ? parseInt(contentLength, 10) : 0;
          
          let loaded = 0;
          const reader = response.body?.getReader();
          const chunks: Uint8Array[] = [];

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              chunks.push(value);
              loaded += value.length;
              
              // Update progress
              this.loadProgress.set(modelId, (loaded / total) * 100);
              this.notifyProgress(totalModels);
            }
          }

          // Combine chunks into buffer
          const buffer = new Uint8Array(loaded);
          let position = 0;
          for (const chunk of chunks) {
            buffer.set(chunk, position);
            position += chunk.length;
          }

          this.modelIds.push(modelId);
          console.log(`Loaded ${modelId} (${(loaded / 1024 / 1024).toFixed(2)} MB)`);
          
          return fragments.core.load(buffer.buffer, { modelId });
        } catch (error) {
          console.error(`Error loading ${path}:`, error);
          return null;
        }
      })
    );
  }

  private notifyProgress(totalModels: number): void {
    if (!this.onProgressUpdate) return;
    
    let totalProgress = 0;
    let loadedCount = 0;
    
    this.loadProgress.forEach((progress) => {
      totalProgress += progress;
      if (progress === 100) loadedCount++;
    });
    
    const avgProgress = totalProgress / this.loadProgress.size;
    this.onProgressUpdate(avgProgress, loadedCount, totalModels);
  }

  private async initializeWorker(): Promise<OBC.FragmentsManager> {
    // Cache worker blob to avoid re-fetching
    const workerUrl = await this.getWorkerUrl();
    const fragments = this.fragmentManager;
    fragments.init(workerUrl);

    // Debounce camera updates to reduce overhead
    let updateTimeout: number | null = null;
    this.world.camera.controls?.addEventListener("rest", () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = window.setTimeout(() => {
        fragments.core.update(true);
      }, 100);
    });

    this.world.onCameraChanged.add((camera) => {
      const threeCamera = camera.three as THREE.PerspectiveCamera | THREE.OrthographicCamera;
      for (const [, model] of fragments.list) {
        model.useCamera(threeCamera);
      }
      fragments.core.update(true);
    });

    fragments.list.onItemSet.add(({ value: model }) => {
      const threeCamera = this.world.camera.three as THREE.PerspectiveCamera | THREE.OrthographicCamera;
      model.useCamera(threeCamera);
      this.world.scene.three.add(model.object);
      fragments.core.update(true);
    });

    return fragments;
  }

  private async getWorkerUrl(): Promise<string> {
    // Check if worker is already cached
    const cachedWorker = sessionStorage.getItem('bim-worker-url');
    if (cachedWorker) {
      return cachedWorker;
    }

    const githubUrl = "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
    const fetchedUrl = await fetch(githubUrl);
    const workerBlob = await fetchedUrl.blob();
    const workerFile = new File([workerBlob], "worker.mjs", {
      type: "text/javascript",
    });
    const workerUrl = URL.createObjectURL(workerFile);
    
    // Cache for session
    sessionStorage.setItem('bim-worker-url', workerUrl);
    
    return workerUrl;
  }

  // Method to load a single model on-demand
  public async loadModelOnDemand(path: string): Promise<void> {
    const modelId = path.split("/").pop()?.split(".").shift();
    if (!modelId || this.modelIds.includes(modelId)) return;

    const file = await fetch(path);
    const buffer = await file.arrayBuffer();
    
    this.modelIds.push(modelId);
    await this.fragmentManager.core.load(buffer, { modelId });
    console.log(`Lazy-loaded ${modelId}`);
  }

  // Dispose method for cleanup
  public dispose(): void {
    this.loadProgress.clear();
    URL.revokeObjectURL(sessionStorage.getItem('bim-worker-url') || '');
    sessionStorage.removeItem('bim-worker-url');
  }
}