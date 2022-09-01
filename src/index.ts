import { Blocks, Events, Extension, Snap } from 'sef';
import { Color } from 'sef/src/snap/Snap';

export class SnapGames extends Extension {
    addBlocks(blocks: Blocks.BlockFactory): void {
        blocks.registerBlock(new Blocks.Block(
            'test', 'test %n', [10], Blocks.BlockType.Reporter,
            'test'
        ).addSpriteAction((x) => {
            return x * 2;
        }));
    }
    
    init() {
        this.blocks.addCategory('test', new Color(255, 123, 0));
        console.log('initialized!');
        console.log('ide', Snap.IDE);
        this.events.addListener(new Events.Block.SnappedListener(args => {
            console.log(args.id);
        }));
    }
}

const games = new SnapGames();
games.register();



