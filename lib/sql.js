'use strict';

const _ = require('underscore');
_.str = require('underscore.string');
const utils = require('./utils');

// Cast waterline types into SQL data types
function sqlTypeCast(type) {
  type = type && type.toLowerCase();

  switch (type) {
    case 'string':
      return 'NVARCHAR(255)';
    case 'text':
    case 'array':
    case 'json':
      return 'NTEXT';
    case 'boolean':
      return 'BIT';
    case 'int':
    case 'integer':
      return 'INT';
    case 'float':
    case 'double':
      return 'FLOAT';
    case 'date':
      return 'DATE';
    case 'time':
      return 'TIME';
    case 'datetime':
      return 'DATETIME';
    default:
      console.error(`Unregistered type given: ${type}`);
      return 'TEXT';
  }
}

function toSqlDate(date) {
  date = `${date.getUTCFullYear()}-${
    (`00${date.getUTCMonth() + 1}`).slice(-2)}-${
    (`00${date.getUTCDate()}`).slice(-2)} ${
    (`00${date.getUTCHours()}`).slice(-2)}:${
    (`00${date.getUTCMinutes()}`).slice(-2)}:${
    (`00${date.getUTCSeconds()}`).slice(-2)}`;

  return date;
}

function validSubAttrCriteria(c) {
  return _.isObject(c) && (
    !_.isUndefined(c.not) || !_.isUndefined(c.greaterThan) || !_.isUndefined(c.lessThan) ||
    !_.isUndefined(c.greaterThanOrEqual) || !_.isUndefined(c.lessThanOrEqual) || !_.isUndefined(c['<']) ||
    !_.isUndefined(c['<=']) || !_.isUndefined(c['!']) || !_.isUndefined(c['>']) || !_.isUndefined(c['>=']) ||
    !_.isUndefined(c.startsWith) || !_.isUndefined(c.endsWith) || !_.isUndefined(c.contains) ||
    !_.isUndefined(c.like));
}

