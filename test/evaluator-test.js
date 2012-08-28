var vows        = require("vows"),
    assert      = require("assert"),
    test_helper = require("./test_helper"),
    cube        = require("../");

var suite = vows.describe("evaluator");

var port = ++test_helper.port, server = cube.server({
  "mongo-host": "localhost",
  "mongo-port": 27017,
  "mongo-database": "cube_test",
  "http-port": port,
  "authenticator": "allow_all"
});

server.register = function(db, endpoints) {
  cube.evaluator.register(db, endpoints);
  cube.visualizer.register(db, endpoints);
};

server.start();

// suite.addBatch(test_helper.batch({
//   "GET /1.0/event": {
//     topic: test_helper.request({method: "GET", port: port, path: "/1.0/event"}),
//     "responds with status 200": function(response) {
//       assert.equal(response.statusCode, 200);
//       assert.deepEqual(JSON.parse(response.body), {error: "SyntaxError: Unexpected token T"});
//     }
//   }
// }));

suite.export(module);
