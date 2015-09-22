/**
 * Created by westopher on 9/22/15.
 */
var pistol = require('./pistol');

/**
 * Command line utility used for testing our round robin queue worker setup
 */
pistol(getJsonInput());

/**
 * Parses the JSON input into an actual string
 *
 * @returns {{host: string}}
 */
function getJsonInput () {
    try {
        var json = JSON.parse(process.argv.slice(2)[0]);
        if (!json) {
            json = {host: 'www.google.com'};
        }
    } catch (e) {
        var json = {host: 'www.google.com'};
    }
    return json;
}

function getArgs () {
    /**
     * var defaults = {
     *      m: 'method',
     *      h: 'host',
     *      p: 'port',
     *      t: 'path'
     *      h: 'headers
     * }
     */
}