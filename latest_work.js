//Installed node modules: jquery underscore request express jade shelljs passport http sys lodash async mocha chai sinon sinon-chai moment connect validator restify ejs ws co when helmet wrench brain mustache should backbone forever debug

var _ = require('underscore')
  , q = require('q')
  , amqp = require('amqplib/callback_api');

   // 'use strict';
    
class WorkQueue  {

    constructor(config) {
        this.setEntireConfig(config);
        this.connection = null;
    }
    
    getConfig(key = null) {
        if (key) {
            return this._config[key];
        }
        return this._config;
    }
    
    setConfig(key, value) {
        this._config[key] = value;
        return this._config[key];
    }
    
    setEntireConfig: (config) {
        this._config = config;
        return this._config;
    }

    clearConfig() {
        this._config = [];
    }

    connect() {
        return q((this.connection) ? this.connection : this.getConnection());
    }

    channel() {
        if (!this.connection) {
            throw new Error('You must define a connection object to get a channel object.');
        }
        return q((this.channel) ? this.channel : this.getChannel(this.connection));
    }

    getConnection() {
        var deferred = q.defer()
          , _this = this;
                
        
        amqp.connect('amqp://localhost', (error, connection) => {
            if (error) {
                return deferred.reject(error);
            }    
            this.connection = connection;
            deferred.resolve(connection);
        })
        
        return deferred.promise;
    }

    getChannel(connection) {
        var deferred = q.defer();
        
        connection.createChannel('amqp://localhost', (error, channel) => {
            if(error) {
                return deferred.reject(error);
            }
            this.channel = channel;
            deferred.resolve(channel);
        })
        return deferred.promise;
    }
    
}

let wq = new WorkQueue({});

wq.connect()
    .then(function (connection) {
        return wq.channel(connection);
    })    

    .then(function (channel) {
    
    })

    .catch(function (error) {
        
    })
