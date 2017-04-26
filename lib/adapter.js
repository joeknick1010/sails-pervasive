'use strict';

const _ = require('underscore');
const sql = require('./sql.js');
const db = require('odbc')();

let dbConnected = false;
let connectionString = '';

const normalizeResult = (result) => {
  if (_.isArray(result)) {
    result.forEach((res) => {
      if (_.isObject(res)) {
        Object.keys(res).forEach((k) => {
          if (Object.prototype.hasOwnProperty.call(res, k) && _.isString(res[k])) {
            res[k] = res[k].trimRight();
          }
        });
      }
    });
  }
  return result;
};

const dbQuery = (sql, data, callback) => {
  if (callback === undefined) {
    callback = data;
    data = undefined;
  }

  const _queryWithConnect = function _queryWithConnect(sql, data, callback) {
    db.open(connectionString, (err) => {
      if (err) {
        dbConnected = false;
        return callback(err);
      }
      dbConnected = true;
      db.query(sql, data, (err, res) => {
        if (err) callback(err);
        else callback(null, normalizeResult(res));
      });
    });
  };

  if (dbConnected) {
    db.query(sql, data, (err, res) => {
      if (err) _queryWithConnect(sql, data, callback);
      else callback(null, normalizeResult(res));
    });
  } else _queryWithConnect(sql, data, callback);
};

module.exports = (function main() {
  /**
   * PervasiveAdapter (read only)
   *
   * @module      :: Pervasive Adapter (read only)
   * @description :: Pervasive database adapter for Sails.js (read only)
   * @docs        ::
   *
   * @syncable    :: false
   * @schema      :: false
   */

  const dbs = {};

  return {
    identity: 'sails-pervasive',
    syncable: false,
    schema: false,


    defaults: {
      schema: false,
    },

    registerConnection(connection, collections, callback) {
      connectionString = connection.connectionString;
      Object.keys(collections).forEach((c) => {
        this._registerCollection(collections[c]);
      });

      callback();
    },

    _registerCollection(collection) {
      const def = _.clone(collection);
      const key = Object.prototype.hasOwnProperty.call(def, 'tableName') ?
        def.tableName : def.identity;
      const definition = def.definition || {};

      // Set a default Primary Key
      let pkName = 'id';

      // Set the Primary Key Field
      Object.keys(definition).forEach((attribute) => {
        if (Object.prototype.hasOwnProperty.call(definition[attribute], 'primaryKey')) {
          // Check if custom primaryKey value is falsy
          if (definition[attribute].primaryKey) {
            // Set the pkName to the custom primaryKey value
            pkName = attribute;
          }
        }
      });

      // Set the primaryKey on the definition object
      def.primaryKey = pkName;

      // Store the definition for the model identity
      if (!dbs[key]) dbs[key.toString()] = def;
    },

    teardown(callback) {
      if (dbConnected) {
        db.close(callback);
      } else {
        callback();
      }
    },

    teardownSync() {
      if (dbConnected) {
        try {
          db.closeSync();
// eslint-disable-next-line no-empty
        } catch (e) {
        }
      }
    },

    query(connectionName, tableName, queryString, args, cb) {
      dbQuery(queryString, args, cb);
    },

    find(connectionName, collectionName, options, callback) {
      if (options.groupBy || options.sum || options.average || options.min || options.max) {
        if (!options.sum && !options.average && !options.min && !options.max) {
          return callback(new Error('Cannot groupBy without a calculation'));
        }
      }

      const statement = sql.selectQuery(collectionName, options);
      dbQuery(statement, (err, recordset) => {
        if (err) return callback(err);
        callback(null, recordset);
      });
    },
  };
}());
