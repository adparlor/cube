var types = {};

var eventRe = /_events$/;

types.getter = function(db) {
  return function(request, callback) {
    db.collectionNames(function(error, names) {
      handle(error);
      callback(names
            .map(function(d) { return d.name.split(".")[1]; })
            .filter(function(d) { return eventRe.test(d); })
            .map(function(d) { return d.substring(0, d.length - 7); })
            .sort());
    });
  };
};

function handle(error) {
  if (error) throw error;
}

module.exports = types;
