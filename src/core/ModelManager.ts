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

    // Load models sequentially (simpler, more reliable for large files)
    const results: any[] = [];
    
    for (let i = 0; i < fragPaths.length; i++) {
      const path = fragPaths[i];
      const modelId = path.split("/").pop()?.split(".").shift();
      
      if (!modelId) {
        console.error(`[ModelManager] Invalid model path: ${path}`);
        results.push(null);
        continue;
      }

      try {
        console.log(`[ModelManager] Loading ${i + 1}/${fragPaths.length}: ${path}`);
        
        // Fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        let file: Response;
        try {
          file = await fetch(path, { 
            signal: controller.signal,
            cache: 'default'
          });
          clearTimeout(timeoutId);
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error(`Timeout loading ${path}`);
          }
          throw fetchError;
        }
        
        if (!file.ok) {
          throw new Error(`HTTP ${file.status}: ${file.statusText}`);
        }
        
        // Convert to arrayBuffer with memory management and timeout
        console.log(`[ModelManager] Reading file data for ${path}...`);
        
        // Get content length for memory check
        const contentLength = file.headers.get('content-length');
        const fileSizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024) : 0;
        console.log(`[ModelManager] File size: ${fileSizeMB.toFixed(2)} MB`);
        
        // Warn if file is very large
        if (fileSizeMB > 100) {
          console.warn(`[ModelManager] ⚠️ Large file detected (${fileSizeMB.toFixed(2)} MB). This may take a while...`);
        }
        
        // Convert to arrayBuffer with timeout protection
        let buffer: ArrayBuffer;
        try {
          const arrayBufferPromise = file.arrayBuffer();
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('arrayBuffer conversion timeout (60s)')), 60000)
          );
          
          buffer = await Promise.race([arrayBufferPromise, timeoutPromise]);
          console.log(`[ModelManager] File loaded: ${path}, size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
        } catch (bufferError) {
          const errorMsg = bufferError instanceof Error ? bufferError.message : String(bufferError);
          console.error(`[ModelManager] Failed to convert ${path} to arrayBuffer:`, errorMsg);
          throw new Error(`Memory/timeout error loading ${path}: ${errorMsg}`);
        }

        if (buffer.byteLength === 0) {
          throw new Error(`Empty file: ${path}`);
        }

        // Load into fragments
        console.log(`[ModelManager] Loading fragment: ${modelId}...`);
        this.modelIds.push(modelId);
        const loadedFragment = await fragments.core.load(buffer, { modelId });
        console.log(`[ModelManager] ✓ Successfully loaded: ${modelId}`);
        results.push(loadedFragment);
        
        // Force garbage collection hint and small delay between loads
        // This helps prevent memory exhaustion with large files
        if (i < fragPaths.length - 1) {
          // Small delay to let browser process memory
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Clear buffer reference to help with memory (browser will GC when ready)
        // Note: We can't explicitly null the buffer, but the delay helps
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[ModelManager] ✗ Failed to load ${path}:`, errorMsg);
        results.push(null);
        // Continue loading other models even if one fails
      }
    }
    
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
