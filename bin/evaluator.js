var cluster = require('cluster');

var options = require("./evaluator-config"),
  cube = require("../"),
  server = cube.server(options);

if (cluster.isMaster) {
  for (var i = 0; i < (options.workers || 1); i++) {
    cluster.fork();
  }
} else {
  server.register = function(db, endpoints) {
    cube.evaluator.register(db, endpoints);
  };

  server.start();
}
