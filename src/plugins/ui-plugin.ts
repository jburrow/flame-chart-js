import { EventEmitter } from 'events';
import { OffscreenRenderEngine } from '../engines/offscreen-render-engine';
import { SeparatedInteractionsEngine } from '../engines/separated-interactions-engine';

export abstract class UIPlugin<S = {}> extends EventEmitter {
    abstract name: string;
    abstract height?: number;

    interactionsEngine: SeparatedInteractionsEngine;
    renderEngine: OffscreenRenderEngine;

    min?: number;
    max?: number;
    styles?: S;

    protected constructor() {
        super();
    }

    init(renderEngine: OffscreenRenderEngine, interactionsEngine: SeparatedInteractionsEngine) {
        this.renderEngine = renderEngine;
        this.interactionsEngine = interactionsEngine;
    }

    postInit?(): void;

    render?(): boolean | void;

    setSettings?(settings: { styles: S }): void;

    renderTooltip?(): boolean;

    postRender?(): void;
}

export default UIPlugin;
