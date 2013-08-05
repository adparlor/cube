var _ = require('underscore');

module.exports = {
  distinctValuesWrapper: function(values) {
    return values.reduce(function(values, value){
      var pair = _.find(values, function(pair) { return pair.v == value; });
      if (!pair) values.push(pair = { v: value, c: 0 });
      pair.c++;
      return values;
    }, []);
  },

  distinctValuesUnwrapper: function(vs) {
    return (vs || []).reduce(function(expanded, value){
      _.times(value.c, function(){ expanded.push(value.v); });
      return expanded;
    }, []);
  },

  avgWrapper: function(values) {
    var total = { s: 0, w: 0 }; // Sum and weight
    _.each(values, function(value) {
      if (typeof value === 'object') {
        total.s += value.s;
        total.w += value.w;
      } else {
        total.s += value;
        total.w++;
      }
    });
    return [total];
  },

  avgUnwrapper: function(vs) {
    return vs;
  }
}
