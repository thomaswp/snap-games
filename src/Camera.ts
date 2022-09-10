import { OverrideRegistry, Blocks, Snap } from "sef";
import { HandMorph, IDE_Morph, Point, SpriteMorph, StageMorph } from "sef/src/snap/Snap";

interface CameraTarget {
    sprite: SpriteMorph | StageMorph;
    transform: Transform;
}

const ZERO = new Point(0, 0); // TODO: Why doesn't ZERO exist?

export class Camera {

    target: CameraTarget;
    transform: Transform;
    snap: number;
    private isPanning = false;
    private panMouseStart: Point;
    private panCameraStart: Point;

    constructor() {
        this.target = {
            sprite: Snap.stage,
            transform: new Transform(),
        };
        this.transform = new Transform();
        this.snap = 100;
    }

    static getCamera() : Camera {
        if (!Snap.IDE) return null;
        return Snap.stage.threads.camera;
    }

    static isHoldingCamera(sprite: SpriteMorph) {
        let camera = this.getCamera();
        if (!camera) return false;
        return camera.target.sprite === sprite;
    }

    isUserControlling() : boolean {
        return this.target && !this.target.sprite;
    }

    startUserControl() {
        this.target = {
            sprite: null,
            transform: this.transform.copy(),
        }
        this.target.transform.rotation = 0;
    }

    updateUserCamera() {
        if (!this.isPanning) return;
        if (!Snap.world || !Snap.IDE) return;
        let hand = Snap.world.hand as HandMorph;
        let stage = Snap.IDE.stage;
        if (!hand || !stage) return;
        if (hand.mouseButton !== 'left') {
            this.isPanning = false;
            this.panCameraStart = null;
            this.panMouseStart = null;
            return;
        }
        let mousePos = hand.position();
        let offset = this.panMouseStart.subtract(mousePos)
            .multiplyBy(this.transform.scale / stage.scale);
        offset.y = -offset.y;
        this.target.transform.position = this.panCameraStart.add(offset);
    }

    handleMouseDown(pos: any): boolean {
        if (!this.isUserControlling()) return false;
        this.isPanning = true;
        this.panMouseStart = pos.copy();
        this.panCameraStart = this.target.transform.position;
    }

    handleMouseScroll(y: number): boolean {
        if (!this.isUserControlling()) return false;
        if (this.isPanning) return false;
        this.target.transform.scale *= Math.pow(1.1, -y);
        return true;
    }

    update() : boolean {
        if (this.isUserControlling()) {
            this.updateUserCamera()
        }

        let targetTransform = this.target.transform;
        if (this.target.sprite != null) {
            // Since Sprites' default facing angle is 90, a camera-holding
            // Sprite at 90 shouldn't rotate the camera at all
            targetTransform = targetTransform.copy();
            targetTransform.rotation -= 90;
        }
        if (this.transform.equals(targetTransform)) {
            return false;
        }

        // TODO: Should be based on elapsed time, not frames
        let rate = 0.05 + 0.95 * Math.pow((this.snap) / 100, 4);
        this.transform.lerpTo(targetTransform, rate);
        return true;
    }

    setTarget(sprite: SpriteMorph | StageMorph) {
        this.target = {
            sprite: sprite,
            transform: sprite?.transform || new Transform(),
        };
    }
}

export function lerp(a: number, b: number, p: number, thresh: number) {
    if (thresh !== undefined && Math.abs(a - b) < thresh) return b;
    return a * (1 - p) + b * p;
}

Point.prototype.lerp = function(b: Point, p: number, thresh: number) {
    return new Point(
        lerp(this.x, b.x, p, thresh),
        lerp(this.y, b.y, p, thresh),
    );
}

/**
 * Represents a transform, including position, rotation and scale.
 * Transforms are local, usually relative to the stage, and may not
 * reflect the actual global position of a Morph on the screen.
 */
export class Transform {
    position: Point;
    rotation: number;
    scale: number;

    private static normalizeRotation(rotation) {
        while (rotation < 0) rotation += 360;
        return rotation % 360;
    }

    constructor(x = 0, y = 0, rotation = 0, scale = 1) {
        this.position = new Point(x, y);
        this.rotation = rotation;
        this.scale = scale;
    }

    set(transform: Transform) {
        this.position = transform.position.copy();
        this.rotation = transform.rotation;
        this.scale = transform.scale;
    }

    flipY() {
        this.position.y = -this.position.y;
    }

    lerpTo(transform: Transform, rate: number) {
        this.position = this.position.lerp(transform.position, rate, 1);
        this.scale = lerp(this.scale, transform.scale, rate, 0.01);

        // Make sure the target rotation is normalized and <= 180 degrees different
        this.rotation = Transform.normalizeRotation(this.rotation);
        let targetRotation = Transform.normalizeRotation(transform.rotation);
        if (this.rotation - targetRotation > 180) targetRotation += 360;
        if (this.rotation - targetRotation < -180) targetRotation -= 360;
        this.rotation = lerp(this.rotation, targetRotation, rate, 0.1);
    }

