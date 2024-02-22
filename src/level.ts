import { Blocks, Snap } from "sef";
import { List, SpriteMorph } from "sef/src/snap/Snap";

const Block = Blocks.Block;
const BlockType = Blocks.BlockType

type Value =  string | number | boolean;

interface Attribute {
    name: string;
    get: (sprite: SpriteMorph) => Value;
    set: (sprite: SpriteMorph, value: Value) => void;
}

const NAME = 'sprite name'
const IS_CLONE = 'is clone';

export class Levels {

    static getAttributes() {
        let attrs = [] as Attribute[];

        attrs.push({
            name: NAME,
            get: s => s.isTemporary ? s.cloneOriginName : s.name,
            set: null,
        });
        attrs.push({
            name: 'x',
            get: s => s.xPosition(),
            set: (s, v) => s.setXPosition(v as number),
        });
        attrs.push({
            name: 'y',
            get: s => s.yPosition(),
            set: (s, v) => s.setYPosition(v as number),
        });
        attrs.push({
            name: 'direction',
            get: s => s.direction(),
            set: (s, v) => s.setHeading(v),
        });
        attrs.push({
            name: 'size',
            get: s => s.getScale(),
            set: (s, v) => s.setScale(v),
        });
        attrs.push({
            name: 'costume #',
            get: s => s.getCostumeIdx(),
            set: (s, v) => s.doSwitchToCostume(v),
        });
        attrs.push({
            name: 'showing',
            get: s => s.reportShown(),
            set: (s, v) => s.setVisibility(v as boolean),
        });
        attrs.push({
            name: IS_CLONE,
            get: s => s.isTemporary,
            set: null,
        });

        return attrs;
    }

    // private static getAttribute(name: string) {
    //     return this.getAttributes().filter(attr => attr.name == name)[0];
    // }

    private static getAttribute(name: string, row: List, header: List) {
        let index = header.contents.indexOf(name);
        if (index < 0) return null;
        return row.contents[index];
    }

    static addBlocks(blockFactory: Blocks.BlockFactory) {
        blockFactory.registerBlock(new Block(
            'saveLevel', 'save level', [], BlockType.Reporter, 'Game'
        ).addSpriteAction(function() {
            const attrs = Levels.getAttributes();
            let list = new List();
            let header = new List();
            attrs.forEach(attr => header.add(attr.name));
            list.add(header);
            if (!Snap.IDE) return list;
            let stage = Snap.stage;
            stage.children.forEach(sprite => {
                if (!(sprite instanceof SpriteMorph)) return;
                
                let row = new List();
                attrs.forEach(attr => row.add(attr.get(sprite)));
                list.add(row);
            });
            return list;
        }));
        
        
        blockFactory.registerBlock(new Block(
            'loadLevel', 'load level %l', [], BlockType.Command, 'Game', false
        ).addSpriteAction(function(list: List) {
            if (!list) return;
            // TODO: this should be in Process not SpriteMorph
            // this.assertType(list, 'list');
            let stage = Snap.IDE.stage;
            stage.removeAllClones();
            let attrs = Levels.getAttributes();
            let header = list.contents[0];

            list.contents.forEach((rowList, index) => {
                if (index === 0) return; // Skip header
                // this.assertType(row, 'list');

                let name = Levels.getAttribute(NAME, rowList, header);
                // Backwards compatibility
                if (name == null) name = Levels.getAttribute("Name", rowList, header);
                let isTemporary = Levels.getAttribute(IS_CLONE, rowList, header);

                let sprite = stage.children.filter(s =>
                    s instanceof SpriteMorph && s.name === name
                )[0];
                if (!sprite) {
                    console.warn('Sprite not found:', name);
                    return;
                }
                if (isTemporary) {
                    sprite = sprite.newClone(false);
                }

                attrs.forEach(attr => {
                    if (!attr.set) return;
                    let val = Levels.getAttribute(attr.name, rowList, header);
                    if (val == null) return;
                    attr.set(sprite, val);
                });
            });
        }));
    }
}

