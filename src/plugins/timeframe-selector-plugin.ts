import {
    clusterizeFlatTree,
    flatTree,
    getFlatTreeMinMax,
    metaClusterizeFlatTree,
    reclusterizeClusteredFlatTree,
} from './utils/tree-clusters';
import { mergeObjects } from '../utils';
import { TimeGrid } from '../engines/time-grid';
import {
    ClusterizedFlatTree,
    CursorTypes,
    FlameChartNodes,
    HitRegion,
    MetaClusterizedFlatTree,
    Mouse,
    RegionTypes,
    Waterfall,
} from '../types';
import { OffscreenRenderEngine } from '../engines/offscreen-render-engine';
import { SeparatedInteractionsEngine } from '../engines/separated-interactions-engine';
import UIPlugin from './ui-plugin';
import { parseWaterfall, PreparedWaterfallInterval } from './utils/waterfall-parser';
import Color from 'color';

const TIMEFRAME_STICK_DISTANCE = 2;

type Dot = {
    time: number;
    type: 'start' | 'end';
};

type RenderDot = {
    pos: number;
    level: number;
};

export type TimeframeSelectorPluginStyles = {
    font: string;
    fontColor: string;
    overlayColor: string;
    graphStrokeColor: string;
    graphFillColor: string;
    flameChartGraphType: TimeframeGraphTypes;
    waterfallStrokeOpacity: number;
    waterfallFillOpacity: number;
    waterfallGraphType: TimeframeGraphTypes;
    bottomLineColor: string;
    knobColor: string;
    knobStrokeColor: string;
    knobSize: number;
    height: number;
    backgroundColor: string;
};

export type TimeframeSelectorPluginSettings = {
    styles?: Partial<TimeframeSelectorPluginStyles>;
};

export type TimeframeGraphTypes = 'square' | 'smooth';

export const defaultTimeframeSelectorPluginStyles: TimeframeSelectorPluginStyles = {
    font: '9px sans-serif',
    fontColor: 'black',
    overlayColor: 'rgba(112, 112, 112, 0.5)',
    graphStrokeColor: 'rgba(0, 0, 0, 0.10)',
    graphFillColor: 'rgba(0, 0, 0, 0.15)',
    flameChartGraphType: 'smooth',
    waterfallStrokeOpacity: 0.4,
    waterfallFillOpacity: 0.35,
    waterfallGraphType: 'smooth',
    bottomLineColor: 'rgba(0, 0, 0, 0.25)',
    knobColor: 'rgb(131, 131, 131)',
    knobStrokeColor: 'white',
    knobSize: 6,
    height: 60,
    backgroundColor: 'white',
};

export class TimeframeSelectorPlugin extends UIPlugin<TimeframeSelectorPluginStyles> {
    override styles: TimeframeSelectorPluginStyles = defaultTimeframeSelectorPluginStyles;
    height = 0;

    private flameChartNodes?: FlameChartNodes;
    private waterfall?: Waterfall;
    private shouldRender: boolean;
    private leftKnobMoving = false;
    private rightKnobMoving = false;
    private selectingActive = false;
    private startSelectingPosition = 0;
    private timeout: number | undefined;
    private offscreenRenderEngine: OffscreenRenderEngine;
    private timeGrid: TimeGrid;
    private actualClusters: ClusterizedFlatTree = [];
    private clusters: MetaClusterizedFlatTree = [];
    private flameChartMaxLevel = 0;
    private flameChartDots: RenderDot[] = [];
    private waterfallDots: { color: string; dots: RenderDot[] }[] = [];
    private waterfallMaxLevel = 0;
    private actualClusterizedFlatTree: ClusterizedFlatTree = [];

    constructor({
        waterfall,
        flameChartNodes,
        settings,
        name = 'timeframeSelectorPlugin',
    }: {
        flameChartNodes?: FlameChartNodes;
        waterfall?: Waterfall;
        settings: TimeframeSelectorPluginSettings;
        name?: string;
    }) {
        super(name);
        this.flameChartNodes = flameChartNodes;
        this.waterfall = waterfall;
        this.shouldRender = true;
        this.setSettings(settings);
    }

