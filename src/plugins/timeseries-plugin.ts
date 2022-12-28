import { OffscreenRenderEngine } from '../engines/offscreen-render-engine';
import { SeparatedInteractionsEngine } from '../engines/separated-interactions-engine';
import { HitRegion, RegionTypes } from '../types';
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
    summary: TimeseriesPointsSummary | null = null;

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

        this.interactionsEngine.on('up', this.handleMouseUp.bind(this));
    }

    handlePositionChange(position: { deltaX: number }) {
        const startPositionX = this.renderEngine.parent.positionX;

        this.interactionsEngine.setCursor('grabbing');

        this.renderEngine.tryToChangePosition(position.deltaX);

        if (startPositionX !== this.renderEngine.parent.positionX) {
            this.renderEngine.parent.render();
        }
    }

    handleMouseUp() {
        this.interactionsEngine.clearCursor();
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
            const round = (v) => Math.round(v * 100) / 100;
            const data = this.hoveredRegion.data as HitRegionData;

            this.renderEngine.renderTooltipFromData(
                [
                    { text: `Value: ${round(data.v)}` },
                    {
                        text: `Timestamp: ${round(data.ts)}ms`,
                    },
                ],
                this.interactionsEngine.getGlobalMouse()
            );
            return true;
        }
        return false;
    }

    override render() {
        if (this.data?.length === 0) {
            return;
        }

        const timestampEnd = this.renderEngine.positionX + this.renderEngine.getRealView();
        const timestampStart = this.renderEngine.positionX;
        this.renderEngine.setCtxColor(this.color);

        this.renderEngine.ctx.beginPath();

        const d: [number, number][] = [];

        let firstIdx = 0;

        let minValue = Number.MAX_VALUE;
        let maxValue = Number.MIN_VALUE;

        this.data.forEach(([ts, v], idx) => {
            if (ts > timestampStart && firstIdx === 0) {
                firstIdx = idx;
            }

            if (ts > timestampStart && ts < timestampEnd) {
                d.push([ts, v]);

                if (v < minValue) {
                    minValue = v;
                }

                if (v > maxValue) {
                    maxValue = v;
                }
            }
        });

        const firstValue = this.data[firstIdx][1];
        if (firstValue === undefined) {
            return;
        }
        if (d.length < 2) {
            maxValue = firstValue + 10;
            minValue = firstValue - 10;
        }

        const padding = 5;
        const heightPerValueUnit = (this.height - padding) / (maxValue - minValue);

        const normalizeValue = (v: number) => {
            return this.height - v * heightPerValueUnit;
        };

        let normalizedValue = normalizeValue(firstValue);

        this.renderEngine.ctx.moveTo(this.renderEngine.timeToPosition(timestampStart), this.height);
        this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(timestampStart), normalizedValue);

        let lastTimeToPosition = 0;
        let timeToPosition = 0;

        for (const [ts, v] of d) {
            normalizedValue = normalizeValue(v);
            timeToPosition = this.renderEngine.timeToPosition(ts);
            this.renderEngine.ctx.lineTo(timeToPosition, normalizedValue);
            this.interactionsEngine.addHitRegion(
                RegionTypes.CLUSTER,
                { ts, v } as HitRegionData,
                lastTimeToPosition,
                0,
                timeToPosition - lastTimeToPosition,
                this.height
            );

            lastTimeToPosition = timeToPosition;
        }

        this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(timestampEnd), normalizedValue);

        this.renderEngine.ctx.lineTo(this.renderEngine.timeToPosition(timestampEnd), this.height);

        this.renderEngine.ctx.closePath();
        this.renderEngine.ctx.stroke();
        this.renderEngine.ctx.fill();

        const textHeight = 10;
        const leftMargin = 5;
        this.renderEngine.ctx.strokeText(
            `${Math.round(maxValue)} (${Math.round(this.summary?.max ?? 0)})`,
            leftMargin,
            textHeight
        );
        this.renderEngine.ctx.strokeText(
            `${Math.round(minValue)} (${Math.round(this.summary?.min ?? 0)})`,
            leftMargin,
            this.height - textHeight - 5
        );
    }
}

type HitRegionData = {
    ts: number;
    v: number;
};
