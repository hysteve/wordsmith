const typescript = require('@rollup/plugin-typescript'); module.exports = { input: 'src/index.ts', output: { dir: 'lib', format: 'cjs', }, plugins: [typescript()], };