    override init(renderEngine: OffscreenRenderEngine, interactionsEngine: SeparatedInteractionsEngine) {
        super.init(renderEngine, interactionsEngine);

        this.interactionsEngine.on('down', this.handleMouseDown.bind(this));
        this.interactionsEngine.on('up', this.handleMouseUp.bind(this));
        this.interactionsEngine.on('move', this.handleMouseMove.bind(this));

        this.setSettings();
    }

    handleMouseDown(region: HitRegion<'right' | 'left'>, mouse: Mouse) {
        if (region) {
            if (region.type === RegionTypes.TIMEFRAME_KNOB) {
                if (region.data === 'left') {
                    this.leftKnobMoving = true;
                } else {
                    this.rightKnobMoving = true;
                }

                this.interactionsEngine.setCursor('ew-resize');
            } else if (region.type === RegionTypes.TIMEFRAME_AREA) {
                this.selectingActive = true;
                this.startSelectingPosition = mouse.x;
            }
        }
    }

    handleMouseUp(_: HitRegion, mouse: Mouse, isClick: boolean) {
        let isDoubleClick = false;

        if (this.timeout) {
            isDoubleClick = true;
        }

        clearTimeout(this.timeout);
        this.timeout = window.setTimeout(() => (this.timeout = void 0), 300);
        this.leftKnobMoving = false;
        this.rightKnobMoving = false;
        this.interactionsEngine.clearCursor();

        if (this.selectingActive && !isClick) {
            this.applyChanges();
        }

        this.selectingActive = false;

        if (isClick && !isDoubleClick) {
            const rightKnobPosition = this.getRightKnobPosition();
            const leftKnobPosition = this.getLeftKnobPosition();

            if (mouse.x > rightKnobPosition) {
                this.setRightKnobPosition(mouse.x);
            } else if (mouse.x > leftKnobPosition && mouse.x < rightKnobPosition) {
                if (mouse.x - leftKnobPosition > rightKnobPosition - mouse.x) {
                    this.setRightKnobPosition(mouse.x);
                } else {
                    this.setLeftKnobPosition(mouse.x);
                }
            } else {
                this.setLeftKnobPosition(mouse.x);
            }

            this.applyChanges();
        }

        if (isDoubleClick) {
            this.renderEngine.parent.setZoom(this.renderEngine.getInitialZoom());
            this.renderEngine.parent.setPositionX(this.renderEngine.min);
            this.renderEngine.parent.render();
        }
    }

    handleMouseMove(_: HitRegion, mouse: Mouse) {
        if (this.leftKnobMoving) {
            this.setLeftKnobPosition(mouse.x);
            this.applyChanges();
        }

        if (this.rightKnobMoving) {
            this.setRightKnobPosition(mouse.x);
            this.applyChanges();
        }

        if (this.selectingActive) {
            if (this.startSelectingPosition >= mouse.x) {
                this.setLeftKnobPosition(mouse.x);
                this.setRightKnobPosition(this.startSelectingPosition);
            } else {
                this.setRightKnobPosition(mouse.x);
                this.setLeftKnobPosition(this.startSelectingPosition);
            }

            this.renderEngine.render();
        }
    }

    override postInit() {
        this.offscreenRenderEngine = this.renderEngine.makeChild();
        this.offscreenRenderEngine.setSettingsOverrides({ styles: this.styles });

        this.timeGrid = new TimeGrid({ styles: this.renderEngine.parent.timeGrid.styles });
        this.timeGrid.setDefaultRenderEngine(this.offscreenRenderEngine);

        this.offscreenRenderEngine.on('resize', () => {
            this.offscreenRenderEngine.setZoom(this.renderEngine.getInitialZoom());
            this.offscreenRender();
        });

        this.offscreenRenderEngine.on('min-max-change', () => (this.shouldRender = true));

        this.setData({
            flameChartNodes: this.flameChartNodes,
            waterfall: this.waterfall,
        });
    }

