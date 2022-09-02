import { Blocks, Events, Extension, Snap } from 'sef';
import { Color } from 'sef/src/snap/Snap';
import { Levels } from './level';
import { Camera } from './Camera';

export class SnapGames extends Extension {
    addBlocks(blocks: Blocks.BlockFactory): void {
        Levels.addBlocks(blocks);
    }

    init() {
        this.blocks.addCategory('game', new Color(120, 80, 20));
        console.log('initialized!');
        console.log('ide', Snap.IDE);
        this.events.addListener(new Events.Block.SnappedListener(args => {
            console.log(args.id);
        }));

        new Camera();
    }
}

const games = new SnapGames();
games.register();



