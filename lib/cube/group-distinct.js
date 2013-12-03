var parser = require('./metric-expression');

var removeGroup = /(.*)\.\s*group\s*\(.*?\)\s*$/;

/**
 * Generates a new expression from a "group" expression to compute a pyramidal distinct instead of MongoDB's.
 */
module.exports = function generateDistinct (expression) {
  if (!expression.group) {
    // This is not a group expression, cannot generate a distinct out of it.
    throw new Error('This function should not be called for non grouped expressions.');
  }

  var param = new RegExp(expression.type + '\\s*\\((.*?)\\)');
  var source = expression.source.replace(param, expression.type + '(' + expression.group.field.substring(2) + ')')
                          .replace(expression.reduce, 'distinct')
                          .replace(removeGroup, '$1');

  return {
    exists: expression.group.exists,
    fields: expression.group.fields,
    value: expression.group.value,
    type: expression.type,
    filter: expression.filter,
    reduce: 'distinct',
    source: source
  };
};