    setLeftKnobPosition(mouseX: number) {
        const maxPosition = this.getRightKnobPosition();

        if (mouseX < maxPosition - 1) {
            const realView = this.renderEngine.getRealView();
            const delta = this.renderEngine.setPositionX(
                this.offscreenRenderEngine.pixelToTime(mouseX) + this.renderEngine.min
            );
            const zoom = this.renderEngine.width / (realView - delta);

            this.renderEngine.setZoom(zoom);
        }
    }

    setRightKnobPosition(mouseX: number) {
        const minPosition = this.getLeftKnobPosition();

        if (mouseX > minPosition + 1) {
            const realView = this.renderEngine.getRealView();
            const delta =
                this.renderEngine.positionX +
                realView -
                (this.offscreenRenderEngine.pixelToTime(mouseX) + this.renderEngine.min);
            const zoom = this.renderEngine.width / (realView - delta);

            this.renderEngine.setZoom(zoom);
        }
    }

    getLeftKnobPosition() {
        return (this.renderEngine.positionX - this.renderEngine.min) * this.renderEngine.getInitialZoom();
    }

    getRightKnobPosition() {
        return (
            (this.renderEngine.positionX - this.renderEngine.min + this.renderEngine.getRealView()) *
            this.renderEngine.getInitialZoom()
        );
    }

    applyChanges() {
        this.renderEngine.parent.setPositionX(this.renderEngine.positionX);
        this.renderEngine.parent.setZoom(this.renderEngine.zoom);
        this.renderEngine.parent.render();
    }

    override setSettings({ styles }: TimeframeSelectorPluginSettings = { styles: this.styles }) {
        this.styles = mergeObjects(defaultTimeframeSelectorPluginStyles, styles);
        this.height = this.styles.height;

        if (this.offscreenRenderEngine) {
            this.offscreenRenderEngine.setSettingsOverrides({ styles: this.styles });
            this.timeGrid.setSettings({ styles: this.renderEngine.parent.timeGrid.styles });
        }

        this.shouldRender = true;
    }

    makeFlameChartDots() {
        if (this.flameChartNodes) {
            const flameChartDots: Dot[] = [];
            const tree = flatTree(this.flameChartNodes);
            const { min, max } = getFlatTreeMinMax(tree);

            this.min = min;
            this.max = max;

            this.clusters = metaClusterizeFlatTree(tree, () => true);
            this.actualClusters = clusterizeFlatTree(
                this.clusters,
                this.renderEngine.zoom,
                this.min,
                this.max,
                TIMEFRAME_STICK_DISTANCE,
                Infinity
            );
            this.actualClusterizedFlatTree = reclusterizeClusteredFlatTree(
                this.actualClusters,
                this.renderEngine.zoom,
                this.min,
                this.max,
                TIMEFRAME_STICK_DISTANCE,
                Infinity
            ).sort((a, b) => a.start - b.start);

            this.actualClusterizedFlatTree.forEach(({ start, end }) => {
                flameChartDots.push(
                    {
                        time: start,
                        type: 'start',
                    },
                    {
                        time: end,
                        type: 'end',
                    }
                );
            });

            flameChartDots.sort((a, b) => a.time - b.time);

            const { dots, maxLevel } = this.makeRenderDots(flameChartDots);

            this.flameChartDots = dots;
            this.flameChartMaxLevel = maxLevel;
        }
    }

    makeRenderDots(dots: Dot[]): { dots: RenderDot[]; maxLevel: number } {
        const renderDots: RenderDot[] = [];
        let level = 0;
        let maxLevel = 0;

        dots.forEach(({ type, time }) => {
            if (type === 'start') {
                renderDots.push({
                    pos: time,
                    level: level,
                });
            }

            if (type === 'end') {
                renderDots.push({
                    pos: time,
                    level: level,
                });
            }

            if (type === 'start') {
                level++;
            } else {
                level--;
            }

            maxLevel = Math.max(maxLevel, level);

            renderDots.push({
                pos: time,
                level,
            });
        });

        return {
            dots: renderDots,
            maxLevel,
        };
    }

