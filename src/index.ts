import { Events, Extension } from 'sef';

export class SnapGames extends Extension {
    init() {
        console.log('initialized!');
        console.log('ide', this.snap.IDE);
        this.events.addListener(new Events.Block.SnappedListener(args => {
            console.log(args.id);
        }));
    }
}

const games = new SnapGames();
games.register();



