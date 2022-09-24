import * as Matter from 'matter-js';
import { Snap } from 'sef';

export class Physics {

    engine: Matter.Engine;
    runner: Matter.Runner;
    render: Matter.Render;

    private floor: Matter.Body;

    init() {
        this.engine = Matter.Engine.create({
            enableSleeping: true,
        });

        // this.setGravity(1, 180);

        this.setFloorActive(true);
        
        // create runner
        this.runner = Matter.Runner.create();

        // run the engine
        Matter.Runner.run(this.runner, this.engine);

        // Can use this to see a debug display
        this.createRender();
    }

    createRender() {
        let stage = Snap.IDE.stage;
        let renderDiv = document.createElement('div');
        renderDiv.id = "renderer";
        renderDiv.innerHTML = "";
        renderDiv.style.zIndex = "999";
        renderDiv.style.position = "absolute";
        renderDiv.style.pointerEvents = "none";
        // TODO: Update size on stage resize
        renderDiv.style.top = `${stage.bounds.origin.y}px`;
        renderDiv.style.right = `0px`;
        let width = stage.width(), height = stage.height();
        renderDiv.style.width = `${width}px`;
        renderDiv.style.height = `${height}px`;

        document.body.appendChild(renderDiv);

        // create a renderer
        this.render = Matter.Render.create({
            element: renderDiv,
            engine: this.engine,
            options: {
                width: width,
                height: height,
            },
            // TODO: Update dimensions on stage dimension change
            bounds: Matter.Bounds.create([
                Matter.Vector.create(-240, -180),
                Matter.Vector.create(240, 180)
            ]),
        });
        this.render.canvas.width = width;
        this.render.canvas.height = height;

        // run the renderer
        Matter.Render.run(this.render);
        this.render.canvas.style.background = 'rgb(21 21 21 / 20%)';
    }

    isFloorActive() {
        return !!this.floor;
    }

    setFloorActive(active: boolean) {
        if (active == this.isFloorActive()) return;
        if (!active) {
            Matter.Composite.remove(this.engine.world, this.floor);
            this.floor = null;
        } else {
            this.floor = Matter.Bodies.rectangle(0, 190, 20000, 20,
                { isStatic: true });
            Matter.Composite.add(this.engine.world, this.floor);
        }
    }
}

// Matter.Common.setDecomp(decomp);

// class Physics {

//     constructor() {
//         this.init();
//     }

//     static getPhysics() {
//         if (!window.ide) return null;
//         return window.ide.stage.threads.physics;
//     }

//     init() {
//         this.spriteMap = new Map();
//         this.costumeMap = new Map();

//         // create an engine
//         this.engine = Matter.Engine.create({
//             enableSleeping: true,
//         });
//         this.setGravity(1, 180);

//         this.setFloorActive(true);

//         // create runner
//         // this.runner = Matter.Runner.create();

//         // run the engine
//         // Matter.Runner.run(this.runner, this.engine);

//         // Can use this to see a debug display
//         // setTimeout(() => this.createRender(), 1);
//     }



//     snapDirToVec(direction, magnitude) {
//         let vec = Matter.Vector.create;
//         return Matter.Vector.rotateAbout(
//             vec(0, -magnitude), direction / 180 * Math.PI, vec(0, 0)
//         );
//     }

//     vecToSnapDir(vector) {
//         let right = Matter.Vector.create(1, 0);
//         let angle = Matter.Vector.angle(right, vector);
//         return -angle / Math.PI * 180;
//     }

//     setGravity(magnitude, direction) {
//         if (direction === undefined) direction = this.gravityDirection;
//         if (magnitude == this.gravityMagnitude &&
//                 direction === this.gravityDirection) {
//             return;
//         }
//         this.gravityMagnitude = magnitude;
//         this.gravityDirection = direction;
//         let g = this.snapDirToVec(direction, magnitude);
//         this.engine.gravity = g;
//         this.wakeUpAllBodies();
//     }

//     wakeUpAllBodies() {
//         this.spriteMap.forEach((body) => {
//             Matter.Sleeping.set(body, false);
//         });
//     }

//     addSprite(sprite) {
//         var body = this.createBodyForCostume(sprite);
//         Matter.Composite.add(this.engine.world, body);
//         // We update the scale here, since body already
//         // sprite.lastUpdateScale = sprite.scale;
//         this.updateSpriteBody(sprite, body);

