// render.js — the whole 3D look of Velvet Vault, built with three.js.
// Every model is low-poly primitives built in code: no model files, no
// textures loaded from disk, no network. The 2D game world (1280 x 720 px)
// maps to a 32 x 18 unit vault hall: 1 unit = 40 px, x to the right, z
// down the screen (so 2D angle a becomes 3D direction (cos a, 0, sin a)).
// Camera: high oblique top-down, so the whole room — thief, guards,
// cameras, loot and both doors — fits in one frame. HUD and full
// screens are DOM overlays (index.html) driven by hud.js; this file
// only builds and syncs the 3D vault hall.

import * as THREE from "three";
import { WORLD_W, WORLD_H, CAMERA_RANGE, CAMERA_HALF_ANGLE } from "./config.js";
import { coinPosition } from "./thief.js";

const S = 40; // px per 3D unit
const HALF_W = WORLD_W / 2 / S; // 16
const HALF_H = WORLD_H / 2 / S; // 9

// 2D px -> 3D ground point (y = 0 plane).
export function to3(x, y) {
  return { x: (x - WORLD_W / 2) / S, z: (y - WORLD_H / 2) / S };
}
// 3D ground point -> 2D px.
export function to2(x, z) {
  return { x: x * S + WORLD_W / 2, y: z * S + WORLD_H / 2 };
}

function mat(color, opts) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05, ...(opts || {}) });
}

