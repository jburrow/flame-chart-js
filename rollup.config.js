import resolve from 'rollup-plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import html from '@rollup/plugin-html';
import cleaner from 'rollup-plugin-cleaner';
import { template } from './example/src/template.js';
import typescript from '@rollup/plugin-typescript';


export default {
    input: './example/src/index.ts',
    output: {
        dir: './example/dist',
        entryFileNames: 'main-[hash].js',
        format: 'iife',
        name: 'bundle',
    },
    plugins: [
        typescript({ compilerOptions: { outDir: './example/dist' } }),        
        resolve({
            browser: true,
            preferBuiltins: true,
        }),
        commonjs(),
        html({
            template,
        }),
        cleaner({
            targets: ['./example/dist'],
        }),      
    ],
};
