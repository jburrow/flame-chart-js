import FlameChart from './../../src/index.js';
import { defaultTimeGridStyles } from '../../src/engines/time-grid.js';
import { defaultRenderStyles } from '../../src/engines/basic-render-engine.js';
import { defaultTimeGridPluginStyles } from '../../src/plugins/time-grid-plugin';
import { defaultTimeframeSelectorPluginStyles } from '../../src/plugins/timeframe-selector-plugin';
import TogglePlugin, { defaultTogglePluginStyles } from '../../src/plugins/toggle-plugin.js';
import { defaultWaterfallPluginStyles } from '../../src/plugins/waterfall-plugin.js';
import { TimeseriesPlugin } from '../../src/plugins/timeseries-plugin.js';
import { generateRandomTree } from './test-data.js';
import { query, initQuery } from './query.js';
import {
    initView,
    getInputValues,
    setNodeView,
    onApplyStyles,
    onUpdate,
    onExport,
    onImport,
    getWrapperWH,
    getCanvas
} from './view.js';

const treeConfig = [
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
        color: '#d7c44c'
    },
    {
        shortName: 'LE',
        fullName: 'LoadEvent',
        timestamp: 2100,
        color: '#4fd24a'
    },
    {
        shortName: 'TTI',
        fullName: 'Time To Interactive',
        timestamp: 3000,
        color: '#4b7ad7'
    }
];

const colors = {
    task: '#696969',
    event: '#a4775b'
};

const inputs = getInputValues(treeConfig)
const generateData = () => generateRandomTree(inputs);




let currentData = query ? [] : generateData();

const [width, height] = getWrapperWH();
const canvas = getCanvas();

canvas.width = width;
canvas.height = height;

const testItems = [
    {
        name: 'foo',
        intervals: 'default',
        timing: {
            requestStart: 2050,
            responseStart: 2500,
            responseEnd: 2600
        }
    },
    {
        name: 'bar',
        intervals: 'default',
        timing: {
            requestStart: 2120,
            responseStart: 2180,
            responseEnd: 2300
        }
    },
    {
        name: 'bar2',
        intervals: 'default',
        timing: {
            requestStart: 2120,
            responseStart: 2180,
            responseEnd: 2300
        }
    },
    {
        name: 'bar3',
        intervals: 'default',
        timing: {
            requestStart: 2130,
            responseStart: 2180,
            responseEnd: 2320
        }
    },
    {
        name: 'bar4',
        intervals: 'default',
        timing: {
            requestStart: 2300,
            responseStart: 2350,
            responseEnd: 2400
        }
    },
    {
        name: 'bar5',
        intervals: 'default',
        timing: {
            requestStart: 2500,
            responseStart: 2520,
            responseEnd: 2550
        }
    }
];
const testIntervals = {
    default: [
        {
            name: 'waiting',
            color: 'rgb(207,196,152)',
            type: 'block',
            start: 'requestStart',
            end: 'responseStart'
        },
        {
            name: 'downloading',
            color: 'rgb(207,180,81)',
            type: 'block',
            start: 'responseStart',
            end: 'responseEnd'
        }
    ]
};


const timeseriesData = [];
let ii = 0
const period =(inputs.end -inputs.start)
const kk =  period / 100.0;


for(let idx=inputs.start; idx<inputs.end;idx+=kk){
    const i = (Math.random()*100)
    timeseriesData.push([idx,ii]);
    timeseriesData.push([idx+5,ii]);
    ii++;
}
console.log('[timeseriesData]',timeseriesData);

const flameChart = new FlameChart({
    canvas,
    data: currentData,
    marks,
    waterfall: {
        items: testItems,
        intervals: testIntervals
    },
    colors,
    plugins:[
        new TogglePlugin("time-series-1", { styles: {} })        ,
        new TimeseriesPlugin("time-series-1", "red", timeseriesData),
         new TogglePlugin("time-series-2", { styles: {} })        ,
        new TimeseriesPlugin("time-series-2", "yellow", timeseriesData),
    ]
});

flameChart.on('select', (node, type) => {
    setNodeView(node ? `${type}\r\n${JSON.stringify({
        ...node,
        source: {
            ...node.source,
            children: '[]',
        },
        parent: undefined
    }, null, '  ')}` : '');
});

window.addEventListener('resize', () => {
    flameChart.resize(...getWrapperWH());
});

onApplyStyles((styles) => {
    flameChart.setSettings({
        styles
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
initView(flameChart, treeConfig, {
    main: defaultRenderStyles,
    timeGrid: defaultTimeGridStyles,
    timeGridPlugin: defaultTimeGridPluginStyles,
    timeframeSelectorPlugin: defaultTimeframeSelectorPluginStyles,
    waterfallPlugin: defaultWaterfallPluginStyles,
    togglePlugin: defaultTogglePluginStyles
});