import { OverrideRegistry, Blocks, Snap } from "sef";
import { HandMorph, IDE_Morph, Point, SpriteMorph, StageMorph } from "sef/src/snap/Snap";

interface CameraTarget {
    sprite: SpriteMorph | StageMorph;
    transform: Transform;
}

// class StageTarget implements CameraTarget {

//     stage: StageMorph;
//     isUser: boolean;

//     constructor(stage: StageMorph) {
//         this.stage = stage;
//         this.isUser = false;
//     }

//     get scale() { return this.stage.scale; }

//     center = () => this.stage.center();

// }

const ZERO = new Point(0, 0); // TODO: Why doesn't ZERO exist?

export class Camera {

    target: CameraTarget;
    transform: Transform;
    snap: number;
    isPanning = false;
    panMouseStart: Point;
    panCameraStart: Point;

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
            transform: this.transform,
        }
    }

    previewPosition() : Point {
        if (this.isUserControlling()) {
            this.updateUserCamera()
        }
        return this.target.transform.position;
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
            .multiplyBy(1 / this.transform.scale / stage.scale);
        offset.y = -offset.y;
        this.transform.position = this.panCameraStart.add(offset);;
    }

    previewScale() {
        if (!this.target || this.target instanceof StageMorph) {
            return 1
        // TODO: Why are these different?
        } else if (this.isUserControlling()) {
            return this.target.transform.scale;
        }
        return 100 / this.target.transform.scale;
    }

    update() {
        let rate = 0.05 + 0.95 * Math.pow((this.snap) / 100, 4);
        this.transform.position = this.transform.position.lerp(this.previewPosition(), rate, 1);
        this.transform.scale = lerp(this.transform.scale, this.previewScale(), rate, 0.01);
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


class Transform {
    position = new Point();
    scale = 1;
    rotation = 0;

    set(sprite: SpriteMorph) {
        // TODO: Inverse transform
        let stage = sprite.parentThatIsA(StageMorph);
        this.position = sprite.rotationCenter();
        if (stage) this.position = this.position.subtract(stage.center());
        this.position.y = -this.position.y;
        this.scale = sprite.scale;
        this.rotation = sprite.heading;
        return this;
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

    getGlobalRotation() {
        let camera = Camera.getCamera();
        let rotation = this.rotation;
        // if (camera) rotation += rotation;
        return rotation;
    }

    getGlobalScale() {
        let camera = Camera.getCamera();
        let scale = this.scale;
        if (camera) scale *= camera.transform.scale;
        return scale;
    }

    getGlobalPosition(sprite: SpriteMorph) {
        let stage = sprite.parentThatIsA(StageMorph);
        if (!stage) return this.position.copy();
        let camera = Camera.getCamera();
        let position = this.position;
        if (camera) {
            position = position.subtract(camera.transform.position);
            position = position.multiplyBy(camera.transform.scale);
        }
        let newX = stage.center().x + position.x * stage.scale;
        let newY = stage.center().y - position.y * stage.scale;
        if (sprite.costume) {
            return new Point(newX, newY).subtract(sprite.rotationOffset);
        } else {
            return new Point(newX, newY).subtract(sprite.extent().divideBy(2));
        }
    }
}

SpriteMorph.prototype.updateGlobalTransform = function(justMe) {
    // let stage = this.getStage();
    // if (!stage) return;
    if (this.isUpdatingGlobalTransform) return;
    this.isUpdatingGlobalTransform = true;
    let heading = this.transform.getGlobalRotation();
    if (heading != this.heading) this.setGlobalHeading(heading, true);
    let scale = this.transform.getGlobalScale();
    if (scale != this.scale) this.setGlobalScale(scale * 100, true);
    let position = this.transform.getGlobalPosition(this);
    if (!position.eq(this.position)) this.setPosition(position, justMe, true);
    this.positionTalkBubble();
    this.isUpdatingGlobalTransform = false;
    // TODO: Handle pen
}

SpriteMorph.prototype.updateStageTransform = function() {
    // Ignore any calls during a global transform update
    if (!this.transform || this.isUpdatingGlobalTransform) return;
    this.transform.set(this);
}

OverrideRegistry.after(SpriteMorph, 'init', function() {
    this.transform = new Transform().set(this);
    this.dirtyTransform = false;
});

OverrideRegistry.after(SpriteMorph, 'setPosition', function() {
    this.updateStageTransform();
});

OverrideRegistry.after(SpriteMorph, 'setCenter', function() {
    this.updateStageTransform();
});

OverrideRegistry.after(StageMorph, 'reactToDropOf', function(morph) {
    if (morph instanceof SpriteMorph)
    morph.updateStageTransform();
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

// TODO: Needed?
// StageMorph.prototype.cameraScale = function() {
//     let camera = Camera.getCamera();
//     if (!camera) return this.scale;
//     return this.scale * camera.scale;
// }

// StageMorph.prototype.cameraCenter = function() {
//     let camera = Camera.getCamera();
//     if (!camera) return this.center();
//     return camera.center;
// }

StageMorph.prototype.updateSpriteForCamera = function(force: boolean) {
    let camera = Camera.getCamera();
    if (!camera) return;
    let scale = camera.transform.scale, center = camera.transform.position,
        newScale = camera.previewScale(), newCenter = camera.previewPosition();
    let forceDirty = force || scale != newScale || !newCenter.eq(center);
    camera.update();
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
    if (!camera || !camera.isUserControlling()) return;
    if (camera.isPanning) return;
    camera.transform.scale *= Math.pow(1.1, y);
});

OverrideRegistry.extend(StageMorph, 'mouseDownLeft', function(base, pos) {
    let camera = Camera.getCamera();
    if (!camera || !camera.isUserControlling()) {
        base.call(this, pos);
        return;
    }
    let user = camera.target;
    camera.isPanning = true;
    camera.panMouseStart = pos.copy();
    camera.panCameraStart = camera.transform.position;
}, false);

OverrideRegistry.after(StageMorph, 'stepFrame', function() {
    this.updateSpriteForCamera();
});


const Block = Blocks.Block;
const BlockType = Blocks.BlockType;

export function addCameraBlocks(blockFactory: Blocks.BlockFactory) {

    blockFactory.registerBlock(new Block(
        'resetCamera', 'reset camera', [], BlockType.Command, 'game', false
    ).addSpriteAction(function() {
        Camera.getCamera().setTarget(null);
    }));

    blockFactory.registerBlock(new Block(
        'holdCamera', 'hold camera', [], BlockType.Command, 'game', false
    ).addSpriteAction(function() {
        Camera.getCamera().setTarget(this);
    }));

    blockFactory.registerBlock(new Block(
        'userControlsCamera', 'let user control camera', [], BlockType.Command, 'game', false
    ).addSpriteAction(function() {
        Camera.getCamera().startUserControl();
    }));

    blockFactory.registerBlock(new Block(
        'isHoldingCamera', 'is holding camera', [], BlockType.Predicate, 'game', false
    ).addSpriteAction(function() {
        return Camera.isHoldingCamera(this);
    }));

    blockFactory.registerBlock(new Block(
        'setCameraSnap', 'set camera snap to %n', [100], BlockType.Command, 'game', false
    ).addSpriteAction(function(snap) {
        let camera = Camera.getCamera();
        if (!camera) return;
        camera.snap = Math.min(Math.max(+snap, 0), 100);
    }));

    blockFactory.registerBlock(new Block(
        'getCameraSnap', 'camera snap', [], BlockType.Reporter, 'game', false
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