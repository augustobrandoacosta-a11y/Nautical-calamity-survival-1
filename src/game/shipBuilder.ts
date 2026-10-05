import * as THREE from 'three';
import { ShipDefinition, ShipId } from '../types/game';

export interface InteractiveLifeboat {
  id: string;
  group: THREE.Group;
  shipSide: 'port' | 'starboard';
  isDeployed: boolean;
  isOccupied: boolean;
  capacity: number;
  occupants: number;
  worldPos: THREE.Vector3;
  initialLocalPos: THREE.Vector3;
}

export interface InteractiveItem {
  id: string;
  type: 'lifejacket' | 'flares';
  group: THREE.Group;
  collected: boolean;
  worldPos: THREE.Vector3;
}

export interface InteractiveDoor {
  id: string;
  name: string;
  targetDestination: 'bow' | 'stern' | 'rooftop' | 'promenade';
  targetLocalPos: THREE.Vector3;
  targetGroup: 'bow' | 'stern';
  group: THREE.Group;
  prompt: string;
}

export interface BuiltShipResult {
  rootGroup: THREE.Group;
  bowGroup: THREE.Group;
  sternGroup: THREE.Group;
  funnels: THREE.Mesh[];
  lifeboats: InteractiveLifeboat[];
  items: InteractiveItem[];
  doors: InteractiveDoor[];
  lights: THREE.PointLight[];
  obstacleMesh: THREE.Group | null;
  deckSurfaces: THREE.Box3[]; // collision/walkable bounding boxes
  propellers?: THREE.Mesh[];
  splitZoneZ: number;
}

