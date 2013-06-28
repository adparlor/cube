// TODO: make capped collection size configurable
var metric_coll_opts = { 
  capped: true, 
  w: 0, 
  size: 304857600 // 300 MB
};

// Much like db.collection, but caches the result for both events and metrics.
// Also, this is synchronous, since we are opening a collection unsafely.
var types = module.exports = function(db) {
  var collections = {};
  return function(type, callback) {
    var collection = collections[type];

    if (collection) {
      callback(collection);
    } else {
      collection = collections[type] = {};
      db.createCollection(type + "_events", metric_coll_opts, function(error, res) {
        if (error) {
          console.error("Couldn't create collection '"+type+"_events':", error);
        }
        db.collection(type + "_events", function(error, events) {
          collection.events = events;
        });
        db.collection(type + "_metrics", function(error, metrics) {
          collection.metrics = metrics;
        });
        callback(collection);
      });
    }
  };
};

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
