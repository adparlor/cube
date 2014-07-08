'use strict';

var metalog = require('./metalog');
metalog.send_events = true;

module.exports = {
  load: function(options) {
    Object.keys(options).forEach(function (key) {
      module.exports[key] = options[key];
    });
    return module.exports;
  }
}
