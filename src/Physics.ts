import * as Matter from 'matter-js';
import * as PolyDecomp from 'poly-decomp'
import hull from 'hull.js'
import { Blocks, OverrideRegistry, Snap } from 'sef';
import { Color, Costume, Point, SpriteMorph, StageMorph } from 'sef/src/snap/Snap';
import { Transform } from './Camera';

const ZERO = new Point(0, 0);

interface PhysicsData {
    centerOffset?: Point;
    lastVelocity?: Matter.Vector;
    lastForce?: Matter.Vector;
    lastUpdateTransform?: Transform
}

function getPhysicsData(sprite: SpriteMorph): PhysicsData {
    if (!sprite.physicsData) sprite.physicsData = {};
    return sprite.physicsData;
}

export class Physics {

    engine: Matter.Engine;
    runner: Matter.Runner;
    render: Matter.Render;

    private static instance: Physics;

    gravityDirection: number;
    gravityMagnitude: number;

    private floor: Matter.Body;
    private spriteMap = new Map<SpriteMorph, Matter.Body>;
    private costumeMap = new Map<Costume, Matter.Vector[]>;

    static init(factory: Blocks.BlockFactory) {
        addOverrides();
        addBlocks(factory);
        this.instance = new Physics();
        return this.instance;
    }

    static getPhysics() {
        return this.instance;
    }

