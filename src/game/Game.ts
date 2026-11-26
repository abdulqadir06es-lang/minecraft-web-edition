import * as THREE from 'three';
import { BlockId, BLOCKS, DEFAULT_HOTBAR } from './blocks';
import { ChunkManager } from './chunks';
import { CharacterRig, animateRig, createCreeper, createPig, createSteve } from './characters';
import { createInputState, InputState } from './input';
import { findSpawn, isInWater, PhysicsBody, stepBody } from './physics';
import { SoundFX } from './audio';
import { createAtlasTexture } from './textures';
import {
  applySave,
  diffAgainstTerrain,
  generateTerrain,
  plantTrees,
  World,
  WorldSave,
  WORLD_HEIGHT,
  WORLD_SIZE,
} from './world';

/** The main game engine: scene, player, mobs, raycasting, day/night, clouds, loop. */

interface Mob {
  rig: CharacterRig;
  body: PhysicsBody;
  phase: number;
  walkTimer: number;
  direction: number;
  speed: number;
  airTimer: number;
}

const EYE_HEIGHT = 1.62;
const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const REACH = 6;
const GRAVITY_JUMP = 8.2;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 6.5;
const SNEAK_SPEED = 1.6;
const SWIM_SPEED = 3;
const DAY_LENGTH = 300; // seconds for a full cycle

export interface GameCallbacks {
  onFps?: (fps: number) => void;
  onTime?: (dayFactor: number) => void; // 0 = midnight, 1 = noon
  onTarget?: (blockName: string | null) => void;
  onDeath?: () => void;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: World;
  private chunks: ChunkManager;
  private input = createInputState();
  private sfx = new SoundFX();

  private body: PhysicsBody;
  private yaw = 0;
  private pitch = 0;
  private thirdPerson = false;
  private steve: CharacterRig;
  private mobs: Mob[] = [];
  private walkPhase = 0;
  private stepTimer = 0;
  private breakProgress = 0;
  private breakTarget: { x: number; y: number; z: number } | null = null;

  private sun: THREE.DirectionalLight;
  private ambient: THREE.HemisphereLight;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private clouds: THREE.Group;
  private timeOfDay = 0.3; // 0..1, 0.25 = noon
  private cloudTimer = 0;

  private highlight: THREE.LineSegments;
  private crackMesh: THREE.Mesh;
  private running = false;
  private lastTime = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private raf = 0;
  private seed: number;
  private callbacks: GameCallbacks;
  private disposed = false;

  // current selection shared with UI
  selectedSlot = 0;
  hotbar: BlockId[] = [...DEFAULT_HOTBAR];

