(function (window) {
    "use strict";

    const Game = {
        canvas: window.document.getElementById("canvas"),
        particles: []
    };
    window.Game = Game;


    class Vector {
        constructor(x, y) {
            this.x = x || 0;
            this.y = y || 0;
        }

        reset() {
            this.x = 0;
            this.y = 0;
        }

        mul(mul) {
            return new Vector(this.x * mul, this.y * mul);
        }

        div(div) {
            return new Vector(this.x / div, this.y / div);
        }

        add(add) {
            return new Vector(this.x + add.x, this.y + add.y);
        }

        sub(sub) {
            return new Vector(this.x - sub.x, this.y - sub.y);
        }

        dot(v) {
            return (this.x * v.x + this.y * v.y);
        }

        length() {
            return Math.sqrt(this.dot(this));
        }

        lengthSq() {
            return this.dot(this);
        }

        normalize() {
            return this.div(this.length());
        }
    }
    Game.Vector = Vector;

    // CIRCLE
    const randomColor = () => {
        const max = 14;   // to prevent too light colors on a white background. out of 16.
        const r = Math.floor(Math.random() * max);
        const g = Math.floor(Math.random() * max);
        const b = Math.floor(Math.random() * max);
        return '#' + r.toString(16) + g.toString(16) + b.toString(16);
    }

    class Circle {
        constructor(location, velocity, radius) {
            this.location = location;
            this.radius = radius;
            this.mass = 4 / 3 * Math.PI * radius * radius * radius; // sphere volume
            this.v = velocity;
            this.a = new Game.Vector();
            this.color = randomColor();
            this.trails = [];
        }
    }
    Game.Circle = Circle;


    // PHYSICS
    Game.physics = (function () {

        const checkCollision = (a, b) => {
            const dist = a.location.sub(b.location);
            const totalRad = a.radius + b.radius;
            return (dist.lengthSq() < totalRad);
        };

        const resolveCollision = (p1, p2) => {
            const displacement = p1.location.sub(p2.location);
            const normalized = displacement.normalize();
            const v = p2.v.sub(p1.v);
            const dot = normalized.dot(v);
            const totalMass = p1.mass + p2.mass;
            const c = normalized.mul(2 * dot / totalMass);
            p1.v = p1.v.add(c.mul(p2.mass));
            p2.v = p2.v.sub(c.mul(p1.mass));
        };

        const hitTest = (loc) => {
            for (let i = 0; i < Game.particles.length; i++) {
                const p = Game.particles[i];
                const diff = p.location.sub(loc);
                if (diff.length() < p.radius)
                    return p;
            }
            return null;
        };

        const doCollisions = () => {
            for (let i = 0; i < Game.particles.length; i++) {
                const p1 = Game.particles[i];
                for (let j = 0; j < i; j++) {
                    const p2 = Game.particles[j];
                    if (checkCollision(p1, p2)) {
                        resolveCollision(p1, p2);
                    }
                }
            }
        };

        const computeForces = () => {
            const GRAVITATIONAL_CONSTANT = 0.1;
            for (let i = 0; i < Game.particles.length; i++) {
                const p = Game.particles[i];
                p.a.reset();
                for (let j = 0; j < i; j++) {
                    const p2 = Game.particles[j];
                    const distance = p.location.sub(p2.location);
                    const norm = Math.sqrt(100.0 + distance.lengthSq());
                    const mag = GRAVITATIONAL_CONSTANT / (norm * norm * norm);
                    const jerkP = distance.mul(mag * p2.mass);
                    const jerkP2 = distance.mul(mag * p.mass);
                    p.a = p.a.sub(jerkP);
                    p2.a = p2.a.add(jerkP2);
                }
            }
        };

        const moveParticles = (dt) => {
            for (let i = 0; i < Game.particles.length; i++) {
                let p = Game.particles[i];
                p.location = p.location.add(p.v.mul(dt));
            }
        }

        const applyForces = (dt) => {
            for (let i = 0; i < Game.particles.length; i++) {
                let p = Game.particles[i];
                p.v = p.v.add(p.a.mul(dt));
            }
        }

        const doPhysics = (dt) => {
            moveParticles(0.5 * dt);
            computeForces();
            applyForces(dt);
            moveParticles(0.5 * dt);
            doCollisions();
        }

        const computeCenterOfGravity = () => {
            let result = new Game.Vector();
            let totalMass = 0.0;
            for (let i = 0; i < Game.particles.length; i++) {
                const p = Game.particles[i];
                result = result.add(p.location.mul(p.mass));
                totalMass += p.mass;
            }
            return result.div(totalMass);
        }

        return {
            doPhysics,
            hitTest,
            computeCenterOfGravity
        };
    })();


    // CAMERA
    Game.camera = (function () {
        let loc = new Game.Vector(0, 0);
        let zoom = 1;

        const screenLocToCanvasLoc = (loc) => {
            let canvasLoc = loc;
            canvasLoc = loc.div(Game.camera.zoom)
            canvasLoc = canvasLoc.add(Game.camera.loc);
            return canvasLoc;
        }

        const zoomIn = (loc) => {
            if (Game.camera.zoom > 10) return;
            zoomInternal(loc, false);
        };

        const zoomOut = (loc) => {
            if (Game.camera.zoom < 0.1) return;
            zoomInternal(loc, true);
        };

        const zoomInternal = (loc, reverse) => {
            const ZOOM_RATE = 1.2;
            const oldZoom = Game.camera.zoom;
            let newZoom = reverse ? oldZoom / ZOOM_RATE : oldZoom * ZOOM_RATE;
            const oldLoc = Game.camera.loc;
            const locDiff = loc.div(oldZoom).sub(loc.div(newZoom));
            const newLoc = oldLoc.add(locDiff);
            Game.camera.loc = newLoc;
            Game.camera.zoom = newZoom;
        };

        const moveCamera = () => {
            if (Game.controls.lockToCenter) {
                moveCameraWithCenterOfGravity();
            } else {
                moveCameraWithArrows();
            }
        }

        const moveCameraWithCenterOfGravity = () => {
            const cog = Game.physics.computeCenterOfGravity();
            const screenCenter = new Game.Vector(Game.canvas.width / 2, Game.canvas.height / 2).div(Game.camera.zoom);
            const newCamLoc = cog.sub(screenCenter);
            const diff = newCamLoc.sub(Game.camera.loc).div(10);
            Game.camera.loc = Game.camera.loc.add(diff);
        }

        const moveCameraWithArrows = () => {
            const speed = 400;
            const step = (1000 / 60) / 1000;
            if (Game.controls.left) Game.camera.loc.x -= speed * step;
            if (Game.controls.up) Game.camera.loc.y -= speed * step;
            if (Game.controls.right) Game.camera.loc.x += speed * step;
            if (Game.controls.down) Game.camera.loc.y += speed * step;
        }

        const isParticleInView = (p) => {
            const canvas = Game.canvas;
            const zoom = Game.camera.zoom;
            const loc = Game.camera.loc;

            const viewLeft = loc.x;
            const viewRight = loc.x + canvas.width / zoom;
            const viewTop = loc.y;
            const viewBottom = loc.y + canvas.height / zoom;

            const particleLeft = p.location.x - p.radius;
            const particleRight = p.location.x + p.radius;
            const particleTop = p.location.y - p.radius;
            const particleBottom = p.location.y + p.radius;

            return particleRight >= viewLeft && particleLeft <= viewRight &&
                   particleBottom >= viewTop && particleTop <= viewBottom;
        }

        return {
            loc,
            zoom,
            zoomIn,
            zoomOut,
            screenLocToCanvasLoc,
            moveCamera,
            isParticleInView
        };
    })();


    // RENDERING
    Game.rendering = (function () {
        let fps, fpsLast, fpslastUpdated;

        const renderGrid = (ctx) => {
            const gridSize = 100;
            const gridHeight = Game.canvas.height / Game.camera.zoom;
            const gridWidth = Game.canvas.width / Game.camera.zoom;
            ctx.beginPath();
            const cameraXPan = Game.camera.loc.x % gridSize;
            const cameraYPan = Game.camera.loc.y % gridSize;
            for (let i = -cameraXPan; i <= gridWidth; i += gridSize) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i, gridHeight);
            }
            for (let i = -cameraYPan; i <= gridHeight; i += gridSize) {
                ctx.moveTo(0, i);
                ctx.lineTo(gridWidth, i);
            }
            ctx.lineWidth = 0.1;
            ctx.strokeStyle = "#555";
            ctx.stroke();
        }

        const renderParticleTrails = (ctx, p) => {
            const TRAILS_IN_PATH = 5;
            for (let i = p.trails.length - 1; i >= 0; i -= TRAILS_IN_PATH) {
                if (!p.trails[i]) continue;
                ctx.beginPath();
                ctx.moveTo(p.trails[i].x, p.trails[i].y);
                for (let j = i - 1; j >= Math.max(i - TRAILS_IN_PATH, 0); j--) {
                    let trailLoc = p.trails[j];
                    if (trailLoc) ctx.lineTo(trailLoc.x, trailLoc.y);
                }
                const opacity = i / p.trails.length / 5;
                ctx.lineWidth = 3;
                ctx.strokeStyle = p.color;
                ctx.globalAlpha = opacity;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        const renderParticle = (ctx, p) => {
            ctx.beginPath();
            ctx.arc(p.location.x, p.location.y, p.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = p.color;
            ctx.fill();
        }

        const renderParticles = (ctx) => {
            for (let i = 0; i < Game.particles.length; i++) {
                const p = Game.particles[i];
                if (Game.camera.isParticleInView(p)) {
                    renderParticleTrails(ctx, p);
                }
            }
            for (let i = 0; i < Game.particles.length; i++) {
                const p = Game.particles[i];
                if (Game.camera.isParticleInView(p)) {
                    renderParticle(ctx, p);
                }
            }
        }

        const renderParticleVectors = (ctx) => {
            for (let i = 0; i < Game.particles.length; i++) {
                const p = Game.particles[i];
                ctx.setLineDash([3, 7]);
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.moveTo(p.location.x, p.location.y);
                ctx.lineTo(p.location.x + p.a.x * 200, p.location.y + p.a.y * 200);
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(p.location.x, p.location.y);
                ctx.lineTo(p.location.x + p.v.x * 5, p.location.y + p.v.y * 5);
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        const renderDebugInfo = (ctx) => {
            renderParticleVectors(ctx)
            if (!fpslastUpdated || window.performance.now() - fpslastUpdated >= 1000) {
                fpsLast = fps;
                fpslastUpdated = window.performance.now();
                fps = 0;
            }
            fps++;
            if (fpsLast) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.font = "14px monospace";
                ctx.fillStyle = "#555";
                ctx.fillText(fpsLast + ' fps', 5, 15);
                ctx.fillText(Game.engine.timeMultiplier + 'x speed', 5, 30);
                ctx.restore();
            }
        }

        const render = () => {
            const ctx = Game.canvas.getContext("2d");
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, Game.canvas.width, Game.canvas.height);
            ctx.scale(Game.camera.zoom, Game.camera.zoom);
            renderGrid(ctx);
            ctx.translate(-Game.camera.loc.x, -Game.camera.loc.y);
            renderParticles(ctx);
            renderDebugInfo(ctx);
        }

        return { render };
    })();

    // KEYBOARD CONTROLS
    Game.controls = {
        left: false, up: false, right: false, down: false,
        pause: false, lockToCenter: false, reset: false
    };

    window.addEventListener("keydown", (e) => {
        switch (e.keyCode) {
            case 37: case 65: Game.controls.left = true; Game.controls.lockToCenter = false; break;
            case 38: case 87: Game.controls.up = true; Game.controls.lockToCenter = false; break;
            case 39: case 68: Game.controls.right = true; Game.controls.lockToCenter = false; break;
            case 40: case 83: Game.controls.down = true; Game.controls.lockToCenter = false; break;
            case 219: Game.engine.timeMultiplier /= 2; break; // [
            case 221: Game.engine.timeMultiplier *= 2; break; // ]
        }
    }, false);

    window.addEventListener("keyup", (e) => {
        switch (e.keyCode) {
            case 37: case 65: Game.controls.left = false; break;
            case 38: case 87: Game.controls.up = false; break;
            case 39: case 68: Game.controls.right = false; break;
            case 40: case 83: Game.controls.down = false; break;
            case 80: Game.controls.pause = !Game.controls.pause; break;
            case 76: Game.controls.lockToCenter = !Game.controls.lockToCenter; break;
            case 82: Game.controls.reset = true; break;
        }
    }, false);


    // MOUSE INTERACTION
    let mouseDownLoc, mouseDownTime, maxTouches = 0, pinchDist = 0;

    const touchOrMouseDown = (x, y) => {
        mouseDownLoc = new Game.Vector(x - Game.canvas.getBoundingClientRect().left, y - Game.canvas.getBoundingClientRect().top);
        mouseDownTime = window.performance.now();
    }

    const touchOrMouseUp = (x, y) => {
        if (maxTouches > 1) {
            return;
        }
        const mouseUpLoc = new Game.Vector(x - Game.canvas.getBoundingClientRect().left, y - Game.canvas.getBoundingClientRect().top);
        const mouseUpLocTranslated = Game.camera.screenLocToCanvasLoc(mouseUpLoc);
        const hitParticle = Game.physics.hitTest(mouseUpLocTranslated);

        if (hitParticle) {
            hitParticle.selected = true;
            return;
        }

        const speedVector = mouseUpLoc.sub(mouseDownLoc).div(10);
        const mouseDownDuration = window.performance.now() - mouseDownTime;
        if (mouseDownDuration < 500) { // Prevent creating huge particles when dragging
            const newCircleRadius = mouseDownDuration / 50 + 3;
            const newCircle = new Game.Circle(mouseUpLocTranslated, speedVector, newCircleRadius);
            Game.particles.push(newCircle);
        }
    }

    const mouseWheel = (event) => {
        const mouseLoc = new Game.Vector(event.x - Game.canvas.getBoundingClientRect().left, event.y - Game.canvas.getBoundingClientRect().top);
        const wheel = event.wheelDelta / 120;
        if (wheel > 0) Game.camera.zoomIn(mouseLoc);
        else Game.camera.zoomOut(mouseLoc);
    }

    Game.canvas.addEventListener("mousedown", (e) => touchOrMouseDown(e.pageX, e.pageY));

    Game.canvas.addEventListener("touchstart", (e) => {
        maxTouches = Math.max(maxTouches, e.touches.length);
        if (e.touches.length === 2) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            pinchDist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
        }
        touchOrMouseDown(e.changedTouches[0].pageX, e.changedTouches[0].pageY);
    }, false);

    Game.canvas.addEventListener("mouseup", (e) => touchOrMouseUp(e.pageX, e.pageY));

    Game.canvas.addEventListener("touchend", (e) => {
        touchOrMouseUp(e.changedTouches[0].pageX, e.changedTouches[0].pageY);
        if (e.touches.length === 0) { // last finger lifted
            maxTouches = 0;
            pinchDist = 0;
        }
    }, false);

    Game.canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const currentDist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
            const midPoint = {
                x: (t1.pageX + t2.pageX) / 2,
                y: (t1.pageY + t2.pageY) / 2
            };
            const mouseLoc = new Game.Vector(midPoint.x - Game.canvas.getBoundingClientRect().left, midPoint.y - Game.canvas.getBoundingClientRect().top);

            if (currentDist > pinchDist) {
                Game.camera.zoomIn(mouseLoc);
            } else if (currentDist < pinchDist) {
                Game.camera.zoomOut(mouseLoc);
            }
            pinchDist = currentDist;
        }
    }, false);

    Game.canvas.addEventListener('mousewheel', (event) => {
        mouseWheel(event);
        return false;
    }, false);


    // GAME ENGINE
    Game.engine = (function () {

        const engine = {
            play,
            timeMultiplier: 1
        };

        const addParticleTrails = (p) => {
            const MAX_TRAILS_LENGTH = 200;
            p.trails.push(p.location);
            if (p.trails.length > MAX_TRAILS_LENGTH) p.trails.shift();
        }

        const init = () => {
            adjustCanvasSize();
            addInitialParticles();
        }

        const addInitialParticles = () => {
            const sun = new Game.Circle(new Game.Vector(0, 0), new Game.Vector(-0.0, -0.05), 16);
            sun.color = "#EE5";
            const earth = new Game.Circle(new Game.Vector(250, 0), new Game.Vector(0, 2.6), 4);
            earth.color = "#66F";
            const moon = new Game.Circle(new Game.Vector(267, 0), new Game.Vector(0, 3.6), 1);
            moon.color = "#111";
            Game.particles.push(sun, earth, moon);
            Game.camera.loc = new Game.Vector(-Game.canvas.width / 2, -Game.canvas.height / 2);
        }

        const reset = () => {
            Game.particles = [];
            Game.controls.reset = false;
        }

        const updatePhysics = () => {
            if (!Game.controls.pause) {
                const physicsPerFrame = 8;
                if (engine.timeMultiplier < 1 / 32) engine.timeMultiplier = 1 / 32;
                if (engine.timeMultiplier > 32) engine.timeMultiplier = 32;
                for (let k = 0; k < physicsPerFrame * engine.timeMultiplier; k++) {
                    Game.physics.doPhysics(1.0 / physicsPerFrame);
                    for (let i = 0; i < Game.particles.length; i++) {
                        addParticleTrails(Game.particles[i]);
                    }
                }
            }
        }

        const updateGraphics = () => {
            if (Game.controls.reset) reset();
            Game.camera.moveCamera();
            Game.rendering.render();
            window.requestAnimationFrame(updateGraphics);
        }

        const adjustCanvasSize = () => {
            const adjustInternal = () => {
                Game.canvas.width = window.innerWidth;
                Game.canvas.height = window.innerHeight;
            };
            adjustInternal();
            window.onresize = adjustInternal;
        };

        function play() {
            init();
            const physicsInterval = 1000 / 60;
            window.setInterval(updatePhysics, physicsInterval);
            updateGraphics();
        }

        return engine;
    })();


    window.onload = () => {
        Game.engine.play();
    }


})(window);