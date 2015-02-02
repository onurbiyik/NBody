(function (window) {
    "use strict";

    window.Game = {
        canvas: window.document.getElementById("canvas"),
        particles: []
    };

    // VECTOR
    (function () {
        var Vector = function (x, y) {
            this.x = x || 0;
            this.y = y || 0;
        };

        Vector.prototype = {

            reset: function () {
                this.x = 0;
                this.y = 0;
            },

            mul: function (mul) {
                return new Vector(this.x * mul, this.y * mul);
            },

            div: function (div) {
                return new Vector(this.x / div, this.y / div);
            },

            add: function (add) {
                return new Vector(this.x + add.x, this.y + add.y);
            },

            sub: function (sub) {
                return new Vector(this.x - sub.x, this.y - sub.y);
            },

            dot: function (v) {
                return (this.x * v.x + this.y * v.y);
            },

            length: function () {
                return Math.sqrt(this.dot(this));
            },

            lengthSq: function () {
                return this.dot(this);
            },

            normalize: function () {
                return this.div(this.length());
            }

        };

        Game.Vector = Vector;
    }());


    // CIRCLE
    (function () {

        function randomColor() {
            // ingenious random hex code generator by Paul Irish.
            return '#' + Math.floor(Math.random() * 0xFFF).toString(16);
        }


        var Circle = function (location, velocity, radius) {
            this.location = location;
            this.radius = radius;
            this.mass = 4 / 3 * Math.PI * radius * radius * radius; // sphere volume
            this.v = velocity;
            this.a = new Game.Vector();
            this.color = randomColor();
        };

        Game.Circle = Circle;

    }());


    // PHYSICS
    (function () {

        Game.physics = function () {

            var checkCollision = function (a, b) {
                var dist = a.location.sub(b.location);
                var totalRad = a.radius + b.radius;
                // object touch check
                // return (dist.lengthSq() < totalRad * totalRad);

                // loose check
                return (dist.lengthSq() < totalRad);
            };

            var resolveCollision = function (p1, p2) {
                var displacement = p1.location.sub(p2.location);

                var normalized = displacement.normalize();

                var v = p2.v.sub(p1.v);

                var dot = normalized.dot(v);

                var totalMass = p1.mass + p2.mass;

                var c = normalized.mul(2 * dot / totalMass);

                //var friction = 0.99;
                //c = c.mul(friction);


                p1.v = p1.v.add(c.mul(p2.mass));
                p2.v = p2.v.sub(c.mul(p1.mass));

            };
            var hitTest = function (loc) {

                for (var i = 0; i < Game.particles.length; i++) {
                    var p = Game.particles[i];

                    var diff = p.location.sub(loc);

                    if (diff.length() < p.radius)
                        return p;
                }
                return null;
            };
            var doCollisions = function () {
                
                for (var i = 0; i < Game.particles.length; i++) {
                    var p1 = Game.particles[i];
                    for (var j = 0; j < i; j++) {
                        var p2 = Game.particles[j];

                        if (checkCollision(p1, p2)) {
                            resolveCollision(p1, p2);
                        }
                    }

                }
            };
            var computeForces = function () {

                var gravity = 0.1;


                for (var i = 0; i < Game.particles.length; i++) {
                    var p = Game.particles[i];
                    p.a.reset();

                    for (var j = 0; j < i; j++) {
                        var p2 = Game.particles[j];

                        var distance = p.location.sub(p2.location);
                        var norm = Math.sqrt(100.0 + distance.lengthSq());
                        var mag = gravity / (norm * norm * norm);

                        p.a = p.a.sub(distance.mul(mag * p2.mass));
                        p2.a = p2.a.add(distance.mul(mag * p.mass));

                    }
                }

            };
            var doPhysics = function (dt) {
                for (var i1 = 0; i1 < Game.particles.length; i1++) {
                    var p1 = Game.particles[i1];
                    p1.location = p1.location.add(p1.v.mul(0.5 * dt));
                }
                computeForces();
                for (var i2 = 0; i2 < Game.particles.length; i2++) {
                    var p2 = Game.particles[i2];
                    p2.v = p2.v.add(p2.a.mul(dt));
                }

                for (var i3 = 0; i3 < Game.particles.length; i3++) {
                    var p3 = Game.particles[i3];
                    p3.location = p3.location.add(p3.v.mul(0.5 * dt));
                }


                doCollisions();
            }
            var computeCenterOfGravity = function () {
                var result = new Game.Vector();
                var totalMass = 0.0;

                for (var i = 0; i < Game.particles.length; i++) {
                    var p = Game.particles[i];

                    
                    result = result.add(p.location.mul(p.mass));

                    totalMass += p.mass;

                }

                return result.div(totalMass);
            }

            return {
                doPhysics: doPhysics,
                hitTest: hitTest,
                computeCenterOfGravity: computeCenterOfGravity
            };
        }();

    })();


    // CAMERA
    (function () {
        Game.camera = function () {
            var loc = new Game.Vector(0, 0);
            var zoom = 1;


            var screenLocToCanvasLoc = function (loc) {
                var canvasLoc = loc;

                canvasLoc = loc.div(Game.camera.zoom)

                canvasLoc = canvasLoc.add(Game.camera.loc);

                return canvasLoc;
            }

            var zoomIn = function (loc) {
                if (Game.camera.zoom > 10)
                    return;
                
                zoomInternal(loc, false);
            };

            var zoomOut = function (loc) {
                if (Game.camera.zoom < 0.1)
                    return;

                zoomInternal(loc, true);
            };

            var zoomInternal = function (loc, reverse) {
                var ZOOM_RATE = 1.2;

                var oldZoom = Game.camera.zoom;
                var newZoom;

                if (reverse)
                    newZoom = oldZoom / ZOOM_RATE;
                else
                    newZoom = oldZoom * ZOOM_RATE;
                

                var oldLoc = Game.camera.loc;
                var locDiff = loc.div(oldZoom).sub(loc.div(newZoom));
                var newLoc = oldLoc.add(locDiff);

                Game.camera.loc = newLoc;
                Game.camera.zoom = newZoom;

            };

            function moveCamera() {

                if (Game.controls.lockToCenter)
                    moveCameraWithCenterOfGravity();
                else
                    moveCameraWithArrows();

            }

            function moveCameraWithCenterOfGravity() {
                var cog = Game.physics.computeCenterOfGravity();

                var screenCenter = new Game.Vector(canvas.width / 2, canvas.height / 2).div(Game.camera.zoom);


                var newCamLoc = cog.sub(screenCenter);

                // slowly move the camera to new location
                var diff = newCamLoc.sub(Game.camera.loc).div(10);

                Game.camera.loc = Game.camera.loc.add(diff);

            }

            function moveCameraWithArrows() {
                var speed = 400;
                var step = (1000 / 60) / 1000; // todo : what's going on?

                if (Game.controls.left)
                    Game.camera.loc.x -= speed * step;
                if (Game.controls.up)
                    Game.camera.loc.y -= speed * step;
                if (Game.controls.right)
                    Game.camera.loc.x += speed * step;
                if (Game.controls.down)
                    Game.camera.loc.y += speed * step;
            }

            return {
                loc: loc,
                zoom: zoom,
                zoomIn: zoomIn,
                zoomOut: zoomOut,
                screenLocToCanvasLoc: screenLocToCanvasLoc,
                moveCamera: moveCamera
            };
        }();
    })();


    // RENDERING
    (function () {

        function render() {

            var ctx = canvas.getContext("2d");

            // reset transformation
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            // clear screen
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.scale(Game.camera.zoom, Game.camera.zoom);

            renderGrid(ctx);

            // pan ctx according to camera
            ctx.translate(-Game.camera.loc.x, -Game.camera.loc.y);


            renderParticles(ctx);


            renderDebugInfo(ctx);

        }

        function renderGrid(ctx) {
            var i;
            var gridSize = 100;


            var gridHeight = canvas.height / Game.camera.zoom;
            var gridWidth = canvas.width / Game.camera.zoom;

            ctx.beginPath();


            // Pseudo scrolling. Grid lines are generated only for the view area of the camera.
            var cameraXPan = Game.camera.loc.x % gridSize;
            var cameraYPan = Game.camera.loc.y % gridSize;

            
            // horizontal lines
            for (i = -cameraXPan; i <= gridWidth; i += gridSize) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i, gridHeight);
            }

            // vertical lines
            for (i = -cameraYPan; i <= gridHeight; i += gridSize) {
                ctx.moveTo(0, i);
                ctx.lineTo(gridWidth, i);
            }

            ctx.lineWidth = 0.1;
            ctx.strokeStyle = "#555";
            ctx.stroke();
        }


        function renderParticleTrails(ctx, p, addTrails) {
            var i, trailLoc;

            p.trails = p.trails || [];

            if (addTrails) {
                addParticleTrails(p);
            }

            // grouping a number of trails in one canvas path for performance.
            var TRAILS_IN_PATH = 5;

            // start from particle location
            ctx.moveTo(p.location.x, p.location.y);

            // follow all the trails from the end
            for (i = p.trails.length - 1; i >= 0; i -= TRAILS_IN_PATH) {
                
                ctx.beginPath();
                ctx.lineTo(p.trails[i].x, p.trails[i].y);

                for (var j = i; j >= Math.max(i - TRAILS_IN_PATH, 0); j--) {
                    trailLoc = p.trails[j];
                    ctx.lineTo(trailLoc.x, trailLoc.y);
                }

                var opacity = i / p.trails.length / 5; 

                ctx.lineWidth = 3;
                ctx.strokeStyle = p.color;
                ctx.globalAlpha = opacity;
                ctx.stroke();
            }

            ctx.globalAlpha = 1;    // reset context opacity
            
        }

        function addParticleTrails(p) {
            var MAX_TRAILS_LENGTH = 40;

            p.trails.push(p.location);
            if (p.trails.length > MAX_TRAILS_LENGTH)
                p.trails.shift();   // consider using queue.js for performance
        }

        function renderParticle(ctx, p) {

            ctx.beginPath();
            // ctx.moveTo(p.location.x, p.location.y);
            ctx.arc(p.location.x, p.location.y, p.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = p.color;
            ctx.fill();
        }

        var skipFramesPerTrail = 0;
        function shouldAddTrails() {

            var FRAMES_PER_TRAIL = 2;

            skipFramesPerTrail++;
            if (skipFramesPerTrail < FRAMES_PER_TRAIL) {
                return false;
            }
            skipFramesPerTrail = 0;
            return true;
        }


        function renderParticles(ctx) {
            var i, p;

            var addTrails = shouldAddTrails();
            for (i = 0; i < Game.particles.length; i++) {
                p = Game.particles[i];
                renderParticleTrails(ctx, p, addTrails);
            }

            for (i = 0; i < Game.particles.length; i++) {
                p = Game.particles[i];

                renderParticle(ctx, p);
            }

        }


        var fps, fpsLast, fpslastUpdated;

        function renderDebugInfo(ctx) {

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
                ctx.restore();
            }

        }

        function renderParticleVectors(ctx) {

            for (var i = 0; i < Game.particles.length; i++) {
                var p = Game.particles[i];


                ctx.setLineDash([3, 7]);
                ctx.lineWidth = 0.3;

                // acceleration
                ctx.beginPath();
                ctx.moveTo(p.location.x, p.location.y);
                ctx.lineTo(p.location.x + p.a.x * 200, p.location.y + p.a.y * 200);
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.stroke();

                // velocity
                ctx.beginPath();
                ctx.moveTo(p.location.x, p.location.y);
                ctx.lineTo(p.location.x + p.v.x * 5, p.location.y + p.v.y * 5);
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                ctx.stroke();


                ctx.setLineDash([]);
            }
        }

        Game.render = render;
    })();


    // KEYBOARD CONTROLS
    (function () {
        Game.controls = {
            left: false,
            up: false,
            right: false,
            down: false,
            pause: false,
            lockToCenter: false,
            reset: false
        };

        window.addEventListener("keydown", function (e) {
            switch (e.keyCode) {
                case 37: // left arrow
                    Game.controls.left = true;
                    Game.controls.lockToCenter = false;
                    break;
                case 38: // up arrow
                    Game.controls.up = true;
                    Game.controls.lockToCenter = false;
                    break;
                case 39: // right arrow
                    Game.controls.right = true;
                    Game.controls.lockToCenter = false;
                    break;
                case 40: // down arrow
                    Game.controls.down = true;
                    Game.controls.lockToCenter = false;
                    break;
            }
        }, false);

        window.addEventListener("keyup", function (e) {
            switch (e.keyCode) {
                case 37: // left arrow
                    Game.controls.left = false;
                    break;
                case 38: // up arrow
                    Game.controls.up = false;
                    break;
                case 39: // right arrow
                    Game.controls.right = false;
                    break;
                case 40: // down arrow
                    Game.controls.down = false;
                    break;
                case 80: // key P pauses the game
                    Game.controls.pause = !Game.controls.pause;
                    break;
                case 76: // key L locks the camera to center of gravity
                    Game.controls.lockToCenter = !Game.controls.lockToCenter;
                    break;
                case 82: // key R locks the camera to center of gravity
                    Game.controls.reset = true;
                    break;
            }
        }, false);
    })();


    // MOUSE INTERACTION
    (function () {

        var mouseDownLoc, mouseDownTime;

        var touchOrMouseDown = function (x, y) {

            mouseDownLoc = new Game.Vector(x - canvas.getBoundingClientRect().left,
                                      y - canvas.getBoundingClientRect().top);

            mouseDownTime = window.performance.now();
        }

        var touchOrMouseUp = function (x, y) {

            var mouseUpLoc = new Game.Vector(x - canvas.getBoundingClientRect().left,
                                        y - canvas.getBoundingClientRect().top);


            var mouseUpLocTranslated = Game.camera.screenLocToCanvasLoc(mouseUpLoc);

            var hitParticle = Game.physics.hitTest(mouseUpLocTranslated);

            if (hitParticle) {
                hitParticle.selected = true;
                return;
            }

            var speedVector = mouseUpLoc.sub(mouseDownLoc).div(10);

            var mouseDownDuration = window.performance.now() - mouseDownTime;
            var newCircleRadius = mouseDownDuration / 50 + 3;

            var newCircle = new Game.Circle(mouseUpLocTranslated, speedVector, newCircleRadius);

            Game.particles.push(newCircle);
        }

        var mouseWheel = function (event) {

            var mouseLoc = new Game.Vector(event.x - canvas.getBoundingClientRect().left,
                                        event.y - canvas.getBoundingClientRect().top);

            var wheel = event.wheelDelta / 120;//n or -n

            if (wheel > 0)
                Game.camera.zoomIn(mouseLoc);
            else
                Game.camera.zoomOut(mouseLoc);


        }

        Game.canvas.addEventListener("mousedown", function (e) {
            touchOrMouseDown(e.pageX, e.pageY);
        });
        Game.canvas.addEventListener("touchstart", function (e) {
            touchOrMouseDown(e.changedTouches[0].x, e.changedTouches[0].y);
        }, false);

        Game.canvas.addEventListener("mouseup", function (e) {
            touchOrMouseUp(e.pageX, e.pageY);
        });
        Game.canvas.addEventListener("touchend", function (e) {
            touchOrMouseUp(e.changedTouches[0].x, e.changedTouches[0].y);
        }, false);

        Game.canvas.addEventListener('mousewheel', function (event) {
            mouseWheel(event);
            return false;
        }, false);

    })();


    // GAME ENGINE
    (function () {
        Game.engine = function () {

            var RAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (callback) {
                window.setTimeout(callback, 1000 / 60);
            };


            function init() {

                adjustCanvasSize();

                addInitialParticles();
            }

            function addInitialParticles() {

                var sun = new Game.Circle(
                    new Game.Vector(0, 0),
                    new Game.Vector(0, -0.1),
                    35);
                sun.color = "#EE5";

                var mercury = new Game.Circle(
                    new Game.Vector(-200, 0),
                    new Game.Vector(0, -9),
                    3);
                mercury.color = "#000";


                var earth = new Game.Circle(
                    new Game.Vector(500, 0),
                    new Game.Vector(0, 6),
                    8);
                earth.color = "#66F";


                var moon = new Game.Circle(
                    new Game.Vector(520, 0),
                    new Game.Vector(0, 9),
                    2);
                moon.color = "#444";

                Game.particles.push(sun);
                Game.particles.push(mercury);
                Game.particles.push(earth);
                Game.particles.push(moon);

                Game.camera.loc = new Game.Vector(-Game.canvas.width / 2, -Game.canvas.height / 2);
            }

            function reset() {
                Game.particles = [];
                Game.controls.reset = false;    // reset the reset flag.
            }

            function update() {

                if (Game.controls.reset) {
                    reset();
                }


                if (!Game.controls.pause) {

                    var physicsPerFrame = 8;

                    for (var k = 0; k < physicsPerFrame; k++) {
                        Game.physics.doPhysics(1.0 / physicsPerFrame);
                    }
                }

                
                Game.camera.moveCamera();

                Game.render();

                RAF(update);
            }

            var adjustCanvasSize = function () {
                var adjustInternal = function () {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                };
                adjustInternal();
                window.onresize = adjustInternal;
            };

            function play() {
                init();
                update();
            }

            return {
                play: play
            };
        }();
    })();


    window.onload = function () {
        Game.engine.play();
    }


})(window);