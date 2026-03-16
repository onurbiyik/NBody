(function (window) {
    "use strict";

    // ── Three.js scene setup ────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020209);

    const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("canvas"),
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const threeCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100000);
    threeCamera.position.set(200, 350, 700);
    threeCamera.lookAt(0, 0, 0);

    const orbitControls = new THREE.OrbitControls(threeCamera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.minDistance = 5;
    orbitControls.maxDistance = 50000;

    // Lighting: dim ambient + point light that follows the sun
    scene.add(new THREE.AmbientLight(0x112233, 2));
    const sunLight = new THREE.PointLight(0xffffff, 3, 8000, 1);
    scene.add(sunLight);

    // Stars
    const starPos = new Float32Array(3000 * 3);
    for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 80000;
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 6 })));

    // Reference grid in the XZ plane
    scene.add(new THREE.GridHelper(2000, 20, 0x333333, 0x1a1a2e));

    // ── Game namespace ──────────────────────────────────────────────────────
    const Game = { particles: [] };
    window.Game = Game;

    // ── 3D Vector ───────────────────────────────────────────────────────────
    class Vector {
        constructor(x, y, z) {
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
        }

        reset() { this.x = 0; this.y = 0; this.z = 0; }
        mul(s)  { return new Vector(this.x * s, this.y * s, this.z * s); }
        div(s)  { return new Vector(this.x / s, this.y / s, this.z / s); }
        add(v)  { return new Vector(this.x + v.x, this.y + v.y, this.z + v.z); }
        sub(v)  { return new Vector(this.x - v.x, this.y - v.y, this.z - v.z); }
        dot(v)  { return this.x * v.x + this.y * v.y + this.z * v.z; }
        length()   { return Math.sqrt(this.dot(this)); }
        lengthSq() { return this.dot(this); }
        normalize() { return this.div(this.length()); }
    }
    Game.Vector = Vector;

    // ── Circle (body) ───────────────────────────────────────────────────────
    const MAX_TRAILS = 300;

    const randomColor = () => {
        const c = new THREE.Color();
        c.setHSL(Math.random(), 0.8, 0.6);
        return c.getHex();
    };

    class Circle {
        constructor(location, velocity, radius) {
            this.location = location;
            this.radius   = radius;
            this.mass     = 4 / 3 * Math.PI * radius * radius * radius;
            this.v        = velocity;
            this.a        = new Vector();
            this.trails   = [];

            const colorHex = randomColor();

            // Sphere mesh
            const mat = new THREE.MeshPhongMaterial({
                color: colorHex,
                emissive: colorHex,
                emissiveIntensity: 0.25,
                shininess: 60
            });
            this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), mat);
            this.mesh.position.set(location.x, location.y, location.z);
            scene.add(this.mesh);

            // Trail line (pre-allocated buffer)
            this.trailBuffer = new Float32Array(MAX_TRAILS * 3);
            this.trailGeo    = new THREE.BufferGeometry();
            this.trailGeo.setAttribute("position", new THREE.BufferAttribute(this.trailBuffer, 3));
            this.trailGeo.setDrawRange(0, 0);
            this.trailLine = new THREE.Line(
                this.trailGeo,
                new THREE.LineBasicMaterial({ color: colorHex, opacity: 0.55, transparent: true })
            );
            scene.add(this.trailLine);
        }

        remove() {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            scene.remove(this.trailLine);
            this.trailGeo.dispose();
        }

        syncMesh() {
            this.mesh.position.set(this.location.x, this.location.y, this.location.z);
        }

        syncTrail() {
            const count = Math.min(this.trails.length, MAX_TRAILS);
            for (let i = 0; i < count; i++) {
                const t = this.trails[i];
                this.trailBuffer[i * 3]     = t.x;
                this.trailBuffer[i * 3 + 1] = t.y;
                this.trailBuffer[i * 3 + 2] = t.z;
            }
            this.trailGeo.setDrawRange(0, count);
            this.trailGeo.attributes.position.needsUpdate = true;
        }
    }
    Game.Circle = Circle;

    // ── Physics ─────────────────────────────────────────────────────────────
    Game.physics = (function () {

        const checkCollision = (a, b) => {
            const r = a.radius + b.radius;
            return a.location.sub(b.location).lengthSq() < r * r;
        };

        const resolveCollision = (p1, p2) => {
            const n  = p1.location.sub(p2.location).normalize();
            const dv = p2.v.sub(p1.v);
            const dot = n.dot(dv);
            const totalMass = p1.mass + p2.mass;
            const imp = n.mul(2 * dot / totalMass);
            p1.v = p1.v.add(imp.mul(p2.mass));
            p2.v = p2.v.sub(imp.mul(p1.mass));
        };

        const hitTest = (loc) => {
            for (const p of Game.particles) {
                if (p.location.sub(loc).length() < p.radius) return p;
            }
            return null;
        };

        const doCollisions = () => {
            for (let i = 0; i < Game.particles.length; i++) {
                for (let j = 0; j < i; j++) {
                    if (checkCollision(Game.particles[i], Game.particles[j]))
                        resolveCollision(Game.particles[i], Game.particles[j]);
                }
            }
        };

        const computeForces = () => {
            const G = 0.1;
            for (let i = 0; i < Game.particles.length; i++) {
                Game.particles[i].a.reset();
                for (let j = 0; j < i; j++) {
                    const pi = Game.particles[i], pj = Game.particles[j];
                    const d    = pi.location.sub(pj.location);
                    const norm = Math.sqrt(100.0 + d.lengthSq());
                    const mag  = G / (norm * norm * norm);
                    pi.a = pi.a.sub(d.mul(mag * pj.mass));
                    pj.a = pj.a.add(d.mul(mag * pi.mass));
                }
            }
        };

        const doPhysics = (dt) => {
            for (const p of Game.particles) p.location = p.location.add(p.v.mul(0.5 * dt));
            computeForces();
            for (const p of Game.particles) p.v = p.v.add(p.a.mul(dt));
            for (const p of Game.particles) p.location = p.location.add(p.v.mul(0.5 * dt));
            doCollisions();
        };

        const computeCenterOfGravity = () => {
            let cog = new Vector(), totalMass = 0;
            for (const p of Game.particles) {
                cog = cog.add(p.location.mul(p.mass));
                totalMass += p.mass;
            }
            return totalMass > 0 ? cog.div(totalMass) : cog;
        };

        return { doPhysics, hitTest, computeCenterOfGravity };
    })();

    // ── Controls ─────────────────────────────────────────────────────────────
    Game.controls = { pause: false, lockToCenter: false, reset: false };

    window.addEventListener("keyup", (e) => {
        switch (e.keyCode) {
            case 80:  Game.controls.pause = !Game.controls.pause; break;         // P
            case 76:  Game.controls.lockToCenter = !Game.controls.lockToCenter; break; // L
            case 82:  Game.controls.reset = true; break;                         // R
            case 219: Game.engine.timeMultiplier /= 2; break;                    // [
            case 221: Game.engine.timeMultiplier *= 2; break;                    // ]
        }
    });

    // Click on the XZ plane to spawn a body
    const raycaster  = new THREE.Raycaster();
    const spawnPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let mouseDownTime = 0, mouseDownPos = { x: 0, y: 0 };

    renderer.domElement.addEventListener("mousedown", (e) => {
        mouseDownTime = performance.now();
        mouseDownPos  = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener("mouseup", (e) => {
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return; // orbit drag, not click

        const ndc = new THREE.Vector2(
            (e.clientX / window.innerWidth)  *  2 - 1,
            (e.clientY / window.innerHeight) * -2 + 1
        );
        raycaster.setFromCamera(ndc, threeCamera);
        const hit = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(spawnPlane, hit)) return;

        const duration = performance.now() - mouseDownTime;
        const radius   = Math.max(1, duration / 50 + 2);
        Game.particles.push(new Circle(new Vector(hit.x, 0, hit.z), new Vector(), radius));
    });

    window.addEventListener("resize", () => {
        threeCamera.aspect = window.innerWidth / window.innerHeight;
        threeCamera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ── HUD ──────────────────────────────────────────────────────────────────
    const hud = document.createElement("div");
    hud.style.cssText = "position:fixed;top:5px;left:5px;color:#667;font:13px monospace;pointer-events:none;";
    document.body.appendChild(hud);

    let fpsCount = 0, fpsDisplay = 0, fpsLastTime = performance.now();
    const updateHUD = () => {
        fpsCount++;
        const now = performance.now();
        if (now - fpsLastTime >= 1000) {
            fpsDisplay  = fpsCount;
            fpsCount    = 0;
            fpsLastTime = now;
        }
        hud.textContent = `${fpsDisplay} fps | ${Game.engine.timeMultiplier}x | ${Game.particles.length} bodies`;
    };

    // ── Game engine ──────────────────────────────────────────────────────────
    Game.engine = (function () {
        const engine = { play, timeMultiplier: 1 };

        const addTrail = (p) => {
            p.trails.push(new Vector(p.location.x, p.location.y, p.location.z));
            if (p.trails.length > MAX_TRAILS) p.trails.shift();
        };

        // Orbital speed formula: v = sqrt(G * M_sun / r), G=0.1, M_sun≈17157
        // r=250 → v≈2.62  r=180 → v≈3.09  r=160 → v≈3.27
        const addInitialParticles = () => {
            // Sun – glowing yellow, emits light
            const sun = new Circle(new Vector(0, 0, 0), new Vector(0, 0, 0), 16);
            sun.mesh.material.color.setHex(0xffdd44);
            sun.mesh.material.emissive.setHex(0xffdd44);
            sun.mesh.material.emissiveIntensity = 2.0;

            // Earth – orbits in the XZ plane (the reference grid plane)
            const earth = new Circle(new Vector(250, 0, 0), new Vector(0, 0, 2.62), 4);
            earth.mesh.material.color.setHex(0x4477ff);
            earth.mesh.material.emissive.setHex(0x223388);

            // Moon – close to Earth, same orbital plane
            const moon = new Circle(new Vector(267, 0, 0), new Vector(0, 0, 3.6), 1);
            moon.mesh.material.color.setHex(0x888888);
            moon.mesh.material.emissive.setHex(0x444444);

            // Venus – orbits in XZ plane but opposite side
            const venus = new Circle(new Vector(-180, 0, 0), new Vector(0, 0, -3.09), 3);
            venus.mesh.material.color.setHex(0xff8844);
            venus.mesh.material.emissive.setHex(0x993300);

            // Mars – starts above the grid, orbits in the XY plane (tilted 90° from others)
            const mars = new Circle(new Vector(0, 160, 0), new Vector(3.27, 0, 0), 2.5);
            mars.mesh.material.color.setHex(0xff3322);
            mars.mesh.material.emissive.setHex(0x881100);

            Game.particles.push(sun, earth, moon, venus, mars);
        };

        const reset = () => {
            for (const p of Game.particles) p.remove();
            Game.particles = [];
            Game.controls.reset = false;
            addInitialParticles();
        };

        const updatePhysics = () => {
            if (Game.controls.pause) return;
            if (engine.timeMultiplier < 1 / 32) engine.timeMultiplier = 1 / 32;
            if (engine.timeMultiplier > 32)      engine.timeMultiplier = 32;
            const physicsPerFrame = 8;
            for (let k = 0; k < physicsPerFrame * engine.timeMultiplier; k++) {
                Game.physics.doPhysics(1.0 / physicsPerFrame);
                for (const p of Game.particles) addTrail(p);
            }
        };

        const updateGraphics = () => {
            if (Game.controls.reset) reset();

            if (Game.controls.lockToCenter && Game.particles.length > 0) {
                const cog = Game.physics.computeCenterOfGravity();
                orbitControls.target.set(cog.x, cog.y, cog.z);
            }

            for (const p of Game.particles) {
                p.syncMesh();
                p.syncTrail();
            }

            // Point light tracks the sun
            if (Game.particles.length > 0) {
                const s = Game.particles[0].location;
                sunLight.position.set(s.x, s.y, s.z);
            }

            updateHUD();
            orbitControls.update();
            renderer.render(scene, threeCamera);
            requestAnimationFrame(updateGraphics);
        };

        function play() {
            addInitialParticles();
            setInterval(updatePhysics, 1000 / 60);
            updateGraphics();
        }

        return engine;
    })();

    window.onload = () => Game.engine.play();

})(window);
