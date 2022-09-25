import { Blocks, Events, Extension, Snap } from 'sef';
import { Color } from 'sef/src/snap/Snap';
import { Levels } from './Level';
import { addCameraBlocks, Camera } from './Camera';
import { Physics } from './Physics';

export class SnapGames extends Extension {

    physics: Physics;

    init() {
        Camera.init();
        this.physics = Physics.init(this.blocks);

        this.blocks.addCategory('Game', new Color(120, 80, 20));
        Levels.addBlocks(this.blocks);
        addCameraBlocks(this.blocks);
    }
}

const games = new SnapGames();
games.register();

export {
    Camera,
    Physics,
}