    constructor() {
        Matter.Common.setDecomp(PolyDecomp);

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

    snapDirToVec(direction: number, magnitude: number) {
        let vec = Matter.Vector.create;
        return Matter.Vector.rotateAbout(
            vec(0, -magnitude), direction / 180 * Math.PI, vec(0, 0)
        );
    }

    vecToSnapDir(vector) {
        let right = Matter.Vector.create(1, 0);
        let angle = Matter.Vector.angle(right, vector);
        return -angle / Math.PI * 180;
    }

    setGravity(magnitude: number, direction?: number) {
        if (direction === undefined) direction = this.gravityDirection;
        if (magnitude == this.gravityMagnitude &&
                direction === this.gravityDirection) {
            return;
        }
        this.gravityMagnitude = magnitude;
        this.gravityDirection = direction;
        let g = this.snapDirToVec(direction, magnitude);
        this.engine.gravity = {
            x: g.x,
            y: g.y,
            scale: 1
        };
        this.wakeUpAllBodies();
    }

    wakeUpAllBodies() {
        this.spriteMap.forEach((body) => {
            Matter.Sleeping.set(body, false);
        });
    }

    addSprite(sprite) {
        sprite.physicsData = {};
        var body = this.createBodyForCostume(sprite);
        Matter.Composite.add(this.engine.world, body);
        // We update the scale here, since body already
        // sprite.lastUpdateScale = sprite.scale;
        this.updateSpriteBody(sprite, body);
        this.spriteMap.set(sprite, body);
    }

    createVerticesForCostume(costume) {
        let canvas = costume.contents;
        let key = canvas;
        if (this.costumeMap.has(key)) {
            return this.costumeMap.get(key);
        }
        // console.log("Creating new costume for ", costume);

        let ctx = canvas.getContext('2d');
        let data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let pps = 50;
        let dx = Math.ceil(canvas.width / pps);
        let dy = Math.ceil(canvas.height / pps);
        let points = []
        for (let x = 0; x < canvas.width; x += dx) {
            for (let y = 0; y < canvas.height; y += dy) {
                let offset = 4 * (y * canvas.width + x) + 3;
                if (data[offset] > 0) {
                    points.push([x, y]);
                }
            }
        }
        let cvHull = hull(points, 10);
        // Since this is only called for concave shapes, go ahead and remove
        // collinear points (which are common).
        Matter.Common.getDecomp().removeCollinearPoints(cvHull, 0.01);
        // Sometimes a second call is necessary... why?
        Matter.Common.getDecomp().removeDuplicatePoints(cvHull, 0.01);

        this.costumeMap.set(key, cvHull);
        return cvHull;
    }

    createBodyForCostume(sprite: SpriteMorph) {
        let costume = sprite.costume;
        if (!costume) return this.createDefaultBody(sprite);
        // TODO rasterize
        let canvas = costume.contents;
        if (!canvas.getContext) return this.createDefaultBody(sprite);

        let points = this.createVerticesForCostume(costume);
        let vertices = points.map(p => Matter.Vector.create(p[0], p[1]));
        let body = Matter.Bodies.fromVertices(
            0, 0, vertices,
        );

        let bodyMin = body.bounds.min, bodyMax = body.bounds.max;
        let newCenter = new Point(
            (bodyMin.x + bodyMax.x) / 2,
            (bodyMin.y + bodyMax.y) / 2
        );

        let offset = costume.rotationCenter
            .subtract(costume.center())
            .add(newCenter);
        
        getPhysicsData(sprite).centerOffset = offset;

        return body;
    }

    createDefaultBody(sprite: SpriteMorph) {
        let len = 30;
        let offset = 90;
        let start = new Point(0, 0);
        let dest = start.distanceAngle(len * 0.75, offset + 180);
        let left = start.distanceAngle(len, offset - 195);
        let right = start.distanceAngle(len, offset + 195);

        let body = Matter.Bodies.fromVertices(
            0, 0, [[
                this.toVector(start, true),
                this.toVector(left, true),
                this.toVector(dest, true),
                this.toVector(right, true),
            ]]
        );
        getPhysicsData(sprite).centerOffset = new Point(17, 0);
        return body;
    }

    removeSprite(sprite) {
        let body = this.spriteMap.get(sprite);
        if (!body) return;
        this.spriteMap.delete(sprite);
        Matter.Composite.remove(this.engine.world, body);
        sprite.physicsData = undefined;
    }

    updateSpriteBody(sprite: SpriteMorph, body?: Matter.Body) {
        if (!body) body = this.spriteMap.get(sprite);
        if (!body) return;

        let data = getPhysicsData(sprite);
        let transform = sprite.transform as Transform;

        if (!data.lastUpdateTransform) data.lastUpdateTransform = new Transform();
        let lastTransform = data.lastUpdateTransform;

        // If the Sprite hasn't moved since physics last moved it
        // we don't need to update.
        if (lastTransform.equals(transform)) return;

        // Otherwise, we update the physcis body based on the Sprite's transform

        // Update position
        let pos = transform.position.copy();
        pos.y = -pos.y;
        if (data.centerOffset) {
            pos = pos.subtract(this.getBodyOffset(body, sprite));
        }
        Matter.Body.setPosition(body, this.toVector(pos));

        // Update angle
        let angle = (-90 + transform.rotation) * Math.PI / 180;
        Matter.Body.setAngle(body, angle);

        // Update scale
        let scaleUp = sprite.scale / transform.scale;
        Matter.Body.scale(body, scaleUp, scaleUp);
        // Scale center offset too
        data.centerOffset = data.centerOffset.scaleBy(scaleUp);

        // Then update the 
        lastTransform.set(transform);

        // The position changed, so wake up!
        Matter.Sleeping.set(body, false);
    }

    update() {
        this.spriteMap.forEach((body, sprite) => {
            this.updateSpriteBody(sprite, body);
            getPhysicsData(sprite).lastVelocity = Matter.Vector.clone(body.velocity);
        });
        // Fixed stepping is safer
        Matter.Engine.update(this.engine);
        this.spriteMap.forEach((body, sprite) => {
            if (!sprite.parentThatIsA(StageMorph)) return;

            let data = getPhysicsData(sprite);

            let pos = this.toPoint(body.position);
            if (data.centerOffset) {
                pos = pos.add(this.getBodyOffset(body, sprite));
            }
            pos.y = -pos.y;

            let transform = sprite.transform as Transform;
            transform.position.x = pos.x;
            transform.position.y = pos.y;
            transform.rotation = 90 + body.angle * 180 / Math.PI;
            sprite.dirtyTransform = true;

            // This is a nice simple calculation, but it is net force,
            // not total force. So if there's equal force from both sides,
            // the result is 0. Could modify the physics engine to calculate
            // it differently, but this work pretty well for now.
            data.lastForce = Matter.Vector.mult(
                Matter.Vector.sub(data.lastVelocity, body.velocity),
                body.mass);
        });
    }

    getBodyOffset(body, sprite) {
        return getPhysicsData(sprite).centerOffset.rotateBy((90 - sprite.heading) / 180 * Math.PI)
    }

    isFloorActive(): boolean {
        return !!this.floor;
    }

    setFloorActive(active) {
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

    getSpriteProperty(sprite, f, alt) {
        let body = this.spriteMap.get(sprite);
        if (!body) return alt;
        return f(body);
    }

    withSprite(sprite: SpriteMorph, f, dontWake = false) {
        let body = this.spriteMap.get(sprite);
        if (!body) return;
        f(body);
        if (!dontWake) {
            Matter.Sleeping.set(body, false);
        }
    }

    getSpriteMass(sprite: SpriteMorph) {
        return this.getSpriteProperty(sprite, b => b.mass, 1);
    }

    setSpriteMass(sprite: SpriteMorph, mass) {
        return this.withSprite(sprite, b => {
            Matter.Body.setMass(b, mass)
        });
    }

    getSpriteBounciness(sprite: SpriteMorph) {
        return this.getSpriteProperty(sprite, b => b.restitution, 0) * 100;
    }

    setSpriteBounciness(sprite: SpriteMorph, bounciness: number) {
        bounciness = Math.min(Math.max(0, bounciness), 100);
        return this.withSprite(sprite, b => {
            b.restitution = bounciness / 100;
        });
    }

    getSpriteAirFriction(sprite: SpriteMorph) {
        return this.getSpriteProperty(sprite, b => b.frictionAir, 10) * 100;
    }

    setSpriteAirFriction(sprite: SpriteMorph, airFriction: number) {
        airFriction = Math.min(Math.max(0, airFriction), 100);
        return this.withSprite(sprite, b => {
            b.frictionAir = airFriction / 100;
        });
    }

    getSpriteVelocity(sprite: SpriteMorph) {
        return this.getSpriteProperty(sprite,
            b => this.toPoint(b.velocity, true),
            ZERO
        );
    }

    getSpriteSpeed(sprite) {
        return this.getSpriteProperty(sprite, b => b.speed, 0);
    }

    setSpriteVelocity(sprite, vx?: number, vy?: number) {
        let vel = this.getSpriteVelocity(sprite).copy();
        if (vx !== undefined) vel.x = vx;
        if (vy !== undefined) vel.y = vy;
        this.withSprite(sprite, b => {
            Matter.Body.setVelocity(b, this.toVector(vel, true));
        });
    }

    accelerateSprite(sprite, magnitude, dir) {
        this.withSprite(sprite, b => {
            let newVel = Matter.Vector.add(
                b.velocity,
                this.snapDirToVec(dir, magnitude)
            );
            Matter.Body.setVelocity(b, newVel);
        });
    }

    getSpriteForceDirection(sprite) {
        let force = this.getSpriteProperty(sprite, b => b.lastForce, null);
        if (!force) return 0;
        return this.vecToSnapDir(force);
    }

    getSpriteForceMagnitude(sprite) {
        return this.getSpriteProperty(sprite,
            b => Matter.Vector.magnitude(b.lastForce || b.force),
            0
        );
    }

    applyForceToSprite(sprite, magnitude, dir) {
        this.accelerateSprite(sprite,
            magnitude / this.getSpriteMass(sprite), dir);
    }

    toPoint(vector, flipY = false) {
        let y = flipY ? -vector.y : vector.y;
        return new Point(vector.x, y);
    }

    toVector(point, flipY = false) {
        let y = flipY ? -point.y : point.y;
        return Matter.Vector.create(point.x, y);
    }
}

function addOverrides() {

    OverrideRegistry.after(SpriteMorph, 'updateStageTransform', function() {
        let physics = Physics.getPhysics();
        if (!physics) return;
        physics.updateSpriteBody(this);
    });

    OverrideRegistry.extend(SpriteMorph, 'destroy', function(base) {
        base.call(this);
        let physics = Physics.getPhysics();
        if (!physics) return;
        physics.removeSprite(this);
    });

    OverrideRegistry.extend(SpriteMorph, 'wearCostume', function(base, costume, noShadow) {
        base.call(this, costume, noShadow);
        if (this.isPhysicsObject) {
            let physics = Physics.getPhysics();
            if (!physics) return;
            physics.removeSprite(this);
            physics.addSprite(this);
        }
    });

}

function addBlocks(blockFactory: Blocks.BlockFactory) {

    const Block = Blocks.Block;
    const BlockType = Blocks.BlockType;

    const category = 'Physics';

    blockFactory.addCategory(category, new Color(200, 70, 70));

    blockFactory.registerBlock(new Block(
        'updatePhysics', 'update physics', [], BlockType.Command, category, true
    ).addSpriteAction(function(hasPhysics) {
        let physics = Physics.getPhysics();
        if (!physics) return;
        physics.update();
    }));

    blockFactory.registerBlock(new Block(
        'setPhysics', 'set physics %b', [], BlockType.Command, category, true
    ).addSpriteAction(function(hasPhysics) {
        if (this.isPhysicsObject == hasPhysics) return;
        this.isPhysicsObject = !!hasPhysics;
        let physics = Physics.getPhysics();
        if (!physics) return;
        if (this.isPhysicsObject) {
            physics.addSprite(this);
        } else {
            physics.removeSprite(this);
        }
    }));

    blockFactory.registerBlock(new Block(
        'setGravityMagnitude', 'set gravity to %n %', [100], BlockType.Command,
        category, false
    ).addSpriteAction(function(g) {
        let physics = Physics.getPhysics();
        if (!physics) return;
        physics.setGravity(g / 100);
    }));

    blockFactory.registerBlock(new Block(
        'getGravityMagnitude', 'gravity', [], BlockType.Reporter,
        category, false
    ).addSpriteAction(function() {
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.gravityMagnitude * 100;
    }));

    blockFactory.registerBlock(new Block(
        'setGravityDirection', 'point gravity in %dir', [180], BlockType.Command,
        category, false
    ).addSpriteAction(function(dir) {
        let physics = Physics.getPhysics();
        if (!physics) return;
        physics.setGravity(physics.gravityMagnitude, +dir);
    }));

    blockFactory.registerBlock(new Block(
        'getGravityDirection', 'gravity direction', [], BlockType.Reporter,
        category, false
    ).addSpriteAction(function() {
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.gravityDirection;
    }));

    blockFactory.registerBlock(new Block(
        'isFloorActive', 'floor active', [], BlockType.Predicate,
        category, false
    ).addSpriteAction(function() {
        let physics = Physics.getPhysics();
        if (!physics) return false;
        return physics.isFloorActive();
    }));

    blockFactory.registerBlock(new Block(
        'setFloorActive', 'set floor active to %b', [], BlockType.Command,
        category, false
    ).addSpriteAction(function(active) {
        let physics = Physics.getPhysics();
        if (!physics) return false;
        return physics.setFloorActive(active);
    }));


    blockFactory.registerBlock(new Block(
        'getMass', 'mass', [], BlockType.Reporter,
        category, false
    ).addSpriteAction(function() {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.getSpriteMass(this);
    }));

    blockFactory.registerBlock(new Block(
        'setMass', 'set mass to %n', [1], BlockType.Command,
        category, false
    ).addSpriteAction(function(mass) {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return;
        // TODO: Sanitize inputs
        return physics.setSpriteMass(this, mass);
    }));

    blockFactory.registerBlock(new Block(
        'getBounciness', 'bounciness', [], BlockType.Reporter,
        category, false
    ).addSpriteAction(function() {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.getSpriteBounciness(this);
    }));

    blockFactory.registerBlock(new Block(
        'setBounciness', 'set bounciness to %n', [50], BlockType.Command,
        category, false
    ).addSpriteAction(function(bounciness) {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return;
        // TODO: Sanitize inputs
        return physics.setSpriteBounciness(this, bounciness);
    }));

    blockFactory.registerBlock(new Block(
        'getAirFriction', 'air friction', [], BlockType.Reporter,
        category, false
    ).addSpriteAction(function() {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.getSpriteAirFriction(this);
    }));

    blockFactory.registerBlock(new Block(
        'setAirFriction', 'set air friction to %n', [10], BlockType.Command,
        category, false
    ).addSpriteAction(function(bounciness) {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return;
        // TODO: Sanitize inputs
        return physics.setSpriteAirFriction(this, bounciness);
    }));


    blockFactory.registerBlock(new Block(
        'getVelocityX', 'velocity x', [], BlockType.Reporter,
        category, false, false, true,
    ).addSpriteAction(function() {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.getSpriteVelocity(this).x;
    }));

    blockFactory.registerBlock(new Block(
        'getVelocityY', 'velocity y', [], BlockType.Reporter,
        category, false, false, true,
    ).addSpriteAction(function() {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.getSpriteVelocity(this).y;
    }));

    blockFactory.registerBlock(new Block(
        'getSpeed', 'speed', [], BlockType.Reporter,
        category, false, false, true,
    ).addSpriteAction(function() {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.getSpriteSpeed(this);
    }));

    blockFactory.registerBlock(new Block(
        'setVelocityX', 'set x velocity to %n', [], BlockType.Command,
        category, false
    ).addSpriteAction(function(vx) {
        if (!this.isPhysicsObject) return;
        let physics = Physics.getPhysics();
        if (!physics) return;
        physics.setSpriteVelocity(this, vx);
    }));

    blockFactory.registerBlock(new Block(
        'setVelocityY', 'set y velocity to %n', [], BlockType.Command,
        category, false
    ).addSpriteAction(function(vy) {
        if (!this.isPhysicsObject) return;
        let physics = Physics.getPhysics();
        if (!physics) return;
        physics.setSpriteVelocity(this, undefined, vy);
    }));

    blockFactory.registerBlock(new Block(
        'accelerate', 'accelerate by %n at %dir', [], BlockType.Command,
        category, false
    ).addSpriteAction(function(magnitude, dir) {
        if (!this.isPhysicsObject) return;
        let physics = Physics.getPhysics();
        if (!physics) return;
        physics.accelerateSprite(this, magnitude, dir);
    }));

    blockFactory.registerBlock(new Block(
        'getForceMagnitude', 'force on this', [], BlockType.Reporter,
        category, false
    ).addSpriteAction(function() {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.getSpriteForceMagnitude(this);
    }));

    blockFactory.registerBlock(new Block(
        'getForceDirection', 'direction of force on this', [], BlockType.Reporter,
        category, false
    ).addSpriteAction(function() {
        if (!this.isPhysicsObject) return 0;
        let physics = Physics.getPhysics();
        if (!physics) return 0;
        return physics.getSpriteForceDirection(this);
    }));


    blockFactory.registerBlock(new Block(
        'applyForce', 'apply %n force at %dir', [], BlockType.Command,
        category, false
    ).addSpriteAction(function(magnitude, dir) {
        if (!this.isPhysicsObject) return;
        let physics = Physics.getPhysics();
        if (!physics) return;
        physics.applyForceToSprite(this, magnitude, dir);
    }));

}