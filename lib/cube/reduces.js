'use strict';

var wrappers = require('./reducer-wrappers');

var reduces = module.exports = {

  sum: function reduceSum(values) {
    var i = -1, n = values.length, sum = 0;
    while (++i < n) sum += values[i];
    return sum;
  },

  min: function reduceMin(values) {
    var i = -1, n = values.length, min = Infinity, value;
    while (++i < n){ if ((value = values[i]) < min){ min = value; } }
    return isFinite(min) ? min : undefined;
  },

  max: function reduceMax(values) {
    var i = -1, n = values.length, max = -Infinity, value;
    while (++i < n){ if ((value = values[i]) > max){ max = value; } }
    return isFinite(max) ? max : undefined;
  },

  distinct: function reduceDistinct(values) {
    var map = {}, count = 0, i = -1, n = values.length, value;
    while (++i < n){ if (!((value = values[i]) in map)){ map[value] = ++count; } }
    return count;
  },

  median: function reduceMedian(values) {
    return quantile(values.sort(ascending), 0.5);
  },

  avg: function reduceAvg(values) {
    // Re-use the wrapper since the aggregation work is alread done there
    var total = wrappers.avgWrapper(values)[0];
    var a = total.w === 0 ? 0 : (total.s / total.w);
    return a;
  }
};

// These metrics have well-defined values for the empty set.
reduces.sum.empty = 0;
reduces.avg.empty = 0;
reduces.distinct.empty = 0;

// These metrics can be computed using pyramidal aggregation.
reduces.sum.pyramidal = true;
reduces.min.pyramidal = true;
reduces.max.pyramidal = true;

// Semi-pyramidal wrappers/unwrappers
reduces.distinct.wrap = wrappers.distinctValuesWrapper;
reduces.distinct.unwrap = wrappers.distinctValuesUnwrapper;
reduces.median.wrap = wrappers.distinctValuesWrapper;
reduces.median.unwrap = wrappers.distinctValuesUnwrapper;
reduces.avg.wrap = wrappers.avgWrapper;
reduces.avg.unwrap = wrappers.avgUnwrapper;

function ascending(a, b) {
  return a - b;
}

function quantile(values, q) {
  var i = 1 + q * (values.length - 1),
      j = ~~i,
      h = i - j,
      a = values[j - 1];
  return h ? a + h * (values[j] - a) : a;
}