function textTexture(text, fg, bg, fontPx) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = `bold ${fontPx || 64}px Georgia, serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A vision cone group: outer sector + brighter inner sector + hard arc
// and edge lines, so the danger reads at a glance even when shrunk.
function makeCone(range, half, color, opacity) {
  const group = new THREE.Group();
  const geo = new THREE.CircleGeometry(range, 24, -half, half * 2);
  geo.rotateX(-Math.PI / 2);
  const outer = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(geo, outer));
  const innerGeo = new THREE.CircleGeometry(range * 0.55, 16, -half, half * 2);
  innerGeo.rotateX(-Math.PI / 2);
  const inner = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opacity + 0.16, depthWrite: false, side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(innerGeo, inner));
  const arcPts = [];
  for (let i = 0; i <= 16; i++) {
    const phi = -half + (2 * half * i) / 16;
    arcPts.push(new THREE.Vector3(range * Math.cos(phi), 0.09, -range * Math.sin(phi)));
  }
  const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts), lineMat));
  for (const sgn of [-1, 1]) {
    const edgePts = [
      new THREE.Vector3(0, 0.09, 0),
      new THREE.Vector3(range * Math.cos(sgn * half), 0.09, -range * Math.sin(sgn * half)),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePts), lineMat));
  }
  return { group, outer, inner, lineMat };
}

export class VaultRenderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1210);
    this.scene.fog = new THREE.Fog(0x0a1210, 38, 78);

    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 140);
    this.camera.position.set(0, 12, 22);
    this.camera.lookAt(0, 0, -3);

    // Warm vault light: amber directional + soft ambient + hemisphere.
    const lamp = new THREE.DirectionalLight(0xffd9a0, 1.7);
    lamp.position.set(-8, 18, -4);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.camera.left = -20;
    lamp.shadow.camera.right = 20;
    lamp.shadow.camera.top = 14;
    lamp.shadow.camera.bottom = -14;
    this.scene.add(lamp);
    this.scene.add(new THREE.AmbientLight(0x50606a, 1.3));
    this.scene.add(new THREE.HemisphereLight(0x3a4a5a, 0x1a2418, 0.8));

    this.levelGroup = null;
    this.thief = null;
    this.guards3d = [];
    this.cameras3d = [];
    this.loot3d = [];
    this.coinMesh = null;
    this.clinkRing = null;
    this.exitGlow = null;
    this.exitLight = null;
    this.exitSign = null;
    this.alarmLight = null;
    this.chandeliers = [];
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Screen pixel (clientX, clientY) -> 2D world px where a coin lands.
  screenToWorld(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    const p = to2(THREE.MathUtils.clamp(hit.x, -HALF_W, HALF_W), THREE.MathUtils.clamp(hit.z, -HALF_H, HALF_H));
    return p;
  }

  buildLevel(level) {
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      this.levelGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    const g = new THREE.Group();
    this.levelGroup = g;
    this.guards3d = [];
    this.cameras3d = [];
    this.loot3d = [];
    this.chandeliers = [];
    this.scene.add(g);

    // --- floor: dark teal marble hall with a gold border ---
    // Tile texture drawn on a canvas: teal checker tiles with gold
    // grout, so the floor reads as a vault hall, never a flat void.
    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = 512;
    tileCanvas.height = 512;
    const tg = tileCanvas.getContext("2d");
    tg.fillStyle = "#1d4a40";
    tg.fillRect(0, 0, 512, 512);
    for (let ty = 0; ty < 8; ty++) {
      for (let tx = 0; tx < 8; tx++) {
        if ((tx + ty) % 2 === 0) {
          tg.fillStyle = "#1f5046";
          tg.fillRect(tx * 64, ty * 64, 64, 64);
        }
      }
    }
    tg.strokeStyle = "rgba(201,162,39,0.32)";
    tg.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      tg.beginPath(); tg.moveTo(i * 64, 0); tg.lineTo(i * 64, 512); tg.stroke();
      tg.beginPath(); tg.moveTo(0, i * 64); tg.lineTo(512, i * 64); tg.stroke();
    }
    const tileTex = new THREE.CanvasTexture(tileCanvas);
    tileTex.wrapS = THREE.RepeatWrapping;
    tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(8, 6);
    tileTex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 95),
      new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.85, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(280, 220), mat(0x0a1a16));
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.y = -0.06;
    g.add(skirt);
    // Gold border inlay around the playfield.
    const border = new THREE.Mesh(new THREE.RingGeometry(0, 1, 4), mat(0x8a6d2f));
    border.visible = false;
    g.add(border);
    for (const [bx, bz, bw, bh] of [
      [0, -HALF_H, HALF_W * 2, 0.18], [0, HALF_H, HALF_W * 2, 0.18],
      [-HALF_W, 0, 0.18, HALF_H * 2], [HALF_W, 0, 0.18, HALF_H * 2],
    ]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.06, bh), mat(0xc9a227, { metalness: 0.6, roughness: 0.4 }));
      strip.position.set(bx, 0.03, bz);
      g.add(strip);
    }
    // Red carpet runner: south door up the centre to the vault door,
    // plus a cross runner — the thief's road, readable at a glance.
    const runner = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, HALF_H * 2), mat(0x7a1f1f));
    runner.position.set(0, 0.035, 0);
    runner.receiveShadow = true;
    g.add(runner);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2, 0.07, 1.6), mat(0x6b1a1a));
    cross.position.set(0, 0.035, 0);
    g.add(cross);
    for (const [gx, gz] of [[-1.0, -4], [1.0, -4], [-1.0, 4], [1.0, 4]]) {
      const diamond = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.3), mat(0xc9a227, { metalness: 0.6 }));
      diamond.position.set(gx, 0.04, gz);
      diamond.rotation.y = Math.PI / 4;
      g.add(diamond);
    }

    // --- walls: north wall holds the vault door, side walls are low ---
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 2, 2.2, 0.6), mat(0x2c2118));
    northWall.position.set(0, 1.1, -HALF_H - 0.6);
    g.add(northWall);
    const northTrim = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 2, 0.25, 0.8), mat(0xc9a227, { metalness: 0.5 }));
    northTrim.position.set(0, 2.3, -HALF_H - 0.6);
    g.add(northTrim);
    for (const sgn of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, HALF_H * 2), mat(0x2c2118));
      side.position.set(sgn * (HALF_W + 0.6), 0.8, 0);
      g.add(side);
    }
    // Chandeliers: gold rings with warm lights over the hall.
    for (const [cx, cz] of [[-7, -4], [7, -4], [-7, 4], [7, 4]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 8, 20), mat(0xc9a227, { metalness: 0.7, roughness: 0.3 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(cx, 3.4, cz);
      g.add(ring);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc93c, emissiveIntensity: 2.2 })
      );
      bulb.position.set(cx, 3.4, cz);
      g.add(bulb);
      const light = new THREE.PointLight(0xffc93c, 5, 9, 1.8);
      light.position.set(cx, 3.2, cz);
      g.add(light);
      this.chandeliers.push(bulb);
    }

    // --- marble pillars: tall, pale, block sight and movement ---
    for (const p of level.pillars) {
      const c = to3(p.x + p.w / 2, p.y + p.h / 2);
      const w = p.w / S;
      const d = p.h / S;
      const col = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), mat(0xd8d2c4));
      col.position.set(c.x, 1.3, c.z);
      col.castShadow = true;
      col.receiveShadow = true;
      g.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.22, d + 0.25), mat(0xc9a227, { metalness: 0.5 }));
      cap.position.set(c.x, 2.7, c.z);
      g.add(cap);
      const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.25, d + 0.25), mat(0x8a6d2f));
      base.position.set(c.x, 0.12, c.z);
      g.add(base);
    }

    // --- display cases: low glass boxes on gold plinths (block movement,
    // never sight — guards see over the glass) ---
    for (const cs of level.cases) {
      const c = to3(cs.x + cs.w / 2, cs.y + cs.h / 2);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(cs.w / S, 0.5, cs.h / S), mat(0x3a2c1c));
      plinth.position.set(c.x, 0.25, c.z);
      plinth.castShadow = true;
      g.add(plinth);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(cs.w / S, 0.55, cs.h / S),
        new THREE.MeshStandardMaterial({ color: 0x9fc8d8, transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.2 })
      );
      glass.position.set(c.x, 0.78, c.z);
      g.add(glass);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(cs.w / S + 0.1, 0.08, cs.h / S + 0.1), mat(0xc9a227, { metalness: 0.6 }));
      rim.position.set(c.x, 1.08, c.z);
      g.add(rim);
    }

    // --- velvet curtains: deep red drapes the thief hides inside ---
    // Kept low (1.15 tall) so they read as drapes, not walls, and the
    // room behind them stays visible from the oblique camera.
    for (const cu of level.curtains) {
      const c = to3(cu.x + cu.w / 2, cu.y + cu.h / 2);
      const drape = new THREE.Mesh(new THREE.BoxGeometry(cu.w / S, 1.15, cu.h / S), mat(0x8a1f2d, { roughness: 1 }));
      drape.position.set(c.x, 0.58, c.z);
      drape.castShadow = true;
      g.add(drape);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, cu.w / S + 0.3, 8), mat(0xc9a227, { metalness: 0.7 }));
      rod.rotation.z = Math.PI / 2;
      rod.position.set(c.x, 1.22, c.z);
      g.add(rod);
      // Gold tie-back so the drape reads as fabric, not a red box.
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, cu.h / S + 0.06), mat(0xc9a227, { metalness: 0.5 }));
      tie.position.set(c.x, 0.55, c.z);
      g.add(tie);
    }

    // --- loot pedestals: gold plinth + glowing piece + gold pool ---
    level.loot.forEach((piece) => {
      const p = to3(piece.x, piece.y);
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.7, 10), mat(0x3a2c1c));
      plinth.position.set(p.x, 0.35, p.z);
      plinth.castShadow = true;
      g.add(plinth);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 10), mat(0xc9a227, { metalness: 0.6 }));
      top.position.set(p.x, 0.75, p.z);
      g.add(top);
      let item;
      if (piece.kind === "diamond") {
        item = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x4db8e8, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.3 })
        );
      } else if (piece.kind === "mask") {
        item = new THREE.Group();
        const face = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb300, emissiveIntensity: 1.1, metalness: 0.7, roughness: 0.3 })
        );
        face.scale.set(1, 0.8, 0.45);
        item.add(face);
        for (const ez of [-0.16, 0.16]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0x1a1210 }));
          eye.position.set(0.12, 0.08, ez);
          item.add(eye);
        }
      } else {
        // painting: gold frame + canvas, standing on the plinth.
        item = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.8), mat(0xc9a227, { metalness: 0.6 }));
        item.add(frame);
        const canvas = new THREE.Mesh(
          new THREE.PlaneGeometry(0.62, 0.82),
          new THREE.MeshStandardMaterial({ color: 0xd8a24a, emissive: 0x8a5a1a, emissiveIntensity: 0.5 })
        );
        canvas.position.x = 0.09;
        canvas.rotation.y = Math.PI / 2;
        item.add(canvas);
      }
      item.position.set(p.x, 1.25, p.z);
      g.add(item);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.05, 16),
        new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.3, depthWrite: false })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(p.x, 0.05, p.z);
      g.add(pool);
      const glow = new THREE.PointLight(0xffb300, 4, 4, 1.8);
      glow.position.set(p.x, 1.4, p.z);
      g.add(glow);
      this.loot3d.push({ piece, item, pool, glow });
    });

    // --- vault door (north, the exit) + GETAWAY sign ---
    const e = to3(level.exit.x + level.exit.w / 2, level.exit.y + level.exit.h / 2);
    const door = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 0.5), mat(0x5a4a22, { metalness: 0.6, roughness: 0.4 }));
    door.position.set(e.x, 1.2, -HALF_H - 0.25);
    g.add(door);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 8, 16), mat(0xc9a227, { metalness: 0.7 }));
    wheel.position.set(e.x, 1.2, -HALF_H + 0.05);
    g.add(wheel);
    this.exitGlow = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 20),
      new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.22, depthWrite: false })
    );
    this.exitGlow.rotation.x = -Math.PI / 2;
    this.exitGlow.position.set(e.x, 0.06, -HALF_H + 1.4);
    g.add(this.exitGlow);
    this.exitLight = new THREE.PointLight(0xff4444, 5, 7, 1.8);
    this.exitLight.position.set(e.x, 1.6, -HALF_H + 1.2);
    g.add(this.exitLight);
    const signTex = textTexture("VAULT  •  EXIT", "#ffe98a", "#1a1210", 56);
    this.exitSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.1),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
    );
    this.exitSign.position.set(e.x, 2.9, -HALF_H - 0.25);
    g.add(this.exitSign);
    // South door (spawn / getaway entrance): a low dark doorway with a
    // gold frame, never a monolith — the thief spawns in front of it.
    const south = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 0.4), mat(0x2c2118));
    south.position.set(0, 0.55, HALF_H + 0.4);
    g.add(south);
    const southFrame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 0.5), mat(0xc9a227, { metalness: 0.5 }));
    southFrame.position.set(0, 1.2, HALF_H + 0.4);
    g.add(southFrame);

    // --- guards: navy-suited, torch in hand, vision cone ---
    level.guards.forEach((def) => {
      const start = def.waypoints[def.start || 0];
      const p = to3(start[0], start[1]);
      const guard = new THREE.Group();
      guard.position.set(p.x, 0, p.z);
      const suit = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 1.15, 10), mat(0x1c2f4a));
      suit.position.y = 0.58;
      suit.castShadow = true;
      guard.add(suit);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.05), mat(0xc23b2e));
      tie.position.set(0.36, 0.85, 0);
      guard.add(tie);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mat(0xd9a066));
      head.position.y = 1.32;
      head.castShadow = true;
      guard.add(head);
      const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.22, 10), mat(0x14181f));
      hatTop.position.y = 1.58;
      guard.add(hatTop);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), mat(0x14181f));
      brim.position.y = 1.48;
      guard.add(brim);
      // Torch held out in front (+x side): glowing amber lamp.
      const torch = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.3, 0.16),
        new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb300, emissiveIntensity: 2.4 })
      );
      torch.position.set(0.55, 1.0, 0);
      guard.add(torch);
      const guardLight = new THREE.PointLight(0xffb84d, 5, 6, 1.8);
      guardLight.position.set(0.55, 1.1, 0);
      guard.add(guardLight);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.2, 16),
        new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0.22, depthWrite: false })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.06;
      guard.add(pool);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
      for (const ez of [-0.1, 0.1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat);
        eye.position.set(0.24, 1.35, ez);
        guard.add(eye);
      }
      g.add(guard);
      // Vision cone, built from the level's cone numbers.
      const range = level.coneRange / S;
      const half = level.coneHalfAngle;
      const cone = makeCone(range, half, 0xffc93c, 0.34);
      cone.group.position.set(p.x, 0.07, p.z);
      g.add(cone.group);
      // "?" / "!" mark: a big billboard above the guard.
      const markCanvas = document.createElement("canvas");
      markCanvas.width = 128;
      markCanvas.height = 128;
      const markTex = new THREE.CanvasTexture(markCanvas);
      const mark = new THREE.Mesh(
        new THREE.PlaneGeometry(1.25, 1.25),
        new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false })
      );
      mark.position.set(p.x, 2.5, p.z);
      g.add(mark);
      this.guards3d.push({ group: guard, cone, mark, markCanvas, markTex, eyeMat });
    });

    // --- security cameras: wall mounts + red sweeping cones ---
    level.cameras.forEach((def) => {
      const p = to3(def.x, def.y);
      const mount = new THREE.Group();
      mount.position.set(p.x, 2.2, p.z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.16), mat(0x3a3a3a));
      mount.add(arm);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.95, 8), mat(0x22262c));
      body.rotation.z = Math.PI / 2;
      body.position.set(0.4, -0.12, 0);
      mount.add(body);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.17, 0.24, 8),
        new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2.5 })
      );
      lens.rotation.z = Math.PI / 2;
      lens.position.set(0.95, -0.12, 0);
      mount.add(lens);
      g.add(mount);
      const range = CAMERA_RANGE / S;
      const cone = makeCone(range, CAMERA_HALF_ANGLE, 0xff4444, 0.3);
      cone.group.position.set(p.x, 0.07, p.z);
      g.add(cone.group);
      const blink = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2222 })
      );
      blink.position.set(p.x, 2.4, p.z);
      g.add(blink);
      this.cameras3d.push({ mount, cone, blink, lensMat: lens.material });
    });

    // --- the thief: black trench coat, fedora, gold satchel ---
    const thief = new THREE.Group();
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.46, 1.15, 10), mat(0x14181f));
    coat.position.y = 0.58;
    coat.castShadow = true;
    thief.add(coat);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.18, 10), mat(0x2c3036));
    collar.position.y = 1.12;
    thief.add(collar);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), mat(0xd9a066));
    head.position.y = 1.3;
    head.castShadow = true;
    thief.add(head);
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.2, 10), mat(0x0c0e12));
    hatTop.position.y = 1.55;
    thief.add(hatTop);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 12), mat(0x0c0e12));
    brim.position.y = 1.46;
    thief.add(brim);
    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.4), mat(0xc9a227, { metalness: 0.6 }));
    satchel.position.set(-0.32, 0.75, 0);
    thief.add(satchel);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.22, depthWrite: false })
    );
    halo.scale.set(1.3, 0.6, 0.95);
    halo.position.y = 0.5;
    thief.add(halo);
    // Gold ring on the floor under the thief, so the black coat pops
    // off the dark floor at contact-sheet size.
    const thiefRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.68, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    thiefRing.rotation.x = -Math.PI / 2;
    thiefRing.position.y = 0.07;
    thief.add(thiefRing);
    const thiefLight = new THREE.PointLight(0xffe98a, 6, 5, 1.8);
    thiefLight.position.set(0, 1.0, 0);
    thief.add(thiefLight);
    g.add(thief);
    this.thief = thief;

    // --- coin + CLINK ring ---
    // Coin is deliberately oversized (0.28 units ≈ 11 px radius) so a
    // coin mid-flight reads at contact-sheet size, not as a 5 px dot.
    this.coinMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb300, emissiveIntensity: 1.4, metalness: 0.7 })
    );
    this.coinMesh.visible = false;
    g.add(this.coinMesh);
    this.clinkRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.78, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe68c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    this.clinkRing.rotation.x = -Math.PI / 2;
    g.add(this.clinkRing);
    // --- footstep noise ring: the radius guards hear (70 px walking,
    // 26 px sneaking), drawn faintly around the moving thief so the
    // hearing rule is visible instead of a surprise "?" ---
    this.noiseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    this.noiseRing.rotation.x = -Math.PI / 2;
    g.add(this.noiseRing);

    // --- lockdown alarm light: red beacon over the vault door ---
    this.alarmLight = new THREE.PointLight(0xff2222, 0, 12, 1.6);
    this.alarmLight.position.set(0, 3.2, -HALF_H + 1.5);
    g.add(this.alarmLight);
  }

  drawMark(canvas, tex, ch, color) {
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    if (!ch) {
      tex.needsUpdate = true;
      return;
    }
    g.fillStyle = "rgba(10,10,14,0.82)";
    g.beginPath();
    g.arc(64, 64, 52, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.font = "bold 84px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(ch, 64, 70);
    tex.needsUpdate = true;
  }

  sync(state, time) {
    const level = state.level;
    if (!this.levelGroup || !level) return;
    // Camera framing: play framing is closer and lower than the menu
    // framing, so the room fills the frame during play instead of
    // leaving dark bands top and bottom.
    if (state.screen === "play" || state.screen === "paused") {
      this.camera.position.set(0, 10, 18.5);
      this.camera.lookAt(0, 0, -2);
    } else {
      this.camera.position.set(0, 11, 20);
      this.camera.lookAt(0, 0, -2.5);
    }

    // Thief.
    if (this.thief && state.thief) {
      const p = to3(state.thief.x, state.thief.y);
      this.thief.position.set(p.x, 0, p.z);
      this.thief.rotation.y = -state.thief.facing;
      this.thief.visible = true;
    }
    // Loot: bob and spin while untaken, vanish when taken.
    for (const l of this.loot3d) {
      const taken = l.piece.taken;
      l.item.visible = !taken;
      l.pool.visible = !taken;
      l.glow.visible = !taken;
      if (!taken) {
        l.item.position.y = 1.25 + Math.sin(time * 2 + l.piece.x) * 0.08;
        l.item.rotation.y = time * 0.8;
        l.pool.material.opacity = 0.24 + Math.sin(time * 2.4) * 0.08;
      }
    }
    // Guards + cones + marks.
    state.guards.forEach((gd, i) => {
      const g3 = this.guards3d[i];
      if (!g3) return;
      const p = to3(gd.x, gd.y);
      g3.group.position.set(p.x, 0, p.z);
      g3.group.rotation.y = -gd.angle;
      g3.cone.group.position.set(p.x, 0.07, p.z);
      g3.cone.group.rotation.y = -gd.angle;
      const col = gd.state === "chase" ? 0xff4444 : gd.state === "suspicious" ? 0xff9a3c : 0xffc93c;
      g3.cone.outer.color.setHex(col);
      g3.cone.inner.color.setHex(col);
      g3.cone.lineMat.color.setHex(col);
      g3.cone.outer.opacity = gd.state === "patrol" ? 0.34 : 0.46;
      g3.cone.inner.opacity = gd.state === "patrol" ? 0.5 : 0.62;
      g3.mark.position.set(p.x, 2.5, p.z);
      const ch = gd.state === "chase" ? "!" : gd.state === "suspicious" && gd.suspicion > 0.35 ? "?" : "";
      this.drawMark(g3.markCanvas, g3.markTex, ch, gd.state === "chase" ? "#ff6b6b" : "#ffb84d");
    });
    // Cameras: cone follows the sweep angle; jammed cones go dark grey.
    state.cameras.forEach((cam, i) => {
      const c3 = this.cameras3d[i];
      if (!c3) return;
      const p = to3(cam.x, cam.y);
      c3.cone.group.position.set(p.x, 0.07, p.z);
      c3.cone.group.rotation.y = -cam.angle;
      const jammed = cam.jammed > 0;
      const col = jammed ? 0x666666 : cam.seeing ? 0xff2222 : 0xff4444;
      c3.cone.outer.color.setHex(col);
      c3.cone.inner.color.setHex(col);
      c3.cone.lineMat.color.setHex(col);
      c3.cone.outer.opacity = jammed ? 0.08 : cam.seeing ? 0.5 : 0.3;
      c3.cone.inner.opacity = jammed ? 0.12 : cam.seeing ? 0.62 : 0.42;
      c3.mount.rotation.y = -cam.angle;
      c3.blink.material.color.setHex(jammed ? 0x666666 : (Math.sin(time * 6) > 0 ? 0xff2222 : 0x881111));
      c3.lensMat.emissiveIntensity = jammed ? 0.2 : 2.5;
    });
    // Coin in flight + clink ring.
    const cp = state.thief ? coinPosition(state.thief) : null;
    if (cp && this.coinMesh) {
      const p = to3(cp.x, cp.y);
      this.coinMesh.visible = true;
      this.coinMesh.position.set(p.x, 0.5, p.z);
      this.coinMesh.rotation.y = time * 10;
    } else if (this.coinMesh) {
      this.coinMesh.visible = false;
    }
    if (state.thief && state.thief.coinLand && this.clinkRing) {
      const land = state.thief.coinLand;
      const p = to3(land.x, land.y);
      const age = land.t;
      this.clinkRing.position.set(p.x, 0.08, p.z);
      this.clinkRing.material.opacity = Math.max(0, 0.85 - age * 0.7);
      const s = 1 + age * 1.6;
      this.clinkRing.scale.set(s, s, 1);
    } else if (this.clinkRing) {
      this.clinkRing.material.opacity = 0;
    }
    // Footstep noise ring around the moving thief.
    if (state.thief && this.noiseRing) {
      const p = to3(state.thief.x, state.thief.y);
      const r = state.thief.noiseRadius;
      if (r > 0) {
        this.noiseRing.position.set(p.x, 0.08, p.z);
        const s = r / S;
        this.noiseRing.scale.set(s, s, 1);
        this.noiseRing.material.opacity = state.thief.sneaking ? 0.16 : 0.28;
      } else {
        this.noiseRing.material.opacity = 0;
      }
    }
    // Exit glow: red shut, green open, flashing red in lockdown.
    if (this.exitGlow && this.exitLight) {
      const open = state.exitOpen && state.alarm.lockdown <= 0;
      const lockdown = state.alarm.lockdown > 0;
      const col = lockdown ? 0xff2222 : open ? 0x3dff7a : 0xff4444;
      const pulse = lockdown ? 0.35 + Math.sin(time * 8) * 0.2 : open ? 0.4 : 0.22;
      this.exitGlow.material.color.setHex(col);
      this.exitGlow.material.opacity = pulse;
      this.exitLight.color.setHex(col);
      this.exitLight.intensity = lockdown ? 8 + Math.sin(time * 8) * 4 : open ? 7 : 5;
    }
    if (this.alarmLight) {
      this.alarmLight.intensity = state.alarm.lockdown > 0 ? 10 + Math.sin(time * 8) * 5 : 0;
    }
    // Chandelier bulbs flicker gently.
    for (let i = 0; i < this.chandeliers.length; i++) {
      this.chandeliers[i].material.emissiveIntensity = 2.0 + Math.sin(time * 3 + i * 1.7) * 0.3;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
