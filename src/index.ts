import { Events, Extension, Blocks } from 'sef';

export class SnapGames extends Extension {

    addBlocks(blocks: Blocks.BlockFactory): void {
        blocks.registerBlock(new Blocks.Block(
            'test', 'test', [], Blocks.BlockType.Reporter,
            'motion',
        ).addSpriteAction(function() {
            return this;
        }));
    }

    init() {
        this.events.addListener(new Events.Block.SnappedListener(args => {
            console.log(args.id);
        }));
    }
}

const games = new SnapGames();
games.register();



