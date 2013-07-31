'use strict';

var options = require("../config/cube").include("collector"),
    cube = require("../"),
    server = cube.server(options);

server
  .use(cube.collector.register)
  .start();