    inverseApplyToPoint(point: Point) {
        let p = point.subtract(this.position) as Point;
        p = p.rotateBy(-this.rotation / 180 * Math.PI);
        p = p.multiplyBy(1 / this.scale);
        return p;
    }

    applyToPoint(point: Point) {
        let p = point.multiplyBy(this.scale);
        p = p.rotateBy(this.rotation / 180 * Math.PI);
        p = p.add(this.position);
        return p;
    }

    inverseApply(transform: Transform): Transform {
        let position = this.inverseApplyToPoint(transform.position);
        return new Transform(
            position.x, position.y,
            transform.rotation - this.rotation,
            transform.scale / this.scale,
        )
    }

    apply(transform: Transform): Transform {
        let position = this.applyToPoint(transform.position);
        return new Transform(
            position.x, position.y,
            transform.rotation + this.rotation,
            transform.scale * this.scale,
        );

    }

    translateBy(offset: Point) {
        this.position = this.position.add(offset);
    }

    scaleBy(scale: number) {
        this.scale *= scale;
        this.position = this.position.multiplyBy(scale);
    }

    equals(transform: Transform) {
        return this.position == transform.position &&
            this.scale == transform.scale &&
            this.position == transform.position;
    }

    copy() {
        let transform = new Transform();
        transform.position = this.position.copy();
        transform.scale = this.scale;
        transform.rotation = this.rotation;
        return transform;
    }

    forwardPosition(steps: number) : Point{
        let angle = this.rotation;
        if (steps < 0) {
            steps = Math.abs(steps);
            angle += 180;
        }
        let pos = new Point(0, 0).distanceAngle(steps, angle);
        pos.y = -pos.y;
        return pos.add(this.position);
    }
}

/**
 * Updates this Sprite's global transform (position, rotation, scale) 
 * to match its local stage position. Call this when the transform
 * has been updated and you want to update the Morph to match.
 */
SpriteMorph.prototype.updateGlobalTransform = function(justMe) {
    if (this.isUpdatingGlobalTransform) return;
    this.isUpdatingGlobalTransform = true;

    let globalTransform = this.transform as Transform;

    let camera = Camera.getCamera();
    if (camera) globalTransform = camera.transform.inverseApply(globalTransform);
    
    globalTransform.flipY();

    let stage = this.parentThatIsA(StageMorph);
    if (stage) {
        globalTransform.scaleBy(stage.scale);
        globalTransform.translateBy(stage.center());
    }

    if (this.costume) {
        // TODO: Probably need to consider rotation
        globalTransform.translateBy(this.rotationOffset.multiplyBy(-1));
    } else {
        globalTransform.translateBy(this.extent().divideBy(-2));
    }

    let heading = globalTransform.rotation;
    if (heading != this.heading) this.setGlobalHeading(heading, true);
    let scale = globalTransform.scale
    if (scale != this.scale) this.setGlobalScale(scale * 100, true);
    let position = globalTransform.position;
    if (!position.eq(this.position)) this.setPosition(position, justMe, true);
    this.positionTalkBubble();

    this.isUpdatingGlobalTransform = false;
    // TODO: Handle pen
}

/**
 * Updates this Sprite's stage transform to match its global position
 * in the world. Call this when the Morph has been moved or scaled
 * and you want to update its transform to match.
 */
SpriteMorph.prototype.updateStageTransform = function() {
    // Ignore any calls during a global transform update
    if (!this.transform || this.isUpdatingGlobalTransform) return;

    let transform = new Transform();
    transform.position = this.rotationCenter();
    transform.rotation = this.heading;
    transform.scale = this.scale;

    let stage = this.parentThatIsA(StageMorph);
    if (stage) {
        transform.translateBy(stage.center().multiplyBy(-1));
        transform.scaleBy(1 / stage.scale);
    }

    transform.flipY();

    let camera = Camera.getCamera();
    if (camera) transform = camera.transform.apply(transform);
    this.dirtyTransform = false;
    
    this.transform.set(transform);
}

OverrideRegistry.after(SpriteMorph, 'init', function() {
    this.transform = new Transform();
    this.updateStageTransform();
});

OverrideRegistry.after(SpriteMorph, 'setPosition', function() {
    this.updateStageTransform();
});

OverrideRegistry.after(SpriteMorph, 'setCenter', function() {
    this.updateStageTransform();
});

OverrideRegistry.after(StageMorph, 'reactToDropOf', function(morph) {
    if (morph instanceof SpriteMorph) {
        morph.updateStageTransform();
    }
});

OverrideRegistry.after(StageMorph, 'add', function(morph) {
    if (morph instanceof SpriteMorph)
    morph.updateStageTransform();
});

OverrideRegistry.extend(SpriteMorph, 'gotoXY', function(base, x, y, justMe, noShadow) {
    if (!this.transform) return base.call(this, x, y, justMe, noShadow);
    if (!noShadow) {
        this.shadowAttribute('x position');
        this.shadowAttribute('y position');
    }
    this.transform.position = new Point(x, y);
    // Update transform directly so we can draw each movement separately
    this.dirtyTransform = true;
    this.updateGlobalTransform(justMe);
});