    makeWaterfallDots() {
        if (this.waterfall) {
            const data = parseWaterfall(this.waterfall);

            const intervals = Object.entries(
                data.reduce((acc: Record<string, PreparedWaterfallInterval[]>, { intervals }) => {
                    intervals.forEach((interval) => {
                        if (!acc[interval.color]) {
                            acc[interval.color] = [];
                        }

                        acc[interval.color].push(interval);
                    });

                    return acc;
                }, {})
            );

            const points = intervals.map(([color, intervals]) => {
                const newPoints: { type: 'start' | 'end'; time: number }[] = [];

                intervals.forEach(({ start, end }) => {
                    newPoints.push({ type: 'start', time: start });
                    newPoints.push({ type: 'end', time: end });
                });

                newPoints.sort((a, b) => a.time - b.time);

                return {
                    color,
                    points: newPoints,
                };
            });

            let globalMaxLevel = 0;

            this.waterfallDots = points.map(({ color, points }) => {
                const { dots, maxLevel } = this.makeRenderDots(points);

                globalMaxLevel = Math.max(globalMaxLevel, maxLevel);

                return {
                    color,
                    dots,
                };
            });

            this.waterfallMaxLevel = globalMaxLevel;
        }
    }

    setData({ flameChartNodes, waterfall }: { flameChartNodes?: FlameChartNodes; waterfall?: Waterfall }) {
        this.flameChartNodes = flameChartNodes;
        this.waterfall = waterfall;

        this.makeFlameChartDots();
        this.offscreenRender();
    }

    setFlameChartNodes(flameChartNodes: FlameChartNodes) {
        this.flameChartNodes = flameChartNodes;

        this.makeFlameChartDots();
        this.offscreenRender();
    }

    setWaterfall(waterfall: Waterfall) {
        this.waterfall = waterfall;

        this.makeWaterfallDots();
        this.offscreenRender();
    }

    renderChart(
        dots: RenderDot[],
        maxLevel: number,
        options: { strokeColor: string; fillColor: string; type?: TimeframeGraphTypes }
    ) {
        const zoom = this.offscreenRenderEngine.getInitialZoom();

        this.offscreenRenderEngine.setStrokeColor(options.strokeColor);
        this.offscreenRenderEngine.setCtxColor(options.fillColor);
        this.offscreenRenderEngine.ctx.beginPath();

        const flameChartLevelHeight = (this.height - this.renderEngine.charHeight - 4) / maxLevel;

        if (dots.length) {
            const xy = dots.map(({ pos, level }) => [
                (pos - this.offscreenRenderEngine.min) * zoom,
                this.castLevelToHeight(level, flameChartLevelHeight),
            ]);

            this.offscreenRenderEngine.ctx.moveTo(xy[0][0], xy[0][1]);

            if (options.type === 'smooth' || !options.type) {
                for (let i = 1; i < xy.length - 2; i++) {
                    const xc = (xy[i][0] + xy[i + 1][0]) / 2;
                    const yc = (xy[i][1] + xy[i + 1][1]) / 2;

                    this.offscreenRenderEngine.ctx.quadraticCurveTo(xy[i][0], xy[i][1], xc, yc);
                }

                const preLast = xy[xy.length - 2];
                const last = xy[xy.length - 1];

                this.offscreenRenderEngine.ctx.quadraticCurveTo(preLast[0], preLast[1], last[0], last[1]);
            } else if (options.type === 'square') {
                for (let i = 1; i < xy.length; i++) {
                    this.offscreenRenderEngine.ctx.lineTo(xy[i][0], xy[i][1]);
                }
            }
        }

        this.offscreenRenderEngine.ctx.closePath();

        this.offscreenRenderEngine.ctx.stroke();
        this.offscreenRenderEngine.ctx.fill();
    }