//         this.spriteMap.set(sprite, body);
//     }

//     createVerticesForCostume(costume) {
//         let canvas = costume.contents;
//         let key = canvas;
//         if (this.costumeMap.has(key)) {
//             return this.costumeMap.get(key);
//         }
//         // console.log("Creating new costume for ", costume);

//         let ctx = canvas.getContext('2d');
//         let data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

//         let pps = 50;
//         let dx = Math.ceil(canvas.width / pps);
//         let dy = Math.ceil(canvas.height / pps);
//         let points = []
//         for (let x = 0; x < canvas.width; x += dx) {
//             for (let y = 0; y < canvas.height; y += dy) {
//                 let offset = 4 * (y * canvas.width + x) + 3;
//                 if (data[offset] > 0) {
//                     points.push([x, y]);
//                 }
//             }
//         }
//         let cvHull = hull(points, 10);
//         // Since this is only called for concave shapes, go ahead and remove
//         // collinear points (which are common).
//         Matter.Common.getDecomp().removeCollinearPoints(cvHull, 0.01);
//         Matter.Common.getDecomp().removeDuplicatePoints(cvHull, 0.01);

//         this.costumeMap.set(key, cvHull);
//         return cvHull;
//     }

//     createBodyForCostume(sprite) {
//         let costume = sprite.costume;
//         if (!costume) return this.createDefaultBody();
//         // TODO rasterize
//         let canvas = costume.contents;
//         if (!canvas.getContext) return this.createDefaultBody();

//         let points = this.createVerticesForCostume(costume);
//         let vertices = points.map(p => Matter.Vector.create(p[0], p[1]));
//         let body = Matter.Bodies.fromVertices(
//             0, 0, vertices,
//         );

//         let bodyMin = body.bounds.min, bodyMax = body.bounds.max;
//         let newCenter = new Point(
//             (bodyMin.x + bodyMax.x) / 2,
//             (bodyMin.y + bodyMax.y) / 2
//         );

//         let offset = costume.rotationCenter
//             .subtract(costume.center())
//             .add(newCenter);
//         body.centerOffset = offset;

//         return body;
//     }

//     createDefaultBody() {
//         let len = 30;
//         let offset = 90;
//         let start = new Point(0, 0);
//         let dest = start.distanceAngle(len * 0.75, offset + 180);
//         let left = start.distanceAngle(len, offset - 195);
//         let right = start.distanceAngle(len, offset + 195);

//         let body = Matter.Bodies.fromVertices(
//             0, 0, [
//                 this.toVector(start, true),
//                 this.toVector(left, true),
//                 this.toVector(dest, true),
//                 this.toVector(right, true),
//             ]
//         );
//         body.centerOffset = new Point(17, 0);
//         return body;
//     }

//     removeSprite(sprite) {
//         let body = this.spriteMap.get(sprite);
//         if (!body) return;
//         this.spriteMap.delete(sprite);
//         Matter.Composite.remove(this.engine.world, body);
//         sprite.lastUpdateHeading = undefined;
//         sprite.lastUpdatePosition = undefined;
//         sprite.lastUpdateScale = undefined;
//     }

//     updateSpriteBody(sprite, body) {
//         if (!body) body = this.spriteMap.get(sprite);
//         if (!body) return;
//         let updated = false;

//         if (!(sprite.lastUpdatePosition &&
//                 sprite.stagePosition.eq(sprite.lastUpdatePosition))) {
//             let pos = sprite.stagePosition.copy();
//             pos.y = -pos.y;
//             if (body.centerOffset) {
//                 pos = pos.subtract(this.getBodyOffset(body, sprite));
//             }
//             Matter.Body.setPosition(body, this.toVector(pos));
//             sprite.lastUpdatePosition = sprite.stagePosition.copy();
//             updated = true;
//         }

//         if (sprite.heading != sprite.lastUpdateHeading) {
//             let angle = (-90 + sprite.heading) * Math.PI / 180;
//             Matter.Body.setAngle(body, angle);
//             sprite.lastUpdateHeading = sprite.heading;
//             updated = true;
//         }

