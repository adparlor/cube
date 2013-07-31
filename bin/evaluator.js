'use strict';

var options = require("../config/cube").include('evaluator'),
    cube = require("../"),
    server = cube.server(options);

server
  .use(cube.evaluator.register)
  .use(cube.visualizer.register)
  .start()
