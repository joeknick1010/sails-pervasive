'use strict';

/**
 * Utility Functions
 */

// Dependencies
const _ = require('underscore');

// Module Exports

const utils = module.exports = {};

/**
 * Prepare values
 *
 * Transform a JS date to SQL date and functions
 * to strings.
 */

utils.prepareValue = function prepareValue(value) {
  if (!value) return value;

  // Cast functions to strings
  if (_.isFunction(value)) {
    value = value.toString();
  }

  // Store Arrays and Objects as strings
  if (Array.isArray(value) || (value.constructor && value.constructor.name === 'Object')) {
    try {
      value = JSON.stringify(value);
    } catch (e) {
      // just keep the value and let the db handle an error
    }
  }

  return value;
};

/**
 * Builds a Select statement determining if Aggeregate options are needed.
 */

utils.buildSelectStatement = function buildSelectStatement(criteria, table) {
  let query = 'SELECT ';

  if (criteria.groupBy || criteria.sum || criteria.average || criteria.min || criteria.max) {
    // Append groupBy columns to select statement
    if (criteria.groupBy) {
      if (criteria.groupBy instanceof Array) {
        criteria.groupBy.forEach((opt) => {
          query += `${opt}, `;
        });
      } else {
        query += `${criteria.groupBy}, `;
      }
    }

    // Handle SUM
    if (criteria.sum) {
      if (criteria.sum instanceof Array) {
        criteria.sum.forEach((opt) => {
          query += `SUM(${opt}) AS ${opt}, `;
        });
      } else {
        query += `SUM(${criteria.sum}) AS ${criteria.sum}, `;
      }
    }

    // Handle AVG (casting to float to fix percision with trailing zeros)
    if (criteria.average) {
      if (criteria.average instanceof Array) {
        criteria.average.forEach((opt) => {
          query += `AVG(${opt}) AS ${opt}, `;
        });
      } else {
        query += `AVG(${criteria.average}) AS ${criteria.average}, `;
      }
    }

    // Handle MAX
    if (criteria.max) {
      if (criteria.max instanceof Array) {
        criteria.max.forEach((opt) => {
          query += `MAX(${opt}) AS ${opt}, `;
        });
      } else {
        query += `MAX(${criteria.max}) AS ${criteria.max}, `;
      }
    }

    // Handle MIN
    if (criteria.min) {
      if (criteria.min instanceof Array) {
        criteria.min.forEach((opt) => {
          query += `MIN(${opt}) AS ${opt}, `;
        });
      } else {
        query += `MIN(${criteria.min}) AS ${criteria.min}, `;
      }
    }

    // trim trailing comma
    query = `${query.slice(0, -2)} `;

    // Add FROM clause
    query += `FROM ${table} `;
    return query;
  }

  // SQL Server implementation of LIMIT
  if (criteria.limit) {
    query += `TOP ${criteria.limit} `;
  }

  query += `* FROM ${table} `;
  return query;
};
