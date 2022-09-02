import { OverrideRegistry, Blocks, Snap } from "sef";
import { HandMorph, Point, SpriteMorph, StageMorph } from "sef/src/snap/Snap";

interface CameraTarget {
    scale: number;
    center: () => Point;
    getScale?: () => number;
    isUser?: boolean;
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

    target : CameraTarget;
    center: Point;
    scale: number;
    snap: number;
    isPanning = false;
    panMouseStart: Point;
    panCameraStart: Point;

    constructor() {
        this.target = Snap.stage;
        this.center = ZERO;
        this.scale = 1;
        this.snap = 100;
    }

    static getCamera() : Camera {
        if (!Snap.IDE) return null;
        return Snap.stage.threads.camera;
    }

    static isHoldingCamera(sprite: SpriteMorph) {
        let camera = this.getCamera();
        if (!camera) return false;
        return camera.target === sprite;
    }

    isUserControlling() : boolean {
        return this.target && this.target.isUser;
    }

    startUserControl() {
        this.target = {
            scale: this.scale,
            center: () => this.center.copy(),
            isUser: true,
        }
    }

    previewCenter() : Point {
        if (!this.target || this.target instanceof StageMorph) {
            return ZERO;
        } else if (this.isUserControlling()) {
            this.updateUserCamera()
        }
        return this.target.center();
    }

    updateUserCamera() {
        let target = this.target;
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
            .multiplyBy(1 / target.scale / stage.scale);
        offset.y = -offset.y;
        target.center = this.panCameraStart.add(offset);
    }

    previewScale() {
        if (!this.target || this.target instanceof StageMorph) {
            return 1
        } else if (this.isUserControlling()) {
            return this.target.scale;
        }
        return 100 / this.target.getScale();
    }

    update() {
        let rate = 0.05 + 0.95 * Math.pow((this.snap) / 100, 4);
        this.center = this.center.lerp(this.previewCenter(), rate, 1);
        this.scale = lerp(this.scale, this.previewScale(), rate, 0.01);
    }

    setTarget(sprite) {
        this.target = sprite;
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

    // TODO
    getGlobalRotation() {
        return this.rotation;
    }

    getGlobalScale() {
        return this.scale;
    }

    getGlobalPosition(sprite: SpriteMorph) {
        let stage = sprite.parentThatIsA(StageMorph);
        if (!stage) return this.position.copy();
        let newX = stage.center().x + this.position.x * stage.scale;
        let newY = stage.center().y - this.position.y * stage.scale;
        if (sprite.costume) {
            return new Point(newX, newY).subtract(sprite.rotationOffset);
        } else {
            return new Point(newX, newY).subtract(sprite.extent().divideBy(2));
        }
    }
}

SpriteMorph.prototype.updateGlobalTransform = function(justMe, silently) {
    // let stage = this.getStage();
    // if (!stage) return;
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
    this.stageMode = false;
    this.globalHeading = this.header;
    this.globalScale = this.scale;
    this.dirtyTransform = false;
    // Object.defineProperty(this, 'heading', {
    //     get() {
    //         if (this.stageMode) return this.transform.rotation;
    //         return this.globalHeading;
    //     },
    //     set(value) {
    //         if (this.stageMode) {
    //             this.transform.rotation = value;
    //             this.dirtyTransform = true;
    //         }
    //         else this.globalHeading = value;
    //     }
    // });
    // Object.defineProperty(this, 'scale', {
    //     get() {
    //         if (this.stageMode) return this.transform.scale;
    //         return this.globalScale;
    //     },
    //     set(value) {
    //         if (this.stageMode) {
    //             this.transform.scale = value;
    //             this.dirtyTransform = true;
    //         }
    //         else this.globalScale = value;
    //     }
    // });
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
    this.updateGlobalTransform();
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
    this.updateGlobalTransform();
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

// StageMorph.prototype.updateSpriteForCamera = function(force: boolean) {
//     let camera = Camera.getCamera();
//     if (!camera) return;
//     let scale = camera.scale, center = camera.center,
//         newScale = camera.previewScale(), newCenter = camera.previewCenter();
//     if (force) {
//         if (center != null && scale == newScale && newCenter.eq(center)) return;
//     }
//     camera.update();
//     this.children.forEach(child => {
//         if (child instanceof SpriteMorph) {
//             child.updateGlobalTransform();
//             child.setScale(child.getScale());
//         }
//     });
// }

// OverrideRegistry.extend(StageMorph, 'init', function(base, globals) {
//     base.call(this, globals);
//     this.threads.camera = new Camera();
// });

// OverrideRegistry.extend(StageMorph, 'mouseScroll', function(base, y) {
//     base.call(this, y);
//     let camera = Camera.getCamera();
//     if (!camera || !camera.isUserControlling()) return;
//     if (camera.isPanning) return;
//     camera.target.scale *= Math.pow(1.1, y);
// });

// OverrideRegistry.extend(StageMorph, 'mouseDownLeft', function(base, pos) {
//     let camera = Camera.getCamera();
//     if (!camera || !camera.isUserControlling()) {
//         base.call(this, pos);
//         return;
//     }
//     let user = camera.target;
//     camera.isPanning = true;
//     camera.panMouseStart = pos.copy();
//     camera.panCameraStart = user.center().copy();
// });

// OverrideRegistry.extend(StageMorph, 'stepFrame', function(base) {
//     base.call(this);
//     this.updateSpriteForCamera();
// });


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