export function buildShipMesh(ship: ShipDefinition): BuiltShipResult {
  const rootGroup = new THREE.Group();
  rootGroup.name = `ship_${ship.id}`;

  const bowGroup = new THREE.Group();
  bowGroup.name = 'bow_section';
  const sternGroup = new THREE.Group();
  sternGroup.name = 'stern_section';

  rootGroup.add(bowGroup);
  rootGroup.add(sternGroup);

  const funnels: THREE.Mesh[] = [];
  const lifeboats: InteractiveLifeboat[] = [];
  const items: InteractiveItem[] = [];
  const lights: THREE.PointLight[] = [];
  const deckSurfaces: THREE.Box3[] = [];
  const propellers: THREE.Mesh[] = [];

  const splitZ = ship.hasSplitting ? 15 : 0;

  // Materials
  const hullBottomMat = new THREE.MeshStandardMaterial({
    color: ship.colors.hullBottom,
    roughness: 0.6,
    metalness: 0.2,
  });

  const hullTopMat = new THREE.MeshStandardMaterial({
    color: ship.colors.hullTop,
    roughness: 0.5,
    metalness: 0.3,
  });

  const superstructureMat = new THREE.MeshStandardMaterial({
    color: ship.colors.superstructure,
    roughness: 0.4,
    metalness: 0.1,
  });

  const deckWoodMat = new THREE.MeshStandardMaterial({
    color: ship.colors.deck,
    roughness: 0.7,
    metalness: 0.05,
  });

  const funnelBaseMat = new THREE.MeshStandardMaterial({
    color: ship.colors.funnelBase,
    roughness: 0.4,
    metalness: 0.2,
  });

  const funnelTopMat = new THREE.MeshStandardMaterial({
    color: ship.colors.funnelTop,
    roughness: 0.5,
    metalness: 0.4,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.3,
    metalness: 0.8,
  });

  const windowGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffea9f,
  });

  // Scale factor based on ship length
  const lengthScale = ship.lengthMeters / 250;
  const shipLength = 160 * lengthScale;
  const shipBeam = 24 * lengthScale;
  const hullHeight = 18;

  // Build Bow and Stern Hull sections
  if (ship.id === 'titanic' || ship.id === 'lusitania' || ship.id === 'britannic') {
    // Classic Ocean Liner Hull Shape
    // Bow Hull (Forecastle to Midships)
    const bowHullGeo = new THREE.BoxGeometry(shipBeam, hullHeight * 0.48, shipLength * 0.55);
    const bowHullMeshBottom = new THREE.Mesh(bowHullGeo, hullBottomMat);
    bowHullMeshBottom.position.set(0, hullHeight * 0.24, shipLength * 0.22);
    bowGroup.add(bowHullMeshBottom);

    const bowHullTopGeo = new THREE.BoxGeometry(shipBeam, hullHeight * 0.52, shipLength * 0.55);
    const bowHullMeshTop = new THREE.Mesh(bowHullTopGeo, hullTopMat);
    bowHullMeshTop.position.set(0, hullHeight * 0.74, shipLength * 0.22);
    bowGroup.add(bowHullMeshTop);

    // Tapered prow wedge
    const prowGeo = new THREE.ConeGeometry(shipBeam * 0.5, 35, 4);
    prowGeo.rotateX(Math.PI * 0.5);
    prowGeo.rotateY(Math.PI * 0.25);
    const prowMesh = new THREE.Mesh(prowGeo, hullTopMat);
    prowMesh.position.set(0, hullHeight * 0.7, shipLength * 0.52);
    bowGroup.add(prowMesh);

    // Stern Hull (Midships to Poop Deck)
    const sternHullGeo = new THREE.BoxGeometry(shipBeam, hullHeight * 0.48, shipLength * 0.45);
    const sternHullBottom = new THREE.Mesh(sternHullGeo, hullBottomMat);
    sternHullBottom.position.set(0, hullHeight * 0.24, -shipLength * 0.22);
    sternGroup.add(sternHullBottom);

    const sternHullTopGeo = new THREE.BoxGeometry(shipBeam, hullHeight * 0.52, shipLength * 0.45);
    const sternHullTop = new THREE.Mesh(sternHullTopGeo, hullTopMat);
    sternHullTop.position.set(0, hullHeight * 0.74, -shipLength * 0.22);
    sternGroup.add(sternHullTop);

    // Counter stern round taper
    const counterSternGeo = new THREE.CylinderGeometry(shipBeam * 0.48, shipBeam * 0.2, 22, 16);
    counterSternGeo.rotateZ(Math.PI * 0.5);
    const counterStern = new THREE.Mesh(counterSternGeo, hullTopMat);
    counterStern.position.set(0, hullHeight * 0.7, -shipLength * 0.46);
    sternGroup.add(counterStern);

    // Britannic Hospital Livery: Green stripe & Red Geneva Crosses
    if (ship.id === 'britannic') {
      const greenStripeGeo = new THREE.BoxGeometry(shipBeam + 0.2, 1.8, shipLength * 0.54);
      const greenStripeMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
      const stripeBow = new THREE.Mesh(greenStripeGeo, greenStripeMat);
      stripeBow.position.set(0, hullHeight * 0.65, shipLength * 0.22);
      bowGroup.add(stripeBow);

      const stripeStern = new THREE.Mesh(new THREE.BoxGeometry(shipBeam + 0.2, 1.8, shipLength * 0.44), greenStripeMat);
      stripeStern.position.set(0, hullHeight * 0.65, -shipLength * 0.22);
      sternGroup.add(stripeStern);

      // Red Crosses on hull
      [-shipBeam / 2 - 0.2, shipBeam / 2 + 0.2].forEach((xPos) => {
        const crossMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 4), crossMat);
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 1.2), crossMat);
        crossH.position.set(xPos, hullHeight * 0.65, shipLength * 0.2);
        crossV.position.set(xPos, hullHeight * 0.65, shipLength * 0.2);
        bowGroup.add(crossH);
        bowGroup.add(crossV);
      });
    }

    // Wooden Decks
    // Bow Decks (Forecastle + Well Deck + Boat Deck Forward)
    const foreDeckGeo = new THREE.BoxGeometry(shipBeam * 0.94, 0.8, shipLength * 0.5);
    const foreDeck = new THREE.Mesh(foreDeckGeo, deckWoodMat);
    foreDeck.position.set(0, hullHeight + 0.4, shipLength * 0.2);
    bowGroup.add(foreDeck);

    // Stern Decks (Boat Deck Aft + Poop Deck)
    const aftDeckGeo = new THREE.BoxGeometry(shipBeam * 0.94, 0.8, shipLength * 0.42);
    const aftDeck = new THREE.Mesh(aftDeckGeo, deckWoodMat);
    aftDeck.position.set(0, hullHeight + 0.4, -shipLength * 0.2);
    sternGroup.add(aftDeck);

    // Poop Deck raised platform at far stern
    const poopDeckGeo = new THREE.BoxGeometry(shipBeam * 0.88, 3.5, shipLength * 0.16);
    const poopDeck = new THREE.Mesh(poopDeckGeo, deckWoodMat);
    poopDeck.position.set(0, hullHeight + 1.8, -shipLength * 0.38);
    sternGroup.add(poopDeck);

    // Superstructures (Bridge + Cabins)
    // Bow superstructure (Officer quarters & bridge)
    const bridgeGeo = new THREE.BoxGeometry(shipBeam * 0.8, 8, shipLength * 0.3);
    const bridgeMesh = new THREE.Mesh(bridgeGeo, superstructureMat);
    bridgeMesh.position.set(0, hullHeight + 4.5, shipLength * 0.15);
    bowGroup.add(bridgeMesh);

    // Stern superstructure
    const sternSuperGeo = new THREE.BoxGeometry(shipBeam * 0.78, 7.5, shipLength * 0.25);
    const sternSuperMesh = new THREE.Mesh(sternSuperGeo, superstructureMat);
    sternSuperMesh.position.set(0, hullHeight + 4.25, -shipLength * 0.12);
    sternGroup.add(sternSuperMesh);

    // Wheelhouse / Navigating Bridge
    const wheelhouseGeo = new THREE.BoxGeometry(shipBeam * 0.9, 4, 8);
    const wheelhouse = new THREE.Mesh(wheelhouseGeo, superstructureMat);
    wheelhouse.position.set(0, hullHeight + 9.5, shipLength * 0.26);
    bowGroup.add(wheelhouse);

    // Funnels (4 Stacks)
    const funnelSpacing = 22;
    const funnelZPositions = [
      shipLength * 0.18,  // Funnel 1 (Bow)
      shipLength * 0.05,  // Funnel 2 (Bow)
      -shipLength * 0.08, // Funnel 3 (Stern)
      -shipLength * 0.21, // Funnel 4 (Stern)
    ];

    funnelZPositions.forEach((zPos, idx) => {
      const parentGroup = idx < 2 ? bowGroup : sternGroup;
      const funnelGroup = new THREE.Group();
      funnelGroup.position.set(0, hullHeight + 8, zPos);
      funnelGroup.rotation.x = 0.12; // Raked backwards

      // Funnel base
      const fBaseGeo = new THREE.CylinderGeometry(3.2, 3.6, 20, 16);
      const fBase = new THREE.Mesh(fBaseGeo, funnelBaseMat);
      fBase.position.y = 10;
      funnelGroup.add(fBase);

      // Funnel black top
      const fTopGeo = new THREE.CylinderGeometry(3.2, 3.2, 6, 16);
      const fTop = new THREE.Mesh(fTopGeo, funnelTopMat);
      fTop.position.y = 20;
      funnelGroup.add(fTop);

      // Funnel steam pipes
      const pipeGeo = new THREE.CylinderGeometry(0.3, 0.3, 24, 8);
      const pipe = new THREE.Mesh(pipeGeo, brassMat);
      pipe.position.set(0, 11, 3.5);
      funnelGroup.add(pipe);

      parentGroup.add(funnelGroup);
      funnels.push(fBase);
    });

    // Masts and Rigging
    // Foremast (with crow's nest)
    const foreMastGeo = new THREE.CylinderGeometry(0.5, 0.9, 48, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.7 });
    const foreMast = new THREE.Mesh(foreMastGeo, mastMat);
    foreMast.position.set(0, hullHeight + 24, shipLength * 0.36);
    foreMast.rotation.x = 0.08;
    bowGroup.add(foreMast);

    // Crow's nest barrel
    const crowsNestGeo = new THREE.CylinderGeometry(1.4, 1.2, 2.2, 12, 1, true);
    const crowsNest = new THREE.Mesh(crowsNestGeo, mastMat);
    crowsNest.position.set(0, hullHeight + 32, shipLength * 0.37);
    bowGroup.add(crowsNest);

    // Mainmast (Aft)
    const aftMastGeo = new THREE.CylinderGeometry(0.5, 0.8, 44, 8);
    const aftMast = new THREE.Mesh(aftMastGeo, mastMat);
    aftMast.position.set(0, hullHeight + 22, -shipLength * 0.32);
    aftMast.rotation.x = 0.08;
    sternGroup.add(aftMast);

    // Triple Bronze Screws / Propellers at Stern
    [-shipBeam * 0.3, 0, shipBeam * 0.3].forEach((xPos, idx) => {
      const propGroup = new THREE.Group();
      propGroup.position.set(xPos, 3, -shipLength * 0.48);

      const hubGeo = new THREE.CylinderGeometry(1.2, 1.2, 3, 12);
      hubGeo.rotateX(Math.PI * 0.5);
      const hub = new THREE.Mesh(hubGeo, brassMat);
      propGroup.add(hub);

      // Blades
      for (let b = 0; b < 3; b++) {
        const bladeGeo = new THREE.BoxGeometry(0.3, 4.2, 1.2);
        const blade = new THREE.Mesh(bladeGeo, brassMat);
        blade.position.y = 2.1;
        blade.rotation.z = (b * Math.PI * 2) / 3;
        blade.rotation.y = 0.3;
        propGroup.add(blade);
      }

      sternGroup.add(propGroup);
      propellers.push(propGroup as unknown as THREE.Mesh);
    });

  } else if (ship.id === 'atlantic') {
    // 1873 SS Atlantic (Single steam funnel, 3 tall masts with rigging, black iron hull)
    const hullGeo = new THREE.BoxGeometry(shipBeam, hullHeight * 0.9, shipLength * 0.9);
    const hullMesh = new THREE.Mesh(hullGeo, hullTopMat);
    hullMesh.position.set(0, hullHeight * 0.45, 0);
    bowGroup.add(hullMesh);

    // Deck
    const deckGeo = new THREE.BoxGeometry(shipBeam * 0.95, 0.8, shipLength * 0.88);
    const deckMesh = new THREE.Mesh(deckGeo, deckWoodMat);
    deckMesh.position.set(0, hullHeight * 0.9 + 0.4, 0);
    bowGroup.add(deckMesh);

    // Small low deckhouses
    const houseGeo = new THREE.BoxGeometry(shipBeam * 0.6, 5, shipLength * 0.4);
    const house = new THREE.Mesh(houseGeo, superstructureMat);
    house.position.set(0, hullHeight * 0.9 + 2.5, 0);
    bowGroup.add(house);

    // 1 Tall Thin Funnel
    const funnelGroup = new THREE.Group();
    funnelGroup.position.set(0, hullHeight * 0.9 + 5, 0);
    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 18, 16), funnelBaseMat);
    fBase.position.y = 9;
    const fTop = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 5, 16), funnelTopMat);
    fTop.position.y = 18;
    funnelGroup.add(fBase);
    funnelGroup.add(fTop);
    bowGroup.add(funnelGroup);
    funnels.push(fBase);

    // 3 Tall Sailing Masts with horizontal cross spars (yards)
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    [-shipLength * 0.28, 0, shipLength * 0.28].forEach((zPos, idx) => {
      const mastGroup = new THREE.Group();
      mastGroup.position.set(0, hullHeight * 0.9, zPos);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 44, 8), mastMat);
      mast.position.y = 22;
      mastGroup.add(mast);

      // 3 horizontal yards
      [18, 28, 36].forEach((yardY, yIdx) => {
        const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 20 - yIdx * 4, 8), mastMat);
        yard.rotation.z = Math.PI * 0.5;
        yard.position.y = yardY;
        mastGroup.add(yard);
      });

      bowGroup.add(mastGroup);
    });

  } else if (ship.id === 'cruise') {
    // Modern 18-Deck Megaship "Ocean Empress"
    const hullGeo = new THREE.BoxGeometry(shipBeam * 1.15, hullHeight, shipLength * 0.9);
    const hull = new THREE.Mesh(hullGeo, hullBottomMat);
    hull.position.set(0, hullHeight * 0.5, 0);
    bowGroup.add(hull);

    // Tiered Balcony decks (5 levels of white balcony superstructure)
    for (let deckLvl = 1; deckLvl <= 5; deckLvl++) {
      const w = shipBeam * (1.1 - deckLvl * 0.05);
      const l = shipLength * (0.85 - deckLvl * 0.04);
      const h = 4.5;
      const bGeo = new THREE.BoxGeometry(w, h, l);
      const bMesh = new THREE.Mesh(bGeo, superstructureMat);
      bMesh.position.set(0, hullHeight + deckLvl * h - h / 2, -deckLvl * 2);
      bowGroup.add(bMesh);

      // Balcony glass railings
      const glassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
      const glassR = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 1.2, l), glassMat);
      glassR.position.set(0, hullHeight + deckLvl * h, -deckLvl * 2);
      bowGroup.add(glassR);
    }

    // Top Sun Deck with Swimming Pools
    const topDeckY = hullHeight + 5 * 4.5;
    const poolGeo = new THREE.BoxGeometry(10, 1.5, 20);
    const poolWaterMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.1,
      metalness: 0.8,
    });
    const pool = new THREE.Mesh(poolGeo, poolWaterMat);
    pool.position.set(0, topDeckY - 0.5, 10);
    bowGroup.add(pool);

    // Twin modern angled funnels
    [-6, 6].forEach((xOffset) => {
      const funnelGeo = new THREE.BoxGeometry(4, 16, 12);
      const modernFunnel = new THREE.Mesh(funnelGeo, funnelBaseMat);
      modernFunnel.position.set(xOffset, topDeckY + 8, -25);
      modernFunnel.rotation.x = -0.25;
      bowGroup.add(modernFunnel);
      funnels.push(modernFunnel);
    });

    // Glass Atrium Dome
    const domeGeo = new THREE.SphereGeometry(7, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0, topDeckY, -5);
    bowGroup.add(dome);
  }

  // Warm Porthole & Cabin Glow Lights along the sides
  const sideLightCount = 8;
  for (let i = 0; i < sideLightCount; i++) {
    const zOffset = -shipLength * 0.35 + (i * shipLength * 0.7) / (sideLightCount - 1);
    [-shipBeam * 0.48, shipBeam * 0.48].forEach((xOffset, sideIdx) => {
      const pLight = new THREE.PointLight(0xffea9f, 0.8, 22);
      pLight.position.set(xOffset, hullHeight + 4, zOffset);
      if (zOffset > splitZ) {
        bowGroup.add(pLight);
      } else {
        sternGroup.add(pLight);
      }
      lights.push(pLight);

      // Porthole mesh
      const porthole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 1.6), windowGlowMat);
      porthole.position.set(xOffset * 1.02, hullHeight + 3.8, zOffset);
      if (zOffset > splitZ) {
        bowGroup.add(porthole);
      } else {
        sternGroup.add(porthole);
      }
    });
  }

  // Build Interactive Lifeboats along Boat Deck
  const boatLength = 8.5;
  const boatBeam = 3.2;
  const boatHeight = 1.6;
  const boatZPositions = [
    shipLength * 0.22,
    shipLength * 0.12,
    -shipLength * 0.04,
    -shipLength * 0.16,
    -shipLength * 0.26,
  ];

  boatZPositions.forEach((zPos, idx) => {
    ['port', 'starboard'].forEach((side) => {
      const isPort = side === 'port';
      const xSign = isPort ? -1 : 1;
      const xPos = xSign * (shipBeam * 0.5 + 1.2);
      const yPos = hullHeight + 8.8;

      const boatGroup = new THREE.Group();
      boatGroup.position.set(xPos, yPos, zPos);

      // Boat hull
      const bHullGeo = new THREE.CylinderGeometry(boatBeam * 0.5, boatBeam * 0.35, boatLength, 8, 1, false);
      bHullGeo.rotateZ(Math.PI * 0.5);
      bHullGeo.rotateY(Math.PI * 0.5);
      const bHullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const bHull = new THREE.Mesh(bHullGeo, bHullMat);
      bHull.position.y = boatHeight * 0.4;
      boatGroup.add(bHull);

      // Interior wooden thwart benches
      const thwartGeo = new THREE.BoxGeometry(boatBeam * 0.8, 0.2, 0.8);
      const thwartMat = new THREE.MeshStandardMaterial({ color: 0xb45309 });
      for (let t = -2; t <= 2; t++) {
        const thwart = new THREE.Mesh(thwartGeo, thwartMat);
        thwart.position.set(0, boatHeight * 0.5, t * 1.4);
        boatGroup.add(thwart);
      }

      // Davits (Curved steel arms holding the lifeboat)
      const davitMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6 });
      [-boatLength * 0.4, boatLength * 0.4].forEach((davitZ) => {
        const davitArm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4, 8), davitMat);
        davitArm.position.set(-xSign * 0.8, 1.2, davitZ);
        davitArm.rotation.z = -xSign * 0.2;
        boatGroup.add(davitArm);

        // Rope falls
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), new THREE.MeshBasicMaterial({ color: 0x78716c }));
        rope.position.set(0, 1.8, davitZ);
        boatGroup.add(rope);
      });

      const parentGroup = zPos > splitZ ? bowGroup : sternGroup;
      parentGroup.add(boatGroup);

      lifeboats.push({
        id: `boat_${side}_${idx}`,
        group: boatGroup,
        shipSide: isPort ? 'port' : 'starboard',
        isDeployed: false,
        isOccupied: false,
        capacity: 8,
        occupants: 0,
        worldPos: new THREE.Vector3(xPos, yPos, zPos),
        initialLocalPos: new THREE.Vector3(xPos, yPos, zPos),
      });
    });
  });

  // Dedicated Bow Lifeboats on Forecastle Deck (Port & Starboard)
  [-1, 1].forEach((bowSign) => {
    const isPort = bowSign === -1;
    const side = isPort ? 'port' : 'starboard';
    const bowXPos = bowSign * (shipBeam * 0.35);
    const bowYPos = hullHeight + 4.8;
    const bowZPos = shipLength * 0.35;

    const bowBoatGroup = new THREE.Group();
    bowBoatGroup.position.set(bowXPos, bowYPos, bowZPos);
    bowBoatGroup.name = `lifeboat_bow_${side}`;

    // Boat hull (white wooden cutter)
    const bHullGeo = new THREE.CylinderGeometry(boatBeam * 0.52, boatBeam * 0.36, boatLength * 0.95, 8, 1, false);
    bHullGeo.rotateZ(Math.PI * 0.5);
    bHullGeo.rotateY(Math.PI * 0.5);
    const bHullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
    const bHull = new THREE.Mesh(bHullGeo, bHullMat);
    bHull.position.y = boatHeight * 0.4;
    bowBoatGroup.add(bHull);

    // Interior thwarts
    const thwartGeo = new THREE.BoxGeometry(boatBeam * 0.78, 0.2, 0.75);
    const thwartMat = new THREE.MeshStandardMaterial({ color: 0xb45309 });
    for (let t = -2; t <= 2; t++) {
      const thwart = new THREE.Mesh(thwartGeo, thwartMat);
      thwart.position.set(0, boatHeight * 0.5, t * 1.3);
      bowBoatGroup.add(thwart);
    }

    // Wooden Oars
    const oarMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
    [-0.8, 0.8].forEach((ox) => {
      const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7.5, 6), oarMat);
      oar.rotation.x = Math.PI * 0.48;
      oar.position.set(ox, boatHeight * 0.6, 0);
      bowBoatGroup.add(oar);
    });

    // Bow Davit Arms
    const davitMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7 });
    [-boatLength * 0.38, boatLength * 0.38].forEach((davitZ) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.5, 8), davitMat);
      arm.position.set(-bowSign * 0.6, 1.0, davitZ);
      bowBoatGroup.add(arm);
    });

    bowGroup.add(bowBoatGroup);

    lifeboats.push({
      id: `boat_bow_${side}`,
      group: bowBoatGroup,
      shipSide: isPort ? 'port' : 'starboard',
      isDeployed: false,
      isOccupied: false,
      capacity: 10,
      occupants: 0,
      worldPos: new THREE.Vector3(bowXPos, bowYPos, bowZPos),
      initialLocalPos: new THREE.Vector3(bowXPos, bowYPos, bowZPos),
    });
  });

  // Interactive Items (Lifejacket Lockers and Flare Gun Boxes)
  // Lifejacket Locker (Bright orange emergency chest)
  const lifejacketBoxGeo = new THREE.BoxGeometry(2.5, 1.8, 3.5);
  const lifejacketBoxMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
  const ljMesh = new THREE.Mesh(lifejacketBoxGeo, lifejacketBoxMat);
  const ljPos = new THREE.Vector3(0, hullHeight + 9.5, shipLength * 0.08);
  const ljGroup = new THREE.Group();
  ljGroup.position.copy(ljPos);
  ljGroup.add(ljMesh);

  // Lifejacket icon cross
  const ljCross = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  ljGroup.add(ljCross);
  bowGroup.add(ljGroup);

  items.push({
    id: 'item_lifejacket',
    type: 'lifejacket',
    group: ljGroup,
    collected: false,
    worldPos: ljPos,
  });

  // Flare Gun Box near Bridge
  const flareBoxGeo = new THREE.BoxGeometry(1.8, 1.4, 2.2);
  const flareBoxMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
  const flareMesh = new THREE.Mesh(flareBoxGeo, flareBoxMat);
  const flarePos = new THREE.Vector3(shipBeam * 0.25, hullHeight + 9.5, shipLength * 0.22);
  const flareGroup = new THREE.Group();
  flareGroup.position.copy(flarePos);
  flareGroup.add(flareMesh);
  bowGroup.add(flareGroup);

  items.push({
    id: 'item_flares',
    type: 'flares',
    group: flareGroup,
    collected: false,
    worldPos: flarePos,
  });

  // Build the Disaster Obstacle (Iceberg / Torpedo / Rock Reef / Rogue Wave / Mine)
  let obstacleMesh: THREE.Group | null = null;

  if (ship.id === 'titanic') {
    // Towering Blue-White Glacier Iceberg
    obstacleMesh = new THREE.Group();
    obstacleMesh.name = 'iceberg';
    const iceGeo = new THREE.DodecahedronGeometry(36, 1);
    // Deform vertices for natural jagged ice look
    const posAttr = iceGeo.attributes.position;
    for (let v = 0; v < posAttr.count; v++) {
      const vx = posAttr.getX(v);
      const vy = posAttr.getY(v);
      const vz = posAttr.getZ(v);
      const noise = (Math.sin(vx * 0.2) + Math.cos(vz * 0.2)) * 3;
      posAttr.setXYZ(v, vx + noise, vy * 1.4 + noise, vz + noise);
    }
    iceGeo.computeVertexNormals();

    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.15,
      metalness: 0.1,
      flatShading: true,
    });
    const iceMesh = new THREE.Mesh(iceGeo, iceMat);
    iceMesh.position.set(shipBeam * 1.4, 12, shipLength * 0.42);
    obstacleMesh.add(iceMesh);

    // Drifting smaller ice growler chunks on forecastle
    for (let c = 0; c < 5; c++) {
      const chunk = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.5 + Math.random() * 1.5, 0),
        iceMat
      );
      chunk.position.set((Math.random() - 0.5) * 12, hullHeight + 1.5, shipLength * 0.38 + c * 3);
      bowGroup.add(chunk);
    }
    rootGroup.add(obstacleMesh);

  } else if (ship.id === 'lusitania') {
    // Torpedo wake and impact hull fracture
    obstacleMesh = new THREE.Group();
    obstacleMesh.name = 'torpedo_impact';

    // Charred hull explosion hole on starboard
    const charGeo = new THREE.BoxGeometry(0.5, 8, 14);
    const charMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const charMesh = new THREE.Mesh(charGeo, charMat);
    charMesh.position.set(shipBeam * 0.51, hullHeight * 0.55, shipLength * 0.12);
    bowGroup.add(charMesh);

    // Orange fire/sparks glow inside breach
    const fireLight = new THREE.PointLight(0xf97316, 3, 30);
    fireLight.position.set(shipBeam * 0.4, hullHeight * 0.55, shipLength * 0.12);
    bowGroup.add(fireLight);
    lights.push(fireLight);

  } else if (ship.id === 'atlantic') {
    // Jagged Golden Rule Rock Reef protruding from the waves
    obstacleMesh = new THREE.Group();
    obstacleMesh.name = 'rock_reef';
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9, flatShading: true });

    [-1, 1].forEach((dir) => {
      const rock = new THREE.Mesh(new THREE.ConeGeometry(18, 32, 6), rockMat);
      rock.position.set(dir * 18, 4, -shipLength * 0.1);
      rock.rotation.z = dir * 0.25;
      obstacleMesh!.add(rock);
    });
    rootGroup.add(obstacleMesh);

  } else if (ship.id === 'britannic') {
    // Underwater Sea Mine with contact horns
    obstacleMesh = new THREE.Group();
    obstacleMesh.name = 'naval_mine';
    const mineGeo = new THREE.SphereGeometry(3.5, 12, 12);
    const mineMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.8 });
    const mine = new THREE.Mesh(mineGeo, mineMat);
    mine.position.set(shipBeam * 0.8, 3, shipLength * 0.45);
    obstacleMesh.add(mine);

    // Horns
    for (let h = 0; h < 6; h++) {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), mineMat);
      horn.rotation.z = (h * Math.PI) / 3;
      mine.add(horn);
    }
    rootGroup.add(obstacleMesh);
  }

  // Build Interactive Compartment Doors (Bow, Stern, Rooftop & Promenade)
  const doors: InteractiveDoor[] = [];

  const createDoorMesh = (name: string, lampColor: number = 0xfef08a) => {
    const doorGroup = new THREE.Group();
    doorGroup.name = name;

    // Door frame (rich dark timber / steel trim)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.6, metalness: 0.2 });
    const frameGeo = new THREE.BoxGeometry(2.4, 4.4, 0.4);
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    doorGroup.add(frameMesh);

    // Door panel (polished teak / mahogany wood)
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
    const panelGeo = new THREE.BoxGeometry(2.0, 4.0, 0.26);
    const panelMesh = new THREE.Mesh(panelGeo, panelMat);
    panelMesh.position.z = 0.05;
    doorGroup.add(panelMesh);

    // Polished brass knob & backplate
    const knobMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.8 });
    const knobGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.25, 8);
    knobGeo.rotateX(Math.PI * 0.5);
    const knobMesh = new THREE.Mesh(knobGeo, knobMat);
    knobMesh.position.set(0.65, 0, 0.22);
    doorGroup.add(knobMesh);

    // Brass nameplate over door
    const plateGeo = new THREE.BoxGeometry(1.8, 0.4, 0.1);
    const plateMesh = new THREE.Mesh(plateGeo, knobMat);
    plateMesh.position.set(0, 1.85, 0.22);
    doorGroup.add(plateMesh);

    // Overhead nautical lantern
    const lanternMat = new THREE.MeshStandardMaterial({
      color: lampColor,
      emissive: lampColor,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    const lanternGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const lanternMesh = new THREE.Mesh(lanternGeo, lanternMat);
    lanternMesh.position.set(0, 2.4, 0.35);
    doorGroup.add(lanternMesh);

    const lanternLight = new THREE.PointLight(lampColor, 1.2, 10);
    lanternLight.position.set(0, 2.4, 0.5);
    doorGroup.add(lanternLight);
    lights.push(lanternLight);

    return doorGroup;
  };

  // 1. Door to Bow (Forecastle & Lookout)
  const doorBowMesh = createDoorMesh('DoorToBow', 0x38bdf8);
  doorBowMesh.position.set(0, hullHeight + 2.2, shipLength * 0.28);
  bowGroup.add(doorBowMesh);
  doors.push({
    id: 'door_bow',
    name: 'Door to the Bow',
    targetDestination: 'bow',
    targetLocalPos: new THREE.Vector3(0, hullHeight + 4.2, shipLength * 0.44),
    targetGroup: 'bow',
    group: doorBowMesh,
    prompt: 'Press [E] or tap Interact to enter Door to the Bow',
  });

  // 1b. Door from Bow returning to Promenade
  const doorBowReturnMesh = createDoorMesh('DoorFromBow', 0x38bdf8);
  doorBowReturnMesh.position.set(0, hullHeight + 4.2, shipLength * 0.38);
  doorBowReturnMesh.rotation.y = Math.PI;
  bowGroup.add(doorBowReturnMesh);
  doors.push({
    id: 'door_bow_return',
    name: 'Door to Promenade Deck',
    targetDestination: 'promenade',
    targetLocalPos: new THREE.Vector3(0, hullHeight + 2.5, shipLength * 0.18),
    targetGroup: 'bow',
    group: doorBowReturnMesh,
    prompt: 'Press [E] or tap Interact to return to Promenade Deck',
  });

  // 2. Door to Stern (Poop Deck & Railing)
  const doorSternMesh = createDoorMesh('DoorToStern', 0xf59e0b);
  doorSternMesh.position.set(0, hullHeight + 2.2, -shipLength * 0.24);
  doorSternMesh.rotation.y = Math.PI;
  sternGroup.add(doorSternMesh);
  doors.push({
    id: 'door_stern',
    name: 'Door to the Stern',
    targetDestination: 'stern',
    targetLocalPos: new THREE.Vector3(0, hullHeight + 5.5, -shipLength * 0.44),
    targetGroup: 'stern',
    group: doorSternMesh,
    prompt: 'Press [E] or tap Interact to enter Door to the Stern',
  });

  // 2b. Door from Stern returning to Promenade
  const doorSternReturnMesh = createDoorMesh('DoorFromStern', 0xf59e0b);
  doorSternReturnMesh.position.set(0, hullHeight + 5.5, -shipLength * 0.36);
  sternGroup.add(doorSternReturnMesh);
  doors.push({
    id: 'door_stern_return',
    name: 'Door to Promenade Deck',
    targetDestination: 'promenade',
    targetLocalPos: new THREE.Vector3(0, hullHeight + 2.5, -shipLength * 0.14),
    targetGroup: 'stern',
    group: doorSternReturnMesh,
    prompt: 'Press [E] or tap Interact to return to Promenade Deck',
  });

  // 3. Door to Rooftop (Observation Deck & Bridge Roof)
  const doorRoofMesh = createDoorMesh('DoorToRooftop', 0x34d399);
  doorRoofMesh.position.set(shipBeam * 0.32, hullHeight + 2.2, shipLength * 0.14);
  doorRoofMesh.rotation.y = -Math.PI * 0.5;
  bowGroup.add(doorRoofMesh);
  doors.push({
    id: 'door_rooftop',
    name: 'Door to the Rooftop',
    targetDestination: 'rooftop',
    targetLocalPos: new THREE.Vector3(0, hullHeight + 11.2, shipLength * 0.22),
    targetGroup: 'bow',
    group: doorRoofMesh,
    prompt: 'Press [E] or tap Interact to climb to the Rooftop',
  });

  // 3b. Door from Rooftop returning down to Promenade
  const doorRoofReturnMesh = createDoorMesh('DoorFromRooftop', 0x34d399);
  doorRoofReturnMesh.position.set(0, hullHeight + 11.2, shipLength * 0.16);
  doorRoofReturnMesh.rotation.y = Math.PI;
  bowGroup.add(doorRoofReturnMesh);
  doors.push({
    id: 'door_rooftop_return',
    name: 'Door down to Promenade',
    targetDestination: 'promenade',
    targetLocalPos: new THREE.Vector3(0, hullHeight + 2.5, shipLength * 0.14),
    targetGroup: 'bow',
    group: doorRoofReturnMesh,
    prompt: 'Press [E] or tap Interact to descend to Promenade Deck',
  });

  // Populate walk surface bounding boxes for basic player ground collision
  deckSurfaces.push(
    new THREE.Box3(
      new THREE.Vector3(-shipBeam * 0.5, hullHeight, -shipLength * 0.5),
      new THREE.Vector3(shipBeam * 0.5, hullHeight + 10, shipLength * 0.5)
    )
  );

  return {
    rootGroup,
    bowGroup,
    sternGroup,
    funnels,
    lifeboats,
    items,
    doors,
    lights,
    obstacleMesh,
    deckSurfaces,
    propellers,
    splitZoneZ: splitZ,
  };
}
