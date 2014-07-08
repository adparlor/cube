'use strict';

var merge = require('recursive-merge');
var defaultConfig = require('./evaluator-config-defaults');

var localConfig = {}
try { localConfig = require('./evaluator-config'); } catch (e) {};

var config = merge(localConfig, defaultConfig);

var cube = require("../"),
    server = cube.server(config);

server
  .use(cube.evaluator.register)
  .use(cube.visualizer.register)
  .start();
