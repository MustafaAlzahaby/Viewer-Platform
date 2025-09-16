import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { COLORS } from "../constants/colors";
import * as OBF from "@thatopen/components-front";

export class SceneManager {
  public components: OBC.Components;
  public world: OBC.World;
  public container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    if (!this.container) {
      throw new Error(`Container with id '${containerId}' not found`);
    }

    this.components = new OBC.Components();
    this.world = this.initializeWorld();
  }

  private initializeWorld(): OBC.World {
    const worlds = this.components.get(OBC.Worlds);
    const world = worlds.create<
      OBC.SimpleScene,
      OBC.SimpleCamera,
      OBC.SimpleRenderer
    >();

    world.scene = new OBC.SimpleScene(this.components);
    world.scene.setup();
    world.scene.three.background = new THREE.Color(COLORS.BACKGROUND);

    world.renderer = new OBC.SimpleRenderer(this.components, this.container);

    world.camera = new OBC.SimpleCamera(this.components);

    this.components.init();

    const grids = this.components.get(OBC.Grids);
    grids.create(world).three.position.setY(-10); //need to readjust

    //adding hover
    const hoverer = this.components.get(OBF.Hoverer);
    hoverer.world = world;
    hoverer.enabled = true;
    hoverer.material = new THREE.MeshBasicMaterial({
      color: 0x6528d7,
      transparent: true,
      opacity: 0.5,
      depthTest: false, 
    });

    return world;
  }
}