  constructor(
    private canvas: HTMLCanvasElement,
    profileName: string,
    callbacks: GameCallbacks = {}
  ) {
    this.callbacks = callbacks;
    this.seed = 42;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 60, 160);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 400);

    // ---- lights ----
    this.ambient = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xfff4d6, 1.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const shadowCam = this.sun.shadow.camera;
    shadowCam.left = -70;
    shadowCam.right = 70;
    shadowCam.top = 70;
    shadowCam.bottom = -70;
    shadowCam.near = 10;
    shadowCam.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // ---- world ----
    this.world = generateTerrain(this.seed);
    plantTrees(this.world, this.seed + 1);
    this.chunks = new ChunkManager(this.world, this.createAtlas(), window.devicePixelRatio <= 1.5);
    this.chunks.buildAll();
    this.scene.add(this.chunks.object3D);

    // ---- sky bodies ----
    this.sunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xfff7c0, fog: false })
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(6, 6, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xd8dce8, fog: false })
    );
    this.scene.add(this.sunMesh, this.moonMesh);

    this.clouds = this.buildClouds();
    this.scene.add(this.clouds);

    // ---- player ----
    const spawn = findSpawn(this.world);
    this.body = {
      position: spawn.clone(),
      velocity: new THREE.Vector3(),
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      onGround: false,
    };
    this.steve = createSteve();
    this.steve.group.visible = false; // start in first person
    this.scene.add(this.steve.group);

    // ---- mobs ----
    this.spawnMobs();

    // ---- block highlight wireframe ----
    const wire = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.highlight = new THREE.LineSegments(wire, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    // ---- breaking crack overlay ----
    this.crackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.004, 1.004, 1.004),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, wireframe: false })
    );
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  private atlasCache: THREE.Texture | null = null;
  private createAtlas(): THREE.Texture {
    if (!this.atlasCache) this.atlasCache = createAtlasTexture();
    return this.atlasCache;
  }

  private buildClouds(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    // seeded scatter of flat blocky clouds high above
    let s = 1234;
    const rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
    for (let i = 0; i < 26; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 5);
      for (let p = 0; p < puffs; p++) {
        const w = 6 + rng() * 14;
        const d = 6 + rng() * 14;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), mat);
        mesh.position.set((rng() - 0.5) * 24, rng() * 2, (rng() - 0.5) * 24);
        cloud.add(mesh);
      }
      cloud.position.set(rng() * WORLD_SIZE * 1.6 - WORLD_SIZE * 0.3, 44 + rng() * 10, rng() * WORLD_SIZE * 1.6 - WORLD_SIZE * 0.3);
      group.add(cloud);
    }
    return group;
  }

  private spawnMobs(): void {
    const kinds = ['creeper', 'pig'];
    for (let i = 0; i < 8; i++) {
      const kind = kinds[i % 2];
      const rig = kind === 'creeper' ? createCreeper() : createPig();
      // spawn on the surface, away from the player a bit
      let x = 0;
      let z = 0;
      let y = -1;
      for (let tries = 0; tries < 40 && y < 1; tries++) {
        x = 10 + Math.floor(Math.random() * (WORLD_SIZE - 20));
        z = 10 + Math.floor(Math.random() * (WORLD_SIZE - 20));
        const sy = this.world.surfaceY(x, z);
        if (sy > 1) y = sy + 1;
      }
      if (y < 1) continue;
      rig.group.position.set(x + 0.5, y, z + 0.5);
      this.scene.add(rig.group);
      this.mobs.push({
        rig,
        body: {
          position: new THREE.Vector3(x + 0.5, y, z + 0.5),
          velocity: new THREE.Vector3(),
          width: 0.6,
          height: kind === 'creeper' ? 1.7 : 1.5,
          onGround: false,
        },
        phase: Math.random() * Math.PI * 2,
        walkTimer: Math.random() * 3,
        direction: Math.random() * Math.PI * 2,
        speed: kind === 'pig' ? 1.2 : 0.9,
        airTimer: 0,
      });
    }
  }

  get inputState(): InputState {
    return this.input;
  }

  get sound(): SoundFX {
    return this.sfx;
  }

  /** Rendering canvas, for input listeners. */
  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get playerBody(): PhysicsBody {
    return this.body;
  }

  get worldSeed(): number {
    return this.seed;
  }

  setThirdPerson(on: boolean): void {
    this.thirdPerson = on;
    this.steve.group.visible = on;
  }

  get isThirdPerson(): boolean {
    return this.thirdPerson;
  }

  // ---- world editing ----

  /** Raycast from camera through voxels (DDA). Returns hit block + face normal. */
  private raycast(): { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = new THREE.Vector3(this.body.position.x, this.body.position.y + EYE_HEIGHT * 0.95, this.body.position.z);

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dir.x || 1e-10));
    const tDeltaY = Math.abs(1 / (dir.y || 1e-10));
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-10));
    let tMaxX = ((dir.x > 0 ? x + 1 - origin.x : origin.x - x) || 1e-10) * tDeltaX;
    let tMaxY = ((dir.y > 0 ? y + 1 - origin.y : origin.y - y) || 1e-10) * tDeltaY;
    let tMaxZ = ((dir.z > 0 ? z + 1 - origin.z : origin.z - z) || 1e-10) * tDeltaZ;
    let nx = 0;
    let ny = 0;
    let nz = 0;

    for (let i = 0; i < 100; i++) {
      const id = this.world.get(x, y, z);
      if (id !== BlockId.Air && id !== BlockId.Water) {
        return { x, y, z, nx, ny, nz };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        if (tMaxX > REACH) break;
        x += stepX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else if (tMaxY < tMaxZ) {
        if (tMaxY > REACH) break;
        y += stepY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        if (tMaxZ > REACH) break;
        z += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
    return null;
  }

  breakBlock(hit: { x: number; y: number; z: number }): boolean {
    const id = this.world.get(hit.x, hit.y, hit.z);
    if (id === BlockId.Air) return false;
    const def = BLOCKS[id];
    if (!def.breakable) return false;
    this.world.set(hit.x, hit.y, hit.z, BlockId.Air);
    this.chunks.rebuildAt(hit.x, hit.z);
    this.sfx.break_();
    return true;
  }

  placeBlock(hit: { x: number; y: number; z: number; nx: number; ny: number; nz: number }): boolean {
    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;
    if (this.world.get(px, py, pz) !== BlockId.Air && this.world.get(px, py, pz) !== BlockId.Water) return false;
    // do not place inside the player
    const half = PLAYER_WIDTH / 2;
    const pMinX = this.body.position.x - half;
    const pMaxX = this.body.position.x + half;
    const pMinZ = this.body.position.z - half;
    const pMaxZ = this.body.position.z + half;
    const overlapsPlayer =
      px + 1 > pMinX &&
      px < pMaxX &&
      pz + 1 > pMinZ &&
      pz < pMaxZ &&
      py + 1 > this.body.position.y &&
      py < this.body.position.y + PLAYER_HEIGHT;
    if (overlapsPlayer) return false;

    const blockId = this.hotbar[this.selectedSlot];
    if (blockId === undefined || blockId === BlockId.Air) return false;
    this.world.set(px, py, pz, blockId);
    this.chunks.rebuildAt(px, pz);
    this.sfx.place();
    return true;
  }

  /** Instant break for touch button. */
  tryBreak(): boolean {
    const hit = this.raycast();
    if (!hit) return false;
    return this.breakBlock(hit);
  }

  tryPlace(): boolean {
    const hit = this.raycast();
    if (!hit) return false;
    return this.placeBlock(hit);
  }

  // ---- save / load ----

  exportSave(playerState?: { yaw: number; pitch: number }): string {
    const save: WorldSave = {
      magic: 'mc-web-edition-world',
      version: 1,
      seed: this.seed,
      size: { x: WORLD_SIZE, z: WORLD_SIZE, y: WORLD_HEIGHT },
      edits: diffAgainstTerrain(this.world, this.seed),
      player: {
        x: this.body.position.x,
        y: this.body.position.y,
        z: this.body.position.z,
        yaw: playerState?.yaw ?? this.yaw,
        pitch: playerState?.pitch ?? this.pitch,
      },
    };
    return JSON.stringify(save);
  }

  loadSave(json: string): boolean {
    try {
      const save = JSON.parse(json) as WorldSave;
      if (save.magic !== 'mc-web-edition-world' || save.version !== 1) return false;
      applySave(this.world, save);
      // rebuild all chunks
      this.chunks.buildAll();
      this.body.position.set(save.player.x, save.player.y, save.player.z);
      this.body.velocity.set(0, 0, 0);
      this.yaw = save.player.yaw;
      this.pitch = save.player.pitch;
      return true;
    } catch {
      return false;
    }
  }

  /** Respawns player at spawn point (also used after falling out / death). */
  respawn(): void {
    const spawn = findSpawn(this.world);
    this.body.position.copy(spawn);
    this.body.velocity.set(0, 0, 0);
  }

  // ---- main loop ----

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.running) return;

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.05);

    this.updatePlayer(dt);
    this.updateMobs(dt);
    this.updateDayNight(dt);
    this.updateClouds(dt);
    this.updateTargeting(dt);
    this.chunks.processDirty(2);

    // fps
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.callbacks.onFps?.(Math.round(this.fpsFrames / this.fpsAccum));
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updatePlayer(dt: number): void {
    const inp = this.input;
    const water = isInWater(this.body, this.world);

    // look
    this.yaw -= inp.lookDX;
    this.pitch -= inp.lookDY;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    inp.lookDX = 0;
    inp.lookDY = 0;

    // movement intent in world space, relative to camera yaw.
    // Forward (moveZ = +1) points where the camera looks: -Z in camera space,
    // so world forward = (-sin(yaw), 0, -cos(yaw)); right = (cos(yaw), 0, -sin(yaw)).
    const speed = inp.sprint ? SPRINT_SPEED : inp.sneak ? SNEAK_SPEED : WALK_SPEED;
    const moveSpeed = water ? SWIM_SPEED : speed;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wishX = inp.moveX * cos - inp.moveZ * sin;
    const wishZ = -inp.moveX * sin - inp.moveZ * cos;
    const len = Math.hypot(inp.moveX, inp.moveZ);
    const targetVX = len > 0.05 ? wishX * moveSpeed : 0;
    const targetVZ = len > 0.05 ? wishZ * moveSpeed : 0;

    // smooth acceleration
    const accel = this.body.onGround ? 14 : 6;
    this.body.velocity.x += (targetVX - this.body.velocity.x) * Math.min(1, accel * dt);
    this.body.velocity.z += (targetVZ - this.body.velocity.z) * Math.min(1, accel * dt);

    // jump / swim up
    if (inp.jump) {
      if (water) {
        this.body.velocity.y = Math.min(this.body.velocity.y + 30 * dt, 3.5);
      } else if (this.body.onGround) {
        this.body.velocity.y = GRAVITY_JUMP;
        this.body.onGround = false;
        this.sfx.jump();
      }
    }

    stepBody(this.body, this.world, dt, water);
    if (this.body.position.y < -12) {
      this.respawn(); // fell out of the world
    }

    // footsteps
    if (this.body.onGround && len > 0.3) {
      this.stepTimer += dt * (inp.sprint ? 2.2 : 1.6);
      if (this.stepTimer > 1) {
        this.stepTimer = 0;
        this.sfx.step();
      }
    }

    // walk animation
    const groundSpeed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
    const speed01 = Math.min(1, groundSpeed / WALK_SPEED);
    this.walkPhase += dt * groundSpeed * 2.4;

    // steve rig in third person
    this.steve.group.position.copy(this.body.position);
    this.steve.group.rotation.y = this.yaw + Math.PI; // model faces camera direction
    animateRig(this.steve, this.walkPhase, speed01, dt);
    this.steve.head.rotation.x = -this.pitch * 0.6;

    // camera placement
    const eyeY = this.body.position.y + EYE_HEIGHT - (inp.sneak ? 0.25 : 0);
    if (this.thirdPerson) {
      const dist = 5;
      const cx = this.body.position.x - Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
      const cz = this.body.position.z - Math.cos(this.yaw) * Math.cos(this.pitch) * dist;
      const cy = eyeY + Math.sin(this.pitch) * dist;
      this.camera.position.set(cx, cy, cz);
      this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, 'YXZ');
    } else {
      this.camera.position.set(this.body.position.x, eyeY, this.body.position.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }

    // day factor to UI
    this.callbacks.onTime?.(Math.max(0, Math.min(1, Math.sin(this.timeOfDay * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5)));
  }

  private updateMobs(dt: number): void {
    for (const mob of this.mobs) {
      mob.walkTimer -= dt;
      if (mob.walkTimer <= 0) {
        // pick new direction: wander, sometimes idle
        mob.walkTimer = 2 + Math.random() * 4;
        if (Math.random() < 0.3) {
          mob.speed = 0; // idle
        } else {
          mob.speed = mob.rig.group.children.length ? 1.1 + Math.random() * 0.7 : 1;
          mob.direction = Math.random() * Math.PI * 2;
        }
      }

      const moving = mob.speed > 0;
      const vx = moving ? Math.sin(mob.direction) * mob.speed : 0;
      const vz = moving ? Math.cos(mob.direction) * mob.speed : 0;
      mob.body.velocity.x = vx;
      mob.body.velocity.z = vz;

      // jump over 1-block obstacles when walking into them
      mob.airTimer -= dt;
      if (moving && mob.body.onGround && mob.airTimer <= 0) {
        // probe ahead
        const aheadX = mob.body.position.x + Math.sin(mob.direction) * 0.7;
        const aheadZ = mob.body.position.z + Math.cos(mob.direction) * 0.7;
        const feetY = Math.floor(mob.body.position.y + 0.1);
        const aheadBlocked = this.world.get(Math.floor(aheadX), feetY, Math.floor(aheadZ)) !== 0;
        const aboveFree = this.world.get(Math.floor(aheadX), feetY + 1, Math.floor(aheadZ)) === 0;
        if (aheadBlocked && aboveFree) {
          mob.body.velocity.y = 7.5;
          mob.airTimer = 0.6;
        }
      }

      stepBody(mob.body, this.world, dt, false);

      // gravity safety: if mob fell below world, teleport to surface
      if (mob.body.position.y < -5) {
        const sy = this.world.surfaceY(Math.floor(mob.body.position.x), Math.floor(mob.body.position.z));
        mob.body.position.y = sy > 0 ? sy + 1 : 30;
        mob.body.velocity.set(0, 0, 0);
      }

      mob.rig.group.position.copy(mob.body.position);
      if (moving) mob.rig.group.rotation.y = mob.direction;
      const sp01 = moving ? Math.min(1, mob.speed / 2) : 0;
      mob.phase += dt * mob.speed * 3;
      animateRig(mob.rig, mob.phase, sp01, dt);
      // gentle head bob for idle mobs
      if (!moving) mob.rig.head.position.y = (mob.rig.head.position.y ?? 0) * 0.98;
    }
  }

  private updateDayNight(dt: number): void {
    this.timeOfDay = (this.timeOfDay + dt / DAY_LENGTH) % 1;
    // sun angle: 0 = sunrise (east), 0.25 = noon, 0.5 = sunset, 0.75 = midnight
    const angle = this.timeOfDay * Math.PI * 2;
    const sunHeight = Math.sin(angle);
    const sunDist = 140;
    const sunX = Math.cos(angle) * sunDist;
    const sunY = sunHeight * sunDist;
    const sunZ = 40;

    this.sun.position.set(sunX + this.body.position.x, sunY + this.body.position.y, sunZ + this.body.position.z);
    this.sun.target.position.copy(this.body.position);
    this.sunMesh.position.set(
      this.camera.position.x + sunX * 1.6,
      this.camera.position.y + sunY * 1.6,
      this.camera.position.z + sunZ * 1.6
    );
    this.moonMesh.position.set(
      this.camera.position.x - sunX * 1.6,
      this.camera.position.y - sunY * 1.6,
      this.camera.position.z - sunZ * 1.6
    );

    const day = Math.max(0, sunHeight);
    const dusk = Math.max(0, 1 - Math.abs(sunHeight) * 4); // near horizon
    this.sun.intensity = day * 1.35;
    this.sun.color.setHSL(0.12, 0.5 * dusk, 0.55 + 0.4 * day);
    this.ambient.intensity = 0.25 + day * 0.55;
    const skyDay = new THREE.Color(0x87ceeb);
    const skyNight = new THREE.Color(0x0a0e28);
    const skyDusk = new THREE.Color(0xe8874a);
    const sky = skyNight.clone().lerp(skyDay, day).lerp(skyDusk, dusk * 0.55 * (1 - day * 0.4));
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color = sky;

    this.sunMesh.visible = sunHeight > -0.1;
    this.moonMesh.visible = sunHeight < 0.1;
  }

  private updateClouds(dt: number): void {
    this.cloudTimer += dt;
    // slow drift
    this.clouds.position.x = (this.cloudTimer * 0.4) % 128;
  }

  private updateTargeting(dt: number): void {
    const hit = this.raycast();
    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      const id = this.world.get(hit.x, hit.y, hit.z);
      this.callbacks.onTarget?.(BLOCKS[id]?.name ?? null);
    } else {
      this.highlight.visible = false;
      this.callbacks.onTarget?.(null);
    }

    // continuous hold-to-break (desktop LMB)
    if (this.input.breakHeld) {
      if (!hit) {
        this.breakProgress = 0;
        this.crackMesh.visible = false;
        return;
      }
      if (!this.breakTarget || this.breakTarget.x !== hit.x || this.breakTarget.y !== hit.y || this.breakTarget.z !== hit.z) {
        this.breakTarget = { x: hit.x, y: hit.y, z: hit.z };
        this.breakProgress = 0;
      }
      const id = this.world.get(hit.x, hit.y, hit.z);
      const def = BLOCKS[id];
      if (def && def.breakable) {
        this.breakProgress += dt * 1.4; // ~0.7s per block
        this.crackMesh.visible = true;
        this.crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        (this.crackMesh.material as THREE.MeshBasicMaterial).opacity = 0.1 + this.breakProgress * 0.35;
        if (Math.random() < dt * 8) this.sfx.dig();
        if (this.breakProgress >= 1) {
          this.breakBlock(hit);
          this.breakProgress = 0;
          this.crackMesh.visible = false;
        }
      } else {
        this.crackMesh.visible = false;
      }
    } else {
      this.breakProgress = 0;
      this.breakTarget = null;
      this.crackMesh.visible = false;
    }
  }

  /** Update UI-facing selected block (called by React when hotbar changes). */
  setSelectedSlot(slot: number): void {
    this.selectedSlot = slot;
  }

  /** Assigns a block id to a hotbar slot (creative inventory pick). */
  setHotbarSlot(slot: number, id: BlockId): void {
    if (slot >= 0 && slot < this.hotbar.length) this.hotbar[slot] = id;
  }
}
