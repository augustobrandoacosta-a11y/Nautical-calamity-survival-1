import * as THREE from 'three';

export interface BuiltLobbyResult {
  group: THREE.Group;
  lights: THREE.Light[];
  spawnPoint: THREE.Vector3;
  votingBoothPos: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function buildLobbyScene(): BuiltLobbyResult {
  const group = new THREE.Group();
  group.name = 'lobby_scene';

  const lights: THREE.Light[] = [];

  // 1. Wooden Pier / Dock Boardwalk
  const pierWidth = 48;
  const pierLength = 70;
  const pierThickness = 3;

  const pierWoodMat = new THREE.MeshStandardMaterial({
    color: 0x5a3825,
    roughness: 0.8,
    metalness: 0.1,
  });

  const pierMesh = new THREE.Mesh(
    new THREE.BoxGeometry(pierWidth, pierThickness, pierLength),
    pierWoodMat
  );
  pierMesh.position.set(0, -pierThickness * 0.5, 0);
  pierMesh.receiveShadow = true;
  group.add(pierMesh);

  // Pilings / Wooden Stilts underneath pier
  const pilingMat = new THREE.MeshStandardMaterial({ color: 0x271911, roughness: 0.9 });
  for (let x = -pierWidth * 0.45; x <= pierWidth * 0.45; x += 12) {
    for (let z = -pierLength * 0.45; z <= pierLength * 0.45; z += 14) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 12, 8), pilingMat);
      piling.position.set(x, -6, z);
      group.add(piling);
    }
  }

  // Pier Railings along water edges (North, East, West)
  const railingMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.4 });
  const railH = 1.4;

  // North Rail (Overlooking open ocean harbor)
  const northRail = new THREE.Mesh(new THREE.BoxGeometry(pierWidth, 0.2, 0.2), railingMat);
  northRail.position.set(0, railH, pierLength * 0.5 - 0.5);
  group.add(northRail);

  // Vertical rail posts
  for (let x = -pierWidth * 0.48; x <= pierWidth * 0.48; x += 4) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, railH, 6), railingMat);
    post.position.set(x, railH * 0.5, pierLength * 0.5 - 0.5);
    group.add(post);
  }

  // Mooring Bollards & Lifebuoys
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
  [-16, 0, 16].forEach((bx) => {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 10), bollardMat);
    bollard.position.set(bx, 0.6, pierLength * 0.5 - 2);
    group.add(bollard);

    // Lifebuoy ring hanging nearby
    const buoyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.16, 8, 16), buoyMat);
    ring.position.set(bx + 1.2, 0.8, pierLength * 0.5 - 0.8);
    ring.rotation.x = Math.PI * 0.5;
    group.add(ring);
  });

  // 2. Grand Departure Terminal Building at South end of Pier
  const terminalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.7,
  });

  const terminalBuilding = new THREE.Mesh(
    new THREE.BoxGeometry(pierWidth * 0.95, 14, 16),
    terminalMat
  );
  terminalBuilding.position.set(0, 7, -pierLength * 0.5 + 8);
  group.add(terminalBuilding);

  // Grand Arched Entrance Canopy
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 8), canopyMat);
  canopy.position.set(0, 6, -pierLength * 0.5 + 18);
  group.add(canopy);

  // Terminal Entrance Pillars
  [-8, 8].forEach((px) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 6, 8), canopyMat);
    pillar.position.set(px, 3, -pierLength * 0.5 + 18);
    group.add(pillar);
  });

  // Warm Brass Lamp Posts on Pier with volumetric light glow
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7, roughness: 0.3 });
  const lampPositions = [
    new THREE.Vector3(-14, 0, 16),
    new THREE.Vector3(14, 0, 16),
    new THREE.Vector3(-14, 0, -4),
    new THREE.Vector3(14, 0, -4),
  ];

  lampPositions.forEach((pos) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 6, 8), lampMat);
    pole.position.set(pos.x, 3, pos.z);
    group.add(pole);

    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    lantern.position.set(pos.x, 5.8, pos.z);
    group.add(lantern);

    const lampLight = new THREE.PointLight(0xfef08a, 1.8, 22);
    lampLight.position.set(pos.x, 5.8, pos.z);
    lampLight.castShadow = false;
    group.add(lampLight);
    lights.push(lampLight);
  });

  // 3. Central Voting Ballot Podium / Departure Board in 3D
  const votingBoothPos = new THREE.Vector3(0, 0, 2);
  const boothGroup = new THREE.Group();
  boothGroup.position.copy(votingBoothPos);

  // Podium base
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 3.2, 1.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 })
  );
  podium.position.y = 0.7;
  boothGroup.add(podium);

  // Holographic / Glowing Vote Terminal Pillar
  const pillarGeo = new THREE.BoxGeometry(1.6, 3.2, 1.6);
  const pillarMesh = new THREE.Mesh(
    pillarGeo,
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.8 })
  );
  pillarMesh.position.y = 2.4;
  boothGroup.add(pillarMesh);

  // Glowing Terminal Screen
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.8),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  screen.position.set(0, 2.8, 0.82);
  boothGroup.add(screen);

  // Beacon light atop terminal
  const beaconLight = new THREE.PointLight(0x38bdf8, 2, 15);
  beaconLight.position.set(0, 4.2, 0);
  boothGroup.add(beaconLight);
  lights.push(beaconLight);

  group.add(boothGroup);

  // Cargo crates and luggage trunks on pier for maritime atmosphere
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const luggageMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 });

  const crateConfigs = [
    { x: -16, z: 8, sx: 3, sy: 2.2, sz: 3, rot: 0.2 },
    { x: -15, z: 11, sx: 2.2, sy: 1.8, sz: 2.2, rot: -0.1 },
    { x: 16, z: 6, sx: 2.8, sy: 2.5, sz: 2.8, rot: 0.4 },
    { x: 15, z: 9, sx: 2, sy: 1.6, sz: 3.5, rot: 0 },
  ];

  crateConfigs.forEach((c) => {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(c.sx, c.sy, c.sz), crateMat);
    crate.position.set(c.x, c.sy * 0.5, c.z);
    crate.rotation.y = c.rot;
    group.add(crate);
  });

  // Distant Foggy Harbor Ocean Plane
  const waterGeo = new THREE.PlaneGeometry(350, 350, 32, 32);
  waterGeo.rotateX(-Math.PI * 0.5);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x051329,
    roughness: 0.1,
    metalness: 0.8,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0, -3.2, 40);
  group.add(waterMesh);

  // Distant lighthouse tower beacon in the harbor
  const lhGroup = new THREE.Group();
  lhGroup.position.set(65, 0, 110);

  const lhTower = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 4.5, 36, 12),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9 })
  );
  lhTower.position.y = 18;
  lhGroup.add(lhTower);

  const lhLamp = new THREE.Mesh(
    new THREE.SphereGeometry(2, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffedd5 })
  );
  lhLamp.position.y = 36;
  lhGroup.add(lhLamp);

  const lhLight = new THREE.PointLight(0xffedd5, 2.5, 90);
  lhLight.position.y = 36;
  lhGroup.add(lhLight);
  lights.push(lhLight);

  group.add(lhGroup);

  return {
    group,
    lights,
    spawnPoint: new THREE.Vector3(0, 0.5, -8),
    votingBoothPos,
    bounds: {
      minX: -pierWidth * 0.45,
      maxX: pierWidth * 0.45,
      minZ: -pierLength * 0.45 + 14,
      maxZ: pierLength * 0.48,
    },
  };
}
