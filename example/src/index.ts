import { defaultRenderStyles } from '../../src/engines/basic-render-engine';
import { defaultTimeGridStyles } from '../../src/engines/time-grid';
import { FlameChart, FlameNode } from '../../src/index';
import { FlameChartPlugin } from '../../src/plugins/flame-chart-plugin';
import { MarksPlugin } from '../../src/plugins/marks-plugin';
import { defaultTimeGridPluginStyles } from '../../src/plugins/time-grid-plugin';
import TimeframeSelectorPlugin, {
    defaultTimeframeSelectorPluginStyles,
} from '../../src/plugins/timeframe-selector-plugin';
import { TimeseriesPlugin } from '../../src/plugins/timeseries-plugin';
import TogglePlugin, { defaultTogglePluginStyles } from '../../src/plugins/toggle-plugin';
import { defaultWaterfallPluginStyles, WaterfallPlugin } from '../../src/plugins/waterfall-plugin';
import { initQuery, query } from './query';
import { generateRandomTree, generateTimeseriesData, waterfallIntervals, waterfallItems } from './test-data';
import {
    getCanvas,
    getInputValues,
    getWrapperWH,
    initView,
    onApplyStyles,
    onExport,
    onImport,
    onUpdate,
    setNodeView,
} from './view';

export interface TreeConfigItem {
    name: string;
    value: number;
    units?: string;
}

const treeConfig: TreeConfigItem[] = [
    { name: 'count', value: 100000 },
    { name: 'start', value: 500 },
    { name: 'end', value: 5000 },
    { name: 'minChild', value: 1 },
    { name: 'maxChild', value: 3 },
    { name: 'thinning', units: '%', value: 12 },
    { name: 'colorsMonotony', value: 40 },
    { name: 'colorsCount', value: 10 },
];

const marks = [
    {
        shortName: 'DCL',
        fullName: 'DOMContentLoaded',
        timestamp: 2000,
        color: '#d7c44c',
    },
    {
        shortName: 'LE',
        fullName: 'LoadEvent',
        timestamp: 2100,
        color: '#4fd24a',
    },
    {
        shortName: 'TTI',
        fullName: 'Time To Interactive',
        timestamp: 3000,
        color: '#4b7ad7',
    },
];

const colors = {
    task: '#696969',
    event: '#a4775b',
};

const inputs = getInputValues(treeConfig);
const generateData = () => generateRandomTree(inputs);

let currentData: FlameNode[] = query ? [] : generateData();

// currentData = [
//     {
//         name: 'testing',
//         start: inputs.start,
//         duration: 200,
//         color: 'yellow',
//         children: [
//             { name: 'testing', start: inputs.start + 50, duration: 50, color: 'orange' },
//             { name: 'testing', start: inputs.start + 100, duration: 50, color: 'orange' },
//         ],
//     },
// ];

const baselineCurrentData = [
    {
        name: 'testing',
        start: inputs.start,
        duration: 225,
        color: 'yellow',
        children: [
            { name: 'testing', start: inputs.start + 50, duration: 75, color: 'orange' },
            { name: 'testing', start: inputs.start + 125, duration: 75, color: 'orange' },
        ],
    },
];

const [width, height] = getWrapperWH();
const canvas = getCanvas();

canvas.width = width;
canvas.height = height;

const timeseriesData = generateTimeseriesData(inputs);

const timeseries1 = 'time-series-1';
const flame1 = 'flame';
const flame2 = 'flame-baseline';

const flameChart = new FlameChart({
    canvas,
    colors,
    plugins: [
        new TimeframeSelectorPlugin(currentData, { styles: {} }),
        new TogglePlugin(timeseries1, { styles: {} }),
        new TimeseriesPlugin(timeseries1, 'red', timeseriesData),
        new TogglePlugin('waterfall plugin', { styles: {} }),
        new WaterfallPlugin(
            {
                items: waterfallItems,
                intervals: waterfallIntervals,
            },
            { styles: {} },
            'waterfall plugin'
        ),
        new TogglePlugin(MarksPlugin.name, { styles: {} }),
        new MarksPlugin(marks),
        new TogglePlugin(flame1, { styles: {} }),
        new FlameChartPlugin({ data: currentData, colors }, flame1),
        new TogglePlugin(flame2, { styles: {} }),
        new FlameChartPlugin({ data: baselineCurrentData, colors }, flame2),
    ],
});

flameChart.on('select', (node: FlameNode, type: string) => {
    setNodeView(node ? `${type}\r\n${JSON.stringify(node, null, 2)}` : '');
});

window.addEventListener('resize', () => {
    const [width, height] = getWrapperWH();

    flameChart.resize(width, height);
});

onApplyStyles((styles) => {
    flameChart.setSettings({
        styles,
    });
});

onUpdate(() => {
    currentData = generateData();

    flameChart.setData(currentData);
});

onImport((data) => {
    currentData = JSON.parse(data);

    flameChart.setData(currentData);
});

onExport(() => {
    return JSON.stringify(currentData);
});

initQuery(flameChart);
initView(treeConfig, {
    main: defaultRenderStyles,
    timeGrid: defaultTimeGridStyles,
    timeGridPlugin: defaultTimeGridPluginStyles,
    timeframeSelectorPlugin: defaultTimeframeSelectorPluginStyles,
    waterfallPlugin: defaultWaterfallPluginStyles,
    togglePlugin: defaultTogglePluginStyles,
});
