![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png) 

# sails-pervasive [![NPM version](https://badge.fury.io/js/sails-pervasive.png)](http://badge.fury.io/js/sails-pervasive)
Microsoft SQL Server Adapter for Sails.js

## Compatibility

* Pervaseive PSQL v11 SP3 and later (tested with Pervaseive PSQL v11 SP3)
* Waterline 0.11.11
* Linux

## Installation
```sh
npm install sails-pervasive
```

## Configuration
__Basic Options__
```javascript
const connectionConfig = {
  adapters: {
    pervasive: sailsPervasiveAdapter,
  },

  connections: {
    default: {
      adapter: 'pervasive',
      connectionString: 'DSN=my_dsn',
    },
  },
};
```

To use the adapter, you need to install the pervasive client and unixodbc first.

To solve encoding problems, do the following:

Add the parameter to the dsn definition (in the odbc.ini file):
```
PvTranslate=auto
```

Change the encoding from UNICODE to UTF8 in the npm odbc package:

Comment this code snippet in binding.gyp
```
#'defines' : [
#  "UNICODE"
#],
```

After which, run the following command from the npm directory of the odbc package
```
node-gyp configure build
```

## License

[MIT License] Copyright © 2017 Vedidev, Pronin Egor

