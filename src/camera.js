// class Camera {
//     constructor() {
//         this.target = window.ide.stage;
//         this.center = ZERO;
//         this.scale = 1;
//         this.snap = 100;
//     }

//     static getCamera() {
//         if (!window.ide) return null;
//         return window.ide.stage.threads.camera;
//     }

//     static isHoldingCamera(sprite) {
//         let camera = this.getCamera();
//         if (!camera) return false;
//         return camera.target === sprite;
//     }

//     isUserControlling() {
//         return this.target && this.target.isUser;
//     }

//     startUserControl() {
//         this.target = {
//             scale: this.scale,
//             center: this.center.copy(),
//             isUser: true,
//         }
//     }

//     previewCenter() {
//         if (!this.target || this.target instanceof StageMorph) {
//             return ZERO;
//         } else if (this.isUserControlling()) {
//             this.updateUserCamera()
//             return this.target.center;
//         }
//         return new Point(this.target.xPosition(), this.target.yPosition());
//     }

//     updateUserCamera() {
//         let target = this.target;
//         if (!target.isPanning) return;
//         if (!window.world || !window.ide) return;
//         let hand = window.world.hand;
//         let stage = window.ide.stage;
//         if (!hand || !stage) return;
//         if (hand.mouseButton !== 'left') {
//             target.isPanning = false;
//             target.panCameraStart = null;
//             target.panMouseStart = null;
//             return;
//         }
//         let mousePos = hand.position();
//         let offset = target.panMouseStart.subtract(mousePos)
//             .multiplyBy(1 / target.scale / stage.scale);
//         offset.y = -offset.y;
//         target.center = target.panCameraStart.add(offset);
//     }

//     previewScale() {
//         if (!this.target || this.target instanceof StageMorph) {
//             return 1
//         } else if (this.isUserControlling()) {
//             return this.target.scale;
//         }
//         return 100 / this.target.getScale();
//     }

//     update() {
//         let rate = 0.05 + 0.95 * Math.pow((this.snap) / 100, 4);
//         this.center = this.center.lerp(this.previewCenter(), rate, 1);
//         this.scale = lerp(this.scale, this.previewScale(), rate, 0.01);
//     }

//     setTarget(sprite) {
//         this.target = sprite;
//     }
// }

// Point.prototype.lerp = function(b, p, thresh) {
//     return new Point(
//         lerp(this.x, b.x, p, thresh),
//         lerp(this.y, b.y, p, thresh),
//     );
// }

// extend(StageMorph, 'init', function(base, globals) {
//     base.call(this, globals);
//     this.threads.camera = new Camera();
// });

// extend(StageMorph, 'mouseScroll', function(base, y) {
//     base.call(this, y);
//     let camera = Camera.getCamera();
//     if (!camera || !camera.isUserControlling()) return;
//     if (camera.target.isPanning) return;
//     camera.target.scale *= Math.pow(1.1, y);
// });

// extend(StageMorph, 'mouseDownLeft', function(base, pos) {
//     let camera = Camera.getCamera();
//     if (!camera || !camera.isUserControlling()) {
//         base.call(this, pos);
//         return;
//     }
//     let user = camera.target;
//     user.isPanning = true;
//     user.panMouseStart = pos.copy();
//     user.panCameraStart = user.center.copy();
// });

// blockFactory.registerBlock(new Block(
//     'resetCamera', 'reset camera', [], 'command', 'game', false
// ).addSpriteAction(function() {
//     Camera.getCamera().setTarget(null);
// }));

// blockFactory.registerBlock(new Block(
//     'holdCamera', 'hold camera', [], 'command', 'game', false
// ).addSpriteAction(function() {
//     Camera.getCamera().setTarget(this);
// }));

// blockFactory.registerBlock(new Block(
//     'userControlsCamera', 'let user control camera', [], 'command', 'game', false
// ).addSpriteAction(function() {
//     Camera.getCamera().startUserControl();
// }));

// blockFactory.registerBlock(new Block(
//     'isHoldingCamera', 'is holding camera', [], 'predicate', 'game', false
// ).addSpriteAction(function() {
//     return Camera.isHoldingCamera(this);
// }));

// blockFactory.registerBlock(new Block(
//     'setCameraSnap', 'set camera snap to %n', [100], 'command', 'game', false
// ).addSpriteAction(function(snap) {
//     let camera = Camera.getCamera();
//     if (!camera) return;
//     camera.snap = Math.min(Math.max(+snap, 0), 100);
// }));

// blockFactory.registerBlock(new Block(
//     'getCameraSnap', 'camera snap', [], 'reporter', 'game', false
// ).addSpriteAction(function() {
//     let camera = Camera.getCamera();
//     if (!camera) return 1;
//     return camera.snap;
// }));

// // blockFactory.registerBlock(new Block(
// //     'getIgnoresCamera', 'ignores camera', [], 'predicate', 'game', true
// // ).addSpriteAction(function() {
// //     return this.ignoresCamera || false;
// // }));

// // blockFactory.registerBlock(new Block(
// //     'setIgnoresCamera', 'set ignores camera %b', [false], 'command', 'game',
// //     true
// // ).addSpriteAction(function(b) {
// //     this.ignoresCamera = !!b;
// // }));

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

// extend(StageMorph, 'stepFrame', function(base) {
//     base.call(this);
//     this.updateSpriteForCamera();
// });

// StageMorph.prototype.updateSpriteForCamera = function(force) {
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
//             child.updateGlobalPosition();
//             child.setScale(child.getScale());
//         }
//     });
// }
