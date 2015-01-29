var nbody = function (window) {
    "use strict";

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
        },

    };


    var randomColor = function () {
        // ingenious random hex code generator by Paul Irish.
        return '#' + Math.floor(Math.random() * 0xFFF).toString(16);
    }


    var Circle = function (location, velocity, radius) {
        this.location = location;
        this.r = radius;
        this.mass = 4 / 3 * Math.PI * radius * radius * radius; // sphere volume
        this.v = velocity;
        this.a = new Vector();
        this.color = randomColor();

    };


    function checkCollision(a, b) {
        var d = a.location.sub(b.location);
        var r = a.r + b.r;
        if (d.lengthSq() < r * r) {
            return true;
        } else {
            return false;
        }
    }

    function resolveCollision(p1, p2) {
        var displacement = p1.location.sub(p2.location);

        var normalized = displacement.normalize();

        var v = p2.v.sub(p1.v);

        var dot = normalized.dot(v);
        
        var totalMass = p1.mass + p2.mass;

        var c = normalized.mul(2 * dot / totalMass);

        //var friction = 0.9999;
        //c = c.mul(friction);


        p1.v = p1.v.add(c.mul(p2.mass));
        p2.v = p2.v.sub(c.mul(p1.mass));
       
    }


    var RAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (callback) {
        window.setTimeout(callback, 1000 / 60);
    };

    var canvas = window.document.getElementById("canvas");
    var ctx = canvas.getContext("2d");

    var gravity = 0.1;

    var particles = [];

    var mouseDownLoc, mouseDownTime;

    window.addEventListener("mousedown", function (e) {
        mouseDownLoc = new Vector(e.pageX - canvas.getBoundingClientRect().left,
                                  e.pageY - canvas.getBoundingClientRect().top);

        mouseDownTime = window.performance.now();
    });


    window.addEventListener("mouseup", function (e) {
        var mouseUpLoc = new Vector(e.pageX - canvas.getBoundingClientRect().left,
                                    e.pageY - canvas.getBoundingClientRect().top);

        
        var speedVector = mouseUpLoc.sub(mouseDownLoc).div(10);

        var mouseDownDuration = window.performance.now() - mouseDownTime;
        var newCircleRadius = mouseDownDuration / 50 + 5;

        var newCircle = new Circle(mouseUpLoc, speedVector, newCircleRadius);

        particles.push(newCircle);
    });


    function computeForces() {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            p.a.reset();

            for (var j = 0; j < i; j++) {
                var p2 = particles[j];

                var distance = p.location.sub(p2.location);
                var norm = Math.sqrt(100.0 + distance.lengthSq());
                var mag = gravity / (norm * norm * norm);

                p.a = p.a.sub(distance.mul(mag * p2.mass));
                p2.a = p2.a.add(distance.mul(mag * p.mass));

            }
        }

    }


    function doCollisions() {

        for (var i = 0; i < particles.length; i++) {
            var p1 = particles[i];
            for (var j = 0; j < i; j++) {
                var p2 = particles[j];

                if (checkCollision(p1, p2)) {
                    resolveCollision(p1, p2);
                }
            }

        }
    }


    function doPhysics(dt) {
        for (var i1 = 0; i1 < particles.length; i1++) {
            var p1 = particles[i1];
            p1.location = p1.location.add(p1.v.mul(0.5 * dt));
        }
        computeForces();
        for (var i2 = 0; i2 < particles.length; i2++) {
            var p2 = particles[i2];
            p2.v = p2.v.add(p2.a.mul(dt));
        }

        for (var i3 = 0; i3 < particles.length; i3++) {
            var p3 = particles[i3];
            p3.location = p3.location.add(p3.v.mul(0.5 * dt));
        }


        doCollisions();
    }

    function update() {

        var physicsPerFrame = 8;

        for (var k = 0; k < physicsPerFrame; k++) {
            doPhysics(1.0 / physicsPerFrame);
        }

        render();

        RAF(update);
    }


    var adjustCanvasSize = function () {
        var foo = function () {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.onresize = foo;
        foo();

    };


    
    function render() {
        var firstLocation;

        
        // reset transformation
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // clear screen
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
            
        if (particles.length > 0) {
            //firstLocation = particles[0].location;
            //ctx.translate(-firstLocation.x + canvas.width / 2, -firstLocation.y + canvas.height / 2);
        }
        

        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];

            ctx.beginPath();
            ctx.arc(p.location.x, p.location.y, p.r, 0, Math.PI * 2, false);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.closePath();
        }

        renderDebugInfo();

    }

    var fps, fpsLast, fpslastUpdated;

    function renderDebugInfo() {
    
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        if (!fpslastUpdated || window.performance.now() - fpslastUpdated >= 1000) {
            fpsLast = fps;
            fpslastUpdated = window.performance.now();
            fps = 0;
        }
        fps++;

        ctx.fillStyle = "#555";
        ctx.fillText(fpsLast + ' fps', 5, 15);
        
        ctx.restore();
    }


    adjustCanvasSize();
    update();
}(window);