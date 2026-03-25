// Procedural environment — floor, sky dome, time-of-day lighting, props
// Only active in fullwindow/fullscreen modes
//
// Sapphire's model is ~2.3 units tall. Furniture scaled to match.
// Layout: open floor plan, props spread around her in a loose circle
//   - Fireplace area (back-left)
//   - Couch + coffee table facing fireplace (center-left)
//   - Minibar (left wall)
//   - Lake window (back center, the focal point)
//   - Reading nook chairs (front of window)
//   - Bed (far right, private corner)

// Time-of-day color palettes (hour 0-23 mapped to key hours, lerp between)
const TIME_PALETTE = [
    // [hour, skyTop, skyBottom, sunColor, sunIntensity, ambientIntensity, ambientColor]
    [0,  '#060610', '#0a0a18', '#223355', 0.15, 0.25, '#151525'],  // deep night
    [4,  '#0d0818', '#1a1030', '#332244', 0.2, 0.28, '#1a1530'],   // predawn
    [5,  '#1a1030', '#2d1b4e', '#553366', 0.3, 0.35, '#2a1a3a'],   // early dawn
    [6,  '#4a2040', '#ff8855', '#ffaa66', 0.7, 0.5, '#4a3030'],    // dawn
    [7,  '#5577bb', '#ffcc88', '#ffddaa', 1.0, 0.6, '#555555'],    // sunrise
    [9,  '#4488cc', '#88bbee', '#ffffff', 1.2, 0.7, '#666666'],    // morning
    [12, '#3377cc', '#66aadd', '#ffffee', 1.3, 0.7, '#666666'],    // noon
    [15, '#4488bb', '#77aacc', '#fff8ee', 1.15, 0.65, '#606055'],  // afternoon
    [17, '#5577aa', '#ffbb77', '#ffcc88', 1.0, 0.6, '#555544'],    // late afternoon
    [18, '#553355', '#ff7744', '#ff9966', 0.7, 0.5, '#443333'],    // sunset
    [19, '#1a1030', '#443355', '#554466', 0.4, 0.35, '#2a1a3a'],   // dusk
    [21, '#0d0d1a', '#111122', '#334466', 0.2, 0.3, '#1a1a3a'],    // night
];

function lerpColor(hex1, hex2, t) {
    const r1 = parseInt(hex1.slice(1,3), 16), g1 = parseInt(hex1.slice(3,5), 16), b1 = parseInt(hex1.slice(5,7), 16);
    const r2 = parseInt(hex2.slice(1,3), 16), g2 = parseInt(hex2.slice(3,5), 16), b2 = parseInt(hex2.slice(5,7), 16);
    const r = Math.round(r1 + (r2-r1)*t), g = Math.round(g1 + (g2-g1)*t), b = Math.round(b1 + (b2-b1)*t);
    return (r << 16) | (g << 8) | b;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function getTimeOfDay() {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
}

function samplePalette(hour) {
    let lo = TIME_PALETTE[TIME_PALETTE.length - 1];
    let hi = TIME_PALETTE[0];
    for (let i = 0; i < TIME_PALETTE.length; i++) {
        if (TIME_PALETTE[i][0] <= hour) lo = TIME_PALETTE[i];
        if (TIME_PALETTE[i][0] > hour) { hi = TIME_PALETTE[i]; break; }
        if (i === TIME_PALETTE.length - 1) hi = TIME_PALETTE[0];
    }
    const range = hi[0] > lo[0] ? hi[0] - lo[0] : (24 - lo[0] + hi[0]);
    const t = range > 0 ? ((hour - lo[0] + 24) % 24) / range : 0;
    return {
        skyTop:    lerpColor(lo[1], hi[1], t),
        skyBottom: lerpColor(lo[2], hi[2], t),
        sunColor:  lerpColor(lo[3], hi[3], t),
        sunIntensity:     lerp(lo[4], hi[4], t),
        ambientIntensity: lerp(lo[5], hi[5], t),
        ambientColor:     lerpColor(lo[6], hi[6], t),
        sunAngle: (hour / 24) * Math.PI * 2 - Math.PI / 2,
    };
}

// Helper: box with shadow
function box(THREE, w, h, d, color, roughness = 0.85) {
    const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness })
    );
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

