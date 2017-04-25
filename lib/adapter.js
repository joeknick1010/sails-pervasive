'use strict';

const _ = require('underscore');
const sql = require('./sql.js');
const db = require('odbc')();

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

    _dbConnected: false,
    _connectionString: '',

    defaults: {
      schema: false,
    },


    _normalizeResult(result) {
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
    },


    _query(sql, data, callback) {
      if (callback === undefined) {
        callback = data;
        data = undefined;
      }
      const self = this;

      const _queryWithConnect = function _queryWithConnect(sql, data, callback) {
        db.open(self._connectionString, (err) => {
          if (err) {
            self._dbConnected = false;
            return callback(err);
          }
          self._dbConnected = true;
          db.query(sql, data, (err, res) => {
            if (err) callback(err);
            else callback(null, self._normalizeResult(res));
          });
        });
      };

      if (this._dbConnected) {
        db.query(sql, data, (err, res) => {
          if (err) _queryWithConnect(sql, data, callback);
          else callback(null, self._normalizeResult(res));
        });
      } else _queryWithConnect(sql, data, callback);
    },

    registerConnection(connection, collections, callback) {
      this._connectionString = connection.connectionString;
      collections.forEach((c) => {
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
      if (this._dbConnected) {
        db.close(callback);
      } else {
        callback();
      }
    },


    query(collectionName, statement, data, callback) {
      if (_.isFunction(data)) {
        callback = data;
        data = null;
      }

      this._query(statement, data, callback);
    },

    find(connectionName, collectionName, options, callback) {
      if (options.groupBy || options.sum || options.average || options.min || options.max) {
        if (!options.sum && !options.average && !options.min && !options.max) {
          return callback(new Error('Cannot groupBy without a calculation'));
        }
      }

      const statement = sql.selectQuery(collectionName, options);
      this._query(statement, (err, recordset) => {
        if (err) return callback(err);
        callback(null, recordset);
      });
    },
  };
}());