//         let lastUpdateScale = (sprite.lastUpdateScale || 1)
//         if (sprite.scale != lastUpdateScale) {
//             let scaleUp = sprite.scale / lastUpdateScale;
//             Matter.Body.scale(body, scaleUp, scaleUp);
//             body.centerOffset = body.centerOffset.scaleBy(scaleUp);
//             sprite.lastUpdateScale = sprite.scale;
//             updated = true;
//         }

//         if (updated) {
//             // The position changed, so wake up!
//             Matter.Sleeping.set(body, false);
//         }
//     }

//     update() {
//         this.spriteMap.forEach((body, sprite) => {
//             this.updateSpriteBody(sprite, body);
//             body.lastVelocity = Matter.Vector.clone(body.velocity);
//         });
//         // Fixed stepping is safer
//         Matter.Engine.update(this.engine);
//         this.spriteMap.forEach((body, sprite) => {
//             if (!sprite.parentThatIsA(StageMorph)) return;
//             let pos = this.toPoint(body.position);
//             if (body.centerOffset) {
//                 pos = pos.add(this.getBodyOffset(body, sprite));
//             }
//             pos.y = -pos.y;
//             sprite.setStagePosition(pos);
//             sprite.setHeading(90 + body.angle * 180 / Math.PI);
//             // This is a nice simple calculation, but it is net force,
//             // not total force. So if there's equal force from both sides,
//             // the result is 0. Could modify the physics engine to calculate
//             // it differently, but this work pretty well for now.
//             body.lastForce = Matter.Vector.mult(
//                 Matter.Vector.sub(body.lastVelocity, body.velocity),
//                 body.mass);
//         });
//     }

//     getBodyOffset(body, sprite) {
//         return body.centerOffset.rotateBy((90 - sprite.heading) / 180 * Math.PI)
//     }

//     setFloorActive(active) {
//         if (active == this.isFloorActive()) return;
//         if (!active) {
//             Matter.Composite.remove(this.engine.world, this.floor);
//             this.floor = null;
//         } else {
//             this.floor = Matter.Bodies.rectangle(0, 190, 20000, 20,
//                 { isStatic: true });
//             Matter.Composite.add(this.engine.world, this.floor);
//         }
//     }

//     getSpriteProperty(sprite, f, alt) {
//         let body = this.spriteMap.get(sprite);
//         if (!body) return alt;
//         return f(body);
//     }

//     withSprite(sprite, f, dontWake) {
//         let body = this.spriteMap.get(sprite);
//         if (!body) return;
//         f(body);
//         if (!dontWake) {
//             Matter.Sleeping.set(body, false);
//         }
//     }

//     getSpriteMass(sprite) {
//         return this.getSpriteProperty(sprite, b => b.mass, 1);
//     }

//     setSpriteMass(sprite, mass) {
//         return this.withSprite(sprite, b => {
//             Matter.Body.setMass(b, mass)
//         });
//     }

//     getSpriteBounciness(sprite) {
//         return this.getSpriteProperty(sprite, b => b.restitution, 0) * 100;
//     }

//     setSpriteBounciness(sprite, bounciness) {
//         bounciness = Math.min(Math.max(0, bounciness), 100);
//         return this.withSprite(sprite, b => {
//             b.restitution = bounciness / 100;
//         });
//     }

//     getSpriteAirFriction(sprite) {
//         return this.getSpriteProperty(sprite, b => b.frictionAir, 10) * 100;
//     }

//     setSpriteAirFriction(sprite, airFriction) {
//         airFriction = Math.min(Math.max(0, airFriction), 100);
//         return this.withSprite(sprite, b => {
//             b.frictionAir = airFriction / 100;
//         });
//     }

//     getSpriteVelocity(sprite) {
//         return this.getSpriteProperty(sprite,
//             b => this.toPoint(b.velocity, true),
//             ZERO
//         );
//     }

//     getSpriteSpeed(sprite) {
//         return this.getSpriteProperty(sprite, b => b.speed, 0);
//     }

//     setSpriteVelocity(sprite, vx, vy) {
//         let vel = this.getSpriteVelocity(sprite).copy();
//         if (vx !== undefined) vel.x = vx;
//         if (vy !== undefined) vel.y = vy;
//         this.withSprite(sprite, b => {
//             Matter.Body.setVelocity(b, this.toVector(vel, true));
//         });
//     }