function cyl(THREE, rTop, rBot, h, segs, color, roughness = 0.8) {
    const m = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBot, h, segs),
        new THREE.MeshStandardMaterial({ color, roughness })
    );
    m.castShadow = true;
    return m;
}

export function createEnvironment(scene, THREE, renderer) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    // --- Enable shadows ---
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- Infinite floor (shader: fades to void at edges) ---
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.ShaderMaterial({
        uniforms: {
            floorColor: { value: new THREE.Color(0x1a1a2a) },
            fadeStart:   { value: 12.0 },
            fadeEnd:     { value: 40.0 },
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPos;
            void main() {
                vUv = uv;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform vec3 floorColor;
            uniform float fadeStart;
            uniform float fadeEnd;
            varying vec3 vWorldPos;
            void main() {
                float dist = length(vWorldPos.xz);
                float alpha = 1.0 - smoothstep(fadeStart, fadeEnd, dist);
                // Subtle grid pattern
                float gridX = abs(fract(vWorldPos.x * 0.5) - 0.5);
                float gridZ = abs(fract(vWorldPos.z * 0.5) - 0.5);
                float grid = 1.0 - smoothstep(0.47, 0.5, min(gridX, gridZ));
                vec3 col = floorColor + vec3(grid * 0.04);
                gl_FragColor = vec4(col, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    group.add(floor);

    // Shadow-receiving opaque floor underneath (for shadow mapping — shader floors don't receive)
    const shadowFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.ShadowMaterial({ opacity: 0.3 })
    );
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -0.01;
    shadowFloor.receiveShadow = true;
    group.add(shadowFloor);

    // --- Sapphire glow ring (subtle circle on the floor around center) ---
    const ringGeo = new THREE.RingGeometry(2.5, 2.7, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x4a9eff, transparent: true, opacity: 0.12, side: THREE.DoubleSide
    });
    const glowRing = new THREE.Mesh(ringGeo, ringMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.01;
    group.add(glowRing);

    // --- Sky dome ---
    const skyGeo = new THREE.SphereGeometry(80, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            topColor:    { value: new THREE.Color(0x0a0a1a) },
            bottomColor: { value: new THREE.Color(0x0d1117) },
        },
        vertexShader: `
            varying vec3 vWorldPos;
            void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            varying vec3 vWorldPos;
            void main() {
                float h = normalize(vWorldPos).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide,
        depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    group.add(skyDome);

    // --- Stars ---
    const starCount = 300;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.45;
        const r = 70;
        starPositions[i*3]     = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i*3 + 1] = r * Math.cos(phi);
        starPositions[i*3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.6 });
    const stars = new THREE.Points(starGeo, starMat);
    group.add(stars);

    // --- Sun/moon orb ---
    const sunGeo = new THREE.SphereGeometry(2, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0.6 });
    const sunOrb = new THREE.Mesh(sunGeo, sunMat);
    group.add(sunOrb);

    // --- Lighting ---
    const envSunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    envSunLight.castShadow = true;
    envSunLight.shadow.mapSize.set(2048, 2048);
    envSunLight.shadow.camera.near = 0.5;
    envSunLight.shadow.camera.far = 50;
    envSunLight.shadow.camera.left = -15;
    envSunLight.shadow.camera.right = 15;
    envSunLight.shadow.camera.top = 15;
    envSunLight.shadow.camera.bottom = -15;
    group.add(envSunLight);

    const envAmbient = new THREE.AmbientLight(0x666666, 0.7);
    group.add(envAmbient);

    // --- PROPS ---
    const props = new THREE.Group();
    group.add(props);

    // ═══ FIREPLACE (back-left, -6, 0, -8) ═══
    const fpX = -6, fpZ = -8;

    // Stone hearth
    const hearth = box(THREE, 2.8, 1.6, 1.0, 0x3a2a1a, 0.95);
    hearth.position.set(fpX, 0.8, fpZ);
    props.add(hearth);

    // Firebox opening (dark inset)
    const firebox = box(THREE, 1.8, 1.0, 0.3, 0x111111, 1.0);
    firebox.position.set(fpX, 0.7, fpZ + 0.4);
    props.add(firebox);

    // Mantel
    const mantel = box(THREE, 3.2, 0.12, 1.2, 0x4a3a28, 0.8);
    mantel.position.set(fpX, 1.64, fpZ);
    props.add(mantel);

    // Chimney column (rises up)
    const chimney = box(THREE, 2.0, 3.0, 0.8, 0x2a2020, 0.95);
    chimney.position.set(fpX, 3.1, fpZ - 0.1);
    props.add(chimney);

    // Fireplace glow
    const fireLight = new THREE.PointLight(0xff6622, 1.2, 10);
    fireLight.position.set(fpX, 0.8, fpZ + 0.8);
    props.add(fireLight);

    // Fire embers
    const emberCount = 40;
    const emberPositions = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
        emberPositions[i*3]     = fpX + (Math.random() - 0.5) * 1.2;
        emberPositions[i*3 + 1] = 0.4 + Math.random() * 0.8;
        emberPositions[i*3 + 2] = fpZ + 0.3 + (Math.random() - 0.5) * 0.4;
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
    const emberMat = new THREE.PointsMaterial({ color: 0xff4400, size: 0.1, transparent: true, opacity: 0.8 });
    props.add(new THREE.Points(emberGeo, emberMat));
    const _emberBase = new Float32Array(emberPositions);

    // Warm rug in front of fireplace
    const rug = new THREE.Mesh(
        new THREE.PlaneGeometry(3.5, 2.5),
        new THREE.MeshStandardMaterial({ color: 0x5a2a2a, roughness: 0.95 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(fpX, 0.02, fpZ + 3);
    rug.receiveShadow = true;
    props.add(rug);

    // ═══ COUCH (facing fireplace, angled) ═══
    const couchX = -5, couchZ = -3.5;

    const couchSeat = box(THREE, 3.2, 0.5, 1.3, 0x2a3a5a, 0.85);
    couchSeat.position.set(couchX, 0.4, couchZ);
    props.add(couchSeat);

    const couchBack = box(THREE, 3.2, 0.8, 0.2, 0x223355, 0.85);
    couchBack.position.set(couchX, 0.85, couchZ - 0.55);
    props.add(couchBack);

    for (const side of [-1, 1]) {
        const arm = box(THREE, 0.2, 0.6, 1.3, 0x223355, 0.85);
        arm.position.set(couchX + side * 1.6, 0.65, couchZ);
        props.add(arm);
    }

    // Coffee table in front of couch
    const coffeeTable = box(THREE, 1.6, 0.08, 0.8, 0x4a3a28, 0.75);
    coffeeTable.position.set(couchX, 0.55, couchZ + 1.5);
    props.add(coffeeTable);

    // Coffee table legs
    for (const lx of [-0.65, 0.65]) {
        for (const lz of [-0.3, 0.3]) {
            const leg = cyl(THREE, 0.03, 0.03, 0.55, 6, 0x3a2a1a);
            leg.position.set(couchX + lx, 0.27, couchZ + 1.5 + lz);
            props.add(leg);
        }
    }

    // Mug on coffee table
    const mug = cyl(THREE, 0.06, 0.05, 0.12, 12, 0x4a9eff, 0.5);
    mug.position.set(couchX + 0.3, 0.65, couchZ + 1.5);
    props.add(mug);

    // ═══ MINIBAR (left wall area, -10, 0, -2) ═══
    const barX = -10, barZ = -2;

    // Bar cabinet
    const barCabinet = box(THREE, 1.6, 1.4, 0.7, 0x3a2a1a, 0.85);
    barCabinet.position.set(barX, 0.7, barZ);
    props.add(barCabinet);

    // Bar top
    const barTop = box(THREE, 1.8, 0.06, 0.8, 0x4a3a28, 0.75);
    barTop.position.set(barX, 1.42, barZ);
    props.add(barTop);

    // Bottles
    const bottleColors = [0x338855, 0x885533, 0x4488aa, 0xaa5533, 0x336655];
    for (let i = 0; i < 5; i++) {
        const h = 0.3 + Math.random() * 0.15;
        const bottle = cyl(THREE, 0.05, 0.06, h, 8, bottleColors[i], 0.3);
        bottle.position.set(barX - 0.5 + i * 0.25, 1.45 + h/2, barZ);
        props.add(bottle);
    }

    // Snack bowl
    const bowl = cyl(THREE, 0.18, 0.12, 0.1, 16, 0x5a4a3a, 0.7);
    bowl.position.set(barX + 0.5, 1.50, barZ);
    props.add(bowl);

    // Bar stool
    const stoolSeat = cyl(THREE, 0.25, 0.25, 0.06, 16, 0x3a3030, 0.85);
    stoolSeat.position.set(barX, 0.95, barZ + 1.2);
    stoolSeat.castShadow = true;
    props.add(stoolSeat);
    const stoolPole = cyl(THREE, 0.04, 0.06, 0.95, 8, 0x444444, 0.5);
    stoolPole.position.set(barX, 0.47, barZ + 1.2);
    props.add(stoolPole);

    // ═══ LAKE WINDOW (back center, 0, 0, -10) ═══
    const winX = 0, winZ = -10;

    // Window frame — tall, wide, feels like a real view
    const windowFrame = box(THREE, 5.0, 3.5, 0.15, 0x2a2a2a, 0.8);
    windowFrame.position.set(winX, 2.0, winZ);
    props.add(windowFrame);

    // Window glass — emissive, reflects sky color
    const windowGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(4.6, 3.1),
        new THREE.MeshBasicMaterial({ color: 0x224466, transparent: true, opacity: 0.85 })
    );
    windowGlass.position.set(winX, 2.0, winZ + 0.08);
    props.add(windowGlass);

    // Window cross bars
    const crossH = box(THREE, 4.6, 0.06, 0.08, 0x333333, 0.8);
    crossH.position.set(winX, 2.0, winZ + 0.1);
    props.add(crossH);
    const crossV = box(THREE, 0.06, 3.1, 0.08, 0x333333, 0.8);
    crossV.position.set(winX, 2.0, winZ + 0.1);
    props.add(crossV);

    // Window light spill into the room
    const windowLight = new THREE.SpotLight(0x4477aa, 0.6, 14, Math.PI / 3.5);
    windowLight.position.set(winX, 3, winZ + 1);
    windowLight.target.position.set(winX, 0, winZ + 8);
    props.add(windowLight);
    props.add(windowLight.target);

    // ═══ READING NOOK — chairs facing window ═══
    for (const xOff of [-1.5, 1.5]) {
        // Chair seat
        const seat = box(THREE, 0.8, 0.08, 0.8, 0x4a3a28, 0.85);
        seat.position.set(winX + xOff, 0.65, winZ + 3.0);
        props.add(seat);
        // Chair back
        const back = box(THREE, 0.8, 0.8, 0.08, 0x4a3a28, 0.85);
        back.position.set(winX + xOff, 1.05, winZ + 2.62);
        props.add(back);
        // Legs
        for (const lx of [-0.3, 0.3]) {
            for (const lz of [-0.3, 0.3]) {
                const leg = cyl(THREE, 0.03, 0.03, 0.65, 6, 0x3a2a1a);
                leg.position.set(winX + xOff + lx, 0.32, winZ + 3.0 + lz);
                props.add(leg);
            }
        }
    }

    // Side table between chairs
    const readingTable = cyl(THREE, 0.35, 0.35, 0.06, 16, 0x3a2a1a, 0.75);
    readingTable.position.set(winX, 0.62, winZ + 3.0);
    readingTable.castShadow = true;
    props.add(readingTable);
    const readingTableLeg = cyl(THREE, 0.05, 0.08, 0.6, 8, 0x3a2a1a);
    readingTableLeg.position.set(winX, 0.3, winZ + 3.0);
    props.add(readingTableLeg);

    // Books stacked on the reading table
    const bookColors = [0x8a3030, 0x2a4a6a, 0x3a6a3a];
    for (let i = 0; i < 3; i++) {
        const book = box(THREE, 0.2, 0.04, 0.14, bookColors[i], 0.9);
        book.position.set(winX - 0.08, 0.67 + i * 0.04, winZ + 3.0);
        book.rotation.y = (i - 1) * 0.15;
        props.add(book);
    }

    // ═══ BED (far right corner, 8, 0, -8) ═══
    const bedX = 8, bedZ = -8;

    // Bed frame
    const bedFrame = box(THREE, 2.6, 0.5, 3.5, 0x3a2a20, 0.9);
    bedFrame.position.set(bedX, 0.25, bedZ);
    props.add(bedFrame);

    // Mattress
    const mattress = box(THREE, 2.3, 0.25, 3.2, 0x4a5577, 0.95);
    mattress.position.set(bedX, 0.62, bedZ);
    props.add(mattress);

    // Pillows
    for (const px of [-0.5, 0.5]) {
        const pillow = box(THREE, 0.7, 0.15, 0.45, 0x6677aa, 0.95);
        pillow.position.set(bedX + px, 0.82, bedZ - 1.2);
        props.add(pillow);
    }

    // Headboard
    const headboard = box(THREE, 2.6, 1.2, 0.12, 0x3a2a20, 0.9);
    headboard.position.set(bedX, 1.1, bedZ - 1.8);
    props.add(headboard);

    // Blanket (slightly draped — angled box)
    const blanket = box(THREE, 2.2, 0.06, 1.8, 0x3a4a6a, 0.95);
    blanket.position.set(bedX, 0.78, bedZ + 0.5);
    blanket.rotation.x = 0.05;
    props.add(blanket);

    // Bedside table
    const nightstand = box(THREE, 0.6, 0.65, 0.5, 0x3a2a20, 0.85);
    nightstand.position.set(bedX + 1.8, 0.32, bedZ - 1.0);
    nightstand.castShadow = true;
    props.add(nightstand);

    // Lamp on nightstand
    const lampBase = cyl(THREE, 0.08, 0.1, 0.04, 12, 0x444444, 0.5);
    lampBase.position.set(bedX + 1.8, 0.67, bedZ - 1.0);
    props.add(lampBase);
    const lampPole = cyl(THREE, 0.02, 0.02, 0.35, 6, 0x555555, 0.5);
    lampPole.position.set(bedX + 1.8, 0.85, bedZ - 1.0);
    props.add(lampPole);
    const lampShade = cyl(THREE, 0.15, 0.1, 0.18, 12, 0xddc088, 0.9);
    lampShade.position.set(bedX + 1.8, 1.1, bedZ - 1.0);
    props.add(lampShade);

    // Warm bedside light
    const bedLight = new THREE.PointLight(0xffaa55, 0.3, 5);
    bedLight.position.set(bedX + 1.8, 1.2, bedZ - 1.0);
    props.add(bedLight);

    // ═══ DUST MOTES (floating particles in window light) ═══
    const dustCount = 60;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
        dustPositions[i*3]     = winX + (Math.random() - 0.5) * 6;
        dustPositions[i*3 + 1] = 0.5 + Math.random() * 3;
        dustPositions[i*3 + 2] = winZ + 2 + Math.random() * 8;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
        color: 0xffffff, size: 0.04, transparent: true, opacity: 0.25
    });
    const dustMotes = new THREE.Points(dustGeo, dustMat);
    group.add(dustMotes);

    // ═══ GLOW RING pulse state ═══
    let _ringPhase = 0;

    // ═══ UPDATE ═══
    let _lastTimeUpdate = 0;
    let _time = 0;

    function update(delta) {
        if (!group.visible) return;
        _time += delta;

        // Time-of-day every 30s
        const now = performance.now();
        if (now - _lastTimeUpdate > 30000 || _lastTimeUpdate === 0) {
            _lastTimeUpdate = now;
            applyTimeOfDay();
        }

        // Embers float + flicker
        const ePos = emberGeo.attributes.position.array;
        for (let i = 0; i < emberCount; i++) {
            ePos[i*3 + 1] += delta * (0.15 + Math.random() * 0.2);
            ePos[i*3]     += (Math.random() - 0.5) * delta * 0.15;
            if (ePos[i*3 + 1] > 2.0) {
                ePos[i*3]     = _emberBase[i*3] + (Math.random() - 0.5) * 0.5;
                ePos[i*3 + 1] = _emberBase[i*3 + 1];
                ePos[i*3 + 2] = _emberBase[i*3 + 2];
            }
        }
        emberGeo.attributes.position.needsUpdate = true;

        // Fire flicker
        fireLight.intensity = 0.8 + Math.sin(_time * 8) * 0.2 + Math.random() * 0.3;

        // Dust motes drift (very slow)
        const dPos = dustGeo.attributes.position.array;
        for (let i = 0; i < dustCount; i++) {
            dPos[i*3]     += Math.sin(_time * 0.3 + i) * delta * 0.05;
            dPos[i*3 + 1] += Math.sin(_time * 0.2 + i * 0.7) * delta * 0.03;
            dPos[i*3 + 2] += Math.cos(_time * 0.25 + i * 0.5) * delta * 0.04;
        }
        dustGeo.attributes.position.needsUpdate = true;

        // Glow ring gentle pulse
        _ringPhase += delta * 0.5;
        ringMat.opacity = 0.08 + Math.sin(_ringPhase) * 0.04;
    }

    function applyTimeOfDay() {
        const hour = getTimeOfDay();
        const p = samplePalette(hour);

        skyMat.uniforms.topColor.value.setHex(p.skyTop);
        skyMat.uniforms.bottomColor.value.setHex(p.skyBottom);

        envSunLight.color.setHex(p.sunColor);
        envSunLight.intensity = p.sunIntensity;

        envAmbient.color.setHex(p.ambientColor);
        envAmbient.intensity = p.ambientIntensity;

        // Sun arc
        const sunDist = 55;
        sunOrb.position.set(
            Math.cos(p.sunAngle) * sunDist,
            Math.sin(p.sunAngle) * sunDist * 0.6 + 8,
            -20
        );
        sunOrb.material.color.setHex(p.sunColor);
        sunOrb.material.opacity = Math.max(0, Math.sin(p.sunAngle) * 0.8);
        sunOrb.visible = sunOrb.material.opacity > 0.05;

        envSunLight.position.copy(sunOrb.position);

        // Stars
        const nightFactor = Math.max(0, 1 - p.sunIntensity / 0.8);
        starMat.opacity = nightFactor * 0.6;
        stars.visible = nightFactor > 0.05;

        // Window glass shifts with sky
        windowGlass.material.color.setHex(p.skyBottom);

        // Dust visibility (brighter in daytime)
        dustMat.opacity = 0.1 + p.sunIntensity * 0.15;

        // Floor color follows ambient
        const fb = 0.1 + p.ambientIntensity * 0.12;
        floorMat.uniforms.floorColor.value.setRGB(fb, fb, fb * 1.15);
    }

    function setVisible(visible) {
        group.visible = visible;
        if (visible) {
            _lastTimeUpdate = 0;
            applyTimeOfDay();
        }
    }

    function enableAvatarShadows(model) {
        model.traverse(child => {
            if (child.isMesh) child.castShadow = true;
        });
    }

    return { update, setVisible, enableAvatarShadows, group };
}