OverrideRegistry.extend(SpriteMorph, 'xPosition', function(base) {
    if (this.inheritsAttribute('x position')) {
        return this.exemplar.xPosition();
    }
    return this.transform.position.x;
});

OverrideRegistry.extend(SpriteMorph, 'yPosition', function(base) {
    if (this.inheritsAttribute('y position')) {
        return this.exemplar.yPosition();
    }
    return this.transform.position.y;
});

OverrideRegistry.extend(SpriteMorph, 'forward', function(base, steps) {
    if (steps === 0 && this.isDown) {
        return base.call(this, steps);
    }
    let dest = this.transform.forwardPosition(steps);
    this.gotoXY(dest.x, dest.y);
});

SpriteMorph.prototype.setGlobalHeading = SpriteMorph.prototype.setHeading;

SpriteMorph.prototype.setHeading = function (degrees, noShadow) {
    this.transform.rotation = ((+degrees % 360) + 360) % 360;
    // propagate to children that inherit my direction
    if (!noShadow) {
        this.shadowAttribute('direction');
    }
    this.dirtyTransform = true;
};

SpriteMorph.prototype.turn = function (degrees) {
    this.setHeading(this.transform.rotation + (+degrees || 0));
};

SpriteMorph.prototype.turnLeft = function (degrees) {
    this.setHeading(this.transform.rotation - (+degrees || 0));
};

SpriteMorph.prototype.direction = function () {
    if (this.inheritsAttribute('direction')) {
        return this.exemplar.direction();
    }
    return this.transform.rotation;
};

SpriteMorph.prototype.setGlobalScale = SpriteMorph.prototype.setScale;

SpriteMorph.prototype.setScale = function (scale, noShadow) {
    this.transform.scale = Math.max(0, scale / 100);
    if (!noShadow) {
        this.shadowAttribute('size');
    }
    this.dirtyTransform = true;
};

SpriteMorph.prototype.getScale = function () {
    // answer my scale in percent
    if (this.inheritsAttribute('size')) {
        return this.exemplar.getScale();
    }
    return this.transform.scale * 100;
};

StageMorph.prototype.updateSpriteForCamera = function(force: boolean) {
    let camera = Camera.getCamera();
    if (!camera) return;
    let forceDirty = force || camera.update();
    this.children.forEach(child => {
        if (child instanceof SpriteMorph) {
            if (forceDirty) child.dirtyTransform = true;
            child.updateGlobalTransform();
        }
    });
}

OverrideRegistry.after(StageMorph, 'init', function(globals) {
    this.threads.camera = new Camera();
});

OverrideRegistry.after(StageMorph, 'mouseScroll', function(y) {
    let camera = Camera.getCamera();
    if (camera) camera.handleMouseScroll(y);
});

OverrideRegistry.extend(StageMorph, 'mouseDownLeft', function(base, pos) {
    let camera = Camera.getCamera();
    if (camera && camera.handleMouseDown(pos)) return;
    base.call(this, pos);
}, false);

OverrideRegistry.after(StageMorph, 'stepFrame', function() {
    this.updateSpriteForCamera();
});


const Block = Blocks.Block;
const BlockType = Blocks.BlockType;

export function addCameraBlocks(blockFactory: Blocks.BlockFactory) {

    blockFactory.registerBlock(new Block(
        'resetCamera', 'reset camera', [], BlockType.Command, 'Game', false
    ).addSpriteAction(function() {
        Camera.getCamera().setTarget(null);
    }));

    blockFactory.registerBlock(new Block(
        'holdCamera', 'hold camera', [], BlockType.Command, 'Game', false
    ).addSpriteAction(function() {
        Camera.getCamera().setTarget(this);
    }));

    blockFactory.registerBlock(new Block(
        'userControlsCamera', 'let user control camera', [], BlockType.Command, 'Game', false
    ).addSpriteAction(function() {
        Camera.getCamera().startUserControl();
    }));

    blockFactory.registerBlock(new Block(
        'isHoldingCamera', 'is holding camera', [], BlockType.Predicate, 'Game', false
    ).addSpriteAction(function() {
        return Camera.isHoldingCamera(this);
    }));

    blockFactory.registerBlock(new Block(
        'setCameraSnap', 'set camera snap to %n', [100], BlockType.Command, 'Game', false
    ).addSpriteAction(function(snap) {
        let camera = Camera.getCamera();
        if (!camera) return;
        camera.snap = Math.min(Math.max(+snap, 0), 100);
    }));

    blockFactory.registerBlock(new Block(
        'getCameraSnap', 'camera snap', [], BlockType.Reporter, 'Game', false
    ).addSpriteAction(function() {
        let camera = Camera.getCamera();
        if (!camera) return 1;
        return camera.snap;
    }));

    // blockFactory.registerBlock(new Block(
    //     'getIgnoresCamera', 'ignores camera', [], 'predicate', 'game', true
    // ).addSpriteAction(function() {
    //     return this.ignoresCamera || false;
    // }));

    // blockFactory.registerBlock(new Block(
    //     'setIgnoresCamera', 'set ignores camera %b', [false], 'command', 'game',
    //     true
    // ).addSpriteAction(function(b) {
    //     this.ignoresCamera = !!b;
    // }));
}