    offscreenRender() {
        const zoom = this.offscreenRenderEngine.getInitialZoom();

        this.offscreenRenderEngine.setZoom(zoom);
        this.offscreenRenderEngine.setPositionX(this.offscreenRenderEngine.min);
        this.offscreenRenderEngine.clear();

        this.timeGrid.recalc();
        this.timeGrid.renderLines(0, this.offscreenRenderEngine.height);
        this.timeGrid.renderTimes();

        this.renderChart(this.flameChartDots, this.flameChartMaxLevel, {
            strokeColor: this.styles.graphStrokeColor,
            fillColor: this.styles.graphFillColor,
            type: this.styles.flameChartGraphType,
        });

        this.waterfallDots.forEach(({ color, dots }) => {
            const colorObj = new Color(color);

            this.renderChart(dots, this.waterfallMaxLevel, {
                strokeColor: colorObj.alpha(this.styles.waterfallStrokeOpacity).rgb().toString(),
                fillColor: colorObj.alpha(this.styles.waterfallFillOpacity).rgb().toString(),
                type: this.styles.waterfallGraphType,
            });
        });

        this.offscreenRenderEngine.setCtxColor(this.styles.bottomLineColor);
        this.offscreenRenderEngine.ctx.fillRect(0, this.height - 1, this.offscreenRenderEngine.width, 1);
    }

    castLevelToHeight(level: number, levelHeight: number) {
        return this.height - level * levelHeight;
    }

    renderTimeframe() {
        const relativePositionX = this.renderEngine.positionX - this.renderEngine.min;

        const currentLeftPosition = relativePositionX * this.renderEngine.getInitialZoom();
        const currentRightPosition =
            (relativePositionX + this.renderEngine.getRealView()) * this.renderEngine.getInitialZoom();
        const currentLeftKnobPosition = currentLeftPosition - this.styles.knobSize / 2;
        const currentRightKnobPosition = currentRightPosition - this.styles.knobSize / 2;
        const knobHeight = this.renderEngine.height / 3;

        this.renderEngine.setCtxColor(this.styles.overlayColor);
        this.renderEngine.fillRect(0, 0, currentLeftPosition, this.renderEngine.height);
        this.renderEngine.fillRect(
            currentRightPosition,
            0,
            this.renderEngine.width - currentRightPosition,
            this.renderEngine.height
        );

        this.renderEngine.setCtxColor(this.styles.overlayColor);
        this.renderEngine.fillRect(currentLeftPosition - 1, 0, 1, this.renderEngine.height);
        this.renderEngine.fillRect(currentRightPosition + 1, 0, 1, this.renderEngine.height);

        this.renderEngine.setCtxColor(this.styles.knobColor);
        this.renderEngine.fillRect(currentLeftKnobPosition, 0, this.styles.knobSize, knobHeight);
        this.renderEngine.fillRect(currentRightKnobPosition, 0, this.styles.knobSize, knobHeight);

        this.renderEngine.renderStroke(
            this.styles.knobStrokeColor,
            currentLeftKnobPosition,
            0,
            this.styles.knobSize,
            knobHeight
        );
        this.renderEngine.renderStroke(
            this.styles.knobStrokeColor,
            currentRightKnobPosition,
            0,
            this.styles.knobSize,
            knobHeight
        );

        this.interactionsEngine.addHitRegion(
            RegionTypes.TIMEFRAME_KNOB,
            'left',
            currentLeftKnobPosition,
            0,
            this.styles.knobSize,
            knobHeight,
            CursorTypes.EW_RESIZE
        );
        this.interactionsEngine.addHitRegion(
            RegionTypes.TIMEFRAME_KNOB,
            'right',
            currentRightKnobPosition,
            0,
            this.styles.knobSize,
            knobHeight,
            CursorTypes.EW_RESIZE
        );
        this.interactionsEngine.addHitRegion(
            RegionTypes.TIMEFRAME_AREA,
            null,
            0,
            0,
            this.renderEngine.width,
            this.renderEngine.height,
            CursorTypes.TEXT
        );
    }

    override render() {
        if (this.shouldRender) {
            this.shouldRender = false;
            this.offscreenRender();
        }

        this.renderEngine.copy(this.offscreenRenderEngine);
        this.renderTimeframe();

        return true;
    }
}
