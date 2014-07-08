'use strict';

var merge = require('recursive-merge');
var defaultConfig = require('./collector-config-defaults');

var localConfig = {}
try { localConfig = require('./collector-config'); } catch (e) {};

var config = merge(localConfig, defaultConfig);

var cube = require("../"),
    server = cube.server(config);

server
  .use(cube.collector.register)
  .start();