//     accelerateSprite(sprite, magnitude, dir) {
//         this.withSprite(sprite, b => {
//             let newVel = Matter.Vector.add(
//                 b.velocity,
//                 this.snapDirToVec(dir, magnitude)
//             );
//             Matter.Body.setVelocity(b, newVel);
//         });
//     }

//     getSpriteForceDirection(sprite) {
//         let force = this.getSpriteProperty(sprite, b => b.lastForce, null);
//         if (!force) return 0;
//         return this.vecToSnapDir(force);
//     }

//     getSpriteForceMagnitude(sprite) {
//         return this.getSpriteProperty(sprite,
//             b => Matter.Vector.magnitude(b.lastForce || b.force),
//             0
//         );
//     }

//     applyForceToSprite(sprite, magnitude, dir) {
//         this.accelerateSprite(sprite,
//             magnitude / this.getSpriteMass(sprite), dir);
//     }

//     toPoint(vector, flipY) {
//         let y = flipY ? -vector.y : vector.y;
//         return new Point(vector.x, y);
//     }

//     toVector(point, flipY) {
//         let y = flipY ? -point.y : point.y;
//         return Matter.Vector.create(point.x, y);
//     }
// }

// extend(StageMorph, 'init', function(base, globals) {
//     base.call(this, globals);
//     this.threads.physics = new Physics(this);
// });

// // extend(StageMorph, 'stepFrame', function(base) {
// //     base.call(this);
// //     Physics.getPhysics().update();
// // });

// extend(SpriteMorph, 'updateStagePosition', function(base) {
//     base.call(this);
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     physics.updateSpriteBody(this);
// });

// extend(SpriteMorph, 'destroy', function(base) {
//     base.call(this);
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     physics.removeSprite(this);
// });

// extend(SpriteMorph, 'wearCostume', function(base, costume, noShadow) {
//     base.call(this, costume, noShadow);
//     if (this.isPhysicsObject) {
//         let physics = Physics.getPhysics();
//         if (!physics) return;
//         physics.removeSprite(this);
//         physics.addSprite(this);
//     }
// })

// blockFactory.addCategory('physics', new Color(200, 70, 70));

// blockFactory.registerBlock(new Block(
//     'updatePhysics', 'update physics', [], 'command', 'physics', true
// ).addSpriteAction(function(hasPhysics) {
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     physics.update();
// }));

