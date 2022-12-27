import { OffscreenRenderEngine } from '../engines/offscreen-render-engine';
import { SeparatedInteractionsEngine } from '../engines/separated-interactions-engine';
import { CursorTypes, HitRegion, RegionTypes } from '../types';
import UIPlugin from './ui-plugin';

export type TimeseriesPoint = [number, number];

interface TimeseriesPointsSummary {
    min: number;
    max: number;
    first: number;
    last: number;
}

export type TimeseriesPluginStyles = {
    defaultHeight: number;
};
export const defaultCPUPluginStyles: TimeseriesPluginStyles = {
    defaultHeight: 68,
};

export class TimeseriesPlugin extends UIPlugin<TimeseriesPluginStyles> {
    height: number;
    name: string;
    color: string;
    data: TimeseriesPoint[];
    maxValue: number;
    hoveredRegion: HitRegion<{}> | null = null;
    selectedRegion: HitRegion<{}> | null = null;
    summary: TimeseriesPointsSummary = null;

    constructor(name: string, color: string, data: TimeseriesPoint[], maxValue = 100) {
        super();

        this.maxValue = maxValue;
        this.data = [];
        this.name = name;
        this.color = color;
        this.height = 100;

        this.setData(data);
    }

    override init(renderEngine: OffscreenRenderEngine, interactionsEngine: SeparatedInteractionsEngine) {
        super.init(renderEngine, interactionsEngine);

        this.interactionsEngine.on('change-position', this.handlePositionChange.bind(this));
        this.interactionsEngine.on('hover', this.handleHover.bind(this));
        this.interactionsEngine.on('select', this.handleSelect.bind(this));
        this.interactionsEngine.on('up', this.handleMouseUp.bind(this));
    }

    handlePositionChange({ deltaX, deltaY }: { deltaX: number; deltaY: number }) {
        const startPositionX = this.renderEngine.parent.positionX;

        this.interactionsEngine.setCursor('grabbing');

        this.renderEngine.tryToChangePosition(deltaX);

        if (startPositionX !== this.renderEngine.parent.positionX) {
            this.renderEngine.parent.render();
        }
    }

    handleMouseUp() {
        this.interactionsEngine.clearCursor();
    }

    handleSelect(region: HitRegion<number> | null) { }

    setPositionY(y: number) {
        console.log('[setPositionY]', y);
    }

    override setSettings(settings) {
        // this.styles = mergeObjects(defaultWaterfallPluginStyles, styles);
        // this.height = this.styles.defaultHeight;
        // this.positionY = 0;
    }

    setData(data: TimeseriesPoint[]) {
        this.data = data;

        let min = Number.MAX_VALUE;
        let max = Number.MIN_VALUE;
        let first = Number.MAX_VALUE;
        let last = Number.MIN_VALUE;

        this.data.forEach(([ts, v]) => {
            if (v < min) {
                min = v;
            }
            if (v > max) {
                max = v;
            }

            if (ts < first) {
                first = ts;
            }
            if (ts > last) {
                last = ts;
            }
        });

        this.summary = {
            min,
            max,
            first,
            last,
        };
    }

    calcRect(start: number, duration: number, isEnd: boolean) {
        const w = duration * this.renderEngine.zoom;

        return {
            x: this.renderEngine.timeToPosition(start),
            w: isEnd ? (w <= 0.1 ? 0.1 : w >= 3 ? w - 1 : w - w / 3) : w,
        };
    }

    handleHover(region: HitRegion<number> | null) {
        this.hoveredRegion = region;
    }

    override renderTooltip() {
        if (this.hoveredRegion) {
            const data = { ...this.hoveredRegion.data } as HitRegionData;

            // @ts-ignore data type on waterfall item is number but here it is something else?
            // data.data = this.data.find(({ index: i }) => index === i);

            const round = (v) => (Math.round(v * 100) / 100).toString();

            const header = 'header';

            this.renderEngine.renderTooltipFromData(
                [
                    { text: header },
                    {
                        text: round(data.ts),
                    },
                    { text: round(data.v) },
                ],
                this.interactionsEngine.getGlobalMouse()
            );
            return true;
        }
        return false;
    }

    override render() {
        const timestampEnd = this.renderEngine.positionX + this.renderEngine.getRealView();
        const timestampStart = this.renderEngine.positionX;
        this.renderEngine.setCtxColor(this.color);

        this.renderEngine.ctx.beginPath();

        const d: [number, number][] = [];

        let beforeStart: [number, number] = [0, 0];

        let iii = 0;
        let minValue = Number.MAX_VALUE;
        let maxValue = Number.MIN_VALUE;

        this.data.forEach(([ts, v], idx) => {
            if (ts > timestampStart && ts < timestampEnd) {
                if (d.length === 0) {
                    beforeStart = this.data[idx - 1];
                }
                d.push([ts, v]);
                iii = idx;

                if (v < minValue) {
                    minValue = v;
                }

                if (v > maxValue) {
                    maxValue = v;
                }
            }
        });

        const padding = 5;
        const heightPerValueUnit = (this.height - padding) / (maxValue - minValue);
        const normalizeValue = (v: number) => {
            return this.height - v * heightPerValueUnit;
        };

        this.renderEngine.ctx.moveTo(this.renderEngine.timeToPosition(timestampStart), this.height);
        this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(timestampStart), normalizeValue(beforeStart[1]));

        for (const [ts, v] of d) {
            const normalizedValue = normalizeValue(v);
            this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(ts), normalizedValue);

            this.interactionsEngine.addHitRegion(
                RegionTypes.CLUSTER,
                { ts, v } as HitRegionData,
                this.renderEngine.timeToPosition(ts),
                normalizedValue,
                normalizedValue,
                this.height
            );
        }

        if (d.length > 0) {
            const [ts, v] = d[d.length - 1];
            this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(timestampEnd), this.height - v);
            this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(timestampEnd), this.height);
        }

        this.renderEngine.ctx.closePath();
        this.renderEngine.ctx.stroke();
        this.renderEngine.ctx.fill();

        this.renderEngine.ctx.strokeText(`${Math.round(maxValue)} (${Math.round(this.summary.max)})`, 5, 0 + 10);
        this.renderEngine.ctx.strokeText(
            `${Math.round(minValue)} (${Math.round(this.summary.min)})`,
            5,
            this.height - 5
        );
    }
}

type HitRegionData = {
    ts: number;
    v: number;
};
