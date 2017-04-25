'use strict';

var _ = require('underscore');
var Query = require('./query');
var sql = require('./sql.js');
var utils = require('./utils');
var db = require('odbc')();

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

var dbs = {};

var adapter = {

	identity: 'sails-pervasive',
	syncable: false,
	schema: false,

    _dbConnected: false,
    _connectionString: '',
    
    defaults: {
        schema: false
    },
    
    
    _normalizeResult: function(result) {
        var res
        if (_.isArray(result))
            for (var i = 0; i < result.length; i++) {
                res = result[i]
                if (_.isObject(res))         
                    for (var k in res)
                        if (res.hasOwnProperty(k)) {
                            if (_.isString(res[k])) res[k] = res[k].trimRight()

                        }
            }
        return result
    },


    _query: function(sql, data, cb){

        if (cb == undefined) {
            cb = data
            data = undefined
        }
        var self = this

        var _queryWithConnect = function (sql, data, cb) {
            db.open(self._connectionString, function (err) {
                if (err) {
                    self._dbConnected = false
                    return cb(err)
                }
                self._dbConnected = true
                db.query(sql, data, function (err, res) {
                    if (err) cb(err)
                    else cb(null, self._normalizeResult(res))
                })
            })                
        }
        
        if (this._dbConnected) {
            db.query(sql, data, function (err, res) {
                if (err) _queryWithConnect(sql, data, cb)
                else cb(null, self._normalizeResult(res))
            })
        } else _queryWithConnect(sql, data, cb)
    },
    
    registerConnection: function (connection, collections, cb){
        this._connectionString = connection.connectionString
        for (var c in collections) {
            if( collections.hasOwnProperty(c) ) {
                this._registerCollection(collections[c])
            } 
        }

        cb()        
    },

    _registerCollection: function (collection) {
        
		var def = _.clone(collection);
        if (def.hasOwnProperty('tableName')) var key = def.tableName
		else var key = def.identity;
		var definition = def.definition || {};

		// Set a default Primary Key
		var pkName = 'id';

		// Set the Primary Key Field
		for(var attribute in definition) {

			if(!definition[attribute].hasOwnProperty('primaryKey')) continue;

			// Check if custom primaryKey value is falsy
			if(!definition[attribute].primaryKey) continue;

			// Set the pkName to the custom primaryKey value
			pkName = attribute;
		}

		// Set the primaryKey on the definition object
		def.primaryKey = pkName;

		// Store the definition for the model identity
		if(!dbs[key]) dbs[key.toString()] = def;
	},

	teardown: function(cb) {
        if (_dbConnected) db.close(cb);
        else cb();
	},

    
	query: function(collectionName, statement, data, cb) {                
		if (_.isFunction(data)) {
			cb = data;
			data = null;
		}

        this._query(statement, data, cb);
	},

	find: function(connectionName, collectionName, options, cb) {
        
		if(options.groupBy || options.sum || options.average || options.min || options.max) {
			if(!options.sum && !options.average && !options.min && !options.max) {
				return cb(new Error('Cannot groupBy without a calculation'));
			}
		}

		var statement = sql.selectQuery(collectionName, options);
        this._query(statement, function(err, recordset) {
            if (err) return cb(err);
            cb(null, recordset);

        });
  },
};

return adapter;

})();