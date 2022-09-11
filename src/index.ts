import { Blocks, Events, Extension, Snap } from 'sef';
import { Color } from 'sef/src/snap/Snap';
import { Levels } from './Level';
import { addCameraBlocks, Camera } from './Camera';

export class SnapGames extends Extension {
    addBlocks(blocks: Blocks.BlockFactory): void {
        Levels.addBlocks(blocks);
        addCameraBlocks(blocks);
    }

    init() {
        this.blocks.addCategory('Game', new Color(120, 80, 20));
    }
}

const games = new SnapGames();
games.register();

export {
    Camera,
}