const sql = {

  escapeId(val) {
    return `[${val.replace(/'/g, "''")}]`;
  },

  escape(val) {
    if (val === undefined || val === null) {
      return 'NULL';
    }

    if (typeof val === 'boolean') {
      return (val) ? '1' : '0';
    } else if (typeof val === 'number') {
      return `${val}`;
    }

    if (typeof val === 'object') {
      val = val.toString();
    }

    /* eslint-disable no-useless-escape */
    val = val.replace(/[\"\']/g, (s) => {
      switch (s) {
        case "\'":
          return "''";
        case '\"':
          return "''";
        default:
          return ' ';
      }
    });
    /* eslint-enable no-useless-escape */

    return `'${val}'`;
  },

  normalizeSchema(schema) {
    return _.reduce(schema, (memo, field) => {
      // Marshal mssql DESCRIBE to waterline collection semantics
      const attrName = field.ColumnName;
      const type = field.TypeName;

      memo[attrName] = {
        type,
      };

      memo[attrName].autoIncrement = field.AutoIncrement;
      memo[attrName].primaryKey = field.PrimaryKey;
      memo[attrName].unique = field.Unique;
      memo[attrName].indexed = field.Indexed;
      memo[attrName].nullable = field.Nullable;

      return memo;
    }, {});
  },

  // @returns ALTER query for adding a column
  addColumn(collectionName, attrName, attrDef) {
    const tableName = collectionName;
    const columnDefinition = sql._schema(collectionName, attrDef, attrName);
    return `ALTER TABLE ${tableName} ADD ${columnDefinition}`;
  },

  // @returns ALTER query for dropping a column
  removeColumn(collectionName, attrName) {
    const tableName = collectionName;
    return `ALTER TABLE ${tableName} DROP COLUMN ${attrName}`;
  },

  selectQuery(collectionName, options) {
    let query = utils.buildSelectStatement(options, collectionName);
    query += sql.serializeOptions(collectionName, options);
    return query;
  },

  insertQuery(collectionName, data) {
    const tableName = collectionName;
    return `INSERT INTO ${tableName} (${sql.attributes(collectionName, data)}) VALUES (${sql.values(collectionName, data)}); SELECT @@IDENTITY AS [id]`;
  },

  // Create a schema csv for a DDL query
  schema(collectionName, attributes) {
    return sql.build(collectionName, attributes, sql._schema);
  },

  _schema(collectionName, attribute, attrName) {
    const type = sqlTypeCast(attribute.type);

    if (attribute.primaryKey) {
      // If type is an integer, set auto increment
      if (type === 'INT') {
        return `${attrName} ${type} IDENTITY(1,1) PRIMARY KEY`;
      }

      // Just set NOT NULL on other types
      return `${attrName} VARCHAR(255) NOT NULL PRIMARY KEY`;
    }

    // Process UNIQUE field
    if (attribute.unique) {
      return `${attrName} ${type} UNIQUE`;
    }

    return `${attrName} ${type} `;
  },

  // Create an attribute csv for a DQL query
  attributes(collectionName, attributes) {
    return sql.build(collectionName, attributes, sql.prepareAttribute);
  },

  // Create a value csv for a DQL query
  // key => optional, overrides the keys in the dictionary
  values(collectionName, values, key) {
    return sql.build(collectionName, values, sql.prepareValue, ', ', key);
  },

  updateCriteria(collectionName, values) {
    const query = sql.build(collectionName, values, sql.prepareCriterion);
    return query;
  },

  prepareCriterion(collectionName, value, key, parentKey) {
    if (validSubAttrCriteria(value)) {
      return sql.where(collectionName, value, null, key);
    }

    // Build escaped attr and value strings using either the key,
    // or if one exists, the parent key
    let attrStr;
    let valueStr;


    // Special comparator case
    if (parentKey) {
      attrStr = sql.prepareAttribute(collectionName, value, parentKey);
      valueStr = sql.prepareValue(collectionName, value, parentKey);

      // Why don't we strip you out of those bothersome apostrophes?
      const nakedButClean = _.str.trim(valueStr, '\'');

      if (key === '<' || key === 'lessThan') return `${attrStr}<${valueStr}`;
      else if (key === '<=' || key === 'lessThanOrEqual') return `${attrStr}<=${valueStr}`;
      else if (key === '>' || key === 'greaterThan') return `${attrStr}>${valueStr}`;
      else if (key === '>=' || key === 'greaterThanOrEqual') return `${attrStr}>=${valueStr}`;
      else if (key === '!' || key === 'not') {
        if (value === null) return `${attrStr} IS NOT NULL`;
        else return `${attrStr}<>${valueStr}`;
      } else if (key === 'like') return `${attrStr} LIKE '${nakedButClean}'`;
      else if (key === 'contains') return `${attrStr} LIKE '%${nakedButClean}%'`;
      else if (key === 'startsWith') return `${attrStr} LIKE '${nakedButClean}%'`;
      else if (key === 'endsWith') return `${attrStr} LIKE '%${nakedButClean}'`;
      else throw new Error(`Unknown comparator: ${key}`);
    } else {
      attrStr = sql.prepareAttribute(collectionName, value, key);
      valueStr = sql.prepareValue(collectionName, value, key);
      if (_.isNull(value)) {
        return `${attrStr} IS NULL`;
      } else return `${attrStr}=${valueStr}`;
    }
  },

  prepareValue(collectionName, value) {
    // Cast dates to SQL
    if (_.isDate(value)) {
      value = toSqlDate(value);
    }

    // Cast functions to strings
    if (_.isFunction(value)) {
      value = value.toString();
    }

    // Escape (also wraps in quotes)
    return sql.escape(value);
  },

  prepareAttribute(collectionName, value, attrName) {
    return attrName;
  },

  // Starting point for predicate evaluation
  // parentKey => if set, look for comparators and apply them to the parent key
  where(collectionName, where, key, parentKey) {
    return sql.build(collectionName, where, sql.predicate, ' AND ', undefined, parentKey);
  },

  // Recursively parse a predicate calculus and build a SQL query
  predicate(collectionName, criterion, key, parentKey) {
    let queryPart = '';

    if (parentKey) {
      return sql.prepareCriterion(collectionName, criterion, key, parentKey);
    }

    // OR
    if (key.toLowerCase() === 'or') {
      queryPart = sql.build(collectionName, criterion, sql.where, ' OR ');
      return ` ( ${queryPart} ) `;
    } else if (key.toLowerCase() === 'and') {
      // AND
      queryPart = sql.build(collectionName, criterion, sql.where, ' AND ');
      return ` ( ${queryPart} ) `;
    } else if (_.isArray(criterion)) {
      // IN
      queryPart = `${sql.prepareAttribute(collectionName, null, key)} IN (${sql.values(collectionName, criterion, key)})`;
      return queryPart;
    } else if (key.toLowerCase() === 'like') {
      // LIKE
      return sql.build(collectionName, criterion, (collectionName, value, attrName) => {
        const attrStr = sql.prepareAttribute(collectionName, value, attrName);
        if (_.isRegExp(value)) {
          throw new Error('RegExp not supported');
        }
        let valueStr = sql.prepareValue(collectionName, value, attrName);
        // Handle escaped percent (%) signs [encoded as %%%]
        valueStr = valueStr.replace(/%%%/g, '\\%');

        return `${attrStr} LIKE ${valueStr}`;
      }, ' AND ');
    } else if (key.toLowerCase() === 'not') {
      // NOT
      throw new Error('NOT not supported yet!');
    } else {
      // Basic criteria item
      return sql.prepareCriterion(collectionName, criterion, key);
    }
  },

  serializeOptions(collectionName, options) {
    let queryPart = '';

    if (options.where) {
      queryPart += `WHERE ${sql.where(collectionName, options.where)} `;
    }

    if (options.groupBy) {
      queryPart += 'GROUP BY ';

      // Normalize to array
      if (!Array.isArray(options.groupBy)) options.groupBy = [options.groupBy];
      options.groupBy.forEach((key) => {
        queryPart += `${key}, `;
      });

      // Remove trailing comma
      queryPart = `${queryPart.slice(0, -2)} `;
    }

    if (options.sort) {
      queryPart += 'ORDER BY ';

      // Sort through each sort attribute criteria
      _.each(options.sort, (direction, attrName) => {
        queryPart += `${sql.prepareAttribute(collectionName, null, attrName)} `;

        // Basic MongoDB-style numeric sort direction
        if (direction === 1) {
          queryPart += 'ASC, ';
        } else {
          queryPart += 'DESC, ';
        }
      });

      // Remove trailing comma
      if (queryPart.slice(-2) === ', ') {
        queryPart = `${queryPart.slice(0, -2)} `;
      }
    }

    return queryPart;
  },

  build(collectionName, collection, fn, separator, keyOverride, parentKey) {
    separator = separator || ', ';
    let $sql = '';

    _.each(collection, (value, key) => {
      $sql += fn(collectionName, value, keyOverride || key, parentKey);

      // (always append separator)
      $sql += separator;
    });

    return _.str.rtrim($sql, separator);
  },

};

module.exports = sql;
