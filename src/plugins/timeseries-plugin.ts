import { OffscreenRenderEngine } from '../engines/offscreen-render-engine';
import { SeparatedInteractionsEngine } from '../engines/separated-interactions-engine';
import { HitRegion } from '../types';
import UIPlugin from './ui-plugin';

export interface TimeseriesPoint{
    timestamp:number,
    value:number,
}
export type TimeseriesPluginStyles = {
    defaultHeight: number;
};
export const defaultCPUPluginStyles: TimeseriesPluginStyles = {
    defaultHeight: 68,
};

export class TimeseriesPlugin extends UIPlugin<TimeseriesPluginStyles> {
    height: number;
    name:string;
    color:string;
    data:[number,number][];
    maxValue:number;

    constructor(name:string,color:string, data:[number,number][], maxValue=100) {
        super();
        
        this.maxValue = maxValue
        this.data = data;
        this.name=name;
        this.color=color;
        this.height = 100;     
    }

    override init(renderEngine: OffscreenRenderEngine, interactionsEngine: SeparatedInteractionsEngine) {
        super.init(renderEngine, interactionsEngine);

        this.interactionsEngine.on('change-position', this.handlePositionChange.bind(this));
        this.interactionsEngine.on('hover', this.handleHover.bind(this));
        this.interactionsEngine.on('select', this.handleSelect.bind(this));
        this.interactionsEngine.on('up', this.handleMouseUp.bind(this));
    }

    handlePositionChange({ deltaX, deltaY }: { deltaX: number; deltaY: number }) {
        
    }

    handleMouseUp() {
        
    }

    handleHover(region: HitRegion<number> | null) {
        
    }

    handleSelect(region: HitRegion<number> | null) {

    }

    setPositionY(y: number) {
        
    }

    override setSettings(settings) {
        // this.styles = mergeObjects(defaultWaterfallPluginStyles, styles);
        // this.height = this.styles.defaultHeight;
        // this.positionY = 0;
    }

    setData(data:TimeseriesPoint[]) {        
        
    }

    calcRect(start: number, duration: number, isEnd: boolean) {
        const w = duration * this.renderEngine.zoom;

        return {
            x: this.renderEngine.timeToPosition(start),
            w: isEnd ? (w <= 0.1 ? 0.1 : w >= 3 ? w - 1 : w - w / 3) : w,
        };
    }

    override renderTooltip() {
        return true;
     

    }

    override render() {
        const timestampEnd = this.renderEngine.positionX + this.renderEngine.getRealView();
        const timestampStart = this.renderEngine.positionX;
        
        console.log('[timeseries-plugin][render] timestamp', timestampStart, timestampEnd);

        this.renderEngine.setCtxColor(this.color);
        this.renderEngine.ctx.beginPath();
        
        const d:[number,number][] = [];        
        
        let beforeStart:[number,number]=[0,0] ;
        let afterEnd:[number,number] =[0,0] ;
        let iii =0;

        this.data.forEach(([ts,v],idx)=>{
            if(ts>timestampStart && ts < timestampEnd){
                if(d.length===0){
                    beforeStart= this.data[idx-1]
                }
                d.push([ts,v]);
                iii=idx;
            }
        })

        afterEnd = this.data[iii+1];
        
        this.renderEngine.ctx.moveTo(this.renderEngine.timeToPosition(timestampStart), this.height);
        this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(timestampStart), this.height-beforeStart[1]);
        
        for(var [ts,v] of d){
            this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(ts), this.height - v);                                    
        }

        this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(timestampEnd), this.height - v);
        this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(timestampEnd), this.height);                        
        this.renderEngine.ctx.closePath();
        this.renderEngine.ctx.stroke();
        this.renderEngine.ctx.fill();
    }
}