// blockFactory.registerBlock(new Block(
//     'setPhysics', 'set physics %b', [], 'command', 'physics', true
// ).addSpriteAction(function(hasPhysics) {
//     if (this.isPhysicsObject == hasPhysics) return;
//     this.isPhysicsObject = !!hasPhysics;
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     if (this.isPhysicsObject) {
//         physics.addSprite(this);
//     } else {
//         physics.removeSprite(this);
//     }
// }));

// blockFactory.registerBlock(new Block(
//     'setGravityMagnitude', 'set gravity to %n %', [100], 'command',
//     'physics', false
// ).addSpriteAction(function(g) {
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     physics.setGravity(g / 100);
// }));

// blockFactory.registerBlock(new Block(
//     'getGravityMagnitude', 'gravity', [], 'reporter',
//     'physics', false
// ).addSpriteAction(function() {
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.gravityMagnitude * 100;
// }));

// blockFactory.registerBlock(new Block(
//     'setGravityDirection', 'point gravity in %dir', [180], 'command',
//     'physics', false
// ).addSpriteAction(function(dir) {
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     physics.setGravity(physics.gravityMagnitude, +dir);
// }));

// blockFactory.registerBlock(new Block(
//     'getGravityDirection', 'gravity direction', [], 'reporter',
//     'physics', false
// ).addSpriteAction(function() {
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.gravityDirection;
// }));

// blockFactory.registerBlock(new Block(
//     'isFloorActive', 'floor active', [], 'predicate',
//     'physics', false
// ).addSpriteAction(function() {
//     let physics = Physics.getPhysics();
//     if (!physics) return false;
//     return physics.isFloorActive();
// }));

// blockFactory.registerBlock(new Block(
//     'setFloorActive', 'set floor active to %b', [], 'command',
//     'physics', false
// ).addSpriteAction(function(active) {
//     let physics = Physics.getPhysics();
//     if (!physics) return false;
//     return physics.setFloorActive(active);
// }));


// blockFactory.registerBlock(new Block(
//     'getMass', 'mass', [], 'reporter',
//     'physics', false
// ).addSpriteAction(function() {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.getSpriteMass(this);
// }));

// blockFactory.registerBlock(new Block(
//     'setMass', 'set mass to %n', [1], 'command',
//     'physics', false
// ).addSpriteAction(function(mass) {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     // TODO: Sanitize inputs
//     return physics.setSpriteMass(this, mass);
// }));

// blockFactory.registerBlock(new Block(
//     'getBounciness', 'bounciness', [], 'reporter',
//     'physics', false
// ).addSpriteAction(function() {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.getSpriteBounciness(this);
// }));

// blockFactory.registerBlock(new Block(
//     'setBounciness', 'set bounciness to %n', [50], 'command',
//     'physics', false
// ).addSpriteAction(function(bounciness) {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     // TODO: Sanitize inputs
//     return physics.setSpriteBounciness(this, bounciness);
// }));

// blockFactory.registerBlock(new Block(
//     'getAirFriction', 'air friction', [], 'reporter',
//     'physics', false
// ).addSpriteAction(function() {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.getSpriteAirFriction(this);
// }));

// blockFactory.registerBlock(new Block(
//     'setAirFriction', 'set air friction to %n', [10], 'command',
//     'physics', false
// ).addSpriteAction(function(bounciness) {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     // TODO: Sanitize inputs
//     return physics.setSpriteAirFriction(this, bounciness);
// }));


// blockFactory.registerBlock(new Block(
//     'getVelocityX', 'velocity x', [], 'reporter',
//     'physics', false, false, true,
// ).addSpriteAction(function() {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.getSpriteVelocity(this).x;
// }));

// blockFactory.registerBlock(new Block(
//     'getVelocityY', 'velocity y', [], 'reporter',
//     'physics', false, false, true,
// ).addSpriteAction(function() {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.getSpriteVelocity(this).y;
// }));

// blockFactory.registerBlock(new Block(
//     'getSpeed', 'speed', [], 'reporter',
//     'physics', false, false, true,
// ).addSpriteAction(function() {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.getSpriteSpeed(this);
// }));

// blockFactory.registerBlock(new Block(
//     'setVelocityX', 'set x velocity to %n', [], 'command',
//     'physics', false
// ).addSpriteAction(function(vx) {
//     if (!this.isPhysicsObject) return;
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     physics.setSpriteVelocity(this, vx);
// }));

// blockFactory.registerBlock(new Block(
//     'setVelocityY', 'set y velocity to %n', [], 'command',
//     'physics', false
// ).addSpriteAction(function(vy) {
//     if (!this.isPhysicsObject) return;
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     physics.setSpriteVelocity(this, undefined, vy);
// }));

// blockFactory.registerBlock(new Block(
//     'accelerate', 'accelerate by %n at %dir', [], 'command',
//     'physics', false
// ).addSpriteAction(function(magnitude, dir) {
//     if (!this.isPhysicsObject) return;
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     physics.accelerateSprite(this, magnitude, dir);
// }));

// blockFactory.registerBlock(new Block(
//     'getForceMagnitude', 'force on this', [], 'reporter',
//     'physics', false
// ).addSpriteAction(function() {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.getSpriteForceMagnitude(this);
// }));

// blockFactory.registerBlock(new Block(
//     'getForceDirection', 'direction of force on this', [], 'reporter',
//     'physics', false
// ).addSpriteAction(function() {
//     if (!this.isPhysicsObject) return 0;
//     let physics = Physics.getPhysics();
//     if (!physics) return 0;
//     return physics.getSpriteForceDirection(this);
// }));


// blockFactory.registerBlock(new Block(
//     'applyForce', 'apply %n force at %dir', [], 'command',
//     'physics', false
// ).addSpriteAction(function(magnitude, dir) {
//     if (!this.isPhysicsObject) return;
//     let physics = Physics.getPhysics();
//     if (!physics) return;
//     physics.applyForceToSprite(this, magnitude, dir);
// }));