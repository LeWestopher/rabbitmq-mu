/**
 * Created by westopher on 9/22/15.
 */
var _ = require('underscore');
var ping = require('ping');
var http = require('request-promise');

/**
 * Constructor for Railgun supplies service for the following request types:
 *
 * - Ping : 'ping'
 * - 200 Response Integrity : 'response_integrity'
 * - Keyword : 'keyword'
 * - JSON Response Integrity : 'json_response_integrity'
 *
 * Object: {
 *      test_type: 'ping',          varchar(20)         not nullable    default 'ping'
 *      method: 'GET',              varchar(5)          nullable        default null
 *      scheme: 'http',             varchar(5)          nullable        default null
 *      host: 'www.google.com',     varchar(255)        not nullable    default ''
 *      path: '/sheets/',           longtext(2000)      nullable        default null
 *      port: 80,                   int(11)             nullable        default null
 *      headers: {},                longtext(2000)      not nullable    default '{}'
 *      authentication: {},         longtext(2000)      not nullable    default '{}'
 *      expected_json: {}           longtext(10000)     not nullable    default '{}'
 * }
 *
 * @type {{defaults: {host: string, path: string, port: number, method: string}}}
 */
function Railgun (opts) {

    // Set our options object on our main object to cache metadata
    this.opts = opts;

    // Set the callbacks object on opts if it doesn't already exist to avoid dot notation errors
    opts.callbacks = (opts.callbacks) ? opts.callbacks : {};

    // Set our default request metadata
    this.test_type = opts.test_type || 'ping';
    this.method = opts.method || 'GET';
    this.scheme = opts.scheme || 'http';
    this.host = opts.host || '';
    this.path = opts.path || null;
    this.port = opts.port || null;
    this.headers = opts.headers || {};
    this.authentication = opts.authentication || {};

    // Set our test type callbacks with defaults
    this.callbacks = {
        ping: opts.callbacks.ping || function(){},
        response_integrity: opts.callbacks.response_integrity || function(){},
        keyword: opts.callbacks.keyword || function(){},
        json_response_integrity: opts.callbacks.json_response_integrity || function(){}
    };

    // Set a default expected response
    this.expected_res = opts.expected_res || {
        code: 200
    };

    // Set expected JSON return value
    this.expected_json = opts.expected_json || {};

    // Cache copies of request and response objects
    this.req = {};
    this.res = {};
}
/**
 * Declare event handlers for the four major test types
 *
 * @param event
 * @param callback
 * @returns {Railgun}
 */
Railgun.prototype.on = function (event, callback) {
    if (!this.validateEvent(event)) {
        throw new Error('That event type is not supported by Railgun.');
    }
    this.callbacks[event] = callback;
    return this;
};
/**
 * Builds a request object that is palatable to request-promise
 *
 * @returns {Railgun}
 */
Railgun.prototype.buildRequest = function () {
    this.req = {
        url: this.url(),
        headers: this.headers,
        method: this.method,
        resolveWithFullResponse: true
    };
    return this;
};
/**
 * Setter function for the test type
 *
 * @param test_type
 * @returns {Railgun}
 */
Railgun.prototype.setTest = function (test_type) {
    this.test_type = test_type;
    return this;
};
/**
 * Sets a header for the outgoing request
 *
 * @param header
 * @param value
 * @returns {Railgun}
 */
Railgun.prototype.setHeader = function (header, value) {
    this.headers[header] = value;
    return this;
};
/**
 * Sets the expected JSON keys from the API endpoint
 *
 * @param expectations
 * @returns {Railgun}
 */
Railgun.prototype.expected = function (expectations) {
    this.expected_json = expectations;
    return this;
};
/**
 * Validates whether an event is one of the four acceptable test types
 *
 * @param event
 * @returns {boolean}
 */
Railgun.prototype.validateEvent = function (event) {
    if (event !== 'ping' && event !== 'response_integrity' && event !== 'keyword' && event !== 'json_response_integrity') {
        return false;
    }
    return true;
};
/**
 * Setter function for the returned response
 *
 * @param response
 * @returns {Railgun}
 */
Railgun.prototype.setResponse = function (response) {
    this.res = response;
    return this;
};
/**
 * Sets the method of the request
 *
 * @param method
 * @returns {Railgun}
 */
Railgun.prototype.setMethod = function (method) {
    this.method = method;
    return this;
};
/**
 * Sets the scheme of the request
 *
 * @param scheme
 * @returns {Railgun}
 */
Railgun.prototype.setScheme = function (scheme) {
    this.scheme = scheme;
    return this;
};
/**
 * Sets the host of the request
 *
 * @param host
 * @returns {Railgun}
 */
Railgun.prototype.setHost = function (host) {
    this.host = host;
    return this;
};
/**
 * Sets the path of the request
 *
 * @param path
 * @returns {Railgun}
 */
Railgun.prototype.setPath = function (path) {
    this.path = path;
    return this;
};
/**
 * Sets the port of the request
 *
 * @param port
 * @returns {Railgun}
 */
Railgun.prototype.setPort = function (port) {
    this.port = port;
    return this;
};
/**
 * Returns the fully canonicallized URL
 *
 * @returns {string}
 */
Railgun.prototype.url = function () {
    var base = this.scheme + '://' + this.host;
    if (this.port) {
        base += ':' + this.port;
    }
    if (this.path) {
        base += this.path;
    }
    return base;
};
/**
 * Creates our ping test
 *
 * @returns {*}
 */
Railgun.prototype.ping = function () {
    var _this = this;
    return ping.promise.probe(this.host)
        .then(function (response) {
            _this.setResponse(response);
            var callback = _.bind(_this.callbacks.ping, _this, response);
            callback();
        });
};
/**
 * Creates our response integrity test, which tests for a 200 value on the response
 *
 * @returns {*}
 */
Railgun.prototype.response_integrity = function () {
    var _this = this;
    this.buildRequest();
    return http(this.req)
        .then(function (response) {
            _this.setResponse(response);
            var callback = _.bind(_this.callbacks.response_integrity, _this, response);
            callback();
        });
};
/**
 * Creates our keyword integrity test, which determines if a keyword exists in the returned response
 *
 * @returns {*}
 */
Railgun.prototype.keyword = function () {
    var _this = this;
    this.buildRequest();
    return http(this.req)
        .then(function (response) {
            _this.setResponse(response);
            var callback = _.bind(_this.callbacks.keyword, _this, response);
            callback();
        });
};
/**
 * Creates our JSON response integrity test, which determines if a set of keys are set properly on a JSON response
 *
 * @returns {*}
 */
Railgun.prototype.json_response_integrity = function () {
    var _this = this;
    this.buildRequest();
    return http(this.req)
        .then(function (response) {
            _this.setResponse(response);
            var callback = _.bind(_this.callbacks.json_response_integrity, _this, response);
            callback();
        });
};
/**
 * Executes the currently set test with the input request set on the main object
 *
 * @returns {*}
 */
Railgun.prototype.execute = function () {
    return this[this.test_type]();
};
/**
 * Export our Railgun object for creation
 *
 * @param opts
 * @returns {Railgun}
 */
module.exports = function (opts) {
    opts = (opts) ? opts : {};
    return new Railgun(opts);
};