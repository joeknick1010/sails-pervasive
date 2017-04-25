'use strict';

const _ = require('underscore');
const sql = require('./sql.js');
const db = require('odbc')();

module.exports = (function () {
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

  const adapter = {

    identity: 'sails-pervasive',
    syncable: false,
    schema: false,

    _dbConnected: false,
    _connectionString: '',

    defaults: {
      schema: false,
    },


    _normalizeResult(result) {
      let res;
      if (_.isArray(result)) {
        for (let i = 0; i < result.length; i++) {
          res = result[i];
          if (_.isObject(res)) {
// eslint-disable-next-line no-restricted-syntax
            for (const k in res) {
// eslint-disable-next-line no-prototype-builtins
              if (res.hasOwnProperty(k)) {
                if (_.isString(res[k])) res[k] = res[k].trimRight();
              }
            }
          }
        }
      }
      return result;
    },


    _query(sql, data, cb) {
      if (cb === undefined) {
        cb = data;
        data = undefined;
      }
      const self = this;

      const _queryWithConnect = function (sql, data, cb) {
        db.open(self._connectionString, (err) => {
          if (err) {
            self._dbConnected = false;
            return cb(err);
          }
          self._dbConnected = true;
          db.query(sql, data, (err, res) => {
            if (err) cb(err);
            else cb(null, self._normalizeResult(res));
          });
        });
      };

      if (this._dbConnected) {
        db.query(sql, data, (err, res) => {
          if (err) _queryWithConnect(sql, data, cb);
          else cb(null, self._normalizeResult(res));
        });
      } else _queryWithConnect(sql, data, cb);
    },

    registerConnection(connection, collections, cb) {
      this._connectionString = connection.connectionString;
// eslint-disable-next-line no-restricted-syntax
      for (const c in collections) {
// eslint-disable-next-line no-prototype-builtins
        if (collections.hasOwnProperty(c)) {
          this._registerCollection(collections[c]);
        }
      }
      cb();
    },

    _registerCollection(collection) {
      const def = _.clone(collection);
      if (def.hasOwnProperty('tableName'))
        let key = def.tableName;
      else let key = def.identity;
      const definition = def.definition || {};

		// Set a default Primary Key
      let pkName = 'id';

		// Set the Primary Key Field
      for (const attribute in definition) {
        if (!definition[attribute].hasOwnProperty('primaryKey')) continue;

			// Check if custom primaryKey value is falsy
        if (!definition[attribute].primaryKey) continue;

			// Set the pkName to the custom primaryKey value
        pkName = attribute;
      }

		// Set the primaryKey on the definition object
      def.primaryKey = pkName;

		// Store the definition for the model identity
      if (!dbs[key]) dbs[key.toString()] = def;
    },

    teardown(cb) {
      if (_dbConnected) db.close(cb);
      else cb();
    },


    query(collectionName, statement, data, cb) {
      if (_.isFunction(data)) {
        cb = data;
        data = null;
      }

      this._query(statement, data, cb);
    },

    find(connectionName, collectionName, options, cb) {
      if (options.groupBy || options.sum || options.average || options.min || options.max) {
        if (!options.sum && !options.average && !options.min && !options.max) {
          return cb(new Error('Cannot groupBy without a calculation'));
        }
      }

      const statement = sql.selectQuery(collectionName, options);
      this._query(statement, (err, recordset) => {
        if (err) return cb(err);
        cb(null, recordset);
      });
    },
  };

  return adapter;
}());
