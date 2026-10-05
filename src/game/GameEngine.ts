import * as THREE from 'three';
import { BotSurvivor, ChatMessage, DisasterType, GamePhase, PlayerStats, PlayerUpgrades, ShipDefinition, ShipId } from '../types/game';
import { SHIPS_DATA, BOT_PASSENGERS_LIST, IN_GAME_CHAT_LINES } from '../data/ships';
import { buildShipMesh, BuiltShipResult, InteractiveLifeboat } from './shipBuilder';
import { buildLobbyScene, BuiltLobbyResult } from './lobbyBuilder';
import { sound } from '../utils/soundEffects';
import { DEFAULT_UPGRADES, loadTokens, saveTokens } from '../utils/upgradesStorage';

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onDisasterProgress: (progress: number, stageTitle: string, pitch: number, roll: number) => void;
  onGameOver: (survived: boolean, stats: PlayerStats, shipName: string) => void;
  onPromptInteract: (text: string | null) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;

  // Three.js Core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId: number | null = null;
  private clock: THREE.Clock;

  // Game State
  private phase: GamePhase = 'voting';
  private activeShipDef: ShipDefinition = SHIPS_DATA['titanic'];
  private disasterProgress: number = 0; // 0 to 1
  private disasterStageTitle: string = 'Calm Voyage';
  private rescueTimer: number = 100; // seconds until rescue arrives
  private isSplitOccurred: boolean = false;
  private isImpactOccurred: boolean = false;

  // Player State & Physics
  private playerPos: THREE.Vector3 = new THREE.Vector3(0, 0.5, -8);
  private playerVel: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private playerRotY: number = 0;
  private cameraPitch: number = 0.2;
  private cameraDistance: number = 8;
  private isFirstPerson: boolean = false;
  private isGrounded: boolean = true;
  private isSwimming: boolean = false;
  private isGrabPressed: boolean = false;
  private grabAnchorLocalPos: THREE.Vector3 | null = null;
  private grabAnchorGroup: THREE.Group | null = null;
  private upgrades: PlayerUpgrades = { ...DEFAULT_UPGRADES };
  private playerMesh!: THREE.Group;
  private playerLifejacketMesh!: THREE.Mesh;
  private thumbstickVector: THREE.Vector2 = new THREE.Vector2(0, 0);
  private playerStats: PlayerStats = {
    health: 100,
    bodyTemp: 100,
    fahrenheitTemp: 98.6,
    isSubmerged: false,
    stamina: 100,
    oxygen: 100,
    hasLifejacket: false,
    inLifeboat: false,
    currentLifeboatId: null,
    flaresLeft: 2,
    flaresFired: 0,
    timeSurvived: 0,
    peakElevation: 0,
    isAlive: true,
    score: 0,
    tokens: 150,
    isGrabbing: false,
    grabStamina: 100,
    maxGrabStamina: 100,
  };

  // Input State
  private keys: Record<string, boolean> = {};
  private isDragging: boolean = false;
  private prevMouseX: number = 0;
  private prevMouseY: number = 0;

  // Scene Objects
  private lobbyData: BuiltLobbyResult | null = null;
  private shipData: BuiltShipResult | null = null;
  private oceanMesh!: THREE.Mesh;
  private skyDome!: THREE.Mesh;
  private sunOrMoonLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;

  // Bots Simulation
  private botSurvivors: BotSurvivor[] = [];
  private botMeshes: THREE.Group[] = [];

  // Active Flares Projectiles
  private activeFlares: {
    mesh: THREE.Mesh;
    light: THREE.PointLight;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    life: number;
  }[] = [];

  // Floating debris in water
  private floatingDebris: THREE.Mesh[] = [];

  constructor(container: HTMLElement, callbacks: GameEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.clock = new THREE.Clock();

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020617, 0.007);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(0, 5, 12);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    this.container.appendChild(this.renderer.domElement);

    // Build Sky & Ocean
    this.initSkyAndAtmosphere();
    this.initPlayerMesh();

    // Start in Lobby
    this.loadLobby();

    // Bind Event Listeners
    this.bindEvents();

    // Start Animation Loop
    this.startLoop();
  }

  private initSkyAndAtmosphere() {
    // Ambient Light
    this.ambientLight = new THREE.AmbientLight(0x1e293b, 1.2);
    this.scene.add(this.ambientLight);

    // Moonlight / Directional
    this.sunOrMoonLight = new THREE.DirectionalLight(0x93c5fd, 1.5);
    this.sunOrMoonLight.position.set(40, 80, -60);
    this.scene.add(this.sunOrMoonLight);

    // Starry Celestial Sky Dome
    const skyGeo = new THREE.SphereGeometry(450, 24, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      side: THREE.BackSide,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Star Particles
    const starCount = 600;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 420;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 10;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starGeo, starMat);
    this.scene.add(stars);

    // Ocean Waves Mesh
    const oceanGeo = new THREE.PlaneGeometry(600, 600, 64, 64);
    oceanGeo.rotateX(-Math.PI * 0.5);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x031838,
      roughness: 0.15,
      metalness: 0.85,
      flatShading: true,
    });
    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.position.y = 0;
    this.scene.add(this.oceanMesh);

    // Floating wooden deck chairs and rafts in the sea
    const raftMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    for (let i = 0; i < 18; i++) {
      const raft = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, 3.5), raftMat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 80;
      raft.position.set(Math.cos(angle) * dist, 0.2, Math.sin(angle) * dist);
      this.scene.add(raft);
      this.floatingDebris.push(raft);
    }
  }

  private initPlayerMesh() {
    this.playerMesh = new THREE.Group();
    this.playerMesh.name = 'player';

    // Body / Coat
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.6, 1.4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.2;
    this.playerMesh.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.38, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.15;
    this.playerMesh.add(head);

    // Captain / Passenger Cap
    const hatGeo = new THREE.CylinderGeometry(0.44, 0.42, 0.2, 10);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 2.45;
    this.playerMesh.add(hat);

    // Lifejacket (orange vest - hidden initially until collected)
    const ljGeo = new THREE.BoxGeometry(1.2, 1.2, 0.9);
    const ljMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });
    this.playerLifejacketMesh = new THREE.Mesh(ljGeo, ljMat);
    this.playerLifejacketMesh.position.y = 1.35;
    this.playerLifejacketMesh.visible = false;
    this.playerMesh.add(this.playerLifejacketMesh);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.0, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.25, 0.5, 0);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.25, 0.5, 0);
    this.playerMesh.add(legL);
    this.playerMesh.add(legR);

    this.scene.add(this.playerMesh);
  }

  public loadLobby() {
    this.phase = 'voting';
    this.callbacks.onPhaseChange('voting');

    // Clean previous ship if any
    if (this.shipData) {
      this.scene.remove(this.shipData.rootGroup);
      this.shipData = null;
    }

    // Build or ensure Lobby Scene
    if (!this.lobbyData) {
      this.lobbyData = buildLobbyScene();
      this.scene.add(this.lobbyData.group);
    } else {
      this.lobbyData.group.visible = true;
    }

    // Reset Player to Pier spawn
    this.playerPos.set(0, 0.5, -8);
    this.playerVel.set(0, 0, 0);
    this.playerRotY = 0;
    this.cameraDistance = 7;
    this.cameraPitch = 0.25;

    // Reset Player Stats
    const currentTokens = this.playerStats.tokens || loadTokens();
    this.playerStats = {
      health: 100,
      bodyTemp: 100,
      fahrenheitTemp: 98.6,
      isSubmerged: false,
      stamina: 100,
      oxygen: 100,
      hasLifejacket: false,
      inLifeboat: false,
      currentLifeboatId: null,
      flaresLeft: 2 + this.upgrades.extraFlares,
      flaresFired: 0,
      timeSurvived: 0,
      peakElevation: 0,
      isAlive: true,
      score: 0,
      tokens: currentTokens,
      isGrabbing: false,
      grabStamina: 100,
      maxGrabStamina: 100,
    };
    this.playerLifejacketMesh.visible = false;
    this.callbacks.onStatsUpdate(this.playerStats);

    // Spawn Passenger Bots on Pier
    this.initBotsForLobby();
  }

  private initBotsForLobby() {
    // Clear old bot meshes
    this.botMeshes.forEach((m) => this.scene.remove(m));
    this.botMeshes = [];
    this.botSurvivors = [];

    const botMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8 });

    BOT_PASSENGERS_LIST.slice(0, 10).forEach((name, idx) => {
      const botGroup = new THREE.Group();

      const bMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.4, 6), botMat);
      bMesh.position.y = 1.1;
      botGroup.add(bMesh);

      const hMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), headMat);
      hMesh.position.y = 2.0;
      botGroup.add(hMesh);

      // Random position on pier
      const bx = (Math.random() - 0.5) * 28;
      const bz = (Math.random() - 0.5) * 40;
      botGroup.position.set(bx, 0.5, bz);

      this.scene.add(botGroup);
      this.botMeshes.push(botGroup);

      this.botSurvivors.push({
        id: `bot_${idx}`,
        name,
        meshIndex: idx,
        isAlive: true,
        inLifeboat: false,
        position: { x: bx, y: 0.5, z: bz },
        targetDeck: 'mid',
        panicLevel: 0,
      });
    });
  }

  public launchShipVoyage(shipId: ShipId) {
    const shipDef = SHIPS_DATA[shipId] || SHIPS_DATA['titanic'];
    this.activeShipDef = shipDef;
    this.phase = 'transition';
    this.callbacks.onPhaseChange('transition');

    sound.playFoghorn();

    // Hide Lobby
    if (this.lobbyData) {
      this.lobbyData.group.visible = false;
    }

    // Clean previous ship
    if (this.shipData) {
      this.scene.remove(this.shipData.rootGroup);
      this.shipData = null;
    }

    // Build Chosen Ship
    this.shipData = buildShipMesh(shipDef);
    this.scene.add(this.shipData.rootGroup);

    // Reset Disaster Progress
    this.disasterProgress = 0;
    this.disasterStageTitle = 'Voyage Underway';
    this.rescueTimer = shipDef.sinkingDurationSeconds;
    this.isSplitOccurred = false;
    this.isImpactOccurred = false;
    this.playerStats.flaresLeft = 2 + this.upgrades.extraFlares;
    this.playerStats.grabStamina = 100;
    this.playerStats.isGrabbing = false;
    this.isGrabPressed = false;
    this.callbacks.onStatsUpdate(this.playerStats);

    // Teleport Player to Ship Promenade / Boat Deck Forward
    const deckY = 18.5;
    this.playerPos.set(0, deckY, 10);
    this.playerVel.set(0, 0, 0);
    this.playerRotY = 0;
    this.cameraDistance = 8;
    this.cameraPitch = 0.2;

    // Teleport Passenger Bots to Ship Decks
    this.teleportBotsToShip();

    // Start Sinking Phase after 2.5s transition
    setTimeout(() => {
      this.phase = 'sinking';
      this.callbacks.onPhaseChange('sinking');
      this.callbacks.onChatMessage({
        id: String(Date.now()),
        sender: 'Officer on Watch',
        text: `All passengers aboard ${shipDef.name}! Current course through high seas.`,
        isSystem: true,
        timestamp: '00:00',
      });
    }, 2500);
  }

  private teleportBotsToShip() {
    this.botSurvivors.forEach((bot, idx) => {
      const mesh = this.botMeshes[idx];
      if (!mesh) return;

      const randomDeckX = (Math.random() - 0.5) * 16;
      const randomDeckZ = (Math.random() - 0.5) * 100;
      const startY = 18.5;

      mesh.position.set(randomDeckX, startY, randomDeckZ);
      bot.position = { x: randomDeckX, y: startY, z: randomDeckZ };
      bot.isAlive = true;
      bot.inLifeboat = false;
      bot.panicLevel = 0;
      mesh.visible = true;
    });
  }

  // User input handlers
  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Toggle First / Third person camera with V
      if (e.code === 'KeyV') {
        this.isFirstPerson = !this.isFirstPerson;
      }

      // Interact with E
      if (e.code === 'KeyE') {
        this.handleInteract();
      }

      // Fire Flare with F
      if (e.code === 'KeyF') {
        this.fireFlare();
      }

      // Grab onto ship with G or Shift
      if (e.code === 'KeyG') {
        this.setGrab(true);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      if (e.code === 'KeyG') {
        this.setGrab(false);
      }
    });

    const dom = this.container;

    dom.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    dom.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMouseX;
      const dy = e.clientY - this.prevMouseY;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;

      this.playerRotY -= dx * 0.005;
      this.cameraPitch = Math.max(-0.4, Math.min(1.1, this.cameraPitch + dy * 0.005));
    });

    dom.addEventListener('wheel', (e) => {
      this.cameraDistance = Math.max(3, Math.min(18, this.cameraDistance + e.deltaY * 0.01));
    });

    // Multi-touch support for tablet/mobile drag look
    let cameraTouchId: number | null = null;
    let cameraTouchStartX = 0;
    let cameraTouchStartY = 0;

    dom.addEventListener('touchstart', (e) => {
      // Find a touch that is in the camera look zone (right 54% of screen)
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX >= window.innerWidth * 0.46) {
          if (cameraTouchId === null) {
            cameraTouchId = t.identifier;
            cameraTouchStartX = t.clientX;
            cameraTouchStartY = t.clientY;
            break;
          }
        }
      }
    }, { passive: true });

    dom.addEventListener('touchmove', (e) => {
      if (cameraTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === cameraTouchId) {
          const dx = t.clientX - cameraTouchStartX;
          const dy = t.clientY - cameraTouchStartY;
          cameraTouchStartX = t.clientX;
          cameraTouchStartY = t.clientY;

          this.playerRotY -= dx * 0.006;
          this.cameraPitch = Math.max(-0.4, Math.min(1.1, this.cameraPitch + dy * 0.006));
          break;
        }
      }
    }, { passive: true });

    const handleCameraTouchEnd = (e: TouchEvent) => {
      if (cameraTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === cameraTouchId) {
          cameraTouchId = null;
          break;
        }
      }
    };

    dom.addEventListener('touchend', handleCameraTouchEnd, { passive: true });
    dom.addEventListener('touchcancel', handleCameraTouchEnd, { passive: true });

    window.addEventListener('resize', this.onResize.bind(this));
  }

  public setVirtualMovement(moveX: number, moveY: number) {
    // For mobile analog thumbstick
    this.thumbstickVector.set(moveX, moveY);
    this.keys['KeyD'] = moveX > 0.3;
    this.keys['KeyA'] = moveX < -0.3;
    this.keys['KeyW'] = moveY > 0.3;
    this.keys['KeyS'] = moveY < -0.3;
  }

  public virtualJump() {
    this.keys['Space'] = true;
    setTimeout(() => {
      this.keys['Space'] = false;
    }, 150);
  }

  public virtualInteract() {
    this.handleInteract();
  }

  public virtualFlare() {
    this.fireFlare();
  }

  public toggleCamera() {
    this.isFirstPerson = !this.isFirstPerson;
  }

  public setUpgrades(upgrades: PlayerUpgrades) {
    this.upgrades = { ...upgrades };
  }

  public setGrab(isDown: boolean) {
    if (this.phase !== 'sinking' || this.playerStats.inLifeboat || !this.playerStats.isAlive) {
      this.isGrabPressed = false;
      this.playerStats.isGrabbing = false;
      this.grabAnchorLocalPos = null;
      this.grabAnchorGroup = null;
      return;
    }

    if (isDown && !this.isGrabPressed) {
      if (this.playerStats.grabStamina > 8) {
        this.isGrabPressed = true;
        this.playerStats.isGrabbing = true;
        sound.playGrab();

        // Lock anchor to the ship structure (stern group if Titanic split, else root group)
        if (this.shipData) {
          const targetGroup = (this.activeShipDef.hasSplitting && this.isSplitOccurred && this.playerPos.z < 15)
            ? this.shipData.sternGroup
            : this.shipData.rootGroup;
          this.grabAnchorGroup = targetGroup;
          this.grabAnchorLocalPos = targetGroup.worldToLocal(this.playerPos.clone());
        }
      }
    } else if (!isDown && this.isGrabPressed) {
      this.isGrabPressed = false;
      this.playerStats.isGrabbing = false;
      this.grabAnchorLocalPos = null;
      this.grabAnchorGroup = null;
    }
    this.callbacks.onStatsUpdate(this.playerStats);
  }

  public addTokens(amount: number) {
    this.playerStats.tokens += amount;
    saveTokens(this.playerStats.tokens);
    this.callbacks.onStatsUpdate(this.playerStats);
  }

  private onResize() {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // Interactive Triggers (Lifeboats, Lifejackets, Flares)
  private handleInteract() {
    if (this.phase === 'voting' && this.lobbyData) {
      // In lobby: check distance to voting terminal
      const distToBooth = this.playerPos.distanceTo(this.lobbyData.votingBoothPos);
      if (distToBooth < 5) {
        sound.playClick();
        return;
      }
    }

    if (this.phase !== 'sinking' || !this.shipData) return;

    // If already in lifeboat, pressing E steps out / disembarks
    if (this.playerStats.inLifeboat) {
      this.playerStats.inLifeboat = false;
      this.playerStats.currentLifeboatId = null;
      this.playerPos.x += 1.8;
      this.playerPos.y += 0.8;
      sound.playSplash();
      this.callbacks.onChatMessage({
        id: String(Date.now()),
        sender: 'Survivor',
        text: 'Disembarked from lifeboat!',
        timestamp: 'NOW',
      });
      this.callbacks.onStatsUpdate(this.playerStats);
      return;
    }

    // Check Lifeboats (Bow lifeboats & Promenade lifeboats)
    for (const boat of this.shipData.lifeboats) {
      const boatWorldPos = boat.group.getWorldPosition(new THREE.Vector3());
      const dist = this.playerPos.distanceTo(boatWorldPos);
      if (dist < 5.0) {
        sound.playSplash();

        // Detach from ship into world scene coordinates so it drives and steers independently
        if (boat.group.parent !== this.scene) {
          const worldPos = boat.group.getWorldPosition(new THREE.Vector3());
          const worldQuat = boat.group.getWorldQuaternion(new THREE.Quaternion());
          this.scene.attach(boat.group);
          boat.group.position.copy(worldPos);
          boat.group.quaternion.copy(worldQuat);
        }

        boat.isDeployed = true;
        boat.isOccupied = true;
        this.playerStats.inLifeboat = true;
        this.playerStats.currentLifeboatId = boat.id;
        this.playerStats.score += 250;
        this.callbacks.onStatsUpdate(this.playerStats);
        const boatDisplayName = boat.id.includes('bow') ? 'Bow Lifeboat' : `Lifeboat ${boat.id.replace('boat_', '')}`;
        this.callbacks.onChatMessage({
          id: String(Date.now()),
          sender: 'Survivor',
          text: `Boarded rideable ${boatDisplayName}! Steer with joystick/WASD!`,
          timestamp: 'NOW',
        });
        return;
      }
    }

    // Check Items (Lifejackets, Flares)
    for (const item of this.shipData.items) {
      if (item.collected) continue;
      const itemWorldPos = item.group.getWorldPosition(new THREE.Vector3());
      const dist = this.playerPos.distanceTo(itemWorldPos);
      if (dist < 4.0) {
        item.collected = true;
        item.group.visible = false;
        sound.playClick();

        if (item.type === 'lifejacket') {
          this.playerStats.hasLifejacket = true;
          this.playerLifejacketMesh.visible = true;
          this.playerStats.score += 150;
          this.callbacks.onChatMessage({
            id: String(Date.now()),
            sender: 'Ship Officer',
            text: 'Lifejacket equipped! Hypothermia resistance greatly increased.',
            isSystem: true,
            timestamp: 'NOW',
          });
        } else if (item.type === 'flares') {
          this.playerStats.flaresLeft += 3;
          this.playerStats.score += 100;
          this.callbacks.onChatMessage({
            id: String(Date.now()),
            sender: 'Ship Officer',
            text: 'Signal Flare Gun collected! Press [F] to fire distress flares.',
            isSystem: true,
            timestamp: 'NOW',
          });
        }
        this.callbacks.onStatsUpdate(this.playerStats);
        return;
      }
    }

    // Check Interactive Doors (Bow, Stern, Rooftop, Promenade)
    if (this.shipData.doors) {
      for (const door of this.shipData.doors) {
        const doorWorldPos = door.group.getWorldPosition(new THREE.Vector3());
        const dist = this.playerPos.distanceTo(doorWorldPos);
        if (dist < 4.2) {
          sound.playDoor();

          const targetParent = door.targetGroup === 'stern' ? this.shipData.sternGroup : this.shipData.bowGroup;
          const worldTargetPos = targetParent.localToWorld(door.targetLocalPos.clone());

          this.playerPos.copy(worldTargetPos);
          this.playerVel.set(0, 0, 0);

          // Clear active grab when going through a door
          this.playerStats.isGrabbing = false;
          this.isGrabPressed = false;
          this.grabAnchorLocalPos = null;
          this.grabAnchorGroup = null;

          this.callbacks.onChatMessage({
            id: String(Date.now()),
            sender: 'Ship Access',
            text: `Traversed through ${door.name}! Now at the ${door.targetDestination.toUpperCase()}.`,
            timestamp: 'NOW',
          });
          this.callbacks.onStatsUpdate(this.playerStats);
          return;
        }
      }
    }
  }

  public fireFlare() {
    if (this.playerStats.flaresLeft <= 0 || !this.playerStats.isAlive) return;
    this.playerStats.flaresLeft--;
    this.playerStats.flaresFired++;
    this.playerStats.score += 150;

    // Accelerated rescue arrival
    this.rescueTimer = Math.max(5, this.rescueTimer - 12);
    sound.playFlare();

    // Create 3D Flare Rocket
    const flareMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    const flareLight = new THREE.PointLight(0xff3333, 4, 60);
    flareMesh.add(flareLight);

    const spawnPos = this.playerPos.clone().add(new THREE.Vector3(0, 2, 0));
    flareMesh.position.copy(spawnPos);
    this.scene.add(flareMesh);

    this.activeFlares.push({
      mesh: flareMesh,
      light: flareLight,
      pos: spawnPos,
      vel: new THREE.Vector3((Math.random() - 0.5) * 4, 28, (Math.random() - 0.5) * 4),
      life: 0,
    });

    this.callbacks.onStatsUpdate(this.playerStats);
    this.callbacks.onChatMessage({
      id: String(Date.now()),
      sender: 'Distress Signal',
      text: 'RED DISTRESS ROCKET FIRED! Rescue ship alerted, arrival accelerated!',
      isSos: true,
      timestamp: 'SOS',
    });
  }

  // Animation Loop
  private startLoop() {
    const loop = () => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.update(dt);
      this.render();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    window.removeEventListener('resize', this.onResize);
  }

  private update(dt: number) {
    const time = this.clock.getElapsedTime();

    // 1. Update Ocean Waves
    this.updateOceanWaves(time);

    // 2. Phase-specific updates
    if (this.phase === 'voting') {
      this.updateLobbyPhysics(dt);
      this.updateBotsLobby(dt, time);
    } else if (this.phase === 'sinking') {
      this.updateSinkingDisaster(dt, time);
      this.updatePlayerShipPhysics(dt, time);
      this.updateBotsSinking(dt, time);
      this.updateLifeboats(dt, time);
      this.updateFlares(dt);
      this.checkInteractionPrompts();
    }

    // 3. Update Camera Tracking
    this.updateCamera();
  }

  private updateOceanWaves(time: number) {
    const posAttr = this.oceanMesh.geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const u = posAttr.getX(i);
      const v = posAttr.getZ(i);
      const wave = Math.sin(u * 0.05 + time * 1.8) * 0.8 + Math.cos(v * 0.04 + time * 1.2) * 0.6;
      posAttr.setY(i, wave);
    }
    posAttr.needsUpdate = true;
  }

  // Lobby Movement Physics
  private updateLobbyPhysics(dt: number) {
    const speed = this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 12 : 7;
    const moveDir = new THREE.Vector3();

    if (this.keys['KeyW']) moveDir.z += 1;
    if (this.keys['KeyS']) moveDir.z -= 1;
    if (this.keys['KeyA']) moveDir.x += 1;
    if (this.keys['KeyD']) moveDir.x -= 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotY);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotY);

      this.playerPos.addScaledVector(forward, moveDir.z * speed * dt);
      this.playerPos.addScaledVector(right, moveDir.x * speed * dt);
    }

    // Jump
    if (this.keys['Space'] && this.isGrounded) {
      this.playerVel.y = 8;
      this.isGrounded = false;
    }

    // Gravity
    this.playerVel.y -= 22 * dt;
    this.playerPos.y += this.playerVel.y * dt;

    // Pier floor collision
    if (this.playerPos.y <= 0.5) {
      this.playerPos.y = 0.5;
      this.playerVel.y = 0;
      this.isGrounded = true;
    }

    // Pier bounds
    if (this.lobbyData) {
      const b = this.lobbyData.bounds;
      this.playerPos.x = Math.max(b.minX, Math.min(b.maxX, this.playerPos.x));
      this.playerPos.z = Math.max(b.minZ, Math.min(b.maxZ, this.playerPos.z));
    }

    this.playerMesh.position.copy(this.playerPos);
    this.playerMesh.rotation.y = this.playerRotY + Math.PI;

    // Check interaction prompt for voting booth
    if (this.lobbyData) {
      const dist = this.playerPos.distanceTo(this.lobbyData.votingBoothPos);
      if (dist < 4.5) {
        this.callbacks.onPromptInteract('Departure Terminal Ballot: Vote in the overlay menu!');
      } else {
        this.callbacks.onPromptInteract(null);
      }
    }
  }

  // Sinking Disaster Simulation & Timeline
  private updateSinkingDisaster(dt: number, time: number) {
    if (!this.shipData) return;

    // Progress advances based on duration
    const totalDuration = this.activeShipDef.sinkingDurationSeconds;
    this.disasterProgress = Math.min(1.0, this.disasterProgress + dt / totalDuration);
    this.rescueTimer = Math.max(0, this.rescueTimer - dt);

    // Compute Ship Pitch & Roll
    const maxPitch = (this.activeShipDef.maxPitch * Math.PI) / 180;
    const maxRoll = (this.activeShipDef.maxRoll * Math.PI) / 180;

    let currentPitch = this.disasterProgress * maxPitch;
    let currentRoll = Math.sin(this.disasterProgress * Math.PI * 0.7) * maxRoll;

    // Stage milestones & sound triggers
    if (this.disasterProgress > 0.08 && !this.isImpactOccurred) {
      this.isImpactOccurred = true;
      sound.playImpactCrash();
      sound.playShipBell();
      this.disasterStageTitle = 'IMPACT! Watertight Breaches';

      this.callbacks.onChatMessage({
        id: String(Date.now()),
        sender: 'Bridge Alarm',
        text: `CRITICAL IMPACT! Breaches reported. ${this.activeShipDef.disasterTitle}!`,
        isSos: true,
        timestamp: 'SOS',
      });
    }

    if (this.disasterProgress > 0.35 && this.disasterProgress <= 0.6) {
      this.disasterStageTitle = 'Decks Flooding · List Increasing';
      if (Math.random() < 0.015) {
        sound.playMetalCreak();
      }
    }

    // Signature TITANIC HULL SPLIT MECHANIC
    if (this.activeShipDef.hasSplitting) {
      if (this.disasterProgress >= 0.62 && !this.isSplitOccurred) {
        this.isSplitOccurred = true;
        sound.playShipSplit();
        this.disasterStageTitle = 'STRUCTURAL FAILURE: HULL SPLITTING!';

        // Blackout / Flicker lights
        this.shipData.lights.forEach((l) => {
          l.color.setHex(0xdc2626); // Emergency eerie red
          l.intensity = 0.4;
        });

        this.callbacks.onChatMessage({
          id: String(Date.now()),
          sender: 'Structural Alert',
          text: 'THE KEEL IS BENDING! THE HULL HAS BROKEN IN TWO!',
          isSos: true,
          timestamp: 'SOS',
        });
      }

      if (this.isSplitOccurred) {
        // Split physics: Bow plunges rapidly forward and down
        const splitProgress = (this.disasterProgress - 0.62) / 0.38;
        const bowPitch = currentPitch + splitProgress * 0.45;
        this.shipData.bowGroup.rotation.x = -bowPitch;
        this.shipData.bowGroup.position.y = -splitProgress * 28;
        this.shipData.bowGroup.position.z = splitProgress * 14;

        // Stern levels out momentarily, then rises 85° straight into the sky!
        const sternVerticalAngle = Math.min(1.48, 0.2 + splitProgress * 1.5);
        this.shipData.sternGroup.rotation.x = -sternVerticalAngle;
        this.shipData.sternGroup.position.y = Math.sin(splitProgress * Math.PI) * 4 - splitProgress * 12;
      } else {
        this.shipData.rootGroup.rotation.x = -currentPitch;
        this.shipData.rootGroup.rotation.z = currentRoll;
        this.shipData.rootGroup.position.y = -this.disasterProgress * 18;
      }
    } else {
      // Non-splitting ships (Lusitania, SS Atlantic, Cruise, Britannic)
      this.shipData.rootGroup.rotation.x = -currentPitch;
      this.shipData.rootGroup.rotation.z = currentRoll;
      this.shipData.rootGroup.position.y = -this.disasterProgress * 22;

      // Britannic spinning propellers
      if (this.shipData.propellers && this.activeShipDef.id === 'britannic') {
        this.shipData.propellers.forEach((p) => {
          p.rotation.z += 8 * dt;
        });
      }
    }

    // Check Win/Rescue or Loss conditions
    const pitchDeg = Math.round((currentPitch * 180) / Math.PI);
    const rollDeg = Math.round((currentRoll * 180) / Math.PI);
    this.callbacks.onDisasterProgress(this.disasterProgress, this.disasterStageTitle, pitchDeg, rollDeg);

    // If Rescue arrives
    if (this.rescueTimer <= 0 && this.playerStats.isAlive) {
      sound.playRescueArrived();
      this.addTokens(150);
      this.phase = 'gameover';
      this.callbacks.onGameOver(true, this.playerStats, this.activeShipDef.name);
    }

    // If ship completely submerged (progress >= 0.99)
    if (this.disasterProgress >= 0.99 && this.phase === 'sinking') {
      const survived = (this.playerStats.inLifeboat || (this.playerStats.hasLifejacket && this.playerStats.health > 20)) && this.playerStats.isAlive;
      if (survived) {
        sound.playRescueArrived();
        this.addTokens(150);
      } else {
        this.playerStats.isAlive = false;
        this.addTokens(Math.round(this.playerStats.timeSurvived * 0.5));
      }
      this.phase = 'gameover';
      this.callbacks.onGameOver(survived, this.playerStats, this.activeShipDef.name);
    }
  }

  // Player movement on tilting ship & swimming physics
  private updatePlayerShipPhysics(dt: number, time: number) {
    if (!this.playerStats.isAlive) return;

    this.playerStats.timeSurvived += dt;
    this.playerStats.peakElevation = Math.max(this.playerStats.peakElevation, this.playerPos.y);

    // If currently inside a lifeboat: RIDEABLE LIFEBOATS!
    if (this.playerStats.inLifeboat && this.shipData) {
      const boat = this.shipData.lifeboats.find((b) => b.id === this.playerStats.currentLifeboatId);
      if (boat) {
        // Ensure the lifeboat is detached from the ship and in world scene space so it drives independently
        if (boat.group.parent !== this.scene) {
          const worldPos = boat.group.getWorldPosition(new THREE.Vector3());
          const worldQuat = boat.group.getWorldQuaternion(new THREE.Quaternion());
          this.scene.attach(boat.group);
          boat.group.position.copy(worldPos);
          boat.group.quaternion.copy(worldQuat);
          boat.isDeployed = true;
          boat.isOccupied = true;
        }

        // Steer & Drive input from analog tablet thumbstick or WASD keyboard
        let inputFwd = 0;
        let inputTurn = 0;
        if (this.keys['KeyW']) inputFwd += 1;
        if (this.keys['KeyS']) inputFwd -= 0.6;
        if (this.keys['KeyA']) inputTurn += 1;
        if (this.keys['KeyD']) inputTurn -= 1;

        if (this.thumbstickVector.lengthSq() > 0.01) {
          inputTurn -= this.thumbstickVector.x;
          inputFwd += this.thumbstickVector.y;
        }

        // Turn lifeboat
        boat.group.rotation.y += inputTurn * 2.2 * dt;

        // Drive lifeboat forward / backward along its heading
        const fwdHeading = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.group.rotation.y);
        const boatSpeed = 9.5; // knots/speed
        boat.group.position.addScaledVector(fwdHeading, inputFwd * boatSpeed * dt);

        // Ocean wave bobbing & buoyancy for the lifeboat
        const boatWaterY = Math.sin(boat.group.position.x * 0.05 + time * 1.8) * 0.8;
        boat.group.position.y = boatWaterY + 0.35;
        boat.group.rotation.x = Math.sin(time * 2.2 + boat.group.position.z * 0.1) * 0.10;
        boat.group.rotation.z = Math.cos(time * 1.8 + boat.group.position.x * 0.1) * 0.07;

        // Seat the player inside the lifeboat
        this.playerPos.copy(boat.group.position).add(new THREE.Vector3(0, 0.45, 0));
        this.playerMesh.position.copy(this.playerPos);
        this.playerMesh.rotation.y = boat.group.rotation.y + Math.PI;

        this.isSwimming = false;
        this.isGrounded = true;
        this.playerVel.set(0, 0, 0);

        // Lifeboat provides warmth and safety from cold
        this.playerStats.bodyTemp = Math.min(100, this.playerStats.bodyTemp + 3.5 * dt);
        this.playerStats.fahrenheitTemp = 28 + (this.playerStats.bodyTemp / 100) * (98.6 - 28);

        this.callbacks.onPromptInteract('Riding Lifeboat: Steer with Joystick / WASD · Press [E] to Disembark');
        this.callbacks.onStatsUpdate(this.playerStats);
        return;
      }
    }

    // Water level at player's current X, Z position
    const waterY = Math.sin(this.playerPos.x * 0.05 + time * 1.8) * 0.8;
    const isSubmerged = this.playerPos.y < waterY;

    if (isSubmerged) {
      // Swimming in freezing ocean water
      this.isSwimming = true;
      this.isGrounded = false;

      // Detect initial plunge into freezing sea water
      if (!this.playerStats.isSubmerged) {
        this.playerStats.isSubmerged = true;
        sound.playSplash();
        sound.playColdGasp();
        this.callbacks.onChatMessage({
          id: String(Date.now()),
          sender: 'Cold Shock',
          text: 'Plunged into freezing 28°F North Atlantic sea!',
          isSos: true,
          timestamp: 'NOW',
        });
      }

      // Buoyancy float upward
      const buoyancy = this.playerStats.hasLifejacket ? 7.5 : 4.0;
      this.playerVel.y += (waterY - this.playerPos.y) * buoyancy * dt;
      this.playerVel.y *= 0.88; // water drag
      this.playerVel.x *= 0.85;
      this.playerVel.z *= 0.85;

      // Freezing North Atlantic water hypothermia drain (slowed by thermalCoat upgrade)
      const baseDrain = this.playerStats.hasLifejacket ? 1.6 : 4.0; // percent per second
      const thermalResistance = Math.max(0.35, 1 - this.upgrades.thermalCoat * 0.22);
      const drainRate = baseDrain * thermalResistance;
      this.playerStats.bodyTemp = Math.max(0, this.playerStats.bodyTemp - drainRate * dt);

      // Convert bodyTemp (0-100) to actual Fahrenheit (28°F to 98.6°F)
      this.playerStats.fahrenheitTemp = 28 + (this.playerStats.bodyTemp / 100) * (98.6 - 28);

      // Chattering teeth / shivering audio cue
      if (Math.random() < 0.05) {
        sound.playShiver();
      }

      // Swimming speed (boosted by flipperBoots upgrade)
      const swimSpeed = 4.5 * (1 + this.upgrades.flipperBoots * 0.25);
      const moveDir = new THREE.Vector3();

      let inputFwd = 0;
      let inputSide = 0;
      if (this.keys['KeyW']) inputFwd += 1;
      if (this.keys['KeyS']) inputFwd -= 1;
      if (this.keys['KeyA']) inputSide += 1;
      if (this.keys['KeyD']) inputSide -= 1;

      // Analog thumbstick integration
      if (this.thumbstickVector.lengthSq() > 0.01) {
        inputSide -= this.thumbstickVector.x;
        inputFwd += this.thumbstickVector.y;
      }

      moveDir.z = inputFwd;
      moveDir.x = inputSide;

      if (moveDir.lengthSq() > 0.01) {
        moveDir.normalize();
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotY);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotY);
        this.playerPos.addScaledVector(forward, moveDir.z * swimSpeed * dt);
        this.playerPos.addScaledVector(right, moveDir.x * swimSpeed * dt);
      }

      // Check floating debris to climb onto
      for (const raft of this.floatingDebris) {
        if (this.playerPos.distanceTo(raft.position) < 2.2) {
          this.playerPos.y = waterY + 0.8;
          this.playerVel.y = 0;
          this.isSwimming = false;
          this.playerStats.isSubmerged = false;
          this.playerStats.bodyTemp = Math.min(100, this.playerStats.bodyTemp + 0.8 * dt);
          break;
        }
      }

    } else {
      // On dry deck or in air
      this.isSwimming = false;

      // Recover temperature when out of freezing water
      if (this.playerStats.isSubmerged) {
        this.playerStats.isSubmerged = false;
      }
      this.playerStats.bodyTemp = Math.min(100, this.playerStats.bodyTemp + 3.0 * dt);
      this.playerStats.fahrenheitTemp = 28 + (this.playerStats.bodyTemp / 100) * (98.6 - 28);

      // Handle Grab Mechanics
      if (this.playerStats.isGrabbing) {
        // Drain grab stamina based on gripStrength upgrade (5.5s to 14s hold)
        const drain = Math.max(7, 18 - this.upgrades.gripStrength * 3.5);
        this.playerStats.grabStamina = Math.max(0, this.playerStats.grabStamina - drain * dt);

        // Physically anchor the player to the ship's 3D local coordinate frame!
        if (this.grabAnchorLocalPos && this.grabAnchorGroup) {
          const anchoredWorldPos = this.grabAnchorGroup.localToWorld(this.grabAnchorLocalPos.clone());
          this.playerPos.copy(anchoredWorldPos);
          this.playerVel.set(0, 0, 0);
          this.isGrounded = true;
        }

        if (this.playerStats.grabStamina <= 0) {
          this.playerStats.isGrabbing = false;
          this.isGrabPressed = false;
          this.grabAnchorLocalPos = null;
          this.grabAnchorGroup = null;
          sound.playGripSlip();
          this.callbacks.onChatMessage({
            id: String(Date.now()),
            sender: 'Survivor',
            text: 'My hands slipped! Lost my grip on the railing!',
            timestamp: 'NOW',
          });
        }
      } else {
        // Regenerate grab stamina when grounded
        if (this.isGrounded) {
          this.playerStats.grabStamina = Math.min(100, this.playerStats.grabStamina + 22 * dt);
        }

        const runSpeed = this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 13 : 7.5;
        const moveDir = new THREE.Vector3();

        let inputFwd = 0;
        let inputSide = 0;
        if (this.keys['KeyW']) inputFwd += 1;
        if (this.keys['KeyS']) inputFwd -= 1;
        if (this.keys['KeyA']) inputSide += 1;
        if (this.keys['KeyD']) inputSide -= 1;

        // Analog thumbstick integration
        if (this.thumbstickVector.lengthSq() > 0.01) {
          inputSide -= this.thumbstickVector.x;
          inputFwd += this.thumbstickVector.y;
        }

        moveDir.z = inputFwd;
        moveDir.x = inputSide;

        if (moveDir.lengthSq() > 0.01) {
          moveDir.normalize();
          const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotY);
          const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotY);
          this.playerPos.addScaledVector(forward, moveDir.z * runSpeed * dt);
          this.playerPos.addScaledVector(right, moveDir.x * runSpeed * dt);
        }

        // Jump (disabled if grabbing)
        if (this.keys['Space'] && this.isGrounded) {
          this.playerVel.y = 8.5;
          this.isGrounded = false;
        }

        // Slope sliding: As ship tilts, gravity pulls player towards the lower end!
        if (this.shipData) {
          const pitchAngle = this.shipData.rootGroup.rotation.x;
          const rollAngle = this.shipData.rootGroup.rotation.z;

          // Slide speed reduced by seaLegs upgrade
          const slideMult = Math.max(0.25, 1 - this.upgrades.seaLegs * 0.25);

          // Slide down pitch (Z axis)
          if (Math.abs(pitchAngle) > 0.20) {
            const slideZ = Math.sin(pitchAngle) * 19 * slideMult * dt;
            this.playerPos.z += slideZ;
          }

          // Slide down roll list (X axis)
          if (Math.abs(rollAngle) > 0.16) {
            const slideX = -Math.sin(rollAngle) * 21 * slideMult * dt;
            this.playerPos.x += slideX;
          }
        }

        // Gravity
        this.playerVel.y -= 22 * dt;
        this.playerPos.y += this.playerVel.y * dt;

        // True 3D spatial ship collision
        const collisionResult = this.calculateShipDeckHeightAndCollision(this.playerPos, dt);
        if (collisionResult.onShip) {
          if (this.playerPos.y <= collisionResult.deckWorldY + 0.4) {
            this.playerPos.y = collisionResult.deckWorldY + 0.4;
            this.playerVel.y = 0;
            this.isGrounded = true;
          } else {
            this.isGrounded = false;
          }
        }
      }
    }

    // Health damage from hypothermia / super cold / freezing water:
    // When super cold (bodyTemp < 45% / fahrenheitTemp < 60°F), start losing health progressively!
    if (this.playerStats.bodyTemp < 45) {
      const coldSeverity = (45 - this.playerStats.bodyTemp) / 45; // 0 to 1
      const hypothermiaDmg = (2.5 + coldSeverity * 12.0) * dt;
      this.playerStats.health = Math.max(0, this.playerStats.health - hypothermiaDmg);

      // Thumping heartbeat audio cue during critical hypothermia
      if (this.playerStats.bodyTemp < 25 && Math.random() < 0.04) {
        sound.playHeartbeat();
      }
    }

    // Immediate cold bite if swimming in 28°F sea with dropping temperature
    if (this.isSwimming && this.playerStats.bodyTemp < 65) {
      this.playerStats.health = Math.max(0, this.playerStats.health - 2.0 * dt);
    }

    if (this.playerStats.health <= 0 && this.playerStats.isAlive) {
      this.playerStats.isAlive = false;
      this.phase = 'gameover';
      this.callbacks.onGameOver(false, this.playerStats, this.activeShipDef.name);
    }

    this.playerMesh.position.copy(this.playerPos);
    this.playerMesh.rotation.y = this.playerRotY + Math.PI;

    this.callbacks.onStatsUpdate(this.playerStats);
  }

  // True 3D Spatial Deck Collision with Hull, Poop Deck, Superstructures, and Railings
  private calculateShipDeckHeightAndCollision(playerPos: THREE.Vector3, dt: number): { deckWorldY: number; onShip: boolean } {
    if (!this.shipData) return { deckWorldY: -999, onShip: false };

    // Determine which ship piece the player is on (supports Titanic split!)
    let targetGroup: THREE.Group = this.shipData.rootGroup;
    if (this.activeShipDef.hasSplitting && this.isSplitOccurred) {
      // Estimate if player is on bow or stern section based on Z
      if (playerPos.z < 15) {
        targetGroup = this.shipData.sternGroup;
      } else {
        targetGroup = this.shipData.bowGroup;
      }
    }

    // Convert player world position into the ship's local coordinate space
    const localPos = targetGroup.worldToLocal(playerPos.clone());

    const lengthScale = this.activeShipDef.lengthMeters / 250;
    const halfBeam = (24 * lengthScale) * 0.5;
    const halfLength = (160 * lengthScale) * 0.5;
    const shipLength = halfLength * 2;

    // Check if player is within ship's footprint
    const insideX = Math.abs(localPos.x) <= halfBeam + 0.9;
    const insideZ = Math.abs(localPos.z) <= halfLength + 1.5;

    if (!insideX || !insideZ) {
      // Overboard into the sea!
      return { deckWorldY: -999, onShip: false };
    }

    // Solid Deckhouse Wall Collision: prevent walking through cabins/bridge
    // Promenade deck alleyways exist at |x| >= 7.6 and |x| <= halfBeam
    if (localPos.y < 24.0 && Math.abs(localPos.z) < halfLength * 0.65) {
      const bridgeWallHalfWidth = 6.8;
      if (Math.abs(localPos.x) < bridgeWallHalfWidth) {
        // Push player outwards to the open promenade deck alleyways
        const pushSign = localPos.x >= 0 ? 1 : -1;
        localPos.x = pushSign * (bridgeWallHalfWidth + 0.3);
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.x = resolvedWorld.x;
        playerPos.z = resolvedWorld.z;
      }
    }

    // Hull Railings: prevent falling off the edge when merely walking
    const railingEdge = halfBeam - 0.3;
    if (Math.abs(localPos.x) > railingEdge && this.playerVel.y < 2.0 && !this.isSwimming) {
      const sign = localPos.x > 0 ? 1 : -1;
      localPos.x = sign * railingEdge;
      const resolvedWorld = targetGroup.localToWorld(localPos.clone());
      playerPos.x = resolvedWorld.x;
      playerPos.z = resolvedWorld.z;
    }

    // Funnel Cylinders Collision (iconic towering funnels along the centerline)
    const funnelZPositions = [-halfLength * 0.38, -halfLength * 0.12, halfLength * 0.12, halfLength * 0.36];
    for (const fz of funnelZPositions) {
      const distToFunnel = Math.hypot(localPos.x, localPos.z - fz);
      const funnelRadius = 2.4;
      if (distToFunnel < funnelRadius && localPos.y >= 17.0) {
        const angle = Math.atan2(localPos.z - fz, localPos.x);
        localPos.x = Math.cos(angle) * (funnelRadius + 0.15);
        localPos.z = fz + Math.sin(angle) * (funnelRadius + 0.15);
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.x = resolvedWorld.x;
        playerPos.z = resolvedWorld.z;
      }
    }

    // Mast Obstacle Collisions (foremast & mainmast)
    const mastZPositions = [-halfLength * 0.62, halfLength * 0.62];
    for (const mz of mastZPositions) {
      const distToMast = Math.hypot(localPos.x, localPos.z - mz);
      const mastRadius = 1.0;
      if (distToMast < mastRadius && localPos.y >= 17.0) {
        const angle = Math.atan2(localPos.z - mz, localPos.x);
        localPos.x = Math.cos(angle) * (mastRadius + 0.1);
        localPos.z = mz + Math.sin(angle) * (mastRadius + 0.1);
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.x = resolvedWorld.x;
        playerPos.z = resolvedWorld.z;
      }
    }

    // Titanic Hull Split Chasm: Open abyss where the ship broke in two!
    if (this.activeShipDef.hasSplitting && this.isSplitOccurred) {
      if (playerPos.z >= 8 && playerPos.z <= 20 && playerPos.y < 16) {
        // Player falls straight through the fracture into the sea
        return { deckWorldY: -999, onShip: false };
      }
    }

    // 1. Identify which deck level the player is on (Rooftop, Forecastle Bow, Poop Deck Stern, or Promenade)
    let localDeckY = 18.5; // Standard promenade deck
    const isRooftopZone = localPos.y >= 21.5 && Math.abs(localPos.x) <= 8.8 && localPos.z >= shipLength * 0.06 && localPos.z <= shipLength * 0.32;
    const isBowZone = localPos.z >= halfLength * 0.22;
    const isSternZone = localPos.z <= -halfLength * 0.22;

    if (isRooftopZone) {
      // ROOFTOP / BRIDGE OBSERVATION DECK
      localDeckY = 26.5;

      // Rooftop Perimeter Guard Railings: keep player safely on the roof!
      const maxRoofX = 8.2;
      if (Math.abs(localPos.x) > maxRoofX && !this.isSwimming) {
        localPos.x = Math.sign(localPos.x) * maxRoofX;
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.x = resolvedWorld.x;
        playerPos.z = resolvedWorld.z;
      }
      if (localPos.z > shipLength * 0.31) {
        localPos.z = shipLength * 0.31;
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.z = resolvedWorld.z;
      }
      if (localPos.z < shipLength * 0.08) {
        localPos.z = shipLength * 0.08;
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.z = resolvedWorld.z;
      }

    } else if (isBowZone) {
      // FORECASTLE BOW DECK
      localDeckY = 20.2;

      // Bow Hull Tapering Railings: follows the aerodynamic bow curve
      const bowProgress = Math.min(1.0, Math.max(0, (localPos.z - halfLength * 0.22) / (halfLength * 0.28)));
      const maxBowWidth = Math.max(2.4, (halfBeam - 0.4) * (1 - bowProgress * 0.65));
      if (Math.abs(localPos.x) > maxBowWidth && !this.isSwimming) {
        localPos.x = Math.sign(localPos.x) * maxBowWidth;
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.x = resolvedWorld.x;
        playerPos.z = resolvedWorld.z;
      }
      // Bow Tip Railing
      if (localPos.z > halfLength * 0.51) {
        localPos.z = halfLength * 0.51;
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.z = resolvedWorld.z;
      }

    } else if (isSternZone) {
      // POOP DECK STERN
      localDeckY = 22.2;

      // Stern Railings (Taffrail)
      const sternProgress = Math.min(1.0, Math.max(0, Math.abs(localPos.z + halfLength * 0.22) / (halfLength * 0.28)));
      const maxSternWidth = Math.max(3.0, (halfBeam - 0.4) * (1 - sternProgress * 0.40));
      if (Math.abs(localPos.x) > maxSternWidth && !this.isSwimming) {
        localPos.x = Math.sign(localPos.x) * maxSternWidth;
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.x = resolvedWorld.x;
        playerPos.z = resolvedWorld.z;
      }
      // Stern Taffrail Railing
      if (localPos.z < -halfLength * 0.51) {
        localPos.z = -halfLength * 0.51;
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.z = resolvedWorld.z;
      }

    } else {
      // MAIN PROMENADE DECK
      localDeckY = 18.5;

      // Solid Deckhouse Wall Collision: promenade alleyways exist at |x| >= 6.8
      if (localPos.y < 23.5 && Math.abs(localPos.z) < halfLength * 0.22) {
        const bridgeWallHalfWidth = 6.8;
        if (Math.abs(localPos.x) < bridgeWallHalfWidth) {
          const pushSign = localPos.x >= 0 ? 1 : -1;
          localPos.x = pushSign * (bridgeWallHalfWidth + 0.3);
          const resolvedWorld = targetGroup.localToWorld(localPos.clone());
          playerPos.x = resolvedWorld.x;
          playerPos.z = resolvedWorld.z;
        }
      }

      // Promenade Hull Railings
      const railingEdge = halfBeam - 0.3;
      if (Math.abs(localPos.x) > railingEdge && this.playerVel.y < 2.0 && !this.isSwimming) {
        const sign = localPos.x > 0 ? 1 : -1;
        localPos.x = sign * railingEdge;
        const resolvedWorld = targetGroup.localToWorld(localPos.clone());
        playerPos.x = resolvedWorld.x;
        playerPos.z = resolvedWorld.z;
      }
    }

    // Calculate world position of this deck point
    const localFloorPoint = new THREE.Vector3(localPos.x, localDeckY, localPos.z);
    const worldFloorPoint = targetGroup.localToWorld(localFloorPoint);

    return { deckWorldY: worldFloorPoint.y, onShip: true };
  }

  // Check near interactive objects and show prompts in HUD
  private checkInteractionPrompts() {
    if (!this.shipData) return;

    if (this.playerStats.inLifeboat) {
      this.callbacks.onPromptInteract('Riding Lifeboat: Steer with Joystick / WASD · Press [E] to Disembark');
      return;
    }

    // Check lifeboats
    for (const boat of this.shipData.lifeboats) {
      const pos = boat.group.getWorldPosition(new THREE.Vector3());
      if (this.playerPos.distanceTo(pos) < 5.0) {
        const label = boat.id.includes('bow') ? 'Board & Ride Bow Lifeboat' : 'Board & Ride Lifeboat';
        this.callbacks.onPromptInteract(`Press [E] or tap Interact to ${label}`);
        return;
      }
    }

    // Check items
    for (const item of this.shipData.items) {
      if (item.collected) continue;
      const pos = item.group.getWorldPosition(new THREE.Vector3());
      if (this.playerPos.distanceTo(pos) < 4.0) {
        if (item.type === 'lifejacket') {
          this.callbacks.onPromptInteract('Press [E] to Equip Lifejacket');
        } else {
          this.callbacks.onPromptInteract('Press [E] to Take Distress Flare Gun');
        }
        return;
      }
    }

    // Check doors
    if (this.shipData.doors) {
      for (const door of this.shipData.doors) {
        const pos = door.group.getWorldPosition(new THREE.Vector3());
        if (this.playerPos.distanceTo(pos) < 4.2) {
          this.callbacks.onPromptInteract(door.prompt);
          return;
        }
      }
    }

    this.callbacks.onPromptInteract(null);
  }

  // Lifeboats flotation physics
  private updateLifeboats(dt: number, time: number) {
    if (!this.shipData) return;

    for (const boat of this.shipData.lifeboats) {
      // If currently steered/ridden by player, skip background auto-drift
      if (this.playerStats.inLifeboat && this.playerStats.currentLifeboatId === boat.id) {
        continue;
      }

      const boatWorldPos = boat.group.getWorldPosition(new THREE.Vector3());
      const waterY = Math.sin(boatWorldPos.x * 0.05 + time * 1.8) * 0.8;

      // Auto-deploy if water reaches davit level
      if (boatWorldPos.y <= waterY + 0.8) {
        boat.isDeployed = true;
      }

      if (boat.isDeployed) {
        // Detach and float on sea water waves
        boat.group.rotation.x = Math.sin(time + boatWorldPos.z * 0.1) * 0.1;
        boat.group.rotation.z = Math.cos(time + boatWorldPos.x * 0.1) * 0.08;

        // Drift slowly away from the sinking ship vortex
        const driftSign = boat.shipSide === 'port' ? -1 : 1;
        boat.group.position.x += driftSign * 1.8 * dt;
        boat.group.position.y = waterY + 0.4;
      }
    }
  }

  // Active Flare Projectiles
  private updateFlares(dt: number) {
    for (let i = this.activeFlares.length - 1; i >= 0; i--) {
      const flare = this.activeFlares[i];
      flare.life += dt;
      flare.vel.y -= 9.8 * dt; // gravity
      flare.pos.addScaledVector(flare.vel, dt);
      flare.mesh.position.copy(flare.pos);

      // Light flicker
      flare.light.intensity = 3 + Math.random() * 2;

      // Expire after 7 seconds or hits water
      if (flare.life > 7.0 || flare.pos.y < 0) {
        this.scene.remove(flare.mesh);
        this.activeFlares.splice(i, 1);
      }
    }
  }

  // Bot passenger AI simulation
  private updateBotsLobby(dt: number, time: number) {
    this.botSurvivors.forEach((bot, idx) => {
      const mesh = this.botMeshes[idx];
      if (!mesh) return;

      // Wander around pier
      mesh.position.x += Math.sin(time * 0.5 + idx) * 1.2 * dt;
      mesh.position.z += Math.cos(time * 0.4 + idx) * 1.2 * dt;
    });
  }

  private updateBotsSinking(dt: number, time: number) {
    this.botSurvivors.forEach((bot, idx) => {
      const mesh = this.botMeshes[idx];
      if (!mesh || !bot.isAlive) return;

      // Sinking panic: bots run towards the stern or towards lifeboats!
      if (this.disasterProgress > 0.15) {
        bot.panicLevel = Math.min(1.0, bot.panicLevel + dt * 0.1);

        // Run towards negative Z (Stern) to avoid rising bow water
        mesh.position.z -= (4 + idx * 0.6) * dt;

        // Grounding on deck using true 3D spatial ship collision
        const deckResult = this.calculateShipDeckHeightAndCollision(mesh.position, dt);
        mesh.position.y = deckResult.deckWorldY + 0.4;

        // If water submerged, bot falls into water
        const waterY = Math.sin(mesh.position.x * 0.05 + time * 1.8) * 0.8;
        if (mesh.position.y < waterY) {
          mesh.position.y = waterY;
          if (Math.random() < 0.005) {
            bot.isAlive = false;
            mesh.visible = false;
          }
        }
      }
    });

    // Random passenger screams / chat lines
    if (Math.random() < 0.008 && this.phase === 'sinking') {
      const randomBot = this.botSurvivors[Math.floor(Math.random() * this.botSurvivors.length)];
      const randomLine = IN_GAME_CHAT_LINES[Math.floor(Math.random() * IN_GAME_CHAT_LINES.length)];
      if (randomBot && randomLine) {
        this.callbacks.onChatMessage({
          id: String(Date.now()),
          sender: randomBot.name,
          text: randomLine,
          timestamp: 'NOW',
        });
      }
    }
  }

  // Camera choreography
  private updateCamera() {
    if (this.isFirstPerson) {
      // First person: at player head height
      this.camera.position.set(this.playerPos.x, this.playerPos.y + 2.2, this.playerPos.z);
      const lookTarget = new THREE.Vector3(0, 0, 10)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), -this.cameraPitch)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotY);
      this.camera.lookAt(this.camera.position.clone().add(lookTarget));
      this.playerMesh.visible = false;
    } else {
      // Third person chase orbit cam
      this.playerMesh.visible = true;
      const camOffset = new THREE.Vector3(
        0,
        Math.sin(this.cameraPitch) * this.cameraDistance + 2.0,
        -Math.cos(this.cameraPitch) * this.cameraDistance
      ).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotY);

      const targetCamPos = this.playerPos.clone().add(camOffset);
      this.camera.position.lerp(targetCamPos, 0.25);
      this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.8, this.playerPos.z);
    }
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }
}
