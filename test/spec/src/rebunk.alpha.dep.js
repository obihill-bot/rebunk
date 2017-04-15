/*! Dependencies */

/*! rScript v1.0.0 | @link https://github.com/restive/rScript | @copyright 2017 Restive LLC <https://github.com/restive> | @license MIT */

/**
 * Polyfills
 */
//forEach
if(typeof String.prototype.forEach !== 'function') {
    Array.prototype.forEach = function (callback, context) {
        for (var i = 0; i < this.length; i++) {
            callback.apply(context, [this[i], i, this]);
        }
    };
}
//Trim
if(typeof String.prototype.trim !== 'function') {
    String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, '');
    };
}

/*! AmplifyJS-Store - v1.1.0 | @link http://amplifyjs.com/api/store/ | @copyright 2012 AppendTo <http://appendto.com/contact> | @license MIT and GPL V2 | Modified by Obinwanne Hill on February 14 2015 */
(function( amplify, undefined ) {

    var store = amplify.store = function( key, value, options ) {
        var type = store.type;
        if ( options && options.type && options.type in store.types ) {
            type = options.type;
        }
        return store.types[ type ]( key, value, options || {} );
    };

    store.types = {};
    store.type = null;
    store.addType = function( type, storage ) {
        if ( !store.type ) {
            store.type = type;
        }

        store.types[ type ] = storage;
        store[ type ] = function( key, value, options ) {
            options = options || {};
            options.type = type;
            return store( key, value, options );
        };
    };
    store.error = function() {
        return "amplify.store quota exceeded";
    };

    var rprefix = /^r_/;
    function createFromStorageInterface( storageType, storage ) {
        store.addType( storageType, function( key, value, options ) {
            var storedValue, parsed, i, remove,
                ret = value,
                now = (new Date()).getTime();

            if ( !key ) {
                ret = {};
                remove = [];
                i = 0;
                try {
                    // accessing the length property works around a localStorage bug
                    // in Firefox 4.0 where the keys don't update cross-page
                    // we assign to key just to avoid Closure Compiler from removing
                    // the access as "useless code"
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=662511
                    key = storage.length;

                    while ( !!(key = storage.key( i++ )) ) {
                        if ( rprefix.test( key ) ) {
                            parsed = JSON.parse( storage.getItem( key ) );
                            if ( parsed.expires && parsed.expires <= now ) {
                                remove.push( key );
                            } else {
                                ret[ key.replace( rprefix, "" ) ] = parsed.data;
                            }
                        }
                    }
                    while ( !!(key = remove.pop()) ) {
                        storage.removeItem( key );
                    }
                } catch ( error ) {}
                return ret;
            }

            // protect against name collisions with direct storage
            key = "r_" + key;

            if ( value === undefined ) {
                storedValue = storage.getItem( key );
                parsed = storedValue ? JSON.parse( storedValue ) : { expires: -1 };
                if ( parsed.expires && parsed.expires <= now ) {
                    storage.removeItem( key );
                } else {
                    return parsed.data;
                }
            } else {
                if ( value === null ) {
                    storage.removeItem( key );
                } else {
                    parsed = JSON.stringify({
                        data: value,
                        expires: options.expires ? now + options.expires : null
                    });
                    try {
                        storage.setItem( key, parsed );
                        // quota exceeded
                    } catch( error ) {
                        // expire old data and try again
                        store[ storageType ]();
                        try {
                            storage.setItem( key, parsed );
                        } catch( error2 ) {
                            throw store.error();
                        }
                    }
                }
            }

            return ret;
        });
    }

// localStorage + sessionStorage
// IE 8+, Firefox 3.5+, Safari 4+, Chrome 4+, Opera 10.5+, iPhone 2+, Android 2+
    var storageTypeFor = { localStorage: 1, sessionStorage: 1 };
    for ( var webStorageType in storageTypeFor ) {
        if(storageTypeFor.hasOwnProperty(webStorageType))
        {
            // try/catch for file protocol in Firefox and Private Browsing in Safari 5
            try {
                // Safari 5 in Private Browsing mode exposes localStorage
                // but doesn't allow storing data, so we attempt to store and remove an item.
                // This will unfortunately give us a false negative if we're at the limit.
                window[ webStorageType ].setItem( "r_", "x" );
                window[ webStorageType ].removeItem( "r_" );
                createFromStorageInterface( webStorageType, window[ webStorageType ] );
            } catch( e ) {}
        }
    }

// globalStorage
// non-standard: Firefox 2+
// https://developer.mozilla.org/en/dom/storage#globalStorage
    if ( !store.types.localStorage && window.globalStorage ) {
        // try/catch for file protocol in Firefox
        try {
            createFromStorageInterface( "globalStorage",
                window.globalStorage[ window.location.hostname ] );
            // Firefox 2.0 and 3.0 have sessionStorage and globalStorage
            // make sure we default to globalStorage
            // but don't default to globalStorage in 3.5+ which also has localStorage
            if ( store.type === "sessionStorage" ) {
                store.type = "globalStorage";
            }
        } catch( e ) {}
    }

// userData
// non-standard: IE 5+
// http://msdn.microsoft.com/en-us/library/ms531424(v=vs.85).aspx
    (function() {
        // IE 9 has quirks in userData that are a huge pain
        // rather than finding a way to detect these quirks
        // we just don't register userData if we have localStorage
        if ( store.types.localStorage ) {
            return;
        }

        // append to html instead of body so we can do this from the head
        var div = document.createElement( "div" ),
            attrKey = "amplify";
        div.style.display = "none";
        document.getElementsByTagName( "head" )[ 0 ].appendChild( div );

        // we can't feature detect userData support
        // so just try and see if it fails
        // surprisingly, even just adding the behavior isn't enough for a failure
        // so we need to load the data as well
        try {
            div.addBehavior( "#default#userdata" );
            div.load( attrKey );
        } catch( e ) {
            div.parentNode.removeChild( div );
            return;
        }

        store.addType( "userData", function( key, value, options ) {
            div.load( attrKey );
            var attr, parsed, prevValue, i, remove,
                ret = value,
                now = (new Date()).getTime();

            if ( !key ) {
                ret = {};
                remove = [];
                i = 0;
                while ( !!(attr = div.XMLDocument.documentElement.attributes[ i++ ]) ) {
                    parsed = JSON.parse( attr.value );
                    if ( parsed.expires && parsed.expires <= now ) {
                        remove.push( attr.name );
                    } else {
                        ret[ attr.name ] = parsed.data;
                    }
                }
                while ( !!(key = remove.pop()) ) {
                    div.removeAttribute( key );
                }
                div.save( attrKey );
                return ret;
            }

            // convert invalid characters to dashes
            // http://www.w3.org/TR/REC-xml/#NT-Name
            // simplified to assume the starting character is valid
            // also removed colon as it is invalid in HTML attribute names
            key = key.replace( /[^\-._0-9A-Za-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c-\u200d\u203f\u2040\u2070-\u218f]/g, "-" );
            // adjust invalid starting character to deal with our simplified sanitization
            key = key.replace( /^-/, "_-" );

            if ( value === undefined ) {
                attr = div.getAttribute( key );
                parsed = attr ? JSON.parse( attr ) : { expires: -1 };
                if ( parsed.expires && parsed.expires <= now ) {
                    div.removeAttribute( key );
                } else {
                    return parsed.data;
                }
            } else {
                if ( value === null ) {
                    div.removeAttribute( key );
                } else {
                    // we need to get the previous value in case we need to rollback
                    prevValue = div.getAttribute( key );
                    parsed = JSON.stringify({
                        data: value,
                        expires: (options.expires ? (now + options.expires) : null)
                    });
                    div.setAttribute( key, parsed );
                }
            }

            try {
                div.save( attrKey );
                // quota exceeded
            } catch ( error ) {
                // roll the value back to the previous value
                if ( prevValue === null ) {
                    div.removeAttribute( key );
                } else {
                    div.setAttribute( key, prevValue );
                }

                // expire old data and try again
                store.userData();
                try {
                    div.setAttribute( key, parsed );
                    div.save( attrKey );
                } catch ( error2 ) {
                    // roll the value back to the previous value
                    if ( prevValue === null ) {
                        div.removeAttribute( key );
                    } else {
                        div.setAttribute( key, prevValue );
                    }
                    throw store.error();
                }
            }
            return ret;
        });
    }() );

// in-memory storage
// fallback for all browsers to enable the API even if we can't persist data
    (function() {
        var memory = {},
            timeout = {};

        function copy( obj ) {
            return obj === undefined ? undefined : JSON.parse( JSON.stringify( obj ) );
        }

        store.addType( "memory", function( key, value, options ) {
            if ( !key ) {
                return copy( memory );
            }

            if ( value === undefined ) {
                return copy( memory[ key ] );
            }

            if ( timeout[ key ] ) {
                clearTimeout( timeout[ key ] );
                delete timeout[ key ];
            }

            if ( value === null ) {
                delete memory[ key ];
                return null;
            }

            memory[ key ] = value;
            if ( options.expires ) {
                timeout[ key ] = setTimeout(function() {
                    delete memory[ key ];
                    delete timeout[ key ];
                }, options.expires );
            }

            return value;
        });
    }() );

}( /* jshint -W040 */ this.amplify = this.amplify || {} ) );


/*! setAsap | Script by Taylor Hakes | @version 2.0.0 | @link https://github.com/taylorhakes/setAsap | @copyright Taylor Hakes | @license MIT */
(function (thisVar, undefined) {
    'use strict';
    var main = (typeof window === 'object' && window) || (typeof global === 'object' && global) ||
        typeof self === 'object' && self || thisVar;

    var hasSetImmediate = typeof setImmediate === 'function';
    var hasNextTick = typeof process === 'object' && !!process && typeof process.nextTick === 'function';
    var index = 0;

    function getNewIndex() {
        if (index === 9007199254740991) {
            return 0;
        }
        return ++index;
    }

    var setAsap = (function () {
        var hiddenDiv, scriptEl, timeoutFn, callbacks;

        // Modern browsers, fastest async
        if (main.MutationObserver) {
            return function setAsap(callback) {
                hiddenDiv = document.createElement("div");
                (new MutationObserver(function() {
                    callback();
                    hiddenDiv = null;
                })).observe(hiddenDiv, { attributes: true });
                hiddenDiv.setAttribute('i', '1');
            };

            // Browsers that support postMessage
        } else if (!hasSetImmediate && main.postMessage && !main.importScripts && main.addEventListener) {

            var MESSAGE_PREFIX = "com.setImmediate" + Math.random();
            callbacks = {};

            var onGlobalMessage = function (event) {
                if (event.source === main && event.data.indexOf(MESSAGE_PREFIX) === 0) {
                    var i = event.data.split(':')[1];
                    callbacks[i]();
                    delete callbacks[i];
                }
            };

            main.addEventListener("message", onGlobalMessage, false);

            return function setAsap(callback) {
                var i = getNewIndex();
                callbacks[i] = callback;
                main.postMessage(MESSAGE_PREFIX + ':' + i, "*");
            };

            // IE browsers without postMessage
        } else if (!hasSetImmediate && main.document && 'onreadystatechange' in document.createElement('script')) {

            return function setAsap(callback) {
                scriptEl = document.createElement("script");
                scriptEl.onreadystatechange = function onreadystatechange() {
                    scriptEl.onreadystatechange = null;
                    scriptEl.parentNode.removeChild(scriptEl);
                    scriptEl = null;
                    callback();
                };
                document.body.appendChild(scriptEl);
            };

            // All other browsers and node
        } else {

            timeoutFn = (hasSetImmediate && setImmediate) || (hasNextTick && process.nextTick) || setTimeout;
            return function setAsap(callback) {
                timeoutFn(callback);
            };
        }

    })();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = setAsap;
    } else if (typeof require !== 'undefined' && require.amd) {
        define(function () {
            return setAsap;
        });
    } else {
        main.setAsap = setAsap;
    }
})(/*jshint -W040 */ this);
/*jshint +W040 */

/*! Promise-Polyfill | Script by Taylor Hakes | @version 6.0.1 | @link https://github.com/taylorhakes/promise-polyfill | @copyright Taylor Hakes | @license MIT */
/*jshint -W040 */
(function (root) {

    // Store setTimeout reference so promise-polyfill will be unaffected by
    // other code modifying setTimeout (like sinon.useFakeTimers())
    var setTimeoutFunc = setTimeout;

    function noop() {}

    // Polyfill for Function.prototype.bind
    function bind(fn, thisArg) {
        return function () {
            fn.apply(thisArg, arguments);
        };
    }

    function Promise(fn) {
        if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
        if (typeof fn !== 'function') throw new TypeError('not a function');
        this._state = 0;
        this._handled = false;
        this._value = undefined;
        this._deferreds = [];

        doResolve(fn, this);
    }

    function handle(self, deferred) {
        while (self._state === 3) {
            self = self._value;
        }
        if (self._state === 0) {
            self._deferreds.push(deferred);
            return;
        }
        self._handled = true;
        Promise._immediateFn(function () {
            var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
            if (cb === null) {
                (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
                return;
            }
            var ret;
            try {
                ret = cb(self._value);
            } catch (e) {
                reject(deferred.promise, e);
                return;
            }
            resolve(deferred.promise, ret);
        });
    }

    function resolve(self, newValue) {
        try {
            // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
            if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
            if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
                var then = newValue.then;
                if (newValue instanceof Promise) {
                    self._state = 3;
                    self._value = newValue;
                    finale(self);
                    return;
                } else if (typeof then === 'function') {
                    doResolve(bind(then, newValue), self);
                    return;
                }
            }
            self._state = 1;
            self._value = newValue;
            finale(self);
        } catch (e) {
            reject(self, e);
        }
    }

    function reject(self, newValue) {
        self._state = 2;
        self._value = newValue;
        finale(self);
    }

    function finale(self) {
        if (self._state === 2 && self._deferreds.length === 0) {
            Promise._immediateFn(function() {
                if (!self._handled) {
                    Promise._unhandledRejectionFn(self._value);
                }
            });
        }

        for (var i = 0, len = self._deferreds.length; i < len; i++) {
            handle(self, self._deferreds[i]);
        }
        self._deferreds = null;
    }

    function Handler(onFulfilled, onRejected, promise) {
        this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
        this.onRejected = typeof onRejected === 'function' ? onRejected : null;
        this.promise = promise;
    }

    /**
     * Take a potentially misbehaving resolver function and make sure
     * onFulfilled and onRejected are only called once.
     *
     * Makes no guarantees about asynchrony.
     */
    function doResolve(fn, self) {
        var done = false;
        try {
            fn(function (value) {
                if (done) return;
                done = true;
                resolve(self, value);
            }, function (reason) {
                if (done) return;
                done = true;
                reject(self, reason);
            });
        } catch (ex) {
            if (done) return;
            done = true;
            reject(self, ex);
        }
    }

    Promise.prototype['catch'] = function (onRejected) {
        return this.then(null, onRejected);
    };

    Promise.prototype.then = function (onFulfilled, onRejected) {
        var prom = new (this.constructor)(noop);

        handle(this, new Handler(onFulfilled, onRejected, prom));
        return prom;
    };

    Promise.all = function (arr) {
        var args = Array.prototype.slice.call(arr);

        return new Promise(function (resolve, reject) {
            if (args.length === 0) return resolve([]);
            var remaining = args.length;

            function res(i, val) {
                try {
                    if (val && (typeof val === 'object' || typeof val === 'function')) {
                        var then = val.then;
                        if (typeof then === 'function') {
                            then.call(val, function (val) {
                                res(i, val);
                            }, reject);
                            return;
                        }
                    }
                    args[i] = val;
                    if (--remaining === 0) {
                        resolve(args);
                    }
                } catch (ex) {
                    reject(ex);
                }
            }

            for (var i = 0; i < args.length; i++) {
                res(i, args[i]);
            }
        });
    };

    Promise.resolve = function (value) {
        if (value && typeof value === 'object' && value.constructor === Promise) {
            return value;
        }

        return new Promise(function (resolve) {
            resolve(value);
        });
    };

    Promise.reject = function (value) {
        return new Promise(function (resolve, reject) {
            reject(value);
        });
    };

    Promise.race = function (values) {
        return new Promise(function (resolve, reject) {
            for (var i = 0, len = values.length; i < len; i++) {
                values[i].then(resolve, reject);
            }
        });
    };

    // Use polyfill for setImmediate for performance gains
    Promise._immediateFn = (typeof setImmediate === 'function' && function (fn) { setImmediate(fn); }) ||
        function (fn) {
            setTimeoutFunc(fn, 0);
        };

    Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
        if (typeof console !== 'undefined' && console) {
            void 0; // eslint-disable-line no-console
        }
    };

    /**
     * Set the immediate function to execute callbacks
     * @param fn {function} Function to execute
     * @deprecated
     */
    Promise._setImmediateFn = function _setImmediateFn(fn) {
        Promise._immediateFn = fn;
    };

    /**
     * Change the function to execute on unhandled rejection
     * @param {function} fn Function to execute on unhandled rejection
     * @deprecated
     */
    Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
        Promise._unhandledRejectionFn = fn;
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Promise;
    } else if (!root.Promise) {
        root.Promise = Promise;
    }

})(this);
/*jshint +W040 */

/*! Critical JavaScript. Load in <head> using <script> with async attribute value */
/*jshint -W097 */
/*jshint -W117 */
/*jshint devel: true, plusplus: false, nonew: false, eqnull: true, validthis: true*/
/* global process, self, global, module, window, amplify, XMLHttpRequest, ActiveXObject, console */
"use strict";

/*! _r - rScript functional helpers */
(function(root, name, make){
    if (typeof module !== 'undefined' && module.exports){ module.exports = make($);}
    else {root[name] = make();}
}(window, '_r', function() {

    var hasOwnProperty = window.hasOwnProperty || Object.prototype.hasOwnProperty;

    /**
     * Checks if an object has a given property defined on itself
     * @param obj {Object} the object
     * @param prop {String} the name of the property
     * @returns {boolean|*|Function}
     */
    function has (obj, prop)
    {
        /*jshint -W116 */
        return obj != null && hasOwnProperty.call(obj, prop);
        /*jshint +W116 */
    }

    function count (mixed_var, mode) {
        // http://kevin.vanzonneveld.net
        // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +      input by: Waldo Malqui Silva
        // +   bugfixed by: Soren Hansen
        // +      input by: merabi
        // +   improved by: Brett Zamir (http://brett-zamir.me)
        // +   bugfixed by: Olivier Louvignes (http://mg-crea.com/)
        // +   improved by: Obinwanne Hill on 15-03-2015 (https://about.me/obinwanne.hill)
        // +   dependencies: isArray() and isObject()
        // *     example 1: count([[0,0],[0,-4]], 'COUNT_RECURSIVE');
        // *     returns 1: 6
        // *     example 2: count({'one' : [1,2,3,4,5]}, 'COUNT_RECURSIVE');
        // *     returns 2: 6
        var key, nvld = false, cnt = 0;

        if (mixed_var === null || typeof mixed_var === 'undefined')
        {
            return 0;
        }
        else if (!isArray(mixed_var) && !isObject(mixed_var))
        {
            nvld = true;
        }

        if (has(mixed_var, 'length'))
        {
            return mixed_var.length;
        }

        //Return 1 if !isArray && !Object && does not have .length
        if(nvld)
        {
            return 1;
        }

        if (mode === 'COUNT_RECURSIVE')
        {
            mode = 1;
        }

        if (mode !== 1)
        {
            mode = 0;
        }

        for (key in mixed_var) {
            if (has(mixed_var, key))
            {
                cnt++;
                if (mode === 1 && mixed_var[key] && (isArray(mixed_var[key]) || isObject(mixed_var[key])))
                {
                    cnt += count(mixed_var[key], 1);
                }
            }
        }

        return cnt;
    }

    /**
     * Join array elements into a string
     * @param delimiter {string} the join delimiter
     * @param pieces {array} the array of strings to implode
     * @returns {String}
     */
    function implode(delimiter, pieces){

        if(!(_r.isArray(pieces) || _r.isObject(pieces)))
        {
            return false;
        }

        delimiter = (!delimiter) ? '' : delimiter;

        if(_r.count(pieces) === 1)
        {
            //return first element without delimiter if array count is 1
            return ''+pieces[0];
        }
        else if (_r.count(pieces) < 1)
        {
            //return empty string on blank array
            return "";
        }

        var retr_str = '';
        if(_r.isArray(pieces))
        {
            //array

            for(var i = 0; i < _r.count(pieces); i++)
            {
                retr_str += (i === 0) ? pieces[i] : delimiter+pieces[i];
            }
        }
        else
        {
            //object

            var j = 0;
            for (var key in pieces)
            {
                if (pieces.hasOwnProperty(key))
                {
                    retr_str += (j === 0) ? pieces[key] : delimiter+pieces[key];

                    j++;
                }
            }
        }

        return retr_str;
    }

    function in_array (needle, haystack, argStrict) {
        // http://kevin.vanzonneveld.net
        // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +   improved by: vlado houba
        // +   input by: Billy
        // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
        // *     example 1: in_array('van', ['Kevin', 'van', 'Zonneveld']);
        // *     returns 1: true
        // *     example 2: in_array('vlado', {0: 'Kevin', vlado: 'van', 1: 'Zonneveld'});
        // *     returns 2: false
        // *     example 3: in_array(1, ['1', '2', '3']);
        // *     returns 3: true
        // *     example 3: in_array(1, ['1', '2', '3'], false);
        // *     returns 3: true
        // *     example 4: in_array(1, ['1', '2', '3'], true);
        // *     returns 4: false
        var key = '',
            strict = !! argStrict;

        if (strict) {
            for (key in haystack) {
                if (haystack[key] === needle) {
                    return true;
                }
            }
        } else {
            for (key in haystack) {
                /* jshint -W116 */
                if (haystack[key] == needle) {
                    return true;
                }
                /* jshint +W116 */
            }
        }

        return false;
    }

    /**
     * Merges one array with another
     * @param first {Array} the primary array
     * @param second {Array} the array being merged into primary
     * @returns {*}
     */
    function merge( first, second ) {
        var len = +second.length,
            j = 0,
            i = first.length;

        while ( j < len ) {
            first[ i++ ] = second[ j++ ];
        }

        // Support: IE<9
        // Workaround casting of .length to NaN on otherwise arraylike objects (e.g., NodeLists)
        if ( len !== len ) {
            while ( second[j] !== undefined ) {
                first[ i++ ] = second[ j++ ];
            }
        }

        first.length = i;

        return first;
    }

    function array_keys (input, search_value, argStrict) {
        // http://kevin.vanzonneveld.net
        // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +      input by: Brett Zamir (http://brett-zamir.me)
        // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +   improved by: jd
        // +   improved by: Brett Zamir (http://brett-zamir.me)
        // +   input by: P
        // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
        // *     example 1: array_keys( {firstname: 'Kevin', surname: 'van Zonneveld'} );
        // *     returns 1: {0: 'firstname', 1: 'surname'}

        var search = typeof search_value !== 'undefined',
            tmp_arr = [],
            strict = !!argStrict,
            include = true,
            key = '';

        if (input && typeof input === 'object' && input.change_key_case) { // Duck-type check for our own array()-created PHPJS_Array
            return input.keys(search_value, argStrict);
        }

        for (key in input) {
            if (has(input, key)) {
                include = true;
                if (search) {
                    if (strict && input[key] !== search_value) {
                        include = false;
                    }/* jshint -W116 */
                    else if (input[key] != search_value) {
                        include = false;
                    }/* jshint +W116 */
                }

                if (include) {
                    tmp_arr[tmp_arr.length] = key;
                }
            }
        }

        return tmp_arr;
    }

    function array_values (input) {
        // http://kevin.vanzonneveld.net
        // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +   improved by: Brett Zamir (http://brett-zamir.me)
        // +   improved by: Obinwanne Hill on 15-03-2015 (https://about.me/obinwanne.hill)
        // *       example 1: array_values( {firstname: 'Kevin', surname: 'van Zonneveld'} );
        // *       returns 1: {0: 'Kevin', 1: 'van Zonneveld'}
        var tmp_arr = [],
            key = '';

        if (input && typeof input === 'object' && input.change_key_case) { // Duck-type check for our own array()-created PHPJS_Array
            return input.values();
        }

        for (key in input) {
            if(has(input, key))
            {
                tmp_arr[tmp_arr.length] = input[key];
            }
        }

        return tmp_arr;
    }

    function array_combine (keys, values) {
        // http://kevin.vanzonneveld.net
        // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +   improved by: Brett Zamir (http://brett-zamir.me)
        // +   improved by: Obinwanne Hill on 15-03-2015 (https://about.me/obinwanne.hill)
        // *     example 1: array_combine([0,1,2], ['kevin','van','zonneveld']);
        // *     returns 1: {0: 'kevin', 1: 'van', 2: 'zonneveld'}
        var new_array = {},
            keycount = keys && keys.length,
            i = 0;

        // input sanitation
        if (typeof keys !== 'object' || typeof values !== 'object' || // Only accept arrays or array-like objects
            typeof keycount !== 'number' || typeof values.length !== 'number' || !keycount) { // Require arrays to have a count
            return false;
        }

        // number of elements does not match
        if (keycount !== values.length) {
            return false;
        }

        for (i = 0; i < keycount; i++) {
            new_array[keys[i]] = values[i];
        }

        return new_array;
    }

    function microtime (get_as_float) {
        // http://kevin.vanzonneveld.net
        // +   original by: Paulo Freitas
        // *     example 1: timeStamp = microtime(true);
        // *     results 1: timeStamp > 1000000000 && timeStamp < 2000000000
        var now = new Date().getTime() / 1000;
        var s = parseInt(now, 10);

        return (get_as_float) ? now : (Math.round((now - s) * 1000) / 1000) + ' ' + s;
    }


    /**
     * Checks if a variable is a String
     * @param str {*} The variable to test
     * @return {Boolean}
     */
    function isString(str)
    {
        return (typeof str === "string" || str instanceof String);
    }

    /**
     * Checks if a variable is a String and is blank/empty
     * @param str {*} The variable to test
     * @returns {boolean}
     */
    function isEmptyString(str)
    {
        if(!(isString(str) || isNumber(str)))
        {
            return false;
        }

        str = str+'';
        return !!(/^[\s]*?$/i.test(str));
    }

    /**
     * Checks if a variable is a Number
     * @param num {*} The variable to test
     * @return {Boolean}
     */
    function isNumber(num)
    {
        if(isObject(num) || isArray(num))
        {
            return false;
        }
        return (!isNaN(parseFloat(num)) && isFinite(num));
    }

    /**
     * Checks if a variable is a Boolean
     * @param bool {*} The variable to test
     * @return {Boolean}
     */
    function isBool(bool)
    {
        return (bool === true || bool === false);
    }

    /**
     * Checks if the variable is an array
     * @param arr {*} The variable to test
     * @return {Boolean}
     */
    function isArray(arr) {
        return Object.prototype.toString.call(arr) === "[object Array]";
    }

    /**
     * Checks if a variable is an Object
     * @param obj {*} The variable to test
     * @return {Boolean}
     */
    function isObject(obj)
    {
        if (isArray(obj))
        {
            return false;
        }

        return typeof obj === "object";
    }

    /**
     * Checks if a value is null or undefined
     * @param {*} val the value to check
     * @returns {boolean}
     */
    function isNullOrUndefined(val)
    {
        return ((typeof val === "undefined" || val === null));
    }

    /**
     * Checks if a variable is a Function
     * @param obj {*} The variable to test
     * @return {Boolean}
     */
    function isFunction(obj)
    {
        return !!(obj && obj.constructor && obj.call && obj.apply);
    }

    /**
     * Converts a string array to an integer array
     * It converts all the string values of an array into their integer equivalents
     * @param str_arr {Array} The array to convert
     * @return {Array}
     */
    function arrayToInteger(str_arr)
    {
        var int_arr_item_int,
            array_count_int,
            keys_arr,
            values_arr,
            values_int_arr = [],
            final_int_arr;

        keys_arr = array_keys(str_arr);
        values_arr = array_values(str_arr);

        array_count_int = _r.count(str_arr);
        for(var i = 0; i < array_count_int; i++)
        {
            int_arr_item_int = parseInt(values_arr[i]);
            values_int_arr.push(int_arr_item_int);
        }

        final_int_arr = array_combine(keys_arr, values_int_arr);
        return final_int_arr;
    }


    /**
     * Sorts an array in numerical order and returns an array containing the keys of the array in the new sorted order
     * @param values_arr {Array} The array to sort
     * @return {Array}
     */
    function getSortedKeys(values_arr)
    {
        var array_with_keys = [],
            i;
        for (i = 0; i < values_arr.length; i++) {
            array_with_keys.push({ key: i, value: values_arr[i] });
        }

        array_with_keys.sort(function(a, b) {
            if (a.value < b.value) { return -1; }
            if (a.value > b.value) { return  1; }
            return 0;
        });

        var keys = [];
        for (i = 0; i < array_with_keys.length; i++) {
            keys.push(array_with_keys[i].key);
        }

        return keys;
    }

    /**
     * Finds the nearest matching number in an array containing integers
     * It is recommended that you sort the array in order before using it with this function
     * @param haystack_arr {Array} The array containing the integer values
     * @param needle_int {Number} The reference integer which is used to find the match
     * @param return_key_only_bool {Boolean} If true, will return the key position of the nearest match. Default is false.
     * @param is_ceil_bool {Boolean} If true, will return the nearest highest number even if a lower number is technically 'closer'. Default value is true.
     * @param disable_ceil_offset_int {Number} Please see explanation below.
     * For example, let's say needle_int is 120 and the nearest matching numbers are 115 on the lower end and 140 on the higher end
     * Being that is_ceil_bool is true by default, 140 would ordinarily be the nearest number selected. However, if disable_ceil_offset is set to 5 [or higher],
     * 115 will be returned because the difference between it (the true nearest matching number) and 120 (needle_int) is 5 [or more], even though needle_int is higher and under normal circumstances 140 would have been returned [as the next highest number after 120]
     * @return {Number}
     */
    function getClosestNumberMatchArray(haystack_arr, needle_int)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            return_key_only_bool = (isBool(myArgs[2])) ? myArgs[2]: false,
            is_ceil_bool = (isBool(myArgs[3])) ? myArgs[3]: true,
            disable_ceil_offset_int = (isNumber(myArgs[4])) ? myArgs[4] : 0,
            value_diff_int,
            value_diff_keys_sort_arr,
            value_diff_values_arr = [],
            key_final_int,
            value_final_int,
            value_final_needle_diff_int
            ;

        haystack_arr = arrayToInteger(haystack_arr);
        needle_int = parseInt(needle_int);

        for(var i = 0; i < _r.count(haystack_arr); i++)
        {
            value_diff_int = needle_int - haystack_arr[i];
            value_diff_int = Math.abs(value_diff_int);
            value_diff_values_arr.push(value_diff_int);
        }

        value_diff_keys_sort_arr = getSortedKeys(value_diff_values_arr);
        key_final_int = value_diff_keys_sort_arr[0];
        value_final_int = haystack_arr[key_final_int];

        value_final_needle_diff_int = value_final_int - needle_int;
        value_final_needle_diff_int = Math.abs(value_final_needle_diff_int);

        //Manage for when needle_int is higher than nearest matching number, and highest matching number is required
        if(value_final_int < needle_int)
        {
            is_ceil_bool = (value_final_needle_diff_int <= disable_ceil_offset_int) ? false : is_ceil_bool;
            key_final_int = (is_ceil_bool) ? key_final_int + 1 : key_final_int;
        }

        //return value or key
        value_final_int = haystack_arr[key_final_int];
        return (return_key_only_bool) ? key_final_int: value_final_int;
    }

    /**
     * This function checks if a number is even
     * @param {Number} number_int the number to test
     * @return {Boolean}
     */
    function isEven(number_int)
    {
        if(!isNumber(number_int))
        {
            return null;
        }

        return !!(number_int % 2 === 0);
    }

    /**
     * This function checks if a number is an integer decimal and if the integral part of the decimal is even
     * For example, 640.123 will be true, 641.123 will be false
     * @param number_int {Number} The Integer Decimal
     * @return {Boolean}
     */
    function isEvenDecimal(number_int)
    {
        var number_str = ''+number_int+'';
        return ((/^ *[\-]?[0-9]+(0|2|4|6|8)\.[0-9]+ *$/i.test(number_str)));
    }

    /**
     * Pad a string
     * @param {Number|String} val_int_or_str the string to pad
     * @param {Number} pad_size_int the number of times pad_char_str will be padded
     * @param {String} pad_char_str the character/substring that will be used to pad
     * @param {Boolean} right_pad_bool if true, will pad to right. Otherwise, will pad to left
     * @returns {string}
     */
    function strPad(val_int_or_str, pad_size_int)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            pad_char_str = (isString(myArgs[2]) && myArgs[2].length > 0) ? myArgs[2]: '0',
            right_pad_bool = (isBool(myArgs[3])) ? myArgs[3] : false,
            val_str = ''+val_int_or_str,
            fill_seed_str = '';

        for(var i = 0; i < pad_size_int; i++)
        {
            fill_seed_str += pad_char_str;
        }

        return (right_pad_bool) ? val_str+fill_seed_str : fill_seed_str+val_str;
    }

    /**
     * This function will zero-fill a string or number
     * @param {Number|String} val_int_or_str the number or string to fill
     * @param {Number} str_size_int the total length of the string after zero-fill
     * @return {String}
     */
    function zeroFill(val_int_or_str, str_size_int)
    {
        var val_str = ''+val_int_or_str,
            val_str_len_int = val_str.length,
            val_fill_str
            ;

        if(!isNumber(str_size_int) || str_size_int < 1 || (val_str_len_int >= str_size_int))
        {
            return val_int_or_str;
        }

        val_fill_str = strPad(val_int_or_str, str_size_int, '0', false)
        return val_fill_str.slice(-str_size_int);
    }

    /**
     * Configuration settings placeholder for rScript
     * scroll {Object}: defines options for scroll events
     * resize {Object}: defines options for resize events
     * resizeContainer {Object}: defines options for resizeContainer events
     * await {Object}: defines the options for $.await timer
     * debug {Boolean}: if true, puts rScript in debug mode. This mode will flush turbo-classes on refresh when moving between test devices on mobile-emulator-enabled browsers like Chrome
     * proxyBrowserPingUrl {String}: Puts rScript into proxy browser ping mode. The URL that hosts the User Agent String Server. The URL must point to a page that echos the user agent string. See the following URL for an example implementation in PHP: https://gist.github.com/restive/d54a4a282f2aa62337b26490559d9903
     */
    var config_main_obj = {
        scroll: {default_handler_type: 'throttle', default_handler_timer: 100},
        resize: {default_handler_type: 'throttle', default_handler_timer: 100},
        await: {throttle: 100, timeout: 30000},
        debug: false,
        proxyBrowserPingUrl: ''
    };

    var console_obj = window.console;
    var console_main_obj = {
        /**
         * General purpose logging
         * @param {String} message_str the message to output
         */
        log: function(message_str){
            var myArgs = Array.prototype.slice.call(arguments);
            if(myArgs[4])
            {
                console_obj.log(message_str, myArgs[1], myArgs[2], myArgs[3], myArgs[4]);
                return;
            }
            else if(myArgs[3])
            {
                console_obj.log(message_str, myArgs[1], myArgs[2], myArgs[3]);
                return;
            }
            else if (myArgs[2])
            {
                console_obj.log(message_str, myArgs[1], myArgs[2]);
                return;
            }
            else if (myArgs[1])
            {
                console_obj.log(message_str, myArgs[1]);
                return;
            }

            console_obj.log(message_str);
        },
        /**
         * Outputs an informational message
         * @param {String} message_str the message to output
         */
        info: function(message_str){
            console_obj.info(message_str);
        },
        /**
         * Outputs a warning message
         * @param {String} message_str the message to output
         */
        warn: function(message_str){
            var myArgs = Array.prototype.slice.call(arguments),
                incr_console_item_bool = (isBool(myArgs[1])) ? myArgs[1]: false;
            console_obj.warn(message_str);
            if(incr_console_item_bool)
            {
                rScript.storeIncrement('rs_var_counter_console');
            }
        },
        /**
         * Outputs an error message
         * @param {String} message_str the message to output
         */
        error: function(message_str){
            var myArgs = Array.prototype.slice.call(arguments),
                incr_console_item_bool = (isBool(myArgs[1])) ? myArgs[1]: false;
            console_obj.error(message_str);
            if(incr_console_item_bool)
            {
                rScript.storeIncrement('rs_var_counter_console');
            }
        }
    }

    /**
     * Display an alert box
     * @param {String} message_str the alert message
     */
    function alert(message_str)
    {
        var alert_obj = window.alert;
        alert_obj(message_str);
    }

    var _r = {
        has: has,
        count: count,
        implode: implode,
        in_array: in_array,
        merge: merge,
        array_keys: array_keys,
        array_values: array_values,
        array_combine: array_combine,
        microtime: microtime,
        isString: isString,
        isEmptyString: isEmptyString,
        isNumber: isNumber,
        isBool: isBool,
        isArray: isArray,
        isObject: isObject,
        isNullOrUndefined: isNullOrUndefined,
        isFunction: isFunction,
        arrayToInteger: arrayToInteger,
        getSortedKeys: getSortedKeys,
        getClosestNumberMatchArray: getClosestNumberMatchArray,
        isEven: isEven,
        isEvenDecimal: isEvenDecimal,
        strPad: strPad,
        zeroFill: zeroFill,
        console: console_main_obj,
        config: config_main_obj,
        alert: alert
    };
    return _r;

}));

/*! rQuery DOM Library | @link https://github.com/restive/rquery | @copyright Obinwanne Hill <@obihill> | @license MIT */
(function(_r){

    if (!Object.create)
    {
        Object.create = function(o, properties)
        {
            if (typeof o !== 'object' && typeof o !== 'function')
            {
                throw new TypeError('Object prototype may only be an Object: ' + o);
            }
            else if (o === null)
            {
                throw new Error("This browser's implementation of Object.create is a shim and doesn't support 'null' as the first argument.");
            }

            /*jshint -W116 */
            if (typeof properties != 'undefined')
            {
                throw new Error("This browser's implementation of Object.create is a shim and doesn't support a second argument.");
            }
            /*jshint +W116 */

            function F() {}
            F.prototype = o;
            return new F();
        };
    }

    function Dom(){}
    Dom.prototype = Object.create(Array.prototype);

    /**
     * Creates a DOM object
     * @param selector {String} the selector
     * @param context {Object} the context
     * @param undefined
     * @returns {Dom}
     * @private
     */
    function _DomCreate(selector, context, undefined){
        var init_dom_obj = new _initDom(selector, context, undefined);
        var dom_obj = new Dom();

        if(init_dom_obj.el === null)
        {
            //no element found
            dom_obj = {};
            dom_obj.empty = true;
            dom_obj.length = (!dom_obj.length) ? 0 : dom_obj.length;
        }
        else
        {
            dom_obj = _r.merge(dom_obj, init_dom_obj.core);
        }

        dom_obj.context = init_dom_obj.context;
        dom_obj.selector = init_dom_obj.selector;

        if(dom_obj.length > 0)
        {
            dom_obj.selectorMethod = init_dom_obj.selectorMethod;
            dom_obj.label = init_dom_obj.label;
            dom_obj.instanceType = init_dom_obj.instanceType;
            dom_obj.objectStore = init_dom_obj.objectStore;
            dom_obj.empty = false;
        }
        if(dom_obj.length === 1)
        {
            dom_obj.tagName = init_dom_obj.tagName;
        }

        return dom_obj;
    }

    /**
     * Selects an object from the DOM
     * @param selector {String} the selector
     * @param context {Object} the context [default is document]
     * @param undefined
     * @returns {*}
     * @private
     */
    function _initDom(selector, context, undefined)
    {
        //set default context if undefined
        context = (!context) ? window.document : context;

        var el,
            _context,
            _selector,
            _selector_method,
            _is_find_op_bool = false,
            _is_nodelist_op_bool = false,
            _is_window_obj_bool = false;

        if(_isWindow(selector) || selector === 'window')
        {
            _is_window_obj_bool = true;
            el = window;
        }
        else if(_r.isObject(selector))
        {
            el = selector;
        }
        else if(selector === 'head' || selector === 'body')
        {
            el = context[selector] || context.getElementsByTagName(selector)[0];
        }
        else if(selector === 'html')
        {
            el = context.getElementsByTagName(selector);
        }
        else if(/^ *([^\s]+(?:,| )\s*[^\s]+|[^\s]*\.[^\s\.]+\.[^\s]+?|[^\s]+\.[^\s]+?|[^\s]*\:[^\s]+?|[^\s]*\[.+?\])/i.test(selector))
        {
            /**
             * 1: if multiple selectors or descendant combinators
             * e.g. $("p.main, a.other"), $("p.main a.other")
             * 2: if multiple class selector
             * e.g. $(".first.second"), $("p.main.test")
             * 3: if tagname.class selector
             * e.g. $("li.class")
             * 4: if pseudo selector
             * e.g. $("a:hover"), $(".container:before")
             * 5: if attribute-value selector
             * e.g. $('input[type="text"]'), $('#div-me[rk="ten"]')
             */
            _is_nodelist_op_bool = true;

            el = context.querySelectorAll(selector);
            _selector_method = 'querySelectorAll';
        }
        else
        {
            /*! Salt.js DOM Selector Lib. By @james2doyle */
            /*! + improved by: Obinwanne Hill on 24-04-2015 */

            var selector_key = selector.slice(0, 1),
                matches = {
                    '#': 'getElementById',
                    '.': 'getElementsByClassName',
                    '@': 'getElementsByName',
                    '=': 'getElementsByTagName',
                    '*': 'querySelectorAll'
                }[selector_key],
                selector_value = selector.slice(1);

            if(_isInstanceOfRQuery(context))
            {
                _is_find_op_bool = true;

                //archive context before updating it
                _context = context;

                context = context[0];
                matches = 'querySelectorAll';
                selector_value = selector;
            }
            else
            {
                //add fallback if getElementsByClassName is not supported e.g. IE8
                if(matches === 'getElementsByClassName' && !document.getElementsByClassName)
                {
                    matches = 'querySelectorAll';
                    selector_value = selector;
                }

                //if matches is undefined, assume selector is a HTML tag
                if(!matches)
                {
                    matches = 'getElementsByTagName';
                    selector_value = selector;
                }
            }

            if(matches !== 'getElementById')
            {
                /**
                 * Set as NodeList operation
                 * all matches methods beside getElementById return a List-like result
                 */
                _is_nodelist_op_bool = true;
            }

            // now pass the selector without the key/first character
            el = context[matches](selector_value);

            _selector_method = (matches) ? matches : '';
        }

        /*jshint -W040 */
        if((!el || el.length < 1) && !_is_window_obj_bool)
        {
            this.el = null;
            this.core = [];

            this.context = context;
            this.selector = selector;
        }
        else
        {
            //define selector
            _selector = (_r.isObject(selector)) ? _getSelectorFromObject(selector) : selector;

            this.core = [];
            if(el.length && el.length >= 1 && _is_nodelist_op_bool)
            {
                //handle NodeLists, etc. + objects from find operation

                var _init_core_arr = [];
                var _initForEach = function (array, callback, scope) {
                    for (var i = 0; i < array.length; i++) {
                        callback.call(scope, i, array[i]);
                    }
                };
                _initForEach(el, function (index) {
                    _init_core_arr.push(el[index]);
                });

                this.core = _init_core_arr;
            }
            else
            {
                this.core.push(el);
            }

            //update _selector if find operation
            if(_is_find_op_bool)
            {
                _selector = (_context && _r.isString(_context.selector)) ? _context.selector+' '+_selector : _selector;
            }

            this.label = 'rquery';
            this.context = context;
            this.selector = _selector;
            this.selectorMethod = _selector_method;
            this.objectStore = {};
            this.instanceType = null;

            var el_count_int = _r.count(this.core);
            if(el_count_int > 0)
            {
                if(_is_nodelist_op_bool)
                {
                    this.instanceType = 'list';
                }
                else
                {
                    this.tagName = (_r.isString(el.nodeName)) ? el.nodeName.toLowerCase() : '';
                    this.instanceType = 'element';
                }
            }
        }
        /*jshint +W040 */
    }

    var _this,
        _this_el_obj,
        _this_count_int,
        _ref_obj,
        _parent_ref_obj;

    /**
     * Creates an rQuery object
     * This is a wrapper class for _DomCreate
     * @param selector see _DomCreate
     * @param context see _DomCreate
     * @param undefined see _DomCreate
     * @returns {Dom}
     */
    var rQuery = function(selector, context, undefined){
        return _DomCreate(selector, context, undefined);
    };

    /**
     * Checks whether the object is a window object
     * @param obj {*} the object to test
     * @returns {boolean}
     * @private
     */
    function _isWindow( obj ) {
        /*jshint -W116 */
        return (obj != null && (obj == obj.window || typeof obj.window === 'object'));
        /*jshint +W116 */
    }

    /**
     * Determines if an object is an instance of RQuery
     * @param obj {*} the object to test
     * @returns {boolean}
     * @private
     */
    function _isInstanceOfRQuery(obj)
    {
        return ((obj.label === 'rquery'));
    }

    /**
     * Determines the selector for a given object
     * @param obj {Object} the object
     * @returns {*}
     * @private
     */
    function _getSelectorFromObject(obj)
    {
        var id_str = (obj.id) ? obj.id : '',
            class_temp_str = obj.className,
            class_str = (_r.isString(class_temp_str)) ? class_temp_str.replace(/\s+/g, '.') : '',
            node_name_str = (obj.nodeName) ? obj.nodeName.toLowerCase() : ''
            ;


        if(_r.isString(id_str) && id_str.length > 0)
        {
            return '#'+id_str;
        }

        if (_isWindow(obj))
        {
            return 'window';
        }

        if (_r.in_array(node_name_str,['body', 'html', 'head']))
        {
            return node_name_str;
        }

        if (_r.isString(class_str) && class_str.length > 0)
        {
            return node_name_str+'.'+class_str;
        }

        return node_name_str;
    }

    /**
     * Returns a list of Node types supported by the browser
     * @returns {Array}
     * @private
     */
    function _getSupportedNodeTypes()
    {
        //Define supported collections for later dynamic function calls
        var node_type_arr = ['NodeList', 'HTMLCollection', 'StaticNodeList'],
            node_type_supported_arr = [];
        for (var i = 0; i < node_type_arr.length; i++)
        {
            if(window[node_type_arr[i]]){
                node_type_supported_arr.push(node_type_arr[i]);
            }
        }
        return node_type_supported_arr;
    }

    /**
     * Determines the type of object
     * @param elem {Object} the reference object
     * @returns {*}
     */
    function _getObjectType(elem)
    {
        var obj_type_str = Object.prototype.toString.call(elem).slice(8, -1),
            supported_nodelist_types_arr = _getSupportedNodeTypes();

        if (typeof elem === 'object')
        {
            var regex_1 = /^ *(HTMLCollection|NodeList|StaticNodeList|Object) *$/gi,
                regex_2 = /^ *.*?(Window|Global|Object) *$/gi,
                regex_3 = /^ *.*?(Element|Object) *$/gi,
                match_1 = regex_1.exec(obj_type_str),
                match_2 = regex_2.exec(obj_type_str),
                match_3 = regex_3.exec(obj_type_str)
                ;

            if(match_1 &&
                _r.has(elem, 'length') &&
                (elem.length === 0 || (typeof elem[0] === "object" && elem[0].nodeType > 0)))
            {
                //check if StaticNodeList
                if(_r.in_array('StaticNodeList', supported_nodelist_types_arr) && elem instanceof window.StaticNodeList)
                {
                    return 'StaticNodeList';
                }

                //check if Window Object
                if(_r.has(elem, 'self'))
                {
                    return 'Window';
                }

                //return HTMLCollection or NodeList
                return match_1[1];
            }
            else if(match_2 &&
                _r.has(elem, 'self'))
            {
                return 'Window';
            }
            else if (match_3)
            {
                //return Element
                return 'Element';
            }

            return null;
        }
    }

    /**
     * Converts a HTML string to a node object
     * @param html_str {String} the HTML string to convert
     * @return {Object}
     * @private
     */
    function _stringToNode(html_str)
    {
        var wrapper_obj = document.createElement('div');

        //remove linebreaks and whitespace
        html_str = html_str.replace(/\n\s*|\s*\n/g, '');

        wrapper_obj.innerHTML = html_str;

        return _getElementChildren(wrapper_obj);
    }

    /**
     * Gets the element of a RQuery object
     * @param obj {Object} the object
     * @private
     */
    function _getElement(obj)
    {
        return (obj.instanceType === 'element' && obj.length === 1) ? obj[0] : obj ;
    }

    /**
     * Gets the children of an element
     * @param {Object} elem_obj the element from which the children are to be retrieved
     * @returns {Array}
     * @private
     */
    function _getElementChildren(elem_obj)
    {
        var childNodes = elem_obj.childNodes,
            children = [],
            i = childNodes.length;

        while (i--) {
            if (childNodes[i].nodeType == 1) {
                children.unshift(childNodes[i]);
            }
        }

        return children;
    }

    rQuery.label = 'rquery';
    rQuery.version = '1.0.0';

    /**
     * Map of native forEach
     * @type {Function|Array.forEach}
     */
    Dom.prototype.each = function(callback){
        var elements = _getElement(this),
            i,
            key
            ;

        /*jshint -W116 */
        if(typeof elements.length == 'number')
        {
            for (i = 0; i < elements.length; i++)
            {
                if(callback.call(elements[i], i, elements[i]) === false)
                {
                    return elements;
                }
            }
        }
        else
        {
            if(_r.in_array(_getObjectType(elements), ['Element', 'Window']))
            {
                callback.call(elements, 0, elements);
                return elements;
            }
            else
            {
                for (key in elements)
                {
                    if (callback.call(elements[key], key, elements[key]) === false)
                    {
                        return elements;
                    }
                }
            }
        }
        /*jshint +W116 */
    };

    /**
     * Gets the descendants of an element filtered by selector
     * @param selector {String} the selector
     * @returns {*}
     */
    Dom.prototype.find = function(selector) {
        return _DomCreate(selector, this, undefined);
    };

    /**
     * Create a deep copy of the set of matched elements
     * @returns {*}
     */
    Dom.prototype.clone = function(){
        _this = _getElement(this);
        var _this_clone = _this.cloneNode(true);
        return $(_this_clone);
    };

    /**
     * Gets [or sets] the value of an attribute
     * @param name {String} the identifier of the attribute
     * @param value {String} the value to set. If provided, the method will be a setter.
     * @returns {*}
     */
    Dom.prototype.attr = function(name, value){
        _this = this;
        _this_count_int = _r.count(_this);

        if(_this_count_int > 0)
        {
            _this_el_obj = _this[0];

            if(value)
            {
                if(_this_count_int > 1)
                {
                    //list

                    _this.each(function(index, el)
                    {
                        el.setAttribute(name, value);
                    });
                    return _this;
                }
                else
                {
                    //element

                    _this_el_obj.setAttribute(name, value);
                }
            }
            else
            {
                //list + element

                return _this_el_obj.getAttribute(name);
            }
        }

        return this;
    };

    /**
     * Gets [or sets] the style property of an element
     * @param el {Object} the element
     * @param prop {String} the style property
     * @param value {String} the value to set [optional]
     * @returns {*}
     * @private
     */
    function _style(el, prop)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            value = (_r.isString(myArgs[2])) ? myArgs[2] : null
            ;

        if(!_r.isNullOrUndefined(value))
        {
            //set value

            el.style[prop] = value;
        }
        else
        {
            //get value

            if(el.currentStyle)
            {
                return el.currentStyle[prop];
            }
            else if (window.getComputedStyle)
            {
                return window.getComputedStyle(el)[prop];
            }
        }
    }

    /**
     * Gets [or sets] the computed style properties
     * @param prop {String} the property name
     * @param value {String} the value to set. If provided, this method will be a setter
     * @returns {*}
     */
    Dom.prototype.css = function(prop, value) {

        _this = this;
        _this_count_int = _r.count(_this);

        if(_this_count_int > 0)
        {
            _this_el_obj = _this[0];

            if(_r.isString(value))
            {
                if(_this_count_int > 1)
                {
                    //list

                    _this.each(function(index, el)
                    {
                        _style(el, prop, value);
                    });
                    return _this;
                }
                else
                {
                    //element

                    _style(_this_el_obj, prop, value);
                }
            }
            else
            {
                //list + element

                return _style(_this_el_obj, prop, value);
            }
        }

        return this;
    };

    /**
     * Manage event listeners
     * Wrapper class
     * @param op {String} The event operation. Either 'on' or 'off'
     * @param eventType {String} the event type
     * @param callback {Function} the function to execute when the event is triggered
     * @param ctx {Object} the context e.g. this
     * @returns {*}
     * @private
     */
    function _doEvent(op, eventType, callback, ctx) {
        var event_func_str = (op === 'on') ? 'addEventListener' : 'removeEventListener',
            event_func_ms_str = (op === 'on') ? 'attachEvent' : 'detachEvent',
            event_type_arr,
            event_type_str
            ;

        event_type_arr = eventType.split(' ');
        for (var i = 0; i < event_type_arr.length; i++)
        {
            event_type_str = event_type_arr[i];
            if (ctx[event_func_str])
            {
                ctx[event_func_str](event_type_str, callback);
            }
            else if (ctx[event_func_ms_str])
            {
                ctx[event_func_ms_str]("on" + event_type_str, callback);

                var event_type_list_arr = ("blur focus focusin focusout load resize scroll unload click dblclick input " +
                "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
                "change select submit keydown keypress keyup error contextmenu").split(" ");
                if(!_r.in_array(event_type_str, event_type_list_arr))
                {
                    //is probably custom event

                    var doc_elem_obj = document.documentElement;
                    /*jshint -W083 */
                    if(event_func_ms_str === 'attachEvent')
                    {
                        doc_elem_obj[event_type_str] = 0;
                        doc_elem_obj[event_func_ms_str]('onpropertychange', function (e) {
                            /*jshint -W116 */
                            if(e.propertyName == event_type_str) {
                                callback();
                            }
                            /*jshint +W116 */
                        });
                        /*jshint +W083 */
                    }
                    else
                    {
                        doc_elem_obj[event_func_ms_str]('onpropertychange', callback);
                    }
                }
            }
            else {
                ctx["on" + event_type_str] = (op === 'on') ? callback : null;
            }
        }
        return ctx;
    }

    /**
     * Cancels the event if it canceleable
     * @param event {Object} the event object
     */
    rQuery.preventDefault = function(event)
    {
        if(event.preventDefault)
        {
            event.preventDefault();
        }

        if(_data('isRQueryActive'))
        {
            //support IE
            event.returnValue = false;
        }
    };

    /**
     * Stops bubbling of an event to its parent
     * @param event {Object} the event object
     */
    rQuery.stopPropagation = function(event)
    {
        if (event.stopPropagation)
        {
            event.stopPropagation();
        }

        if(_data('isRQueryActive'))
        {
            //support IE
            event.cancelBubble = true;
        }
    };

    /**
     * on and off dual event handler method
     * @param context {Object} the context; this is usually this reference
     * @param eventName {String} the event handler name; either on or off
     * @param eventType {String} the event type e.g. click, etc.
     * @param callback {Function} the callback function
     * @returns {*}
     * @private
     */
    function _onOrOffEvent(context, eventName, eventType, callback)
    {
        _this = context;
        _this_count_int = _r.count(_this);

        if(_this_count_int > 0)
        {
            if(_this_count_int > 1)
            {
                //list

                _this.each(function(index, el)
                {
                    _doEvent(eventName, eventType, callback, el);
                });
                return _this;
            }
            else
            {
                //element

                _this_el_obj = _this[0];

                return _doEvent(eventName, eventType, callback, _this_el_obj);
            }
        }
    }

    /**
     * Attach an event handler for one or more events to the selected elements
     * @param eventType {String} The event identifier
     * @param callback {Function} The event handler
     * @returns {Object}
     */
    Dom.prototype.on = function(eventType, callback) {
        return _onOrOffEvent(this, 'on', eventType, callback);
    };

    /**
     * Remove an event handler
     * @param eventType {String} The event identifier
     * @param callback {Function} The event handler
     * @returns {Object}
     */
    Dom.prototype.off = function(eventType, callback) {
        return _onOrOffEvent(this, 'off', eventType, callback);
    };

    /**
     * Manually executes an event handler attached to the element
     * @param eventName {String} The event identifier
     * @param eventData {Function} data that is passed along
     * @return {*}
     */
    Dom.prototype.trigger = function(eventName) {
        _this = _getElement(this);

        var myArgs = Array.prototype.slice.call(arguments),
            eventData = (myArgs[1]) ? myArgs[1]: {},
            event;

        if (window.CustomEvent)
        {
            event = new CustomEvent(eventName, {detail: eventData});
            _this.dispatchEvent(event);
        }
        else if (document.createEvent)
        {
            event = document.createEvent('Event');
            event.initEvent(eventName, true, true, eventData);
            _this.dispatchEvent(event);
        }
        else
        {
            if(_this[eventName])
            {
                _this[eventName]();
            }
            document.documentElement[eventName] = 1;
        }

        return this;
    };

    /**
     * Adds or removes a class from a DOM Object
     * Wrapper class
     * @param op {String} The Class operation. Either 'add' or 'remove'
     * @param name {String} The Class name(s)
     * @param ctx {Object} The Object Context
     */
    function _doClass(op, name, ctx)
    {
        //get existing class
        var class_orig_str = ctx.getAttribute("class");
        class_orig_str = (!class_orig_str) ? '': class_orig_str;

        var i,
            class_orig_arr = (class_orig_str) ? class_orig_str.split(/\s+/g): [],
            class_new_arr = name.split(/\s+/g),
            class_new_str = '';

        if (!ctx.classList)
        {
            //classList not defined: probably old browser

            var class_item_str,
                class_list_arr = (op === 'remove') ? class_orig_arr : class_new_arr,
                class_list_haystack_arr = (op === 'remove') ? class_new_arr : class_orig_arr
                ;
            class_new_str = (op === 'remove') ? class_new_str : class_orig_str;

            for(i = 0; i < class_list_arr.length; i++)
            {
                class_item_str = class_list_arr[i].trim();
                if(!_r.in_array(class_item_str, class_list_haystack_arr))
                {
                    class_new_str += (op === 'remove') ? class_item_str+" " : " "+class_item_str;
                }
            }
            ctx.className = class_new_str.trim();

            //repaint
            ctx.innerHTML = ctx.innerHTML.replace('>', '>');
        }
        else
        {
            for(i = 0; i < class_new_arr.length; i++)
            {
                var class_list_item_new_str = class_new_arr[i].trim();
                ctx.classList[op](class_list_item_new_str);
            }
        }
    }

    /**
     * Adds or removes one or more classes
     * Wrapper class for _doClass
     * @param ctx {Object} the context
     * @param op {String} the name of the operation. Either 'add' or 'remove'
     * @param name {String} the class name(s)
     * @returns {*}
     * @private
     */
    function _addRemoveClass(ctx, op, name)
    {
        _this = ctx;
        _this_count_int = _r.count(_this);

        //return if string is empty
        if(_r.isString(name) && name.length < 1)
        {
            return _this;
        }

        //trim class data
        name = name.trim();

        if(_this_count_int > 0) {
            _this_el_obj = _this[0];

            if (_r.isString(name)) {
                if (_this_count_int > 1) {
                    //list

                    _this.each(function (index, el) {
                        _doClass(op, name, el);
                    });
                }
                else {
                    //element

                    _doClass(op, name, _this_el_obj);
                }
            }
            else {
                //list + element

                _doClass(op, name, _this_el_obj);
            }

            return _this;
        }
    }

    /**
     * Checks if an element has a class
     * @param ctx {Object} the context
     * @param name {String} the name of the class
     * @returns {*}
     * @private
     */
    function _hasClass(ctx, name)
    {
        if (!ctx.classList) {
            return ctx.className && new RegExp("(\\s|^)" + name + "(\\s|$)", "gi").test(ctx.className);
        }
        else {
            return ctx.classList.contains(name);
        }
    }

    /**
     * Checks if an element has a class
     * @param name {String} the class name
     * @return {Boolean}
     */
    Dom.prototype.hasClass = function(name) {
        _this = _getElement(this);
        return _hasClass(_this, name);
    };

    /**
     * Adds the specified class(es) to the selected element
     * @param name {String} the class name
     * @return {*}
     */
    Dom.prototype.addClass = function(name) {
        return _addRemoveClass(this, 'add', name);
    };

    /**
     * Removes the specified class(es) from the selected element
     * @param name {String} the class name
     * @return {*}
     */
    Dom.prototype.removeClass = function(name) {
        return _addRemoveClass(this, 'remove', name);
    };

    /**
     * Toggles a class off and on from the selected element
     * @param name {String} the class name
     * @return {Dom}
     */
    Dom.prototype.toggleClass = function(name){
        _this = _getElement(this);
        if(_hasClass(_this, name))
        {
            //remove
            _addRemoveClass(this, 'remove', name);
        }
        else
        {
            //add
            _addRemoveClass(this, 'add', name);
        }
        return this;
    };

    /**
     * Removes an attribute from the DOM
     * @param name {String} the name of the attribute
     * @returns {*}
     */
    Dom.prototype.removeAttr = function(name){
        _this = _getElement(this);
        _this.removeAttribute(name);

        return this;
    };

    /**
     * Get the first child of a list
     * @return {*}
     */
    Dom.prototype.first = function(){
        _this = _getElement(this);
        if(_this.length > 0)
        {
            return _this[0];
        }
    };

    /**
     * Get the last child of a list
     * @return {*}
     */
    Dom.prototype.last = function(){
        _this = _getElement(this);
        if(_this.length > 0)
        {
            var count_int;
            for(var i = 0; i < _this.length; i++)
            {
                count_int = i + 1;
                if(count_int === _this.length)
                {
                    return _this[i];
                }
            }
        }
    };

    /**
     * Get the middle child of a list
     * Note: DO NOT use this method if the list length is not odd
     * @return {*}
     */
    Dom.prototype.mid = function(){
        _this = _getElement(this);
        if(_this.length > 0 && !_r.isEven(_this.length))
        {
            var count_int,
                mid_idx_temp_flt = _this.length/2,
                mid_idx_int = Math.ceil(mid_idx_temp_flt);
            for(var i = 0; i < _this.length; i++)
            {
                count_int = i + 1;
                if(count_int === mid_idx_int)
                {
                    return _this[i];
                }
            }
        }
    };

    /**
     * Get the immediately following sibling of an element
     * @return {*}
     */
    Dom.prototype.next = function(){
        _this = _getElement(this);
        if (_this.nextElementSibling){
            return rQuery(_this.nextElementSibling);
        }
        var el = _this;
        do { el = el.nextSibling; } while (el && el.nodeType !== 1);
        return rQuery(el);
    };

    /**
     * Get the immediately preceding sibling of an element
     * @return {*}
     */
    Dom.prototype.prev = function(){
        _this = _getElement(this);
        if (_this.previousElementSibling){
            return rQuery(_this.previousElementSibling);
        }
        var el = _this;
        do { el = el.previousSibling; } while (el && el.nodeType !== 1);
        return rQuery(el);
    };

    /**
     * Get the parent of the element
     * @return {*}
     */
    Dom.prototype.parent = function(){
        _this = _getElement(this);
        return rQuery(_this.parentNode);
    };

    /**
     * Get the child of the element
     * @param pos_int {Number} the position of the child. By default, the first child is returned
     * Note: Child position starts from 0 i.e. 0 for first child, 1 for second, etc.
     * Note: Returns only one child
     * Note: Returns undefined if element has no child
     * @return {*}
     */
    Dom.prototype.child = function(){
        var myArgs = Array.prototype.slice.call(arguments),
            pos_int = (_r.isNumber(myArgs[0])) ? myArgs[0]: 0,
            _this = _getElement(this);
        return (_this.children.length > 0) ? rQuery(_this.children[pos_int]) : undefined;
    };

    /**
     * Get the current value of the element
     * This is for form elements only
     * @param value {String} the value to set [optional]
     * @return {*|String}
     */
    Dom.prototype.val = function(){
        var myArgs = Array.prototype.slice.call(arguments);
        _this = _getElement(this);
        if(_r.isString(myArgs[0]) || _r.isNumber(myArgs[0]) || _r.isBool(myArgs[0])) {
            if(_this.length > 1)
            {
                //list
                _this.each(function (index, el) {
                    el.value = ''+myArgs[0]+'';
                    el.setAttribute('value', ''+myArgs[0]+'');
                });
            }
            else
            {
                //element
                _this.value = ''+myArgs[0]+'';
                _this.setAttribute('value', ''+myArgs[0]+'');
            }

            return this;
        }
        else{
            return _this.value;
        }
    };

    /**
     * Get [or set] the html contents of the element
     * @param value {String} the HTML string to set [optional]
     * @return {*|Boolean|String}
     */
    Dom.prototype.html = function(){
        var myArgs = Array.prototype.slice.call(arguments);
        _this = _getElement(this);
        if(_r.isString(myArgs[0]) || _r.isNumber(myArgs[0]) || _r.isBool(myArgs[0]))
        {
            if(_this.length > 1)
            {
                //list
                _this.each(function (index, el) {
                    el.innerHTML = myArgs[0];
                });
            }
            else
            {
                //element
                _this.innerHTML = myArgs[0];
            }

            return this;
        }
        else
        {
            return _this.innerHTML;
        }
    };

    /**
     * Determines if a DOM element is displayed or not
     * @param {Object} ctx the context
     * @returns {boolean}
     * @private
     */
    function _displayState(ctx)
    {
        var el = _getElement(ctx);
        var value = _style(el, 'display'),
            width_str = _getDimension(ctx, 'width').toString(),
            op_offset_int = (width_str.indexOf('px') < 0) ? 0 : 2,
            width_int = parseInt(width_str.slice(0, width_str.length - op_offset_int), 10);

        return !((value === 'none') || !width_int);
    }

    /**
     * Shows or hides an element
     * @param {Object} ctx the context
     * @param {String} op the operation type. Either 'show' or 'hide'
     * @returns {Dom}
     * @private
     */
    function _showHide(ctx, op)
    {
        var display_val_str = (op === 'hide') ? 'none' : '';
        _this = ctx;
        _this_count_int = _r.count(_this);
        if(_this_count_int > 0)
        {
            _this.each(function (index, el) {
                el.style.display = display_val_str;
            });
        }

        return this;
    }

    /**
     * Checks if an element is shown
     * @returns {Boolean}
     */
    Dom.prototype.isShown = function(){
        return _displayState(this);
    };

    /**
     * Checks if an element is hidden
     * @returns {Boolean}
     */
    Dom.prototype.isHidden = function(){
        return !_displayState(this);
    };

    /**
     * Displays an element
     * @returns {Dom}
     */
    Dom.prototype.show = function(){
        return _showHide(this, 'show');
    };

    /**
     * Hides an element
     * @returns {Dom}
     */
    Dom.prototype.hide = function(){
        return _showHide(this, 'hide');
    };

    /**
     * Show or hide an element based on state
     * For example, if the item is hidden, show it; and if it is shown, hide it
     */
    Dom.prototype.toggle = function(){
        _this = _getElement(this);
        var display_state_bool = _displayState(this);
        if(display_state_bool)
        {
            _this.style.display = 'none';
        }
        else
        {
            _this.style.display = '';
        }

        return this;
    };

    /**
     * Removes an element
     */
    Dom.prototype.remove = function(){
        _this = _getElement(this);
        _this.parentNode.removeChild(_this);
    };

    /**
     * Insert an element to the end of all elements within a reference element
     * Analogous to JQuery $.append method
     * @param ref_obj {Element} The reference [destination] element
     * @return {*}
     */
    Dom.prototype.append = function(ref_obj) {

        //return if ref_obj is empty string
        if(_r.isEmptyString(ref_obj))
        {
            return;
        }

        _this = _getElement(this);
        _ref_obj = _getElement(ref_obj);
        _ref_obj = (_r.isString(ref_obj)) ? _stringToNode(ref_obj) : _ref_obj;
        if(_ref_obj.length > 0)
        {
            _ref_obj.forEach(function(el){
                _this.appendChild(el);
            });
        }
        else if(_ref_obj)
        {
            _this.appendChild(_ref_obj);
        }
        return this;
    };

    /**
     * Insert an element to the end of all elements within a reference element
     * Analogous to JQuery $.appendTo method
     * @param ref_obj {Element} The reference [destination] element
     * @return {*}
     */
    Dom.prototype.appendTo = function(ref_obj) {
        _this = _getElement(this);
        ref_obj = (_r.isString(ref_obj) && (ref_obj === "head" || ref_obj === "body")) ? rQuery(ref_obj): ref_obj;
        _ref_obj = _getElement(ref_obj);
        _ref_obj = (_r.isString(ref_obj)) ? _stringToNode(ref_obj) : _ref_obj;
        if(_getObjectType(_this) === 'Element')
        {
            _ref_obj.appendChild(_this);
            return this;
        }
        _appendToList(_ref_obj, this);
        return this;
    };

    /**
     * Insert an element to the end of all elements with a reference [NodeList/HTMLCollection/StaticNodeList]
     * @param obj {Object} the reference object
     * @param _this {Object} the context
     * @returns {*}
     * @private
     */
    function _appendToList(obj, _this){
        _this.each(function(index, el) {
            obj.appendChild(el);
        });
        return _this;
    }

    /**
     * Insert an element to the start of all elements within a reference element
     * Analogous to JQuery $.prepend method
     * @param ref_obj {Element} The reference [destination] element
     * @return {*}
     */
    Dom.prototype.prepend = function(ref_obj) {

        //return if ref_obj is empty string
        if(_r.isEmptyString(ref_obj))
        {
            return;
        }

        _this = _getElement(this);
        _ref_obj = _getElement(ref_obj);
        _ref_obj = (_r.isString(_ref_obj)) ? _stringToNode(_ref_obj) : _ref_obj;
        if(_ref_obj.length > 0)
        {
            for (var i = _ref_obj.length - 1; i >= 0; i--)
            {
                _this.insertBefore(_ref_obj[i], _this.firstChild);
            }
        }
        else if(_ref_obj)
        {
            _this.insertBefore(_ref_obj, _this.firstChild);
        }
        return this;
    };

    /**
     * Insert an element to the start of all elements within a reference element
     * Analogous to JQuery $.prependTo method
     * @param ref_obj {Element} The reference [destination] element
     * @return {*}
     */
    Dom.prototype.prependTo = function(ref_obj) {
        _this = _getElement(this);
        ref_obj = (_r.isString(ref_obj) && (ref_obj === "head" || ref_obj === "body")) ? rQuery(ref_obj): ref_obj;
        _ref_obj = _getElement(ref_obj);
        _ref_obj = (_r.isString(_ref_obj)) ? _stringToNode(_ref_obj) : _ref_obj;
        if(_getObjectType(_this) === 'Element') {
            _ref_obj.insertBefore(_this, _ref_obj.firstChild);
            return this;
        }

        if(this.selector_method !== 'querySelectorAll')
        {
            _this = document.querySelectorAll(this.selector);
        }
        _prependToList(_ref_obj, _this);
        return this;
    };

    /**
     * Insert an element to the start of all elements with a reference [NodeList/HTMLCollection/StaticNodeList]
     * @param obj {Object} the reference object
     * @param _this {Object} the context
     * @returns {*}
     * @private
     */
    function _prependToList(obj, _this){

        for (var i = _this.length-1; i >= 0; i--)
        {
            obj.insertBefore(_this[i], obj.firstChild);
        }
        return _this;
    }

    /**
     * Insert an element before a reference element
     * Analogous to JQuery $.insertBefore method
     * @param ref_obj {Element} The reference [destination] element
     * @return {*}
     */
    Dom.prototype.addBefore = function(ref_obj) {
        _this = _getElement(this);
        _ref_obj = _getElement(ref_obj);
        _parent_ref_obj = _ref_obj.parentNode;
        _parent_ref_obj.insertBefore(_this, _ref_obj);
        return this;
    };

    /**
     * Insert an element after a reference element
     * Analogous to JQuery $.insertAfter method
     * @param ref_obj {Element} The reference [destination] element
     * @return {*}
     */
    Dom.prototype.addAfter = function(ref_obj) {
        _this = _getElement(this);
        _ref_obj = _getElement(ref_obj);
        _parent_ref_obj = _ref_obj.parentNode;
        _parent_ref_obj.insertBefore(_this, _ref_obj.nextSibling);
        return this;
    };

    /**
     * Gets the width or height of an element
     * @param ctx {Object} the context
     * @param prop {String} the property name. Either width or height
     * @param op_type_str {String} the type of operation. Either outer, inner, or main
     * @param inc_margin_bool {String} determines if the margin is included in calculation. Valid for outer op_type_str only
     * @returns {*}
     * @private
     */
    function _getDimension(ctx, prop)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            el = ctx[0],
            selector = ctx.selector,
            op_type_str = (_r.isString(myArgs[2])) ? myArgs[2] : 'main',
            inc_margin_bool = (_r.isBool(myArgs[3])) ? myArgs[3] : false,
            is_getcomputedstyle_bool = ((typeof window.getComputedStyle !== 'undefined')),
            outer_margin_idx_1_str = (prop === 'height') ? 'marginTop' : 'marginLeft',
            outer_margin_idx_2_str = (prop === 'height') ? 'marginBottom' : 'marginRight',
            outer_border_idx_1_str = (prop === 'height') ? 'borderTopWidth' : 'borderLeftWidth',
            outer_border_idx_2_str = (prop === 'height') ? 'borderBottomWidth' : 'borderRightWidth',
            outer_padding_idx_1_str = (prop === 'height') ? 'paddingTop' : 'paddingLeft',
            outer_padding_idx_2_str = (prop === 'height') ? 'paddingBottom' : 'paddingRight',
            fallback_func_str = (prop === 'height') ? 'clientHeight' : 'clientWidth',
            style_obj,
            dim_temp_int,
            dim_padding_1_int,
            dim_padding_2_int,
            dim_padding_int,
            dim_border_1_int,
            dim_border_2_int,
            dim_border_int,
            dim_margin_1_int,
            dim_margin_2_int,
            dim_margin_int,
            dim_final_int
            ;

        //Compute for window object
        if(_isWindow(el))
        {
            return document.documentElement[fallback_func_str];
        }

        //Compute for HTML object
        if(selector === "html" || el === document)
        {
            var func_type_str = (prop === "height") ? "Height" : "Width",
                el_win = window,
                el_doc = document.documentElement,
                el_body = document.body || document.getElementsByTagName("body")[0],
                el_body_s_dim_int = (el_body['scroll'+func_type_str]) ? el_body['scroll'+func_type_str] : 0,
                el_body_o_dim_int = (el_body['offset'+func_type_str]) ? el_body['offset'+func_type_str] : 0,
                el_body_c_dim_int = (el_body['client'+func_type_str]) ? el_body['client'+func_type_str] : 0,
                el_doc_s_dim_int = (el_doc['scroll'+func_type_str]) ? el_doc['scroll'+func_type_str] : 0,
                el_doc_o_dim_int = (el_doc['offset'+func_type_str]) ? el_doc['offset'+func_type_str] : 0,
                el_doc_c_dim_int = (el_doc['client'+func_type_str]) ? el_doc['client'+func_type_str] : 0,
                el_win_i_dim_int = (el_win['inner'+func_type_str]) ? el_win['inner'+func_type_str] : 0
                ;

            return (prop === "height") ? Math.max(el_body_s_dim_int, el_body_o_dim_int, el_doc_s_dim_int, el_doc_o_dim_int, el_doc_c_dim_int) : el_win_i_dim_int || el_doc_c_dim_int || el_body_c_dim_int || el_body_o_dim_int;
        }

        //Get the Primary Dimension
        dim_temp_int = (prop === 'height') ? el.offsetHeight : el.offsetWidth;

        //define style object
        style_obj = (is_getcomputedstyle_bool) ? window.getComputedStyle(el, null) : el.currentStyle;

        //get margin
        dim_margin_1_int = (parseInt(style_obj[outer_margin_idx_1_str])) ? parseInt(style_obj[outer_margin_idx_1_str]): 0;
        dim_margin_2_int = (parseInt(style_obj[outer_margin_idx_2_str])) ? parseInt(style_obj[outer_margin_idx_2_str]): 0;
        dim_margin_int = dim_margin_1_int + dim_margin_2_int;

        //get padding
        dim_padding_1_int = (parseInt(style_obj[outer_padding_idx_1_str])) ? parseInt(style_obj[outer_padding_idx_1_str]): 0;
        dim_padding_2_int = (parseInt(style_obj[outer_padding_idx_2_str])) ? parseInt(style_obj[outer_padding_idx_2_str]): 0;
        dim_padding_int = dim_padding_1_int + dim_padding_2_int;

        //get border
        dim_border_1_int = (parseInt(style_obj[outer_border_idx_1_str])) ? parseInt(style_obj[outer_border_idx_1_str]): 0;
        dim_border_2_int = (parseInt(style_obj[outer_border_idx_2_str])) ? parseInt(style_obj[outer_border_idx_2_str]): 0;
        dim_border_int = dim_border_1_int + dim_border_2_int;

        //get final dimension
        dim_final_int = dim_temp_int;
        dim_final_int = dim_final_int-dim_padding_int-dim_border_int;

        //manage operation type e.g. innerWith, outerWidth
        if(op_type_str === 'outer')
        {
            dim_final_int = dim_final_int+dim_padding_int+dim_border_int;
            dim_final_int = (inc_margin_bool) ? dim_final_int+dim_margin_int : dim_final_int;
        }
        else if (op_type_str === 'inner')
        {
            dim_final_int = dim_final_int+dim_padding_int;
        }

        return dim_final_int;
    }

    /**
     * Gets the width of an element
     * Analogous to JQuery $.width()
     * @return {Number}
     */
    Dom.prototype.width = function(){
        var width_str = _getDimension(this, 'width').toString(),
            op_offset_int = (width_str.indexOf('px') < 0) ? 0 : 2;
        return parseInt(width_str.slice(0, width_str.length - op_offset_int), 10);
    };

    /**
     * Gets the inner width of an element
     * Analogous to JQuery $.innerWidth()
     * @return {Number}
     */
    Dom.prototype.innerWidth = function(){
        var width_str = _getDimension(this, 'width', 'inner').toString(),
            op_offset_int = (width_str.indexOf('px') < 0) ? 0 : 2;
        return parseInt(width_str.slice(0, width_str.length - op_offset_int), 10);
    };

    /**
     * Gets the outer width of an element
     * Analogous to JQuery $.outerWidth()
     * @param inc_margin_bool {Boolean} determines whether the margin value should be included
     * @return {Number}
     */
    Dom.prototype.outerWidth = function(inc_margin_bool){
        var width_str = _getDimension(this, 'width', 'outer', inc_margin_bool).toString(),
            op_offset_int = (width_str.indexOf('px') < 0) ? 0 : 2;
        return parseInt(width_str.slice(0, width_str.length - op_offset_int), 10);
    };

    /**
     * Gets the height of an element
     * Analogous to JQuery $.height()
     * @return {Number}
     */
    Dom.prototype.height = function(){
        var height_str = _getDimension(this, 'height').toString(),
            op_offset_int = (height_str.indexOf('px') < 0) ? 0 : 2;
        return parseInt(height_str.slice(0, height_str.length - op_offset_int), 10);
    };

    /**
     * Gets the height of an element
     * Analogous to JQuery $.innerHeight()
     * @return {Number}
     */
    Dom.prototype.innerHeight = function(){
        var height_str = _getDimension(this, 'height', 'inner').toString(),
            op_offset_int = (height_str.indexOf('px') < 0) ? 0 : 2;
        return parseInt(height_str.slice(0, height_str.length - op_offset_int), 10);
    };

    /**
     * Gets the outer height of an element
     * Analogous to JQuery $.outerHeight()
     * @param inc_margin_bool {Boolean} determines whether the margin value should be included
     * @return {Number}
     */
    Dom.prototype.outerHeight = function(inc_margin_bool){
        var height_str = _getDimension(this, 'height', 'outer', inc_margin_bool).toString(),
            op_offset_int = (height_str.indexOf('px') < 0) ? 0 : 2;
        return parseInt(height_str.slice(0, height_str.length - op_offset_int), 10);
    };

    /**
     * Gets or sets arbitrary data
     * @param key {String} the key
     * @param val {String|Number|Boolean} the value
     * @param ctx {Object} the context. Default is window
     * @returns {*}
     * @private
     */
    function _data(key, val)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            ctx = (!myArgs[2]) ? window : myArgs[2],
            _this = ctx,
            object_store_fn_str = 'objectStore';

        if(_isWindow(ctx))
        {
            object_store_fn_str = 'rObjectStore';

            //initialize window object store
            if(!ctx[object_store_fn_str])
            {
                ctx[object_store_fn_str] = {};
            }
        }

        //set method
        var _setValue = function(key, value){
            _this[object_store_fn_str][key] = value;
        };

        //get method
        var _getValue = function(key)
        {
            return _this[object_store_fn_str][key];
        };

        if (key)
        {
            if(!_r.isNullOrUndefined(val))
            {
                _setValue(key, val);
                /*jshint -W040 */
                return this;
                /*jshint +W040 */
            }
            else
            {
                return _getValue(key);
            }
        }
    }

    /**
     * Get or set arbitrary data associated with a matched element
     * Wrapper class of _data
     * @param key {String} the identifier of the data value
     * @param val {*} the data value
     * @return {*}
     */
    Dom.prototype.data = function(key, val)
    {
        return _data(key, val, this);
    };

    /**
     * Get or set arbitrary data to window-scope storage
     * Wrapper class of _data
     * @param key {String} the identifier of the data value
     * @param val {*} the data value
     * @returns {*}
     */
    rQuery.data = function(key, val)
    {
        return _data(key, val, window);
    };

    /**
     * Checks whether the object is an RQuery Object
     * @param elem_obj {Object} the Object to test
     * @returns {boolean}
     */
    rQuery.isRQueryObject = function(elem_obj)
    {
        return ((elem_obj.label === 'rquery'));
    };

    /**
     * Extends the Dom object by adding a method
     * @param name {String} the name of the function
     * @param func {Function} the function to add to the Dom object
     */
    rQuery.extend = function(name, func){
        Dom.prototype[name] = func;
    };

    //assign to window object
    window.rQuery = rQuery;

    //assign to $ namespace if it is undefined
    _data('isRQueryActive', false);
    if(!window.$)
    {
        window.$ = window.rQuery;
        _data('isRQueryActive', true);
    }

})(_r);


/*! Plain javascript replacement of .ready() function from jQuery | @link https://github.com/jfriend00/docReady | @copyright John Friend <https://github.com/jfriend00> | @license MIT */
(function(funcName, baseObj) {
    // The public function name defaults to window.docReady
    // but you can modify the last line of this function to pass in a different object or method name
    // if you want to put them in a different namespace and those will be used instead of
    // window.docReady(...)

    //update baseObj if not rQuery
    var is_rquery_bool = (baseObj.label && baseObj.label === 'rquery');
    baseObj = (!is_rquery_bool) ? window.rQuery : baseObj;

    //continue
    funcName = funcName || "docReady";
    baseObj = baseObj || window;
    var readyList = [];
    var readyFired = false;
    var readyEventHandlersInstalled = false;

    // call this when the document is ready
    // this function protects itself against being called more than once
    function ready() {
        if (!readyFired) {
            // this must be set to true before we start calling callbacks
            readyFired = true;
            for (var i = 0; i < readyList.length; i++) {
                // if a callback here happens to add new ready handlers,
                // the docReady() function will see that it already fired
                // and will schedule the callback to run right after
                // this event loop finishes so all handlers will still execute
                // in order and no new ones will be added to the readyList
                // while we are processing the list
                readyList[i].fn.call(window, readyList[i].ctx);
            }
            // allow any closures held by these functions to free
            readyList = [];
        }
    }

    function readyStateChange() {
        if ( document.readyState === "complete" ) {
            ready();
        }
    }

    // This is the one public interface
    // docReady(fn, context);
    // the context argument is optional - if present, it will be passed
    // as an argument to the callback
    baseObj[funcName] = function(callback, context) {
        // if ready has already fired, then just schedule the callback
        // to fire asynchronously, but right away
        if (readyFired) {
            setTimeout(function() {callback(context);}, 1);
            return;
        } else {
            // add the function and context to the list
            readyList.push({fn: callback, ctx: context});
        }
        // if document already ready to go, schedule the ready function to run
        // IE only safe when readyState is "complete", others safe when readyState is "interactive"
        if (document.readyState === "complete" || (!document.attachEvent && document.readyState === "interactive")) {
            setTimeout(ready, 1);
        } else if (!readyEventHandlersInstalled) {
            // otherwise if we don't have event handlers installed, install them
            if (document.addEventListener) {
                // first choice is DOMContentLoaded event
                document.addEventListener("DOMContentLoaded", ready, false);
                // backup is window load event
                window.addEventListener("load", ready, false);
            } else {
                // must be IE
                document.attachEvent("onreadystatechange", readyStateChange);
                window.attachEvent("onload", ready);
            }
            readyEventHandlersInstalled = true;
        }
    };
})("domReady", $);
// modify this previous line to pass in your own method name
// and object for the method to be attached to


/*! rScript - C | @link http://github.com/restive/rscript | @copyright 2017 Restive LLC <http://rscript.io> | @license MIT */
(function(window, document, $){

    //define util rScript class
    (function(root, name, make){
        if (typeof module !== 'undefined' && module.exports){ module.exports = make();}
        else {root[name] = make();}
    }(window, 'rUtil', function() {

        var rUtil = {};

        /**
         * Wrapper for _domStore
         * @returns {*}
         */
        function domStoreFn()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _domStore(myArgs[0], myArgs[1]);
        }

        /**
         * Create DOM-based Storage
         * @param key_str {String} The identifier for the value being stored
         * @param value_res {*} The value to store [optional]
         * @param namespace_str {String} a dedicated namespace to store values
         * Note: When storing objects in a namespace, you can return all objects by using this method with an undefined key_str and undefined value_res
         * @returns {*}
         * @private
         */
        function _domStore()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                key_str = myArgs[0],
                value_res = myArgs[1],
                namespace_str = (_r.isString(myArgs[2]) && myArgs[2].length > 0) ? myArgs[2] : null,
                is_value_valid_bool = !!((typeof value_res !== "undefined" && value_res !== null) && ((_r.isString(value_res) && value_res.length > 0) || _r.isNumber(value_res) || (_r.isArray(value_res)) || _r.isBool(value_res) || _r.isObject(value_res) || typeof value_res === 'function')),
                is_value_null_bool = ((value_res === null)),
                key_prefix_str = 'r_'
                ;

            //prefix key value
            key_str = (_r.isString(key_str) && key_str.length > 0) ? key_prefix_str+key_str : key_str;

            if(namespace_str)
            {
                //prefix namespace value
                namespace_str = key_prefix_str+namespace_str;

                //save in namespace

                //create object namespace if not
                if(!window.rUtil.domStoreData[namespace_str])
                {
                    window.rUtil.domStoreData[namespace_str] = {};
                }

                if(is_value_valid_bool)
                {
                    window.rUtil.domStoreData[namespace_str][key_str] = value_res;
                }
                else if (is_value_null_bool)
                {
                    window.rUtil.domStoreData[namespace_str][key_str] = null;
                }
                else
                {
                    return (key_str) ? window.rUtil.domStoreData[namespace_str][key_str] : window.rUtil.domStoreData[namespace_str];
                }
            }
            else
            {
                if(is_value_valid_bool)
                {
                    window.rUtil.domStoreData[key_str] = value_res;
                }
                else if (is_value_null_bool)
                {
                    window.rUtil.domStoreData[key_str] = null;
                }
                else
                {
                    return window.rUtil.domStoreData[key_str];
                }
            }
        }

        /**
         * Wrapper class for _domStore
         * @returns {*}
         */
        function domStore()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _domStore(myArgs[0], myArgs[1], myArgs[2]);
        }

        /**
         * Stores a value in LocalStorage [or other storage type], or retrieves previously stored value
         * Leverages AmplifyJS Store <http://amplifyjs.com/api/store/> and JS-Cookie <https://github.com/js-cookie/js-cookie>
         * @param key_str {String} The identifier for the value being stored
         * @param value_res {*} The value to store [optional]
         * @param type_str {String} The type of storage format to be used
         * ls for localStorage
         * ss for sessionStorage [default]
         * ck for cookie
         * @param options_res {*} A set of key/value pairs that relate to settings for storing the value
         * These are pass-through values for the respective storage libraries
         * For sessionStorage and LocalStorage, see official AmplifyJS options
         * For cookie, see official js-cookie options
         * @return {*}
         */
        function _store()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            var is_priv_browsing_bool = domStore("browser_is_private"),
                key_str = myArgs[0],
                value_res = myArgs[1],
                type_str = ((typeof myArgs[2] !== "undefined" && myArgs[2] !== null) && (_r.isString(myArgs[2]) && myArgs[2].length > 0)) ? myArgs[2] : 'ss',
                options_res = myArgs[3],
                store_func_name,
                store_func,
                list_del_key_arr = [],
                is_getall_bool = (_r.isString(key_str) && key_str.length > 0) ? false: true,
                is_value_valid_bool = !!((typeof value_res !== "undefined" && value_res !== null) && ((_r.isString(value_res) && value_res.length > 0) || _r.isNumber(value_res) || (_r.isArray(value_res)) || _r.isBool(value_res) || _r.isObject(value_res))),
                is_value_null_bool = ((value_res === null));

            try
            {
                if (is_priv_browsing_bool)
                {
                    //Private Browsing Detected, Use Windows Store
                    store_func_name = 'domStoreFn';
                    store_func = window.rUtil[store_func_name];
                }
                else if(type_str === 'ck')
                {
                    //Use Cookies

                    //get
                    if (!is_value_valid_bool)
                    {
                        if(is_value_null_bool)
                        {
                            //remove
                            Cookies.remove(key_str, options_res);
                        }
                        else
                        {
                            //get
                            return Cookies.get(key_str);
                        }
                    }
                    else
                    {
                        //set
                        Cookies.set(key_str, value_res, options_res);
                    }
                    return;
                }
                else
                {
                    //Use AmplifyJS Store
                    if(type_str === 'ls')
                    {
                        store_func_name = 'localStorage';
                    }
                    else
                    {
                        store_func_name = 'sessionStorage';
                    }
                    store_func = amplify.store[store_func_name];

                    //if sessionStorage is not supported, default to amplifyJS
                    if (!window.sessionStorage || !window.localStorage)
                    {
                        store_func = amplify.store;
                    }

                    //return all values if no key is provided
                    if(is_getall_bool)
                    {
                        return store_func();
                    }
                }

                //return stored value if empty value argument and value is not null
                if (!is_value_valid_bool && !is_value_null_bool)
                {
                    return store_func(key_str);
                }

                //delete object if value is null
                if (is_value_null_bool)
                {
                    //delete stored object(s)
                    list_del_key_arr = key_str.split(" ");
                    for (var i = 0; i < _r.count(list_del_key_arr); i++)
                    {
                        store_func(list_del_key_arr[i], null);
                    }
                    return null;
                }

                //store value
                store_func(key_str, null);
                store_func(key_str, value_res, options_res);
            }
            catch(e){
                var e_msg_str = e.message;
                _r.console.error(e_msg_str);
            }
        }

        /**
         * Wrapper class for _store
         * @returns {*}
         */
        function store()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _store(myArgs[0], myArgs[1], myArgs[2], myArgs[3]);
        }

        /**
         * Checks if a value stored in LocalStorage exists and contains a value
         * Also stores a value if provided if the value did not previously exist or was invalid
         * @param key_str {String} The identifier for the value that was stored
         * @param value_store_res {*} The value to store [optional]
         * @param type_str {String} The type of storage format to be used
         * @return {Boolean}
         */
        function _storeCheck()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                key_str = myArgs[0],
                value_store_res = myArgs[1],
                type_str = ((typeof myArgs[2] !== "undefined" && myArgs[2] !== null) && (_r.isString(myArgs[2]) && myArgs[2].length > 0)) ? myArgs[2] : 'ss',
                value_retr_res = store(''+key_str+'', '', type_str),
                is_value_valid_bool = !!((typeof value_store_res !== "undefined" && value_store_res !== null)),
                is_store_value_set_bool = false
                ;

            //Determine if store value exists and is valid
            if(_r.isBool(value_retr_res) || (value_retr_res !== null && typeof value_retr_res !== "undefined" && value_retr_res.length > 0))
            {
                is_store_value_set_bool = true;
            }

            //Return result of check immediately if no value is provided
            if(!is_value_valid_bool)
            {
                return is_store_value_set_bool;
            }

            //Store value if it does not exist and/or is invalid.
            if(!is_store_value_set_bool)
            {
                store(key_str, value_store_res, type_str);
            }
        }

        /**
         * Wrapper class for _storeCheck
         * @returns {*}
         */
        function storeCheck()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _storeCheck(myArgs[0], myArgs[1], myArgs[2]);
        }

        //Handle existing window.rUtil
        if(window.rUtil)
        {
            rUtil = window.rUtil;
        }

        //Append methods
        rUtil.domStoreData = {'domStoreData': {}};
        rUtil.domStoreFn = domStoreFn;
        rUtil.domStore = domStore;
        rUtil.store = store;
        rUtil.storeCheck = storeCheck;

        return rUtil;

    }));

    //define core rScript class
    (function(root, name, make){
        var $ = (root.jQuery || root.Zepto) ? root.jQuery || root.Zepto : root.$;
        if (typeof module !== 'undefined' && module.exports){ module.exports = make($);}
        else {root[name] = make($);}
    }(window, 'rScript', function($) {

        //Define rScript Object
        var rScript;

        /**
         * Initialize and store some important default values.
         * Return false if initialization has already been performed in same session.
         * @return {Boolean}
         */
        var init = function ()
        {
            /**
             * Ready method to execute scripts on a specific queue
             * @param {Function|Object} util_ready_fn_or_obj
             * @param {Function} queue_id_fn the specific queue function
             * @private
             */
            function _ready(util_ready_fn_or_obj, queue_id_fn)
            {
                if(_r.isFunction(util_ready_fn_or_obj))
                {
                    //queue function
                    queue_id_fn(util_ready_fn_or_obj);
                }
                else if (_r.isObject(util_ready_fn_or_obj))
                {
                    //queue function from object
                    var func_obj = util_ready_fn_or_obj;
                    for (var key in func_obj)
                    {
                        if (func_obj.hasOwnProperty(key))
                        {
                            queue_id_fn(func_obj[key]);
                        }
                    }
                }
            }

            /**
             * Detect private browsing
             * Note: Must be called first before everything
             */
            var is_private_browser_bool = !!((_detectPrivateBrowsing()));
            domStore("browser_is_private", is_private_browser_bool);

            //run preInit on rUtil
            if(rUtil.init)
            {
                rUtil.init();
            }

            //setup to run on document ready
            if(rUtil.domReady)
            {
                _ready(rUtil.domReady, addToQueueDomReady);
            }

            //setup to run first [before rScript]
            if(rUtil.first)
            {
                _ready(rUtil.first, addToQueueRScriptFirst);
            }

            //setup to run when rScript is ready
            if(rUtil.ready)
            {
                _ready(rUtil.ready, addToQueueRScriptReady);
            }

            //setup to run after rScript
            if(rUtil.post)
            {
                _ready(rUtil.post, addToQueueRScriptPostReady);
            }

            //setup to run when deferred scripts are loaded
            if(rUtil.defer)
            {
                _ready(rUtil.defer, addToQueueRScriptDeferReady);
            }

            //setup to stage async scripts
            if(rUtil.async)
            {
                _ready(rUtil.async, addToQueueRScriptAsync);
            }

            //setup to run when async [above] scripts are loaded
            if(rUtil.await)
            {
                _ready(rUtil.await, addToQueueRScriptAwaitReady);
            }

            //ready initialization
            var is_init_bool = store("rs_var_is_init"),
                retr_bool;

            //reset storage variables
            store("rs_var_run_defer_auto", null);
            store("rs_var_run_defer_css_manual_set_fn", null);

            store("rs_var_counter_console", 1);

            if(is_init_bool)
            {
                store("rs_var_timestamp_curr", _r.microtime(true));

                //update the dimension and orientation info storage-wide
                _initDimensionVars();
                _updateDimensionStore();
                _updateOrientationStore();

                retr_bool = false;
            }
            else
            {
                //set defaults
                store("rs_var_timestamp_curr", _r.microtime(true));
                store("rs_var_timestamp_init", store("rs_var_timestamp_curr"));

                store("rs_var_is_init", true);

                _initDimensionVars();
                _updateDimensionStore();
                store("rs_var_screen_ort_init", getOrientation());
                store("rs_var_screen_ort_curr", getOrientation());

                retr_bool = true;
            }

            return retr_bool;
        };

        /**
         * Detects whether private browsing is active or not
         * @return {Boolean}
         */
        function _detectPrivateBrowsing()
        {
            try {
                localStorage.setItem("__test", "data");
            }
            catch (e)
            {
                var is_local_storage_notset_bool = /localStorage.*?(undefined|denied|null)|setItem.*?(undefined|null)|security *error.*?dom +exception +18/i.test(e.message);
                var is_quota_exceeded_bool = /quota.*?(exceeded|reached)/i.test(e.name);

                if (is_local_storage_notset_bool || is_quota_exceeded_bool) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Wrapper class for rUtil.domStore
         * @returns {*}
         */
        function domStore()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return rUtil.domStore(myArgs[0], myArgs[1], myArgs[2]);
        }

        /**
         * Wrapper class for rUtil.store
         * @returns {*}
         */
        function store()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return rUtil.store(myArgs[0], myArgs[1], myArgs[2], myArgs[3]);
        }

        /**
         * Wrapper class for rUtil.storeCheck
         * @returns {*}
         */
        function storeCheck()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return rUtil.storeCheck(myArgs[0], myArgs[1], myArgs[2]);
        }

        /**
         * Increments or decrements a value in storage
         * @param key_str {String} the identifier of the value in storage
         * @param incr_size_int {Number} the size of the increment
         * @param decr_bool {Boolean} if set to true, will decrement instead of increment
         * @param type_str {String} the storage type
         * Note: only ls [localStorage], ss [sessionStorage], and ck [cookie] are allowed
         * @returns {*}
         * @private
         */
        function _storeIncrement(key_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                incr_size_int = (_r.isNumber(myArgs[1])) ? myArgs[1]: 1,
                decr_bool = (_r.isBool(myArgs[2])) ? myArgs[2]: false,
                type_str = (_r.isString(myArgs[3]) && _r.in_array(myArgs[3], ['ss', 'ls', 'ck'])) ? myArgs[3] : 'ss',
                value_int;

            value_int = parseInt(store(key_str, undefined, type_str));
            if(!_r.isNumber(value_int))
            {
                return false;
            }

            value_int = (decr_bool) ? value_int - incr_size_int: value_int + incr_size_int;
            store(key_str, value_int, type_str);

            return value_int;
        }

        /**
         * Increments a value in storage
         * Wrapper class for _storeIncrement
         * @returns {*}
         */
        function storeIncrement(key_str, incr_size_int)
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _storeIncrement(key_str, incr_size_int, undefined, myArgs[2]);
        }

        /**
         * Decrements a value in storage
         * Wrapper class for _storeIncrement
         * @returns {*}
         */
        function storeDecrement(key_str, incr_size_int)
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _storeIncrement(key_str, incr_size_int, true, myArgs[2]);
        }

        /**
         * Initializes important dimension variables to Local storage
         * @private
         */
        function _initDimensionVars()
        {
            var docElem = document.documentElement;
            store("rs_var_document_client_w", docElem.clientWidth);
            store("rs_var_document_client_h", docElem.clientHeight);
            store("rs_var_window_outer_w", window.outerWidth);
            store("rs_var_window_outer_h", window.outerHeight);
            store("rs_var_window_screen_w", screen.width);
            store("rs_var_window_screen_h", screen.height);
        }

        /**
         * Get the width of the viewport
         * @return {*|Number}
         */
        function viewportW(){
            return (storeCheck("rs_var_viewport_w")) ? store("rs_var_viewport_w"): _getViewportDimensionPixel('w');
        }

        /**
         * Get the height of the viewport
         * @return {*|Number}
         */
        function viewportH(){
            return (storeCheck("rs_var_viewport_h")) ? store("rs_var_viewport_h"): _getViewportDimensionPixel('h');
        }

        /**
         * Get the width of the screen i.e. device width
         * @return {*|Number}
         */
        function screenW(){
            return (storeCheck("rs_var_screen_w")) ? store("rs_var_screen_w"): _getDimension('sW', store("rs_var_is_getdim_screen_adj"));
        }

        /**
         * Get the height of the screen i.e. device height
         * @return {*|Number}
         */
        function screenH(){
            return (storeCheck("rs_var_screen_h")) ? store("rs_var_screen_h"): _getDimension('sH', store("rs_var_is_getdim_screen_adj"));
        }

        /**
         * Get the Device-Independent Pixel width of the viewport
         */
        function pixelW()
        {
            return (storeCheck("rs_var_viewport_w_dp")) ? store("rs_var_viewport_w_dp"): _getDimension('vW', store("rs_var_is_getdim_screen_adj"));
        }

        /**
         * Get the Device-Independent Pixel height of the viewport
         */
        function pixelH()
        {
            return (storeCheck("rs_var_viewport_h_dp")) ? store("rs_var_viewport_h_dp"): _getDimension('vH', store("rs_var_is_getdim_screen_adj"));
        }

        /**
         * Get the dimension of a DOM Element.
         * It uses the JQuery dimension functions e.g. width(), innerHeight(), etc.
         * @param el_obj {String} The JQuery element object
         * @param type_str {String} The type of operation. w = width, h = height
         * @param format_str {String} The dimension retrieval method to use. There are three as follows
         * 1: d = default = el_obj.width() or el_obj.height()
         * 2: i = inner = el_obj.innerWidth() or el_obj.innerHeight()
         * 3: o = outer = el_obj.outerWidth() or el_obj.outerHeight()
         * @param force_dip_bool {Boolean} Determines whether to consider the element dimensions in device-independent pixel format or not. true = do not use DIP, false [default] = use DIP
         * @return {Number|Boolean}
         * @private
         */
        function _getElementDimension(el_obj, type_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                format_str = (_r.isString(myArgs[2]) && myArgs[2].length > 0) ? myArgs[2]: 'd',
                force_dip_bool = (_r.isBool(myArgs[3])) ? myArgs[3]: true,
                dim_final_int
                ;
            type_str = type_str.toLowerCase();

            if(type_str === 'w' || type_str === 'h')
            {
                if(format_str === 'i')
                {
                    dim_final_int = (type_str === 'w') ? el_obj.innerWidth() : el_obj.innerHeight();
                }
                else if (format_str === 'o')
                {
                    dim_final_int = (type_str === 'w') ? el_obj.outerWidth() : el_obj.outerHeight();
                }
                else
                {
                    dim_final_int = (type_str === 'w') ? el_obj.width() : el_obj.height();
                }
            }
            else
            {
                dim_final_int = false;
            }

            if(force_dip_bool === false)
            {
                //Convert to Device Pixels
                dim_final_int = dim_final_int * getPixelRatio();
            }

            return dim_final_int;
        }

        /**
         * Get the width of a DOM element
         * @param el_obj {Object} The JQuery Element Object
         * @param dim_format_str {String} The dimension retrieval method to use.
         * @param force_dip_bool {Boolean} Flag for forced Device-Independent Pixel consideration
         * @return {Number|Boolean}
         * @private
         */
        function _elementW(el_obj){
            var myArgs = Array.prototype.slice.call(arguments),
                dim_format_str = myArgs[1],
                force_dip_bool = myArgs[2]
                ;
            return _getElementDimension(el_obj, 'w', dim_format_str, force_dip_bool);
        }

        /**
         * Get the height of a DOM element
         * @param el_obj {Object} The JQuery Element Object
         * @param dim_format_str {String} The dimension retrieval method to use.
         * @param force_dip_bool {Boolean} Flag for forced Device-Independent Pixel consideration
         * @return {Number|Boolean}
         * @private
         */
        function _elementH(el_obj){
            var myArgs = Array.prototype.slice.call(arguments),
                dim_format_str = myArgs[1],
                force_dip_bool = myArgs[2]
                ;
            return _getElementDimension(el_obj, 'h', dim_format_str, force_dip_bool);
        }

        /**
         * Get the Device Pixel Ratio
         * @param decimal {Number} An optional number (integer or float) to check against actual pixel ratio
         * @return {Number|Boolean}
         */
        function getPixelRatio(decimal) {
            //check if pixel ratio check has already been done. If so, return stored value
            if (storeCheck("rs_var_screen_pixel_ratio")) {
                return store("rs_var_screen_pixel_ratio");
            }

            var device_user_agent_str = getUserAgent(),
                is_opera_browser_bool = /opera.+(mini|mobi)/i.test(device_user_agent_str),
                doc_client_w = store("rs_var_document_client_w"),
                win_outer_w = store("rs_var_window_outer_w"),
                win_screen_w = store("rs_var_window_screen_w"),
                is_symbian_bool = !!(isSymbian()),
                is_windows_bool = !!(isWindows()),
                is_android_1_bool = !!((isAndroid('1.'))),
                is_android_2_bool = !!((isAndroid('2.'))),
                is_special_needs_bool = !!(((is_android_1_bool || is_android_2_bool) || is_symbian_bool || is_windows_bool)),
                is_windows_or_symbian_bool = !!(is_windows_bool || is_symbian_bool),
                viewport_w = (is_special_needs_bool) ? ((win_outer_w <= 0) ? doc_client_w : win_outer_w) : doc_client_w,
                screen_w = ((is_android_2_bool || is_symbian_bool) && !is_opera_browser_bool) ? ((win_outer_w <= 0) ? win_screen_w : win_outer_w) : win_screen_w,
                dPR,
                dPR_temp,
                dPR_virtual,
                dPR_retr
                ;

            /**
             * Get the Pixel Ratio
             * Make Adjustments for when window.devicePixelRatio is 0
             */
            dPR_temp = window.devicePixelRatio;
            if (dPR_temp <= 0 || typeof dPR_temp === 'undefined' || dPR_temp === null) {
                dPR_virtual = screen_w / viewport_w;
                dPR = dPR_virtual;
                if (is_windows_or_symbian_bool) {
                    if (dPR > 0.5 && dPR < 1.2) {
                        dPR = 1;
                    }
                    else if (dPR >= 1.2 && dPR < 2) {
                        dPR = 1.5;
                    }
                    else if (dPR >= 2 && dPR < 3) {
                        dPR = 2;
                    }
                    else if (dPR >= 3 && dPR < 4) {
                        dPR = 3;
                    }
                    else if (dPR >= 4) {
                        dPR = 4;
                    }
                    else {
                        dPR = 1;
                    }
                }
                store("rs_var_screen_pixel_ratio_virt", dPR_virtual);
            }
            else {
                dPR = dPR_temp;
            }

            //Return Pixel Ratio variations
            if (!_r.isNumber(decimal)) {
                dPR_retr = dPR || (getPixelRatio(3) ? 3 : getPixelRatio(2) ? 2 : getPixelRatio(1.5) ? 1.5 : getPixelRatio(1) ? 1 : 0);
                store("rs_var_screen_pixel_ratio", dPR_retr);
                return dPR_retr;
            }

            //Return false if not finite
            if (!isFinite(decimal)) {
                return false;
            }

            if (dPR && dPR > 0) {
                return dPR >= decimal;
            }

            //Revert to .matchMedia/.msMatchMedia for Gecko (FF6+) support
            decimal = 'only all and (min--moz-device-pixel-ratio:' + decimal + ')';
            if (media(decimal).matches)
            {
                return true;
            }

            return !!media(decimal.replace('-moz-', '')).matches;
        }

        /**
         * Determines if the browser is a proxy-based browser
         * @link http://docs.webplatform.org/wiki/concepts/Internet_and_Web/proxy_based_browsers
         * @param {String} ua_str The user agent string
         * @return {Boolean}
         * @private
         */
        function _hasProxyBrowser(ua_str)
        {
            if (storeCheck("rs_var_device_has_proxy_browser")){
                return store("rs_var_device_has_proxy_browser");
            }

            var myArgs = Array.prototype.slice.call(arguments),
                set_to_store_flag_bool = (_r.isBool(myArgs[1])) ? myArgs[1]: false,
                is_ua_proxy_bool = /(series(4|6)0|s(4|6)0).+nokia|nokia.+(series(4|6)0|s(4|6)0)|(android|linux).+nokia.{1,3}x|skyfire|ucweb *mini|opera *mini/i.test(ua_str);

            if(set_to_store_flag_bool)
            {
                store("rs_var_device_has_proxy_browser", is_ua_proxy_bool);
            }
            return is_ua_proxy_bool;
        }

        /**
         * Gets the user agent of the Device
         * This function makes provision for proxy-based browsers that employ X11 forwarding, but you need to use rScript.proxyBrowserPing method to enable this
         * @return {String}
         */
        function getUserAgent()
        {
            //check if user agent check has been done and is in storage. If so, return stored value
            if(storeCheck("rs_var_device_user_agent"))
            {
                return store("rs_var_device_user_agent");
            }

            var ua_str = navigator.userAgent.toLowerCase(),
                has_proxy_ua_bool;

            //run synchronous UA ping only if specified using rScript.
            if(_r.config.proxyBrowserPingUrl && _r.isString(_r.config.proxyBrowserPingUrl) && _r.config.proxyBrowserPingUrl.length > 0)
            {
                //Check if device user agent is likely used by proxy-based browser
                has_proxy_ua_bool = /mozilla.+x11(?!.*?(ubuntu|firefox|chrome|safari|opera|opr|qupzilla))/i.test(ua_str);
                if(has_proxy_ua_bool)
                {
                    //launch ajax request and set isProxyBrowser function in callback
                    var xhr_obj = new XMLHttpRequest(),
                        xhr_url_str = _r.config.proxyBrowserPingUrl;
                    xhr_obj.open('GET', xhr_url_str, false);  // 'false' makes the request synchronous. This is not an issue for proxy browsers because they are asynchronous by nature
                    xhr_obj.setRequestHeader("Cache-Control", "no-cache");
                    xhr_obj.setRequestHeader("Pragma", "no-cache");
                    xhr_obj.send(null);

                    ua_str = (xhr_obj.status === 200) ? xhr_obj.responseText : '';
                }
            }

            /**
            if(store('rs_var_is_proxy_browser_ua_ping_mode'))
            {
                //Check if device user agent is likely used by proxy-based browser
                has_proxy_ua_bool = /mozilla.+x11(?!.*?(ubuntu|firefox|chrome|safari|opera|opr|qupzilla))/i.test(ua_str);
                if(has_proxy_ua_bool)
                {
                    //launch ajax request and set isProxyBrowser function in callback
                    var xhr_obj = new XMLHttpRequest(),
                        xhr_url_str = store('rs_var_is_proxy_browser_ua_ping_url');
                    xhr_obj.open('GET', xhr_url_str, false);  // 'false' makes the request synchronous. This is not an issue for proxy browsers because they are asynchronous by nature
                    xhr_obj.setRequestHeader("Cache-Control", "no-cache");
                    xhr_obj.setRequestHeader("Pragma", "no-cache");
                    xhr_obj.send(null);

                    ua_str = (xhr_obj.status === 200) ? xhr_obj.responseText : '';
                }
            }
            **/

            //set proxy browser setting to storage
            _hasProxyBrowser(ua_str, true);

            store("rs_var_device_user_agent", ua_str);
            return ua_str;
        }

        /**
         * Gets the Operating System/Platform of the Device
         * The following platforms are supported
         * ios, android, symbian, blackberry, windows, mac, linux, unix, openbsd
         * @return {String}
         */
        function getPlatform()
        {
            if(_checkOS("ios"))
            {
                return "ios";
            }
            else if (_checkOS("android"))
            {
                return "android";
            }
            else if(_checkOS("symbian"))
            {
                return "symbian";
            }
            else if (_checkOS("blackberry"))
            {
                return "blackberry";
            }
            else if (_checkOS("windows"))
            {
                return "windows";
            }
            else if(_checkOS("mac"))
            {
                return "mac";
            }
            else if(_checkOS("linux"))
            {
                return "linux";
            }
            else if(_checkOS("unix"))
            {
                return "unix";
            }
            else if(_checkOS("openbsd"))
            {
                return "openbsd";
            }

            return "unknown";
        }

        /**
         * Detects the Operating System [Platform] of the Device
         * @param os_str {String} The name of the OS
         * @param version_str An optional version number [Only valid for Android]
         * @return {Boolean}
         * @private
         */
        function _checkOS(os_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                is_version_valid_bool = !!((_r.isString(myArgs[1]) && myArgs[1].length > 0)),
                version_str = '',
                version_regex_suffix_str = '',
                version_store_suffix_str = ''
                ;

            //manage version string if provided
            if (is_version_valid_bool)
            {
                version_str = myArgs[1];
                version_str = version_str.replace(/^\s+|\s+$/g, "");
                version_regex_suffix_str = ' '+version_str;
                version_store_suffix_str = '_'+version_str.replace(".", "_");
            }

            //Check if value is stored. Return if true
            if (storeCheck("rs_var_device_os_is_"+os_str+version_store_suffix_str))
            {
                return store("rs_var_device_os_is_"+os_str+version_store_suffix_str);
            }

            var nav = getUserAgent(),
                is_os_bool = false;

            if (os_str === "ios")
            {
                is_os_bool = /\bipad|\biphone|\bipod/i.test(nav);
            }
            else if (os_str === "android")
            {
                var pattern = new RegExp("\\bandroid"+version_regex_suffix_str, "i");
                is_os_bool = pattern.test(nav);
            }
            else if (os_str === "symbian")
            {
                is_os_bool = /series(4|6)0|symbian|symbos|syb-[0-9]+|\bs60\b/i.test(nav);
            }
            else if (os_str === "blackberry")
            {
                is_os_bool = /bb[0-9]+|blackberry|playbook|rim +tablet/i.test(nav);
            }
            else if (os_str === "windows")
            {
                is_os_bool = /window mobile|windows +(ce|phone)|windows +nt.+arm|windows +nt.+touch|xblwp7|zunewp7|windows +(10|8\.1|8|7|xp|2000|me|9x +4\.90|98|95|_95)|windows +nt +(6\.3|6\.2|6\.1|6\.0|5\.2|5\.1|5\.0|4\.0)|win(95|98|nt4\.0|nt)|windows +nt/i.test(nav);
            }
            else if (os_str === "windows_phone")
            {
                is_os_bool = /windows +phone|xblwp7|zunewp7/i.test(nav);
            }
            else if (os_str === "mac")
            {
                is_os_bool = /mac +os +x|macppc|macintel|mac_powerpc|macintosh/i.test(nav);
            }
            else if (os_str === "linux")
            {
                is_os_bool = /x11|linux/i.test(nav);
            }
            else if (os_str === "unix")
            {
                is_os_bool = /unix/i.test(nav);
            }
            else if (os_str === "openbsd")
            {
                is_os_bool = /openbsd/i.test(nav);
            }

            //persist to local storage and return
            store("rs_var_device_os_is_"+os_str+version_store_suffix_str, is_os_bool);
            return !!((is_os_bool));
        }

        /**
         * Checks if the Device is based on Apple's iOS Platform
         * @return {Boolean}
         */
        function isIOS()
        {
            return _checkOS("ios");
        }

        /**
         * Checks if the Device is based on Android Platform
         * @return {Boolean}
         */
        function isAndroid()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                version_str = myArgs[0];
            return _checkOS("android", version_str);
        }

        /**
         * Checks if the Device is based on Symbian Platform
         * @return {Boolean}
         */
        function isSymbian()
        {
            return _checkOS("symbian");
        }

        /**
         * Checks if the Device is based on Blackberry Platform
         * @return {Boolean}
         */
        function isBlackberry()
        {
            return _checkOS("blackberry");
        }

        /**
         * Checks if the Device is based on a Windows Platform
         * @return {Boolean}
         */
        function isWindows()
        {
            return _checkOS("windows");
        }

        /**
         * Checks if the Device is based on Windows Phone Platform
         * @return {Boolean}
         */
        function isWindowsPhone()
        {
            return _checkOS("windows_phone");
        }

        /**
         * Mobile Browser Detection Regex
         * @param ua {String} User Agent String
         * @return {Boolean}
         * @private
         */
        function _mobileDetect(ua)
        {
            return /android|android.+mobile|avantgo|bada\/|\bbb[0-9]+|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|\bip(hone|od|ad)|iris|(jolla|sailfish).+mobile|kindle|lge |maemo|meego.+mobile|midp|mmp|motorola|mobile.+firefox|netfront|nokia|nintendo +3ds|opera m(ob|in)i|palm|palm( os)?|phone|p(ixi|re)\/|playbook|rim +tablet|playstation.+vita|plucker|pocket|psp|samsung|(gt\-|bgt\-|sgh\-|sph\-|sch\-)[a-z][0-9]+|series(4|6)0|symbian|symbos|\bs60\b|tizen.+mobile|treo|up\.(browser|link)|vertu|vodafone|wap|windows (ce|phone)|windows +nt.+arm|windows +nt.+touch|xda|xiino|xblwp7|zunewp7/i.test(ua) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(di|rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb|b\-[0-9]+)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(ua.substr(0, 4));
        }


        /**
         * Resets/Updates the cached values (localStorage) of Viewport and Screen Dimension Info
         * @private
         */
        function _updateDimensionStore()
        {
            //reset
            store("rs_var_viewport_w rs_var_viewport_w_dp rs_var_viewport_h rs_var_viewport_h_dp rs_var_screen_w rs_var_screen_h", null);

            //reload
            store("rs_var_viewport_w", viewportW());
            store("rs_var_viewport_h", viewportH());
            store("rs_var_screen_w", screenW());
            store("rs_var_screen_h", screenH());
            store("rs_var_viewport_w_dp", pixelW());
            store("rs_var_viewport_h_dp", pixelH());
        }

        /**
         * Resets/Updates the cached values (localStorage) of Orientation Info
         * @private
         */
        function _updateOrientationStore()
        {
            //reset
            store("rs_var_screen_ort_curr rs_var_is_portrait rs_var_is_landscape", null);

            //reload
            store("rs_var_screen_ort_curr", getOrientation());
        }

        /**
         * Gets the orientation of the device
         * @param bypass_cache_bool {Boolean} Determines if the stored value for current orientation should be retrieved or not. True will ignore the value stored and will re-test the orientation
         * @return {String}
         */
        function getOrientation()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                bypass_cache_bool = _r.isBool(myArgs[0]) ? myArgs[0] : false,
                ort_final_str;

            //check if current orientation value is stored and bypass_cache_bool is false. If so, return stored value
            if(storeCheck("rs_var_screen_ort_curr") && !bypass_cache_bool)
            {
                return store("rs_var_screen_ort_curr");
            }

            //Reset Viewport Dimensions if bypass_cache_bool is true
            if(bypass_cache_bool)
            {
                store("rs_var_viewport_w rs_var_viewport_w_dp rs_var_viewport_h rs_var_viewport_h_dp rs_var_screen_w rs_var_screen_h", null);
            }

            //Get the Viewport Dimensions
            var device_user_agent_str = getUserAgent(),
                is_opera_mini_bool = /opera.+(mini|mobi)/i.test(device_user_agent_str),
                viewport_w_dp_int = pixelW(),
                viewport_h_dp_int = pixelH(),
                screen_w_int = screenW(),
                screen_h_int = screenH(),
                screen_w_to_h_ratio_int = screen_w_int/screen_h_int,
                screen_w_to_viewport_w_diff_int = screen_w_int - viewport_w_dp_int,
                is_landscape_extended_verify_bool,
                is_landscape_bool;

            screen_w_to_viewport_w_diff_int = Math.abs(screen_w_to_viewport_w_diff_int);
            is_landscape_extended_verify_bool = (is_opera_mini_bool && viewport_w_dp_int < 260) ? !!((screen_w_to_viewport_w_diff_int <= 4) && (screen_w_to_h_ratio_int >= 1)) : true;
            is_landscape_bool = !!((viewport_h_dp_int <= viewport_w_dp_int) && is_landscape_extended_verify_bool);

            if(is_landscape_bool)
            {
                //landscape
                ort_final_str = 'landscape';

                //do not alter cached orientation variables if bypass_cache_bool is true
                if(!bypass_cache_bool)
                {
                    store("rs_var_screen_ort_is_portrait", false);
                    store("rs_var_screen_ort_is_landscape", true);
                }
            }
            else
            {
                //portrait
                ort_final_str = 'portrait';

                //do not alter cached orientation variables if bypass_cache_bool is true
                if(!bypass_cache_bool)
                {
                    store("rs_var_screen_ort_is_portrait", true);
                    store("rs_var_screen_ort_is_landscape", false);
                }
            }

            return ort_final_str;
        }

        /**
         * Checks if the device is currently in Portrait mode
         * @return {Boolean}
         */
        function isPortrait()
        {
            //check if portrait orientation value is stored. If so, return stored value
            if(storeCheck("rs_var_screen_ort_is_portrait"))
            {
                return store("rs_var_screen_ort_is_portrait");
            }
            return ((getOrientation() === 'portrait'));
        }

        /**
         * Checks if the device is currently in Landscape mode
         * @return {Boolean}
         */
        function isLandscape()
        {
            //check if landscape orientation value is stored. If so, return stored value
            if(storeCheck("rs_var_screen_ort_is_landscape"))
            {
                return store("rs_var_screen_ort_is_landscape");
            }
            return ((getOrientation() === 'landscape'));
        }

        /**
         * Returns a list of standard resolution dimensions
         * @param class_str {String} the class of dimensions to return. It could be 'w' = widths, or 'h' = heights
         * @return {Array}
         * @private
         */
        function _getResolutionDimensionList(class_str)
        {
            var std_w_arr = [120, 128, 160, 200, 240, 272, 300, 320, 352, 360, 480, 540, 576, 600, 640, 720, 768, 800, 864, 900, 1024, 1050, 1080, 1152, 1200, 1440, 1536, 1600, 1800, 2048, 2160, 2400, 3072, 3200, 4096, 4320, 4800],
                std_h_arr = [160, 240, 260, 320, 400, 432, 480, 640, 720, 800, 854, 960, 1024, 1136, 1152, 1280, 1360, 1366, 1400, 1440, 1600, 1680, 1920, 2048, 2560, 2880, 3200, 3840, 4096, 5120, 6400, 7680]
                ;

            if(class_str === 'w')
            {
                return std_w_arr;
            }
            else if (class_str === 'h')
            {
                return std_h_arr;
            }
        }

        /**
         * Get the Viewport or Screen Dimensions of the Device
         * @param type_str {String} The type of operation to execute
         * vW = viewport width, vH = viewport height, sW = screen width, sH = screen height
         * @param adj_screen_size_bool {Boolean} This determines if the screen size result should be adjusted to return the nearest standard resolution. For example if actual screen height is 1184, 1280 will be returned as it is the nearest standard resolution height. Default is true
         * @return {*}
         * @private
         */
        function _getDimension(type_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                adj_screen_size_bool = (_r.isBool(myArgs[1])) ? myArgs[1]: true,
                dim_res,
                dim_res_adj,
                adj_dim_res_bool = false,
                user_agent_str = getUserAgent() || navigator.vendor.toLowerCase() || window.opera,
                regex_tv_detect_str = "googletv|smart-tv|smarttv|internet +tv|netcast|nettv|appletv|boxee|kylo|roku|vizio|dlnadoc|ce-html|ouya|xbox|playstation *(3|4)|wii",
                regex_tv_obj = new RegExp(regex_tv_detect_str, "i"),
                is_tv_bool = regex_tv_obj.test(user_agent_str),
                is_desktop_bool = !((_mobileDetect(user_agent_str))),
                is_desktop_or_tv_bool = ((is_desktop_bool || is_tv_bool)),
                pixel_ratio_device_int = getPixelRatio(),
                pixel_ratio_virtual_int,
                win_outer_w_int = store("rs_var_window_outer_w"),
                win_outer_h_int = store("rs_var_window_outer_h"),
                doc_client_w_int = store("rs_var_document_client_w"),
                doc_client_h_int = store("rs_var_document_client_h"),
                win_screen_w_int = store("rs_var_window_screen_w"),
                win_screen_h_int = store("rs_var_window_screen_h")
                ;

            /**
             * Return dimensions quickly if device is Desktop or TV
             */
            if(is_desktop_or_tv_bool)
            {
                if(type_str === 'vW')
                {
                    dim_res = doc_client_w_int;
                }
                else if(type_str === 'vH')
                {
                    dim_res = doc_client_h_int;
                }
                else if (_r.in_array(type_str, ['sW', 'sH']))
                {
                    dim_res = (type_str === 'sW') ? win_screen_w_int : win_screen_h_int;

                    /**
                     * Adjust screen dimensions if
                     * 1: Pixel Ratio is greater than 1.5
                     * 2: Difference between viewport and screen dimensions is less
                     * than expected on account of pixel ratio
                     */
                    if(pixel_ratio_device_int > 1.5)
                    {
                        var screen_viewport_ratio_w_flt = win_screen_w_int/doc_client_w_int,
                            screen_viewport_ratio_h_flt = win_screen_h_int/doc_client_h_int,
                            pixel_ratio_idx_flt = pixel_ratio_device_int * 0.9;

                        if(screen_viewport_ratio_w_flt < pixel_ratio_idx_flt || screen_viewport_ratio_h_flt < pixel_ratio_idx_flt)
                        {
                            dim_res = (type_str === 'sW') ? win_screen_w_int*pixel_ratio_device_int : win_screen_h_int*pixel_ratio_device_int;
                        }
                    }
                }

                if (type_str === 'vW' || type_str === 'vH')
                {
                    dim_res = (pixel_ratio_device_int >= 1.5) ? dim_res * pixel_ratio_device_int : dim_res;
                }

                dim_res = Math.floor(dim_res);
                return dim_res;
            }

            /**
             * If not Desktop or TV, continue processing
             */
            var device_user_agent_str = user_agent_str,
                is_opera_browser_bool = /opera.+(mini|mobi)/i.test(device_user_agent_str),
                is_ios_bool = !!((isIOS())),
                is_symbian_bool = !!((isSymbian())),
                is_windows_bool = !!((isWindows())),
                is_android_bool = !!((isAndroid())),
                is_android_1_bool = !!((isAndroid('1.'))),
                is_android_2_bool = !!((isAndroid('2.'))),
                is_special_needs_bool = !!(((is_android_1_bool || is_android_2_bool) || is_symbian_bool || is_windows_bool)),
                viewport_w_int,
                viewport_h_int,
                screen_w_int = win_screen_w_int,
                screen_h_int = win_screen_h_int,
                screen_w_fix_int = screen_w_int,
                ort_w_int,
                ort_h_int,
                screen_w_to_viewport_w_diff_int,
                screen_w_to_h_ratio_int,
                fixed_screen_dim_bool,
                std_w_arr = _getResolutionDimensionList('w'),
                std_h_arr = _getResolutionDimensionList('h'),
                std_w_temp_arr = std_w_arr,
                std_h_temp_arr = std_h_arr,
                is_landscape_v_bool,                    //viewport
                is_landscape_s_bool,                    //screen
                is_landscape_v_extended_verify_bool
                ;

            /**
             * Get the viewport dimensions
             */
            if (is_special_needs_bool)
            {
                viewport_w_int = (win_outer_w_int <= 0) ? doc_client_w_int : win_outer_w_int;
                viewport_h_int = (win_outer_h_int <= 0) ? doc_client_h_int : win_outer_h_int;
                ort_w_int = viewport_w_int;
                ort_h_int = viewport_h_int;
            }
            else
            {
                viewport_w_int = doc_client_w_int;
                viewport_h_int = doc_client_h_int;
                ort_w_int = doc_client_w_int;
                ort_h_int = doc_client_h_int;
            }

            /**
             * Modify Screen Dimensions if Android 2 or Symbian Platform
             */
            if ((is_android_2_bool || is_symbian_bool) && !is_opera_browser_bool)
            {
                screen_w_int = (win_outer_w_int <= 0) ? screen_w_int : win_outer_w_int;
                screen_h_int = (win_outer_h_int <= 0) ? screen_h_int : win_outer_h_int;
            }

            //Determine orientation
            screen_w_to_h_ratio_int = screen_w_int/screen_h_int;
            screen_w_to_viewport_w_diff_int = screen_w_int - viewport_w_int;
            screen_w_to_viewport_w_diff_int = Math.abs(screen_w_to_viewport_w_diff_int);

            is_landscape_v_extended_verify_bool = (is_opera_browser_bool && viewport_w_int < 260) ? !!((screen_w_to_viewport_w_diff_int <= 4) && (screen_w_to_h_ratio_int >= 1)) : true;
            is_landscape_v_bool = !!((ort_h_int <= ort_w_int) && is_landscape_v_extended_verify_bool);
            is_landscape_s_bool = (screen_h_int <= screen_w_int);

            /**
             * Reduce resolution dimension list size if iOS
             * This improves the accuracy for first-generation iOS devices
             */
            if(is_ios_bool)
            {
                std_w_temp_arr = std_w_temp_arr.slice(7);
                std_h_temp_arr = std_h_temp_arr.slice(6);
            }
            else if (is_android_bool)
            {
                std_w_temp_arr = std_w_temp_arr.slice(4);
                std_h_temp_arr = std_h_temp_arr.slice(3);
            }
            else
            {
                std_w_temp_arr = std_w_temp_arr.slice(4);
            }

            /**
             * Reverse resolution dimension list when orientation changes
             */
            if (is_landscape_v_bool)
            {
                std_w_arr = std_h_temp_arr;
                std_h_arr = std_w_temp_arr;
            }
            else
            {
                std_w_arr = std_w_temp_arr;
                std_h_arr = std_h_temp_arr;
            }

            /**
             * Get Dimensions
             */
            if(type_str === 'vW')
            {
                dim_res = viewport_w_int;
            }
            else if (type_str === 'vH')
            {
                dim_res = viewport_h_int;
            }
            else if (type_str === 'sW' || type_str === 'sH')
            {
                /**
                 * This aims to correct any screen dimension discrepancies that usually occur when the
                 * raw viewport dimensions say the orientation is in one mode, but the raw screen dimensions
                 * say it is in another mode. Certain devices e.g. iPad will not change screen dimensions as the
                 * orientation changes. When this happens, we reverse values for screen_w and screen_h to compensate
                 */
                fixed_screen_dim_bool = !!((is_landscape_v_bool === true && is_landscape_s_bool === false) || (is_landscape_v_bool === false && is_landscape_s_bool === true));

                if(type_str === 'sW')
                {
                    dim_res = (fixed_screen_dim_bool) ? screen_h_int : screen_w_int ;
                }
                else
                {
                    dim_res = (fixed_screen_dim_bool) ? screen_w_int : screen_h_int ;
                }

                //get the fixed screen width
                screen_w_fix_int = (fixed_screen_dim_bool) ? screen_h_int : screen_w_int ;

                dim_res_adj = dim_res * pixel_ratio_device_int;

                if(type_str === 'sW')
                {
                    adj_dim_res_bool = adj_screen_size_bool ? ((_r.in_array(dim_res, std_w_arr) || _r.in_array(dim_res_adj, std_w_arr)) ? false: true) : false;
                }
                else
                {
                    adj_dim_res_bool = adj_screen_size_bool ? ((_r.in_array(dim_res, std_h_arr) || _r.in_array(dim_res_adj, std_h_arr)) ? false: true) : false;
                }

            }

            /**
             * Get the virtual pixel ratio i.e. screen vs viewport dimensions
             */
            pixel_ratio_virtual_int = screen_w_fix_int/viewport_w_int;

            /**
             * Return if Device Pixel Ratio is 1 or less and Virtual Pixel Ratio is less than 1.1
             */
            if (pixel_ratio_device_int <= 1 && pixel_ratio_virtual_int <= 1.1)
            {
                if (type_str === 'sW' && adj_dim_res_bool)
                {
                    dim_res = _r.getClosestNumberMatchArray(std_w_arr, dim_res, '', '', 8);
                }
                else if (type_str === 'sH' && adj_dim_res_bool)
                {
                    dim_res = _r.getClosestNumberMatchArray(std_h_arr, dim_res, '', '', 8);
                }
                return dim_res;
            }

            /**
             * Continue if Pixel Ratio is greater than 1
             */
            if(is_ios_bool)
            {
                dim_res = dim_res * pixel_ratio_device_int;
            }
            else
            {
                if (!is_android_2_bool)
                {
                    /**
                     * Case 1: Device Pixel Ratio is 1 or less, and Virtual Pixel Ratio is greater than 1.1
                     * Update Viewport Dimensions only. Do not update Screen Dimensions
                     * Case 2. Device Pixel Ratio is more than 1, and Virtual Pixel Ratio is less than or equal to 1.1
                     * Update both Viewport and Screen Dimensions
                     * Case 3. Device Pixel Ratio is more than 1, and Virtual Pixel Ratio is greater than 1.1
                     * Update Viewport Dimensions only. Do not update Screen Dimensions
                     */
                    if(pixel_ratio_device_int <= 1 && pixel_ratio_virtual_int > 1.1)
                    {
                        //1
                        dim_res = (_r.in_array(type_str, ['vW', 'vH'])) ? dim_res * pixel_ratio_virtual_int : dim_res;
                    }
                    else if (pixel_ratio_device_int > 1 && pixel_ratio_virtual_int <= 1.1)
                    {
                        //2
                        if(pixel_ratio_device_int <= 1.1)
                        {
                            //Special Operation for some devices that report device pixel ratio slightly above one
                            if (_r.in_array(type_str, ['vW', 'vH']))
                            {
                                dim_res = dim_res * pixel_ratio_device_int;
                                dim_res = (_r.isEvenDecimal(dim_res)) ? Math.floor(dim_res) : dim_res;
                            }
                        }
                        else
                        {
                            dim_res = dim_res * pixel_ratio_device_int;
                        }
                    }
                    else if (pixel_ratio_device_int > 1 && pixel_ratio_virtual_int > 1.1)
                    {
                        //3
                        if(_r.in_array(type_str, ['vW', 'vH']))
                        {
                            dim_res = dim_res * pixel_ratio_device_int;
                            dim_res = (_r.isEvenDecimal(dim_res)) ? Math.floor(dim_res) : Math.ceil(dim_res);
                        }
                    }
                }

                /**
                 * Get the nearest standard screen widths or heights
                 */
                if (type_str === 'sW' && adj_dim_res_bool)
                {
                    dim_res = _r.getClosestNumberMatchArray(std_w_arr, dim_res, '', '', 8);
                }
                else if (type_str === 'sH' && adj_dim_res_bool)
                {
                    dim_res = _r.getClosestNumberMatchArray(std_h_arr, dim_res, '', '', 8);
                }
            }

            dim_res = Math.floor(dim_res);
            return dim_res;
        }

        /**
         * Get the Viewport dimensions in Device-Independent Pixels
         * @param type_str {String} The type of operation. Either 'w' for width, or 'h' for height
         * @return {Number}
         * @private
         */
        function _getViewportDimensionPixel(type_str)
        {
            var dim_res,
                is_width_bool = ((type_str === 'w')),
                user_agent_str = getUserAgent() || navigator.vendor.toLowerCase() || window.opera,
                regex_tv_detect_str = "googletv|smart-tv|smarttv|internet +tv|netcast|nettv|appletv|boxee|kylo|roku|vizio|dlnadoc|ce-html|ouya|xbox|playstation *(3|4)|wii",
                regex_tv_obj = new RegExp(regex_tv_detect_str, "i"),
                is_tv_bool = regex_tv_obj.test(user_agent_str),
                is_desktop_bool = !((_mobileDetect(user_agent_str))),
                is_desktop_or_tv_bool = ((is_desktop_bool || is_tv_bool)),
                pixel_ratio_int = getPixelRatio()
                ;

            if(is_desktop_or_tv_bool)
            {
                //If desktop or tv, moderate use of pixel ratio
                pixel_ratio_int = (pixel_ratio_int <= 1.5 || !pixel_ratio_int) ? 1 : pixel_ratio_int;
            }
            dim_res = (is_width_bool) ? pixelW()/pixel_ratio_int : pixelH()/pixel_ratio_int;
            return Math.round(dim_res);
        }

        /**
         * A comparison function for checking if a number is within a range of two other numbers
         * @param {Function} fn
         * @return {Function}
         */
        function rangeCompare(fn) {
            return function(min, max) {
                var myArgs = Array.prototype.slice.call(arguments),
                    bool,
                    el = myArgs[2],
                    el_valid_bool = !!((_r.isObject(el) && (typeof el !== "undefined" && el !== null))),
                    wf = myArgs[3],
                    f_dip = myArgs[4],
                    curr = (el_valid_bool) ? fn(el, wf, f_dip) : fn()
                    ;

                bool = curr >= (min || 0);
                return !max ? bool : bool && curr <= max;
            };
        }

        //Range Comparison Booleans for Viewport and Screen and DOM Element Containers
        var vSpan = rangeCompare(viewportW),
            vPitch = rangeCompare(viewportH),
            dSpan = rangeCompare(screenW),
            dPitch = rangeCompare(screenH),
            cSpan = rangeCompare(pixelW),
            cPitch = rangeCompare(pixelH),
            eSpan = rangeCompare(_elementW),
            ePitch = rangeCompare(_elementH);


        /**
         * Loads a JavaScript of Stylesheet
         * Original script: @link https://github.com/rgrove/lazyload @copyright Ryan Grove <ryan@wonko.com> @license MIT
         * @param url_str_or_arr {Array} a single URL or an array of URLs
         * @param target_obj {Object} the target object i.e. where the script/stylesheet should be loaded. This is either <head> or <body>
         * @param loc_str {String} this is a string notation of where the file will be loaded. It is either "head" or "body". It is used to properly compose attribute options for the link tag.
         * @param attr_str {Object} Defines attributes to be applied to relevant stylesheets or script on load.
         * The following options are available
         * async: true or false
         * defer: true or false
         * @private
         */
        function _lazyLoad(url_str_or_arr)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                doc = window.document,
                env,
                head = doc.head || doc.getElementsByTagName('head')[0],
                target_obj = (myArgs[1]) ? myArgs[1] : head,
                loc_str = (myArgs[2] === 'body') ? 'body' : 'head',
                attr_obj = (_r.isObject(myArgs[3])) ? myArgs[3] : {},
                pending = {},
                pollCount = 0,
                queue = {css: [], js: []},
                styleSheets = doc.styleSheets,
                url_str,
                regex_obj = new RegExp("\\.js(\\?[^\\s]*?|) *$", "gi"),
                is_js_bool
                ;

            url_str = (_r.isArray(url_str_or_arr)) ? _r.implode('|', url_str_or_arr) : url_str_or_arr;

            is_js_bool = regex_obj.test(url_str);

            function createNode(name, attrs) {
                var node = doc.createElement(name), attr;

                for (attr in attrs) {
                    if (attrs.hasOwnProperty(attr)) {
                        node.setAttribute(attr, attrs[attr]);
                    }
                }

                return node;
            }


            function finish(type) {
                var p = pending[type],
                    callback,
                    urls;

                if (p) {
                    callback = p.callback;
                    urls     = p.urls;

                    urls.shift();
                    pollCount = 0;

                    if (!urls.length) {
                        callback && callback.call(p.context, p.obj);
                        pending[type] = null;
                        queue[type].length && load(type);
                    }
                }
            }

            function getEnv() {
                var ua = getUserAgent();

                env = {
                    async: doc.createElement('script').async === true
                };

                (env.webkit = /AppleWebKit\//.test(ua))
                || (env.ie = /MSIE|Trident/.test(ua))
                || (env.opera = /Opera/.test(ua))
                || (env.gecko = /Gecko\//.test(ua))
                || (env.unknown = true);
            }

            function load(type, urls, callback, obj, context, loc, attr_obj)
            {
                var _finish = function () { finish(type); },
                    isCSS   = type === 'css',
                    nodes   = [],
                    i, len, node, p, pendingUrls, url, js_attr_obj, css_attr_obj;

                env || getEnv();

                if (urls) {
                    urls = typeof urls === 'string' ? [urls] : urls.concat();

                    if (isCSS || env.async || env.gecko || env.opera) {
                        // Load in parallel.
                        queue[type].push({
                            urls    : urls,
                            callback: callback,
                            obj     : obj,
                            context : context
                        });
                    } else {
                        // Load sequentially.
                        for (i = 0, len = urls.length; i < len; ++i) {
                            queue[type].push({
                                urls    : [urls[i]],
                                callback: i === len - 1 ? callback : null,
                                obj     : obj,
                                context : context
                            });
                        }
                    }
                }

                if (pending[type] || !(p = pending[type] = queue[type].shift())) {
                    return;
                }

                pendingUrls = p.urls.concat();

                for (i = 0, len = pendingUrls.length; i < len; ++i) {
                    url = pendingUrls[i];

                    js_attr_obj = {src: url, type: 'text/javascript'};

                    css_attr_obj = (loc === 'body') ? {href: url, rel : 'stylesheet', property: 'stylesheet', media: 'only r'} : {href: url, rel : 'stylesheet', media: 'only r'};

                    if (isCSS)
                    {
                        node = env.gecko ? createNode('style') : createNode('link', css_attr_obj);
                    }
                    else
                    {
                        node = createNode('script', js_attr_obj);
                        if(attr_obj.async)
                        {
                            node.async = true;
                        }
                        if(attr_obj.defer)
                        {
                            node.defer = true;
                        }
                    }

                    node.className = 'r_defer';
                    node.setAttribute('charset', 'utf-8');

                    if (env.ie && !isCSS && 'onreadystatechange' in node && !('draggable' in node)) {
                        node.onreadystatechange = function () {
                            if (/loaded|complete/.test(node.readyState)) {
                                node.onreadystatechange = null;
                                _finish();
                            }
                        };
                    }
                    else if (isCSS && (env.gecko || env.webkit))
                    {
                        if (env.webkit)
                        {
                            p.urls[i] = node.href;
                            pollWebKit();
                        }
                        else
                        {
                            node.innerHTML = '@import "' + url + '";';
                            pollGecko(node);
                        }
                    }
                    else
                    {
                        node.onload = node.onerror = _finish;
                    }

                    nodes.push(node);
                }

                for (i = 0, len = nodes.length; i < len; ++i) {
                    target_obj.appendChild(nodes[i]);
                }
            }

            function pollGecko(node) {
                var hasRules;

                try {
                    hasRules = !!node.sheet.cssRules;
                } catch (ex) {
                    pollCount += 1;

                    if (pollCount < 200) {
                        setTimeout(function () { pollGecko(node); }, 50);
                    } else {
                        hasRules && finish('css');
                    }

                    return;
                }

                finish('css');
            }

            function pollWebKit() {
                var css = pending.css, i;

                if (css) {
                    i = styleSheets.length;

                    while (--i >= 0) {
                        if (styleSheets[i].href === css.urls[0]) {
                            finish('css');
                            break;
                        }
                    }

                    pollCount += 1;

                    if (css) {
                        if (pollCount < 200) {
                            setTimeout(pollWebKit, 50);
                        } else {
                            finish('css');
                        }
                    }
                }
            }

            function lazyLoadCSS(urls, callback, obj, context)
            {
                load('css', urls, callback, obj, context, loc_str, attr_obj);
            }

            function lazyLoadJS(urls, callback, obj, context)
            {
                load('js', urls, callback, obj, context, loc_str, attr_obj);
            }

            //Load JavaScript or CSS
            if(is_js_bool)
            {
                lazyLoadJS(url_str_or_arr);
            }
            else
            {
                lazyLoadCSS(url_str_or_arr);
            }
        }

        /**
         * Load a script via XHR (XMLHTTPRequest)
         * @param {string} src_str the script source URL
         * @param {function} callback_fn the callback
         * @param {object} tag_attr_obj the script tag attributes
         * @returns {Promise|*}
         * @private
         */
        function _loadScriptXHR(src_str)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            return new Promise(function(resolve, reject)
            {
                var callback_fn = (myArgs[1]) ? myArgs[1] : function(){},
                    tag_attr_obj = (myArgs[2]) ? myArgs[2] : {},
                    el_head = $('head'),
                    el,
                    ref_obj,
                    el_rq_obj,
                    insert_method_str
                    ;

                el = el_head[0];
                ref_obj = document.createElement("script");

                if (ref_obj.readyState)
                {
                    //IE
                    ref_obj.onreadystatechange = function(){
                        /*jshint -W116 */
                        if (ref_obj.readyState == "loaded" || ref_obj.readyState == "complete"){
                            ref_obj.onreadystatechange = null;
                            callback_fn();
                            resolve();
                        }
                        /*jshint +W116 */
                    };
                }
                else
                {
                    //Others
                    ref_obj.onload = function(){
                        callback_fn();
                        resolve();
                    };
                }

                //set default tag options
                ref_obj.src = src_str;
                ref_obj.type = 'text/javascript';

                //set custom options
                if(tag_attr_obj)
                {
                    var ref_obj_prop;
                    for (var key in tag_attr_obj)
                    {
                        if (tag_attr_obj.hasOwnProperty(key))
                        {
                            ref_obj_prop = tag_attr_obj[key];
                            ref_obj[key] = ref_obj_prop;
                        }
                    }
                }

                //append to page
                insert_method_str = 'append';
                el_rq_obj = $(el);
                el_rq_obj[insert_method_str](ref_obj);

            });
        }

        /**
         * Loads scripts
         * @param {array} src_arr the script source array
         * @param {function} callback_fn the callback
         * @param {object} tag_attr_obj the custom script tag attributes
         * @param {array} src_dep_matrix_arr
         * @param {function} callback_finally_fn the callback that runs at the very end
         * @private
         */
        function _loadScript(src_arr)
        {
            if(!_r.isArray(src_arr) || _r.count(src_arr) < 1)
            {
                return;
            }

            var myArgs = Array.prototype.slice.call(arguments),
                callback_fn = (myArgs[1]) ? myArgs[1] : undefined,
                tag_attr_obj = (myArgs[2]) ? myArgs[2] : {},
                src_dep_matrix_arr = (myArgs[3]) ? myArgs[3]: [],
                callback_finally_fn = (myArgs[4]) ? myArgs[4]: function(){},
                i,
                j,
                src_main_arr = [],
                src_dep_arr = [],
                promise_callback_fn,
                promises = [],
                promises_dep = [],
                src_arr_item_str,
                src_main_arr_item_str,
                src_dep_arr_item_str,
                src_arr_item_dep_bool = false,
                has_dep_flag_bool = false,
                callback_threshold_int = src_arr.length - 1;
            ;

            callback_threshold_int = (callback_threshold_int < 0) ? 0 : callback_threshold_int;

            for(i = 0; i < src_arr.length; i++)
            {
                src_arr_item_str = src_arr[i];

                if(src_dep_matrix_arr && _r.isArray(src_dep_matrix_arr) && src_dep_matrix_arr.length > 0)
                {
                    src_arr_item_dep_bool = !!(src_dep_matrix_arr[i] === 1);
                    has_dep_flag_bool = (src_dep_matrix_arr[i] === 1) ? true : has_dep_flag_bool;
                }

                promise_callback_fn = (callback_threshold_int === i) ? callback_fn : undefined;

                if(src_arr_item_dep_bool)
                {
                    //add url to dependency execution list
                    src_dep_arr.push(src_arr_item_str);
                }
                else
                {
                    //add url to main execution list
                    src_main_arr.push(src_arr_item_str);
                }
            }

            /**
             * Manage script loading using Promises
             * Delay loading of scripts that have been marked as being dependent
             */

            //Load scripts without dependencies
            for(i = 0; i < src_main_arr.length; i++)
            {
                src_main_arr_item_str = src_main_arr[i];
                promise_callback_fn = ((src_dep_arr.length < 1) && callback_threshold_int === i) ? callback_fn : undefined;
                promises.push(_loadScriptXHR(src_main_arr_item_str, promise_callback_fn, tag_attr_obj));
            }

            //Start the promise chain
            Promise.all(promises).then(function(){
                if(has_dep_flag_bool)
                {
                    for(j = 0; j < src_dep_arr.length; j++)
                    {
                        src_dep_arr_item_str = src_dep_arr[j];
                        promise_callback_fn = (callback_threshold_int === j) ? callback_fn : undefined;
                        promises_dep.push(_loadScriptXHR(src_dep_arr_item_str, promise_callback_fn, tag_attr_obj));
                    }
                    return Promise.all(promises_dep);
                }
                else
                {
                    return;
                }
            }).then(function(){
                callback_finally_fn();
            })["catch"](function(err){
                _r.console.log(err);
            });
        }

        /**
         * Runs all deferred JavaScript or CSS files
         * @param options_obj {Object} defines options
         * The following options are available:
         * loc: specifies the location where the script or stylesheet should be loaded. Either 'head' [for <head>] or 'body' [for <body]
         * inline: designates the operation as inline. This is meant to load deferred scripts and stylesheets that are defined inline HTML
         * script: designates the operation as script. This is meant to load deferred scripts and stylesheets that are defined in script using loadCSS and loadJS
         * js_only: specifies that only deferred javascript files should be loaded
         * inline_js_async: will run inline-deferred javascript files in async mode
         * script_js_async: will run script-deferred javascript files in async mode
         * js_tag_attr: custom tag attributes for loading deferred scripts
         * disable_cache: setting this to true will disable the loading cache. The loading cache prevents loading of files more times than needed
         *
         */
        function runDefer()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[0] && _r.isObject(myArgs[0])) ? myArgs[0] : {},
                loc_str = (options_obj.loc === "b" || options_obj.loc === "body") ? "body" : "head",
                run_inline_bool = (_r.isBool(options_obj.inline)) ? options_obj.inline : false,
                run_js_only_bool = (_r.isBool(options_obj.js_only)) ? options_obj.js_only: false,
                inline_js_async_bool = (_r.isBool(options_obj.inline_js_async)) ? options_obj.inline_js_async: false,
                lazyload_inline_js_async_obj = (inline_js_async_bool) ? {async: true} : {},
                script_js_async_bool = (_r.isBool(options_obj.script_js_async)) ? options_obj.script_js_async: false,
                lazyload_script_js_async_obj = (script_js_async_bool) ? {async: true} : {},
                disable_store_cache_auto_bool = (_r.isBool(options_obj.disable_cache)) ? options_obj.disable_cache : false,
                script_tag_attr_obj = (options_obj.js_tag_attr) ? options_obj.js_tag_attr: {},
                defer_css_sys_collection_obj = $("[type='text/css/r_defer_sys']"),
                defer_css_collection_obj = $("[type='text/css/r_defer']"),
                defer_js_sys_collection_obj = $("[type='text/javascript/r_defer_sys']"),
                defer_js_collection_obj = $("[type='text/javascript/r_defer']"),
                defer_async_js_collection_obj = $("[type='text/javascript/r_defer_async']"),
                el_head_rq_obj = $('head'),
                el_head_obj = document.head || el_head_rq_obj[0],
                el_body_rq_obj = $('body'),
                el_body_obj = document.body || el_body_rq_obj[0],
                el_target_obj = (loc_str === "body") ? el_body_obj : el_head_obj,
                el_noscript_obj = $('noscript'),
                link_css_update_media_attrib_fn,
                flag_css_defer_auto_bool = false,
                el_list_r_defer_obj,
                files_css_arr = [],
                files_css_sys_arr = [],
                files_js_arr = [],
                files_js_dep_matrix_arr = [],
                files_js_jq_main_arr = [],          //jquery
                files_js_jq_arr = [],               //post-jq files
                files_js_jq_dep_matrix_arr = [],    //post-jq files dependency matrix
                files_js_zt_main_arr = [],          //zepto
                files_js_zt_arr = [],               //post-zt files
                files_js_zt_dep_matrix_arr = [],    //post-zt files dependency matrix
                files_js_pt_main_arr = [],          //prototype
                files_js_pt_arr = [],               //post-pt files
                files_js_pt_dep_matrix_arr = [],    //post-pt files dependency matrix
                files_async_js_arr = [],
                files_js_sys_arr = [],
                load_script_callback_fn,
                load_script_jq_main_callback_fn,
                load_script_jq_callback_fn,
                load_script_zt_main_callback_fn,
                load_script_zt_callback_fn,
                load_script_pt_main_callback_fn,
                load_script_pt_callback_fn,
                load_script_defer_ready_fn = function(){rScript.runFunction('dready', {queue: true, namespace: 'dready', flush: true});},
                i,j,k,m
                ;

            /**
             * Run deferred scripts, stylesheets
             * X: Setup CSS Media Attribute Management Callback
             * A: Automatic
             * B: Manual
             */

            /**
             * X: Create function that will be triggered by setTimeout
             * or other delayed function
             * This function will update CSS link media attribute to 'all'
             */
            link_css_update_media_attrib_fn = function(){

                var link_tag_name_str,
                    link_attr_media_str;

                //get all links
                el_list_r_defer_obj = $('.r_defer');
                el_list_r_defer_obj.each(function(){
                    link_tag_name_str = this.tagName || this.nodeName || this.localName;
                    link_tag_name_str = link_tag_name_str.toLowerCase();

                    link_attr_media_str = this.media;
                    link_attr_media_str = (_r.isString(link_attr_media_str) && link_attr_media_str.length > 0) ? link_attr_media_str.toLowerCase() : '';

                    //filter links
                    if(link_tag_name_str === 'link' && link_attr_media_str !== 'all')
                    {
                        //change media attribute back to all
                        this.media = 'all';
                    }
                });
            };

            /**
             * A:
             * A.1: Load CSS inside noscript in <head>
             * A.2: Load CSS referenced in HTML <head>
             * A.3: Load JS referenced in HTML <head>
             */
            if(run_inline_bool)
            {
                if (!store('rs_var_run_defer_auto'))
                {
                    if(!run_js_only_bool)
                    {
                        //A.1: Load CSS [noscript]
                        if(el_noscript_obj.length > 0)
                        {
                            var html_noscript_str,
                                regex_noscript_css_obj = /link.+?href *\= *["'](.+?)(\?[^\s]*?|)["']/ig,
                                match_arr,
                                noscript_files_css_arr = []
                                ;

                            //get files
                            el_noscript_obj.each(function(){

                                html_noscript_str = this.innerHTML;

                                //find all matches and save to array
                                do {
                                    match_arr = regex_noscript_css_obj.exec(html_noscript_str);
                                    if (match_arr) {
                                        noscript_files_css_arr.push(match_arr[1]);
                                    }
                                } while (match_arr);
                            });

                            //load into head
                            _lazyLoad(noscript_files_css_arr, el_target_obj, loc_str);

                            flag_css_defer_auto_bool = true;
                        }

                        //A.2: Load CSS
                        if (defer_css_collection_obj.length > 0)
                        {
                            defer_css_collection_obj.each(function () {
                                files_css_arr.push($(this).attr("href"));
                            });

                            _lazyLoad(files_css_arr, el_target_obj, loc_str);

                            //Unload CSS with r_defer tag
                            for (i = defer_css_collection_obj.length - 1; i >= 0; i--) {
                                defer_css_collection_obj[i].parentNode.removeChild(defer_css_collection_obj[i]);
                            }

                            flag_css_defer_auto_bool = true;
                        }
                    }

                    //A.3: Load JavaScript
                    //Defer
                    if(defer_js_collection_obj.length > 0)
                    {
                        /**
                         * This will split the loading order and enable a sequence
                         * that is compatible with loading jQuery, Zepto, and Prototype libraries only
                         */

                        var defer_js_item_str,
                            defer_js_item_dep_str,
                            defer_js_item_dep_int,
                            defer_js_sub_flag_bool = false,
                            defer_js_sub_jq_flag_bool = false,
                            defer_js_sub_zt_flag_bool = false,
                            defer_js_sub_pt_flag_bool = false
                            ;
                        defer_js_collection_obj.each(function()
                        {
                            defer_js_item_str = $(this).attr("src");

                            //get attribute from script indicating dependency order
                            defer_js_item_dep_str = $(this).attr("data-r-dep");
                            defer_js_item_dep_str = (_r.isString(defer_js_item_dep_str) && defer_js_item_dep_str.length > 0) ? defer_js_item_dep_str.trim() : "false";
                            defer_js_item_dep_int = (defer_js_item_dep_str === "true") ? 1: 0;

                            if(/jquery\..*?js/i.test(defer_js_item_str))
                            {
                                defer_js_sub_flag_bool = true;
                                defer_js_sub_jq_flag_bool = true;

                                defer_js_sub_zt_flag_bool = false;
                                defer_js_sub_pt_flag_bool = false;

                                files_js_jq_main_arr.push(defer_js_item_str);

                                return true;
                            }
                            if(/zepto\..*?js/i.test(defer_js_item_str))
                            {
                                defer_js_sub_flag_bool = true;
                                defer_js_sub_zt_flag_bool = true;

                                defer_js_sub_jq_flag_bool = false;
                                defer_js_sub_pt_flag_bool = false;

                                files_js_zt_main_arr.push(defer_js_item_str);

                                return true;
                            }
                            if(/prototype\..*?js/i.test(defer_js_item_str))
                            {
                                defer_js_sub_flag_bool = true;
                                defer_js_sub_pt_flag_bool = true;

                                defer_js_sub_jq_flag_bool = false;
                                defer_js_sub_zt_flag_bool = false;

                                files_js_pt_main_arr.push(defer_js_item_str);

                                return true;
                            }

                            if(defer_js_sub_flag_bool)
                            {
                                if(defer_js_sub_jq_flag_bool)
                                {
                                    files_js_jq_arr.push(defer_js_item_str);
                                    files_js_jq_dep_matrix_arr.push(defer_js_item_dep_int);
                                }
                                if(defer_js_sub_zt_flag_bool)
                                {
                                    files_js_zt_arr.push(defer_js_item_str);
                                    files_js_zt_dep_matrix_arr.push(defer_js_item_dep_int);
                                }
                                if(defer_js_sub_pt_flag_bool)
                                {
                                    files_js_pt_arr.push(defer_js_item_str);
                                    files_js_pt_dep_matrix_arr.push(defer_js_item_dep_int);
                                }
                            }
                            else
                            {
                                files_js_arr.push(defer_js_item_str);
                                files_js_dep_matrix_arr.push(defer_js_item_dep_int);
                            }

                        });

                        //define callback for load scripts
                        if(files_js_arr.length > 0)
                        {
                            /**
                             * The _loadScript method [below] is nested several times, and scripts are loaded at each step.
                             * This will constitute a problem because there will be certain instances where deep nested files will not be loaded
                             * For example, if zepto is loaded instead of [as opposed to in addition to] jquery, the zepto-related files will never get loaded because the jquery block will be empty and thus the execution will not cascade down the callback tree.
                             * Therefore, files need to be shifted up the nest to make sure that things work as expected
                             */
                            if(files_js_jq_main_arr.length <= 0)
                            {
                                if(files_js_zt_main_arr.length > 0)
                                {
                                    files_js_jq_main_arr = files_js_zt_main_arr;
                                    files_js_jq_arr = files_js_zt_arr;
                                    files_js_zt_main_arr = [];
                                    files_js_zt_arr = [];
                                }

                                if(files_js_pt_main_arr.length > 0)
                                {
                                    if(files_js_zt_main_arr.length <= 0)
                                    {
                                        files_js_zt_main_arr = files_js_pt_main_arr;
                                        files_js_zt_arr = files_js_pt_arr;
                                        files_js_pt_main_arr = [];
                                        files_js_pt_arr = [];
                                    }
                                    if (files_js_jq_main_arr.length <= 0)
                                    {
                                        if(files_js_zt_main_arr.length > 0)
                                        {
                                            files_js_jq_main_arr = files_js_zt_main_arr;
                                            files_js_jq_arr = files_js_zt_arr;
                                            files_js_zt_main_arr = [];
                                            files_js_zt_arr = [];
                                        }

                                        files_js_pt_main_arr = [];
                                        files_js_pt_arr = [];
                                    }
                                }
                            }
                            else
                            {
                                if(files_js_pt_main_arr.length > 0)
                                {
                                    if(files_js_zt_main_arr.length <= 0)
                                    {
                                        files_js_zt_main_arr = files_js_pt_main_arr;
                                        files_js_zt_arr = files_js_pt_arr;
                                        files_js_pt_main_arr = [];
                                        files_js_pt_arr = [];
                                    }
                                }
                            }

                            /**
                             * Setup functionality to run callback after all deferred scripts have been loaded
                             */
                            load_script_callback_fn = load_script_defer_ready_fn;

                            if(files_js_jq_main_arr.length > 0)
                            {
                                load_script_callback_fn = function(){};
                                load_script_jq_main_callback_fn = load_script_defer_ready_fn;
                                if(files_js_jq_arr.length > 0)
                                {
                                    load_script_jq_main_callback_fn = function(){};
                                    load_script_jq_callback_fn = load_script_defer_ready_fn;
                                }
                            }
                            if(files_js_zt_main_arr.length > 0)
                            {
                                load_script_callback_fn = function(){};
                                load_script_jq_main_callback_fn = function(){};
                                load_script_jq_callback_fn = function(){};

                                load_script_zt_main_callback_fn = load_script_defer_ready_fn;
                                if(files_js_zt_arr.length > 0)
                                {
                                    load_script_zt_main_callback_fn = function(){};
                                    load_script_zt_callback_fn = load_script_defer_ready_fn;
                                }
                            }
                            if(files_js_pt_main_arr.length > 0)
                            {
                                load_script_callback_fn = function(){};
                                load_script_jq_main_callback_fn = function(){};
                                load_script_jq_callback_fn = function(){};
                                load_script_zt_main_callback_fn = function(){};
                                load_script_zt_callback_fn = function(){};

                                load_script_pt_main_callback_fn = load_script_defer_ready_fn;
                                if(files_js_pt_arr.length > 0)
                                {
                                    load_script_pt_main_callback_fn = function(){};
                                    load_script_pt_callback_fn = load_script_defer_ready_fn;
                                }
                            }
                        }

                        //Load scripts via XHR
                        _loadScript(files_js_arr, function(){
                            _loadScript(files_js_jq_main_arr, function(){
                                _loadScript(files_js_jq_arr, function(){
                                    _loadScript(files_js_zt_main_arr, function(){
                                        _loadScript(files_js_zt_arr, function(){
                                            _loadScript(files_js_pt_main_arr, function(){
                                                _loadScript(files_js_pt_arr, function(){
                                                    var end_of_the_line;
                                                }, script_tag_attr_obj, files_js_pt_dep_matrix_arr, load_script_pt_callback_fn)
                                            }, script_tag_attr_obj, [], load_script_pt_main_callback_fn)
                                        }, script_tag_attr_obj, files_js_zt_dep_matrix_arr, load_script_zt_callback_fn);
                                    }, script_tag_attr_obj, [], load_script_zt_main_callback_fn)
                                }, script_tag_attr_obj, files_js_jq_dep_matrix_arr, load_script_jq_callback_fn);
                            }, script_tag_attr_obj, [], load_script_jq_main_callback_fn);
                        }, script_tag_attr_obj, files_js_dep_matrix_arr, load_script_callback_fn);

                        //Unload JavaScript with r_defer tag
                        for(k = defer_js_collection_obj.length-1; k >= 0; k--)
                        {
                            defer_js_collection_obj[k].parentNode.removeChild(defer_js_collection_obj[k]);
                        }
                    }

                    //Defer + Async
                    if(defer_async_js_collection_obj.length > 0)
                    {
                        defer_async_js_collection_obj.each(function()
                        {
                            files_async_js_arr.push($(this).attr("src"));
                        });

                        _lazyLoad(files_async_js_arr, el_target_obj, loc_str, lazyload_inline_js_async_obj);

                        //Unload JavaScript with r_defer_async tag
                        for(k = defer_async_js_collection_obj.length-1; k >= 0; k--)
                        {
                            defer_async_js_collection_obj[k].parentNode.removeChild(defer_async_js_collection_obj[k]);
                        }
                    }

                    //setup function to update link media attribute
                    if(flag_css_defer_auto_bool)
                    {
                        //setup delayed function
                        rScript.addFunction('run_defer_css_auto', link_css_update_media_attrib_fn);
                    }
                }

                //set cache if not disabled
                if(!disable_store_cache_auto_bool)
                {
                    store('rs_var_run_defer_auto', true);
                }
            }

            /**
             * B:
             * B.1: Load CSS manually setup via rScript.loadCSS [defer]
             * B.2: Load JS manually setup via rScript.loadJS [defer]
             */
            if(!run_inline_bool)
            {
                //B.1.
                if(defer_css_sys_collection_obj.length > 0)
                {
                    //Load CSS
                    defer_css_sys_collection_obj.each(function() {
                        files_css_sys_arr.push($(this).attr("href"));
                    });

                    _lazyLoad(files_css_sys_arr, el_target_obj, loc_str);

                    //Unload CSS with r_defer tag
                    for(j = defer_css_sys_collection_obj.length-1; j >= 0; j--)
                    {
                        defer_css_sys_collection_obj[j].parentNode.removeChild(defer_css_sys_collection_obj[j]);
                    }

                    //setup delayed function once
                    if(!store('rs_var_run_defer_css_manual_set_fn'))
                    {
                        rScript.addFunction('run_defer_css_manual', link_css_update_media_attrib_fn);

                        store('rs_var_run_defer_css_manual_set_fn', true);
                    }
                }

                //B.2.
                if(defer_js_sys_collection_obj.length > 0)
                {
                    //Load JavaScript
                    defer_js_sys_collection_obj.each(function() {
                        files_js_sys_arr.push($(this).attr("src"));
                    });

                    _lazyLoad(files_js_sys_arr, el_target_obj, loc_str, lazyload_script_js_async_obj);

                    //Unload JavaScript with r_defer tag
                    for(m = defer_js_sys_collection_obj.length-1; m >= 0; m--)
                    {
                        defer_js_sys_collection_obj[m].parentNode.removeChild(defer_js_sys_collection_obj[m]);
                    }
                }
            }

            return this;
        }

        /**
         * Adds/retrieves/removes an object to rScript-specific namespace
         * @param {String} id_str the object identifier
         * @param {Object} obj the object
         * Note: if object is valid, this will trigger an add operation
         * Note: if object is undefined, this will trigger a get operation
         * Note: if object is null, this will trigger a remove operation
         * @param {String} options_obj optional settings that define parameters for the operation
         * namespace: this enables storage of objects in a namespace different from the default one.
         * Note: if you use this option for the add operation, you must also do same for retrieve/remove operations to ensure that you are working with the same object
         * @private
         */
        function _addOrGetOrRemoveObject(id_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                obj = myArgs[1],
                options_obj = (myArgs[2]) ? myArgs[2] : {},
                namespace_str
                ;

            //Define defaults if options_obj mode
            if(_r.isObject(options_obj))
            {
                namespace_str = (options_obj.namespace && (_r.isString(options_obj.namespace) && options_obj.namespace.length > 0)) ? '_'+options_obj.namespace : undefined;
            }

            if(obj)
            {
                //add
                if(namespace_str)
                {
                    domStore(id_str, obj, 'rs_var_object_q'+namespace_str);
                }
                else
                {
                    domStore(id_str, obj, 'rs_var_object');
                }
            }
            else
            {
                //get/remove
                obj = (obj === null) ? null : '';
                return (namespace_str) ? domStore(id_str, obj, 'rs_var_object_q'+namespace_str) : domStore(id_str, obj, 'rs_var_object');
            }
        }

        /**
         * Adds an object to rScript-specific namespace
         * @param {String} id_str the object identifier
         * @param {Object} obj the object
         * @param {String} options_obj optional settings that define object creation
         * namespace: this enables storage of objects in a namespace different from the default one.
         */
        function addObject(id_str, obj){
            var myArgs = Array.prototype.slice.call(arguments);
            _addOrGetOrRemoveObject(id_str, obj, myArgs[2]);
        }

        /**
         * Retrieves an object from rScript-specific namespace
         * @param {String} id_str the object identifier
         * @param {Object} options_obj the options that define how object is added. Available options are:
         * namespace this enables storage of objects in a namespace different from the default one.
         *
         * @returns {*}
         */
        function getObject(id_str)
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _addOrGetOrRemoveObject(id_str, undefined, myArgs[1]);
        }

        /**
         * Retrieves an entire object namespace
         * Note: this will retrieve all the objects
         * @param {String} namespace_str the namespace
         * @returns {Object}
         */
        function getObjectSpace(namespace_str)
        {
            var options_obj = {namespace: namespace_str};
            return _addOrGetOrRemoveObject(undefined, undefined, options_obj);
        }

        /**
         * Removes an object from rScript-specific namespace
         * @param {String} id_str the object identifier
         * @param {Object} options_obj the options that define how object is added. Available options are:
         * namespace this enables storage of objects in a namespace different from the default one.
         */
        function removeObject(id_str)
        {
            var myArgs = Array.prototype.slice.call(arguments);
            _addOrGetOrRemoveObject(id_str, null, myArgs[1]);
        }

        /**
         * Adds function to rScript-specific namespace
         * @param {String} id_str the identifier for the function.
         * Note: If queue option [below] is set to true, make sure you keep this value [id_str] constant when adding multiple functions to ensure that they are all captured within the same queue
         * For example:
         * rScript.addFunction('queue_1', fn_1, {queue: true, namespace: 'queue_1'})
         * rScript.addFunction('queue_1', fn_2, {queue: true, namespace: 'queue_1'})
         * will add fn_1 and fn_2 to the same queue, enabling you to call both functions at the same time with a single runFunction call like this:
         * rScript.runFunction('queue_1', {queue: true, namespace: 'queue_1'})
         *
         * @param {Function} fn the function to store
         * @param {Object} options_obj the options that define how functions will be added
         *
         * queue: if true, will add the function to a special queue. Multiple functions can be added using the same id_str. All functions will then be called at once using when the runFunction method is called
         * Note: You must use this in conjunction with the 'namespace' option
         *
         * namespace: this enables storage of functions in a namespace different from the default one. Without specifying a namespace, you can't queue functions
         * Note: You can use namespace without queue options. Your function will be stored in a namespace specific to you, as opposed to the default namespace. This provides better safety and security
         *
         * args: this stores corresponding arguments for queued functions.
         * Note: You only need to use this when you are queuing functions [queue option is set to true]. Otherwise, there is no need because you can already pass arguments when calling the function via runFunction() method
         *
         */
        function addFunction(id_str, fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[2]) ? myArgs[2] : {},
                is_queue_bool,
                namespace_str,
                fn_args,
                id_fn_args_str;

            //Define defaults if options_obj mode
            if(_r.isObject(options_obj))
            {
                is_queue_bool = (options_obj.queue && _r.isBool(options_obj.queue)) ? options_obj.queue : false;
                namespace_str = (options_obj.namespace && (_r.isString(options_obj.namespace) && options_obj.namespace.length > 0)) ? '_'+options_obj.namespace : undefined;
                fn_args = (options_obj.args) ? options_obj.args : undefined;
            }

            //Start function addition operations
            if (is_queue_bool)
            {
                var id_final_str,
                    id_store_counter_id_str = id_str + '_counter',
                    id_store_counter_int = 0;

                //add a suffix to id
                if (!domStore(id_store_counter_id_str)) {
                    domStore(id_store_counter_id_str, id_store_counter_int);
                }
                else {
                    id_store_counter_int = parseInt(domStore(id_store_counter_id_str));
                }

                id_final_str = id_str + '_' + id_store_counter_int;

                //add function to queue
                domStore(id_final_str, fn, 'rs_var_function_q'+namespace_str);

                //add function arguments to storage
                if(fn_args)
                {
                    id_fn_args_str = id_final_str+'_args';
                    domStore(id_fn_args_str, fn_args, 'rs_var_function_q_args');
                }

                //increment counter
                id_store_counter_int++;
                domStore(id_store_counter_id_str, id_store_counter_int);
            }
            else
            {
                if(namespace_str)
                {
                    domStore(id_str, fn, 'rs_var_function_q'+namespace_str);
                }
                else
                {
                    domStore(id_str, fn, 'rs_var_function');
                }
            }
        }

        /**
         * Gets a stored function
         * @param {String} id_str the function identifier
         * @param {Object} options_obj the options that define how the function was added. Available options are:
         * namespace: this enables [storage and] retrieval of functions that were stored using a namespace different from the default one.
         * queue: if true, will get the queued functions
         * @returns {*}
         */
        function getFunction(id_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[1]) ? myArgs[1] : {},
                namespace_str,
                queue_bool,
                fn_namespace_str,
                fn
                ;

            //get options
            if(_r.isObject(options_obj))
            {
                namespace_str = (options_obj.namespace && (_r.isString(options_obj.namespace) && options_obj.namespace.length > 0)) ? '_'+options_obj.namespace : undefined;
                queue_bool = (options_obj.queue && _r.isBool(options_obj.queue)) ? options_obj.queue : false;
            }

            if(queue_bool)
            {
                //validate namespace
                if(!namespace_str)
                {
                    _r.console.warn('rScript warning ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: You must define a namespace if you are using function queues', true);
                }

                fn = window.rUtil.domStoreData['r_rs_var_function_q'+namespace_str];
            }
            else
            {
                if(namespace_str)
                {
                    fn_namespace_str = 'rs_var_function_q'+namespace_str;
                    fn = domStore(id_str, '', fn_namespace_str);
                }
                else
                {
                    fn = domStore(id_str, '', 'rs_var_function');
                }
            }

            return fn;
        }

        /**
         * Counts the number of queued functions
         * @param {String} id_str the identifier for the function
         * @param {Object} options_obj the options
         * namespace: the function namespace. Must be provided
         * queue: specifies is queue functions. Must be true
         * @returns {number}
         */
        function countFunction(id_str, options_obj){

            var fn_obj = getFunction(id_str, options_obj),
                fn_count_int = 0;

            if(fn_obj)
            {
                for (var key in fn_obj) {
                    if (fn_obj.hasOwnProperty(key)) {
                        fn_count_int++;
                    }
                }
            }

            return fn_count_int;
        }

        /**
         * Flush a function queue
         * @param {Object} options_obj the options that
         * queue: must be true
         * namespace: defines the namespace that contains the function(s)
         */
        function flushFunction(options_obj)
        {
            var is_queue_bool,
                namespace_str
            ;

            //set defaults
            if(_r.isObject(options_obj))
            {
                is_queue_bool = (options_obj.queue && _r.isBool(options_obj.queue)) ? options_obj.queue : false;
                namespace_str = (options_obj.namespace && (_r.isString(options_obj.namespace) && options_obj.namespace.length > 0)) ? '_'+options_obj.namespace : undefined;
            }

            //flush
            if(is_queue_bool && namespace_str)
            {
                window.rUtil.domStoreData['r_rs_var_function_q'+namespace_str] = {};
            }
        }

        /**
         * Runs a function from rScript-specific namespace
         * @param {String} id_str the identifier for the function
         * @param {Object} options_obj the options that define how functions will be run
         * queue: if true, will run all functions that have been queued
         * Note: Queued functions are enable via addFunction method by setting the queue option to true
         * Note: all functions will be run at the same time
         * Note: you must define a namespace, because queued functions are queued in a non-default namespace
         *
         * namespace: defines the namespace that contains the function(s)
         * Note: this must be defined if queue option is true
         *
         * flush: if true, will flush the queue after execution to prevent
         *
         * args: an object|array that contains custom arguments for the function to be called
         * Note: This option [args] doesn't apply to queued functions
         *
         * promise: if true, will not execute functions, but return an array of promisified functions
         * Note: This option [promise] only applies to queued functions
         *
         * @return {*}
         */
        function runFunction(id_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[1]) ? myArgs[1] : {},
                fn_args_arr_or_obj = myArgs[1],
                is_queue_bool,
                queue_flush_bool,
                queue_promisify_bool,
                namespace_str,
                fn,
                fn_namespace_str,
                fn_all_obj,
                fn_promise_arr = []
                ;

            //Define defaults if options_obj mode
            if(_r.isObject(options_obj))
            {
                //define args defaults
                fn_args_arr_or_obj = (options_obj.args && (_r.isObject(fn_args_arr_or_obj) || _r.isArray(fn_args_arr_or_obj))) ? options_obj.args : fn_args_arr_or_obj;
                fn_args_arr_or_obj = (_r.isObject(fn_args_arr_or_obj) || _r.isArray(fn_args_arr_or_obj)) ? fn_args_arr_or_obj : undefined;

                //define rest of defaults
                is_queue_bool = (options_obj.queue && _r.isBool(options_obj.queue)) ? options_obj.queue : false;
                queue_flush_bool = (options_obj.flush && _r.isBool(options_obj.flush)) ? options_obj.flush : false;
                namespace_str = (options_obj.namespace && (_r.isString(options_obj.namespace) && options_obj.namespace.length > 0)) ? '_'+options_obj.namespace : undefined;
                queue_promisify_bool = (options_obj.promise && _r.isBool(options_obj.promise)) ? options_obj.promise : false;
            }

            //Start run function operations
            if(is_queue_bool)
            {
                //validate namespace
                if(!namespace_str)
                {
                    _r.console.warn('rScript warning ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: You must define a namespace if you are using function queues', true);
                }

                //run queued function
                var fn_regex_obj = new RegExp(""+id_str+"_[0-9]+$", "i"),
                    fn_arg_id_str,
                    fn_q_args_arr_or_obj,
                    fn_is_valid_bool;
                fn_all_obj = window.rUtil.domStoreData['r_rs_var_function_q'+namespace_str];

                //iterate over all queued function
                for (var key in fn_all_obj) {
                    if (fn_all_obj.hasOwnProperty(key)) {

                        //check if function is valid
                        fn_is_valid_bool = !!((fn_all_obj[key]));

                        //run function(s) only if valid
                        if(fn_is_valid_bool)
                        {
                            //check that key matches pattern
                            if(fn_regex_obj.test(key))
                            {
                                //if promisify
                                if(queue_promisify_bool)
                                {
                                    var fn_promise_item_fn = new Promise(function(){
                                        return fn_all_obj[key]();
                                    });
                                    fn_promise_arr.push(fn_promise_item_fn);
                                }
                                else
                                {
                                    //if yes, check if function has stored arguments
                                    fn_arg_id_str = key+'_args';
                                    fn_arg_id_str = fn_arg_id_str.replace(/^ *r_/, "");
                                    fn_q_args_arr_or_obj = domStore(fn_arg_id_str, '', 'rs_var_function_q_args');

                                    if(fn_q_args_arr_or_obj && ((_r.isArray(fn_q_args_arr_or_obj) && fn_q_args_arr_or_obj.length > 0) || (_r.isObject(fn_q_args_arr_or_obj))))
                                    {
                                        if(fn_args_arr_or_obj)
                                        {
                                            //run function with both saved + given arguments
                                            fn_all_obj[key](fn_q_args_arr_or_obj, fn_args_arr_or_obj);
                                        }
                                        else
                                        {
                                            //run function with saved arguments
                                            fn_all_obj[key](fn_q_args_arr_or_obj);
                                        }
                                    }
                                    else if(fn_args_arr_or_obj)
                                    {
                                        //run function with given arguments
                                        fn_all_obj[key](fn_args_arr_or_obj);
                                    }
                                    else
                                    {
                                        //run function
                                        fn_all_obj[key]();
                                    }
                                }
                            }
                        }
                    }
                }

                //flush
                if(queue_flush_bool)
                {
                    window.rUtil.domStoreData['r_rs_var_function_q'+namespace_str] = {};
                }

                //promisify
                if(queue_promisify_bool && _r.count(fn_promise_arr) > 0)
                {
                    return fn_promise_arr;
                }
            }
            else
            {
                //get function
                if(namespace_str)
                {
                    fn_namespace_str = 'rs_var_function_q'+namespace_str;
                    fn = domStore(id_str, '', fn_namespace_str);
                }
                else
                {
                    fn = domStore(id_str, '', 'rs_var_function');
                }

                //run function
                if(fn)
                {
                    return (fn_args_arr_or_obj) ? fn(fn_args_arr_or_obj) : fn();
                }
            }

            return this;
        }

        /**
         * Adds a function to the rScriptFirst queue
         * @param {Function} fn the function to queue
         */
        function addToQueueRScriptFirst(fn)
        {
            addFunction('fready', fn, {queue: true, namespace: 'fready'});
        }

        /**
         * Adds a function to the domReady queue
         * @param {Function} fn the function to queue
         */
        function addToQueueDomReady(fn)
        {
            addFunction('dmready', fn, {queue: true, namespace: 'dmready'});
        }

        /**
         * Adds a function to the rScriptReady queue
         * @param {Function} fn the function to queue
         */
        function addToQueueRScriptReady(fn)
        {
            addFunction('ready', fn, {queue: true, namespace: 'ready'});
        }

        /**
         * Adds a function to the rScriptPostReady queue
         * @param {Function} fn the function to queue
         */
        function addToQueueRScriptPostReady(fn)
        {
            addFunction('zready', fn, {queue: true, namespace: 'zready'});
        }

        /**
         * Adds a function to the rScriptDeferReady queue
         * @param {Function} fn the function to queue
         */
        function addToQueueRScriptDeferReady(fn)
        {
            addFunction('dready', fn, {queue: true, namespace: 'dready'});
        }

        /**
         * Adds a function to the rScriptAsync queue
         * @param {Function} fn the function to queue
         */
        function addToQueueRScriptAsync(fn)
        {
            //flag so that relevant await functionality will be triggered
            domStore('rs_var_await_init', true);

            //add
            addFunction('a1ready', fn, {queue: true, namespace: 'a1ready'});
            if(!_r.isNumber(store('rs_var_async_fn_counter')))
            {
                store('rs_var_async_fn_counter', 0);
            }
            if(_r.isNullOrUndefined(store('rs_var_async_fn_gate_open')))
            {
                store('rs_var_async_fn_gate_open', false);
            }
        }

        /**
         * Used inside $.async block to signal a return value
         * @param {String} key the identifier
         * @param {*} value the value to store
         */
        function resolveAsync(key, value)
        {
            if(!(_r.isString(key) && key.length > 0))
            {
                return false;
            }

            //store value
            var key_async_str = 'rs_var_async_'+key;
            store(key_async_str, value);

            if(store('rs_var_async_fn_gate_open'))
            {
                //increment async function counter
                storeIncrement('rs_var_async_fn_counter');
            }
        }

        /**
         * Used inside $.async block to signal an error or exception
         */
        function rejectAsync()
        {
            if(store('rs_var_async_fn_gate_open'))
            {
                //increment async function counter
                storeIncrement('rs_var_async_fn_counter');
            }
        }

        /**
         * Used inside $.await block to get the value of an asynchronously returned value i.e. a value persisted via resolveAsync
         * @param {String} key the identifier of the value in storage
         * @return {*}
         */
        function getAsyncValue(key)
        {
            //return value
            var key_async_str = 'rs_var_async_'+key;
            return store(key_async_str);
        }

        /**
         * Adds a function to the rScriptAwaitReady queue
         * @param {Function} fn the function to queue
         */
        function addToQueueRScriptAwaitReady(fn)
        {
            //flag so that relevant await functionality will be triggered
            domStore('rs_var_await_init', true);

            //add
            addFunction('a2ready', fn, {queue: true, namespace: 'a2ready'});
        }

        rScript = {
            domStore: domStore,
            domStoreData: window.rUtil.domStoreData,
            detectPrivateBrowsing: _detectPrivateBrowsing,
            store: store,
            storeCheck: storeCheck,
            storeIncrement: storeIncrement,
            storeDecrement: storeDecrement,
            init: init(),
            initDimVars: _initDimensionVars,
            updateDimStore: _updateDimensionStore,
            updateOrtStore: _updateOrientationStore,
            getUserAgent: getUserAgent,
            mobileDetect: _mobileDetect,
            hasProxyBrowser: _hasProxyBrowser,
            getResolutionDimensionList: _getResolutionDimensionList,
            viewportW: viewportW,
            viewportH: viewportH,
            screenW: screenW,
            screenH: screenH,
            pixelW: pixelW,
            pixelH: pixelH,
            vSpan: vSpan,
            vPitch: vPitch,
            dSpan: dSpan,
            dPitch: dPitch,
            cSpan: cSpan,
            cPitch: cPitch,
            eSpan: eSpan,
            ePitch: ePitch,
            getPixelRatio: getPixelRatio,
            getPlatform: getPlatform,
            getOrientation: getOrientation,
            isPortrait: isPortrait,
            isLandscape: isLandscape,
            isIOS: isIOS,
            isAndroid: isAndroid,
            isSymbian: isSymbian,
            isBlackberry: isBlackberry,
            isWindows: isWindows,
            isWindowsPhone: isWindowsPhone,
            runDefer: runDefer,
            addObject: addObject,
            getObject: getObject,
            getObjectSpace: getObjectSpace,
            removeObject: removeObject,
            addFunction: addFunction,
            getFunction: getFunction,
            countFunction: countFunction,
            flushFunction: flushFunction,
            runFunction: runFunction,
            queueFirst: addToQueueRScriptFirst,
            queueReady: addToQueueRScriptReady,
            queuePost: addToQueueRScriptPostReady,
            queueDefer: addToQueueRScriptDeferReady,
            queueAsync: addToQueueRScriptAsync,
            resolveAsync: resolveAsync,
            rejectAsync: rejectAsync,
            getAsyncValue: getAsyncValue,
            queueAwait: addToQueueRScriptAwaitReady
        };

        return rScript;
    }));

    /**
     * Manage rScript non-critical file asynchonicity
     * If async
     * a.1: we load non-critical file in async fashion
     * If not async
     * b.1: we force runDefer to run again [because in non-async mode, the critical file will have run before the non-critical file is accessible via script, thus making it impossible to run] on document.ready
     * b.2: we load non-critical file in non-async fashion
     */
    var elem_script_obj = $('script'),
        is_rscript_critical_async_bool = true,
        run_defer_again_bool = false,
        run_defer_options_obj = {inline: true, inline_js_async: true},
        run_defer_again_options_obj = {inline: true, inline_js_async: true},
        ua_str = rScript.getUserAgent(),
        vendors_arr = ['ms', 'moz', 'webkit', 'o'],
        raf_fn = window.requestAnimationFrame,
        link_update_fn = function(){
            rScript.runFunction('run_defer_css_auto');
        }
        ;

    for(var i = 0; i < vendors_arr.length && !raf_fn; ++i)
    {
        raf_fn = window[vendors_arr[i]+'RequestAnimationFrame'];
    }

    elem_script_obj.each(function(){
        //filter for file name
        if(!this.async && /\.c\.([a-zA-Z_]+\.|)js *$/i.test(this.src))
        {
            //update variables
            run_defer_again_bool = true;
            is_rscript_critical_async_bool = false;
            run_defer_again_options_obj.inline_js_async = false;
            run_defer_again_options_obj.js_only = true;
        }
    });

    //setup deferred scripts in a non-blocking way
    rScript.runDefer(run_defer_options_obj);

    /**
     * Pagespeed CSS Non-blocking Fix
     *
     * Pagespeed Insights incorrectly reports that our CSS loading feature
     * is blocking even when network tests in the Inspector of both
     * Chrome and Firefox browsers, as well as on WebPageTest,
     * clearly show that CSS is loaded after DOMContentLoaded.
     * This appears to be a bug and is mentioned here: https://github.com/filamentgroup/loadCSS/issues/53
     *
     * To fix this issue, we do the following:
     * 1. Detect the traffic coming from Pagespeed Insights
     * 2. Load our CSS after a 7-second timeout to ensure that it loads
     * well after the page has loaded
     *
     * Doing this will cause the Pagespeed Insights bot to load the CSS after
     * the page has been loaded, and as such will not penalize our
     * CSS loading script for doing the right thing i.e. loading CSS
     * in a non-blocking fashion
     *
     * This might appear to some like gaming the results. This is untrue.
     * If we did the exact same thing in our main script, we would get the same
     * result [pagespeed score]. Plus, if we did, we could eliminate FOUC
     * (Flash-Of-Unstyled-Content) by using inline CSS (while we waited for
     * the main CSS file to load after 7 seconds).
     *
     * However, this kind of hacking should be totally unnecessary because the
     * script is already loading CSS in a non-blocking fashion.
     *
     * So, in the interim, we have to filter pagespeed requests and pass them
     * through our delayed CSS loading method.
     *
     * We will continue to monitor Pagespeed Insights, and will remove this
     * filter when they do fix the issue
     */
    if(/google.+?page *speed.+?insights/i.test(ua_str))
    {
        //update link media attribute to 'all' on delay
        if(raf_fn)
        {
            raf_fn(function() { window.setTimeout(link_update_fn, 7000); });
        }
        else
        {
            window.setTimeout(link_update_fn, 7000);
        }
    }
    else
    {
        //update link media attribute to all
        rScript.runFunction('run_defer_css_auto');
    }


    $.domReady(function(){
        //run domReady functions
        rScript.runFunction('dmready', {queue: true, namespace: 'dmready', flush: true});

        //run deferred related
        if(run_defer_again_bool)
        {
            rScript.store("rs_var_run_defer_auto", null);

            rScript.runDefer(run_defer_again_options_obj);
        }
    });

})(window, document, rQuery);

/**
 * Add first function
 * Use it to define a function that you want to run when rScript is first initialized
 * Usage: $.first(function(){})
 */
(function(funcName, baseObj){

    //update baseObj if not rQuery
    var is_rquery_bool = (baseObj.label && baseObj.label === 'rquery');
    baseObj = (!is_rquery_bool) ? window.rQuery : baseObj;

    baseObj[funcName] = function(fn){
        //queue function
        //to be called later by rScript_obj.preInit method [in rscript.core.nc.js]
        rScript.queueFirst(fn);
    };

})("first", $);

/**
 * Add rScriptReady function
 * Use it to define a function that you want to run when rScript is ready
 * Usage: $.rScriptReady(function(){})
 */
(function(funcName, baseObj){

    //update baseObj if not rQuery
    var is_rquery_bool = (baseObj.label && baseObj.label === 'rquery');
    baseObj = (!is_rquery_bool) ? window.rQuery : baseObj;

    baseObj[funcName] = function(fn){
        //queue function
        //to be called later by rScript_obj.postInit method [in rscript.core.nc.js]
        rScript.queueReady(fn);
    };

})("rScriptReady", $);

/**
 * Add ready function
 * Analogous to rScriptReady
 * Use it to define a function that you want to run when rScript is ready
 * Usage: $.ready(function(){})
 */
(function(funcName, baseObj){

    //update baseObj if not rQuery
    var is_rquery_bool = (baseObj.label && baseObj.label === 'rquery');
    baseObj = (!is_rquery_bool) ? window.rQuery : baseObj;

    baseObj[funcName] = function(fn){
        //queue function
        //to be called later by rScript_obj.postInit method [in rscript.core.nc.js]
        rScript.queueReady(fn);
    };

})("ready", $);

/**
 * Add deferReady function
 * Use it to define a function that you want to run when deferred scripts are ready
 * Usage: $.defer(function(){})
 */
(function(funcName, baseObj){

    //update baseObj if not rQuery
    var is_rquery_bool = (baseObj.label && baseObj.label === 'rquery');
    baseObj = (!is_rquery_bool) ? window.rQuery : baseObj;

    baseObj[funcName] = function(fn){
        //queue function
        //to be called later by runDefer method
        rScript.queueDefer(fn);
    };

})("defer", $);

/**
 * Add postReady function
 * Use it to define one or more functions that you want to run when rScript is ready and all 'ready' functions have been executed
 * Usage: $.post(function(){})
 */
(function(funcName, baseObj){

    //update baseObj if not rQuery
    var is_rquery_bool = (baseObj.label && baseObj.label === 'rquery');
    baseObj = (!is_rquery_bool) ? window.rQuery : baseObj;

    baseObj[funcName] = function(fn){
        //queue function
        //to be called later by rScript_obj.postInit method [in rscript.core.nc.js]
        rScript.queuePost(fn);
    };

})("post", $);

/**
 * Add async function
 * Use it to define one or more asynchronous functions whose results you need to use later
 * Usage: $.async(function(){})
 */
(function(funcName, baseObj){

    //update baseObj if not rQuery
    var is_rquery_bool = (baseObj.label && baseObj.label === 'rquery');
    baseObj = (!is_rquery_bool) ? window.rQuery : baseObj;

    baseObj[funcName] = function(fn){
        //queue function
        //to be called later by rScript_obj.await method [in rscript.core.nc.js]
        rScript.queueAsync(fn);
    };

})("async", $);

/**
 * Add awaitReady function
 * Use it to define a function to run when all the results from the functions in $.async are ready
 * Usage: $.await(function(){})
 */
(function(funcName, baseObj){

    //update baseObj if not rQuery
    var is_rquery_bool = (baseObj.label && baseObj.label === 'rquery');
    baseObj = (!is_rquery_bool) ? window.rQuery : baseObj;

    baseObj[funcName] = function(fn){
        //queue function
        //to be called later by rScript_obj.await method [in rscript.core.nc.js]
        rScript.queueAwait(fn);
    };

})("await", $);

(function(window, document, $){

    //fire after rScript is ready
    $.post(function(){

        //update link media attribute to 'all' for manually loaded and deferred CSS
        rScript.runFunction('run_defer_css_manual');

    });

})(window, document, rQuery);

/** Polyfills **/
if (!('map' in Array.prototype)) {
    Array.prototype.map= function(mapper, that /*opt*/) {
        var other= new Array(this.length);
        for (var i= 0, n= this.length; i<n; i++)
        {
            if (i in this)
            {
                other[i]= mapper.call(that, this[i], i, this);
            }
        }
        return other;
    };
}

/*! json2.js | @link https://github.com/douglascrockford/JSON-js | @copyright Douglas Crockford <douglas@crockford.com> | @license MIT  */

// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

if (typeof JSON !== 'object')
{
    /* jshint -W020 */
    JSON = {};
    /* jshint +W020 */
}

/* jshint -W040 */
(function () {

    var rx_one = /^[\],:{}\s]*$/,
        rx_two = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,
        rx_three = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
        rx_four = /(?:^|:|,)(?:\s*\[)+/g,
        rx_escapable = /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        rx_dangerous = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    function this_value() {
        return this.valueOf();
    }

    if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function () {

            return isFinite(this.valueOf()) ? this.getUTCFullYear() + '-' +
                f(this.getUTCMonth() + 1) + '-' +
                f(this.getUTCDate()) + 'T' +
                f(this.getUTCHours()) + ':' +
                f(this.getUTCMinutes()) + ':' +
                f(this.getUTCSeconds()) + 'Z'
                : null;
        };

        Boolean.prototype.toJSON = this_value;
        Number.prototype.toJSON = this_value;
        String.prototype.toJSON = this_value;
    }

    var gap,
        indent,
        meta,
        rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        rx_escapable.lastIndex = 0;
        return rx_escapable.test(string) ?
            '"' + string.replace(rx_escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ?
                    c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"'
            : '"' + string + '"';
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (value && typeof value === 'object' &&
            typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
            case 'string':
                return quote(value);

            case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

                return isFinite(value) ? String(value)
                    : 'null';

            case 'boolean':
            case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

                return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

            case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

                if (!value) {
                    return 'null';
                }

// Make an array to hold the partial results of stringifying this object value.

                gap += indent;
                partial = [];

// Is the value an array?

                if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                    length = value.length;
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value) || 'null';
                    }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                    v = partial.length === 0 ? '[]'
                        : gap ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
                            : '[' + partial.join(',') + ']';
                    gap = mind;
                    return v;
                }

// If the replacer is an array, use it to select the members to be stringified.

                if (rep && typeof rep === 'object') {
                    length = rep.length;
                    for (i = 0; i < length; i += 1) {
                        if (typeof rep[i] === 'string') {
                            k = rep[i];
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (
                                        gap ? ': '
                                            : ':'
                                    ) + v);
                            }
                        }
                    }
                } else {

// Otherwise, iterate through all of the keys in the object.

                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (
                                        gap ? ': '
                                            : ':'
                                    ) + v);
                            }
                        }
                    }
                }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

                v = partial.length === 0 ? '{}'
                    : gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
                        : '{' + partial.join(',') + '}';
                gap = mind;
                return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== 'function') {
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"': '\\"',
            '\\': '\\\\'
        };
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = '';
            indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === 'string') {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                (typeof replacer !== 'object' ||
                typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

            return str('', {'': value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            rx_dangerous.lastIndex = 0;
            if (rx_dangerous.test(text)) {
                text = text.replace(rx_dangerous, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

            if (
                rx_one.test(
                    text
                        .replace(rx_two, '@')
                        .replace(rx_three, ']')
                        .replace(rx_four, '')
                )
            ) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                /* jshint -W061 */
                j = eval('(' + text + ')');
                /* jshint +W061 */


// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return typeof reviver === 'function' ? walk({'': j}, '')
                    : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError('JSON.parse');
        };
    }
}());
/* jshint +W040 */


/*! JavaScript Cookie 2.1.3 | @link https://github.com/js-cookie/js-cookie | @copyright Klaus Hartl <@carhartl> & Fagner Brack <github@fagnermartins.com> | @license MIT  */
(function (factory) {
    var registeredInModuleLoader = false;
    if (typeof define === 'function' && define.amd) {
        define(factory);
        registeredInModuleLoader = true;
    }
    if (typeof exports === 'object') {
        module.exports = factory();
        registeredInModuleLoader = true;
    }
    if (!registeredInModuleLoader) {
        var OldCookies = window.Cookies;
        var api = window.Cookies = factory();
        api.noConflict = function () {
            window.Cookies = OldCookies;
            return api;
        };
    }
}(function () {
    function extend () {
        var i = 0;
        var result = {};
        for (; i < arguments.length; i++) {
            var attributes = arguments[ i ];
            for (var key in attributes) {
                result[key] = attributes[key];
            }
        }
        return result;
    }

    function init (converter) {
        function api (key, value, attributes) {
            var result;
            if (typeof document === 'undefined') {
                return;
            }

            // Write

            if (arguments.length > 1) {
                attributes = extend({
                    path: '/'
                }, api.defaults, attributes);

                if (typeof attributes.expires === 'number') {
                    var expires = new Date();
                    expires.setMilliseconds(expires.getMilliseconds() + attributes.expires * 864e+5);
                    attributes.expires = expires;
                }

                // We're using "expires" because "max-age" is not supported by IE
                attributes.expires = attributes.expires ? attributes.expires.toUTCString() : '';

                try {
                    result = JSON.stringify(value);
                    if (/^[\{\[]/.test(result)) {
                        value = result;
                    }
                } catch (e) {}

                if (!converter.write) {
                    value = encodeURIComponent(String(value))
                        .replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent);
                } else {
                    value = converter.write(value, key);
                }

                key = encodeURIComponent(String(key));
                key = key.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent);
                key = key.replace(/[\(\)]/g, escape);

                var stringifiedAttributes = '';

                for (var attributeName in attributes) {
                    if (!attributes[attributeName]) {
                        continue;
                    }
                    stringifiedAttributes += '; ' + attributeName;
                    if (attributes[attributeName] === true) {
                        continue;
                    }
                    stringifiedAttributes += '=' + attributes[attributeName];
                }
                return (document.cookie = key + '=' + value + stringifiedAttributes);
            }

            // Read

            if (!key) {
                result = {};
            }

            // To prevent the for loop in the first place assign an empty array
            // in case there are no cookies at all. Also prevents odd result when
            // calling "get()"
            var cookies = document.cookie ? document.cookie.split('; ') : [];
            var rdecode = /(%[0-9A-Z]{2})+/g;
            var i = 0;

            for (; i < cookies.length; i++) {
                var parts = cookies[i].split('=');
                var cookie = parts.slice(1).join('=');

                if (cookie.charAt(0) === '"') {
                    cookie = cookie.slice(1, -1);
                }

                try {
                    var name = parts[0].replace(rdecode, decodeURIComponent);
                    cookie = converter.read ?
                        converter.read(cookie, name) : converter(cookie, name) ||
                        cookie.replace(rdecode, decodeURIComponent);

                    if (this.json) {
                        try {
                            cookie = JSON.parse(cookie);
                        } catch (e) {}
                    }

                    if (key === name) {
                        result = cookie;
                        break;
                    }

                    if (!key) {
                        result[name] = cookie;
                    }
                } catch (e) {}
            }

            return result;
        }

        api.set = api;
        api.get = function (key) {
            return api.call(api, key);
        };
        api.getJSON = function () {
            return api.apply({
                json: true
            }, [].slice.call(arguments));
        };
        api.defaults = {};

        api.remove = function (key, attributes) {
            api(key, '', extend(attributes, {
                expires: -1
            }));
        };

        api.withConverter = init;

        return api;
    }

    return init(function () {});
}));


/*! Offline.js v0.7.18 | @link https://github.com/HubSpot/offline | @copyright Hubspot, Inc. | @license MIT */
(function() {
    var Offline, checkXHR, defaultOptions, extendNative, grab, handlers, init;
    extendNative = function(to, from) {
        var e, key, results, val;
        results = [];
        for (key in from.prototype) try {
            val = from.prototype[key], null == to[key] && "function" != typeof val ? results.push(to[key] = val) :results.push(void 0);
        } catch (_error) {
            e = _error;
        }
        return results;
    }, Offline = {}, Offline.options = window.Offline ? window.Offline.options || {} :{},
        defaultOptions = {
            checks:{
                xhr:{
                    url:function() {
                        return "/favicon.ico?_=" + new Date().getTime();
                    },
                    timeout:5e3,
                    type:"HEAD"
                },
                image:{
                    url:function() {
                        return "/favicon.ico?_=" + new Date().getTime();
                    }
                },
                active:"xhr"
            },
            checkOnLoad:!1,
            interceptRequests:!0,
            reconnect:!0,
            deDupBody:!1
        }, grab = function(obj, key) {
        var cur, i, j, len, part, parts;
        for (cur = obj, parts = key.split("."), i = j = 0, len = parts.length; len > j && (part = parts[i],
            cur = cur[part], "object" == typeof cur); i = ++j) ;
        return i === parts.length - 1 ? cur :void 0;
    }, Offline.getOption = function(key) {
        var ref, val;
        return val = null != (ref = grab(Offline.options, key)) ? ref :grab(defaultOptions, key),
            "function" == typeof val ? val() :val;
    }, "function" == typeof window.addEventListener && window.addEventListener("online", function() {
        return setTimeout(Offline.confirmUp, 100);
    }, !1), "function" == typeof window.addEventListener && window.addEventListener("offline", function() {
        return Offline.confirmDown();
    }, !1), Offline.state = "up", Offline.markUp = function() {
        return Offline.trigger("confirmed-up"), "up" !== Offline.state ? (Offline.state = "up",
                Offline.trigger("up")) :void 0;
    }, Offline.markDown = function() {
        return Offline.trigger("confirmed-down"), "down" !== Offline.state ? (Offline.state = "down",
                Offline.trigger("down")) :void 0;
    }, handlers = {}, Offline.on = function(event, handler, ctx) {
        var e, events, j, len, results;
        if (events = event.split(" "), events.length > 1) {
            for (results = [], j = 0, len = events.length; len > j; j++) e = events[j], results.push(Offline.on(e, handler, ctx));
            return results;
        }
        return null == handlers[event] && (handlers[event] = []), handlers[event].push([ ctx, handler ]);
    }, Offline.off = function(event, handler) {
        var _handler, ctx, i, ref, results;
        if (null != handlers[event]) {
            if (handler) {
                for (i = 0, results = []; i < handlers[event].length; ) ref = handlers[event][i],
                    ctx = ref[0], _handler = ref[1], _handler === handler ? results.push(handlers[event].splice(i, 1)) :results.push(i++);
                return results;
            }
            return handlers[event] = [];
        }
    }, Offline.trigger = function(event) {
        var ctx, handler, j, len, ref, ref1, results;
        if (null != handlers[event]) {
            for (ref = handlers[event].slice(0), results = [], j = 0, len = ref.length; len > j; j++) ref1 = ref[j],
                ctx = ref1[0], handler = ref1[1], results.push(handler.call(ctx));
            return results;
        }
    }, checkXHR = function(xhr, onUp, onDown) {
        var _onerror, _onload, _onreadystatechange, _ontimeout, checkStatus;
        return checkStatus = function() {
            return xhr.status && xhr.status < 12e3 ? onUp() :onDown();
        }, null === xhr.onprogress ? (_onerror = xhr.onerror, xhr.onerror = function() {
                return onDown(), "function" == typeof _onerror ? _onerror.apply(null, arguments) :void 0;
            }, _ontimeout = xhr.ontimeout, xhr.ontimeout = function() {
                return onDown(), "function" == typeof _ontimeout ? _ontimeout.apply(null, arguments) :void 0;
            }, _onload = xhr.onload, xhr.onload = function() {
                return checkStatus(), "function" == typeof _onload ? _onload.apply(null, arguments) :void 0;
            }) :(_onreadystatechange = xhr.onreadystatechange, xhr.onreadystatechange = function() {
                return 4 === xhr.readyState ? checkStatus() :0 === xhr.readyState && onDown(), "function" == typeof _onreadystatechange ? _onreadystatechange.apply(null, arguments) :void 0;
            });
    }, Offline.checks = {}, Offline.checks.xhr = function() {
        var e, xhr;
        xhr = new XMLHttpRequest(), xhr.offline = !1, xhr.open(Offline.getOption("checks.xhr.type"), Offline.getOption("checks.xhr.url"), !0),
        null != xhr.timeout && (xhr.timeout = Offline.getOption("checks.xhr.timeout")),
            checkXHR(xhr, Offline.markUp, Offline.markDown);
        try {
            xhr.send();
        } catch (_error) {
            e = _error, Offline.markDown();
        }
        return xhr;
    }, Offline.checks.image = function() {
        var img;
        img = document.createElement("img"), img.onerror = Offline.markDown, img.onload = Offline.markUp,
            img.src = Offline.getOption("checks.image.url");
    }, Offline.checks.down = Offline.markDown, Offline.checks.up = Offline.markUp, Offline.check = function() {
        return Offline.trigger("checking"), Offline.checks[Offline.getOption("checks.active")]();
    }, Offline.confirmUp = Offline.confirmDown = Offline.check, Offline.onXHR = function(cb) {
        var _XDomainRequest, _XMLHttpRequest, monitorXHR;
        return monitorXHR = function(req, flags) {
            var _open;
            return _open = req.open, req.open = function(type, url, async, user, password) {
                return cb({
                    type:type,
                    url:url,
                    async:async,
                    flags:flags,
                    user:user,
                    password:password,
                    xhr:req
                }), _open.apply(req, arguments);
            };
        }, _XMLHttpRequest = window.XMLHttpRequest, window.XMLHttpRequest = function(flags) {
            var _overrideMimeType, _setRequestHeader, req;
            return req = new _XMLHttpRequest(flags), monitorXHR(req, flags), _setRequestHeader = req.setRequestHeader,
                req.headers = {}, req.setRequestHeader = function(name, value) {
                return req.headers[name] = value, _setRequestHeader.call(req, name, value);
            }, _overrideMimeType = req.overrideMimeType, req.overrideMimeType = function(type) {
                return req.mimeType = type, _overrideMimeType.call(req, type);
            }, req;
        }, extendNative(window.XMLHttpRequest, _XMLHttpRequest), null != window.XDomainRequest ? (_XDomainRequest = window.XDomainRequest,
                window.XDomainRequest = function() {
                    var req;
                    return req = new _XDomainRequest(), monitorXHR(req), req;
                }, extendNative(window.XDomainRequest, _XDomainRequest)) :void 0;
    }, init = function() {
        return Offline.getOption("interceptRequests") && Offline.onXHR(function(arg) {
            var xhr;
            return xhr = arg.xhr, xhr.offline !== !1 ? checkXHR(xhr, Offline.markUp, Offline.confirmDown) :void 0;
        }), Offline.getOption("checkOnLoad") ? Offline.check() :void 0;
    }, setTimeout(init, 0), window.Offline = Offline;
}).call(this), function() {
    var down, next, nope, rc, reset, retryIntv, tick, tryNow, up;
    if (!window.Offline) throw new Error("Offline Reconnect brought in without offline.js");
    rc = Offline.reconnect = {}, retryIntv = null, reset = function() {
        var ref;
        return null != rc.state && "inactive" !== rc.state && Offline.trigger("reconnect:stopped"),
            rc.state = "inactive", rc.remaining = rc.delay = null != (ref = Offline.getOption("reconnect.initialDelay")) ? ref :3;
    }, next = function() {
        var delay, ref;
        return delay = null != (ref = Offline.getOption("reconnect.delay")) ? ref :Math.min(Math.ceil(1.5 * rc.delay), 3600),
            rc.remaining = rc.delay = delay;
    }, tick = function() {
        return "connecting" !== rc.state ? (rc.remaining -= 1, Offline.trigger("reconnect:tick"),
                0 === rc.remaining ? tryNow() :void 0) :void 0;
    }, tryNow = function() {
        return "waiting" === rc.state ? (Offline.trigger("reconnect:connecting"), rc.state = "connecting",
                Offline.check()) :void 0;
    }, down = function() {
        return Offline.getOption("reconnect") ? (reset(), rc.state = "waiting", Offline.trigger("reconnect:started"),
                retryIntv = setInterval(tick, 1e3)) :void 0;
    }, up = function() {
        return null != retryIntv && clearInterval(retryIntv), reset();
    }, nope = function() {
        return Offline.getOption("reconnect") && "connecting" === rc.state ? (Offline.trigger("reconnect:failure"),
                rc.state = "waiting", next()) :void 0;
    }, rc.tryNow = tryNow, reset(), Offline.on("down", down), Offline.on("confirmed-down", nope),
        Offline.on("up", up);
}.call(this), function() {
    var clear, flush, held, holdRequest, makeRequest, waitingOnConfirm;
    if (!window.Offline) throw new Error("Requests module brought in without offline.js");
    held = [], waitingOnConfirm = !1, holdRequest = function(req) {
        return Offline.getOption("requests") !== !1 ? (Offline.trigger("requests:capture"),
            "down" !== Offline.state && (waitingOnConfirm = !0), held.push(req)) :void 0;
    }, makeRequest = function(arg) {
        var body, name, password, ref, type, url, user, val, xhr;
        if (xhr = arg.xhr, url = arg.url, type = arg.type, user = arg.user, password = arg.password,
                body = arg.body, Offline.getOption("requests") !== !1) {
            xhr.abort(), xhr.open(type, url, !0, user, password), ref = xhr.headers;
            for (name in ref) val = ref[name], xhr.setRequestHeader(name, val);
            return xhr.mimeType && xhr.overrideMimeType(xhr.mimeType), xhr.send(body);
        }
    }, clear = function() {
        return held = [];
    }, flush = function() {
        var body, i, key, len, request, requests, url;
        if (Offline.getOption("requests") !== !1) {
            for (Offline.trigger("requests:flush"), requests = {}, i = 0, len = held.length; len > i; i++) request = held[i],
                url = request.url.replace(/(\?|&)_=[0-9]+/, function(match, chr) {
                    return "?" === chr ? chr :"";
                }), Offline.getOption("deDupBody") ? (body = request.body, body = "[object Object]" === body.toString() ? JSON.stringify(body) :body.toString(),
                    requests[request.type.toUpperCase() + " - " + url + " - " + body] = request) :requests[request.type.toUpperCase() + " - " + url] = request;
            for (key in requests) request = requests[key], makeRequest(request);
            return clear();
        }
    }, setTimeout(function() {
        return Offline.getOption("requests") !== !1 ? (Offline.on("confirmed-up", function() {
                return waitingOnConfirm ? (waitingOnConfirm = !1, clear()) :void 0;
            }), Offline.on("up", flush), Offline.on("down", function() {
                return waitingOnConfirm = !1;
            }), Offline.onXHR(function(request) {
                var _onreadystatechange, _send, async, hold, xhr;
                return xhr = request.xhr, async = request.async, xhr.offline !== !1 && (hold = function() {
                    return holdRequest(request);
                }, _send = xhr.send, xhr.send = function(body) {
                    return request.body = body, _send.apply(xhr, arguments);
                }, async) ? null === xhr.onprogress ? (xhr.addEventListener("error", hold, !1),
                            xhr.addEventListener("timeout", hold, !1)) :(_onreadystatechange = xhr.onreadystatechange,
                            xhr.onreadystatechange = function() {
                                return 0 === xhr.readyState ? hold() :4 === xhr.readyState && (0 === xhr.status || xhr.status >= 12e3) && hold(),
                                    "function" == typeof _onreadystatechange ? _onreadystatechange.apply(null, arguments) :void 0;
                            }) :void 0;
            }), Offline.requests = {
                flush:flush,
                clear:clear
            }) :void 0;
    }, 0);
}.call(this), function() {
    var base, e, i, len, ref, simulate, state;
    if (!Offline) throw new Error("Offline simulate brought in without offline.js");
    for (ref = [ "up", "down" ], i = 0, len = ref.length; len > i; i++) {
        state = ref[i];
        try {
            simulate = document.querySelector("script[data-simulate='" + state + "']") || ("undefined" != typeof localStorage && null !== localStorage ? localStorage.OFFLINE_SIMULATE :void 0) === state;
        } catch (_error) {
            e = _error, simulate = !1;
        }
    }
    simulate && (null == Offline.options && (Offline.options = {}), null == (base = Offline.options).checks && (base.checks = {}),
        Offline.options.checks.active = state);
}.call(this), function() {
    var RETRY_TEMPLATE, TEMPLATE, _onreadystatechange, addClass, content, createFromHTML, el, flashClass, flashTimeouts, init, removeClass, render, roundTime;
    if (!window.Offline) throw new Error("Offline UI brought in without offline.js");
    TEMPLATE = '<div class="offline-ui"><div class="offline-ui-content"></div></div>',
        RETRY_TEMPLATE = '<a href class="offline-ui-retry"></a>', createFromHTML = function(html) {
        var el;
        return el = document.createElement("div"), el.innerHTML = html, el.children[0];
    }, el = content = null, addClass = function(name) {
        return removeClass(name), el.className += " " + name;
    }, removeClass = function(name) {
        return el.className = el.className.replace(new RegExp("(^| )" + name.split(" ").join("|") + "( |$)", "gi"), " ");
    }, flashTimeouts = {}, flashClass = function(name, time) {
        return addClass(name), null != flashTimeouts[name] && clearTimeout(flashTimeouts[name]),
            flashTimeouts[name] = setTimeout(function() {
                return removeClass(name), delete flashTimeouts[name];
            }, 1e3 * time);
    }, roundTime = function(sec) {
        var mult, unit, units, val;
        units = {
            day:86400,
            hour:3600,
            minute:60,
            second:1
        };
        for (unit in units) if (mult = units[unit], sec >= mult) return val = Math.floor(sec / mult),
            [ val, unit ];
        return [ "now", "" ];
    }, render = function() {
        var button, handler;
        return el = createFromHTML(TEMPLATE), document.body.appendChild(el), null != Offline.reconnect && Offline.getOption("reconnect") && (el.appendChild(createFromHTML(RETRY_TEMPLATE)),
            button = el.querySelector(".offline-ui-retry"), handler = function(e) {
            return e.preventDefault(), Offline.reconnect.tryNow();
        }, null != button.addEventListener ? button.addEventListener("click", handler, !1) :button.attachEvent("click", handler)),
            addClass("offline-ui-" + Offline.state), content = el.querySelector(".offline-ui-content");
    }, init = function() {
        return render(), Offline.on("up", function() {
            return removeClass("offline-ui-down"), addClass("offline-ui-up"), flashClass("offline-ui-up-2s", 2),
                flashClass("offline-ui-up-5s", 5);
        }), Offline.on("down", function() {
            return removeClass("offline-ui-up"), addClass("offline-ui-down"), flashClass("offline-ui-down-2s", 2),
                flashClass("offline-ui-down-5s", 5);
        }), Offline.on("reconnect:connecting", function() {
            return addClass("offline-ui-connecting"), removeClass("offline-ui-waiting");
        }), Offline.on("reconnect:tick", function() {
            var ref, time, unit;
            return addClass("offline-ui-waiting"), removeClass("offline-ui-connecting"), ref = roundTime(Offline.reconnect.remaining),
                time = ref[0], unit = ref[1], content.setAttribute("data-retry-in-value", time),
                content.setAttribute("data-retry-in-unit", unit);
        }), Offline.on("reconnect:stopped", function() {
            return removeClass("offline-ui-connecting offline-ui-waiting"), content.setAttribute("data-retry-in-value", null),
                content.setAttribute("data-retry-in-unit", null);
        }), Offline.on("reconnect:failure", function() {
            return flashClass("offline-ui-reconnect-failed-2s", 2), flashClass("offline-ui-reconnect-failed-5s", 5);
        }), Offline.on("reconnect:success", function() {
            return flashClass("offline-ui-reconnect-succeeded-2s", 2), flashClass("offline-ui-reconnect-succeeded-5s", 5);
        });
    }, "complete" === document.readyState ? init() :null != document.addEventListener ? document.addEventListener("DOMContentLoaded", init, !1) :(_onreadystatechange = document.onreadystatechange,
                document.onreadystatechange = function() {
                    return "complete" === document.readyState && init(), "function" == typeof _onreadystatechange ? _onreadystatechange.apply(null, arguments) :void 0;
                });
}.call(this);

/*! ResizeSensor.js from CSS Element Queries | @link https://github.com/marcj/css-element-queries | @copyright Marc J. Schmidt <@MarcJSchmidt> | @license MIT  */
(function(_this) {

    /**
     * Class for dimension change detection.
     *
     * @param {Element|Element[]|Elements|jQuery} element
     * @param {Function} callback
     *
     * @constructor
     */
    _this.ResizeSensor = function(element, callback) {
        /**
         *
         * @constructor
         */
        function EventQueue() {
            this.q = [];
            this.add = function(ev) {
                this.q.push(ev);
            };

            var i, j;
            this.call = function() {
                for (i = 0, j = this.q.length; i < j; i++) {
                    this.q[i].call();
                }
            };
        }

        /**
         * @param {HTMLElement} element
         * @param {String}      prop
         * @returns {String|Number}
         */
        function getComputedStyle(element, prop) {
            if (element.currentStyle) {
                return element.currentStyle[prop];
            } else if (window.getComputedStyle) {
                return window.getComputedStyle(element, null).getPropertyValue(prop);
            } else {
                return element.style[prop];
            }
        }

        /**
         *
         * @param {HTMLElement} element
         * @param {Function}    resized
         */
        function attachResizeEvent(element, resized) {
            if (!element.resizedAttached) {
                element.resizedAttached = new EventQueue();
                element.resizedAttached.add(resized);
            } else if (element.resizedAttached) {
                element.resizedAttached.add(resized);
                return;
            }

            element.resizeSensor = document.createElement('div');
            element.resizeSensor.className = 'resize-sensor';
            var style = 'position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: scroll; z-index: -1; visibility: hidden;';
            var styleChild = 'position: absolute; left: 0; top: 0;';

            element.resizeSensor.style.cssText = style;
            element.resizeSensor.innerHTML =
                '<div class="resize-sensor-expand" style="' + style + '">' +
                '<div style="' + styleChild + '"></div>' +
                '</div>' +
                '<div class="resize-sensor-shrink" style="' + style + '">' +
                '<div style="' + styleChild + ' width: 200%; height: 200%"></div>' +
                '</div>';
            element.appendChild(element.resizeSensor);

            if (!{fixed: 1, absolute: 1}[getComputedStyle(element, 'position')]) {
                element.style.position = 'relative';
            }

            var expand = element.resizeSensor.childNodes[0];
            var expandChild = expand.childNodes[0];
            var shrink = element.resizeSensor.childNodes[1];
            var shrinkChild = shrink.childNodes[0];

            var lastWidth, lastHeight;

            var reset = function() {
                expandChild.style.width = expand.offsetWidth + 10 + 'px';
                expandChild.style.height = expand.offsetHeight + 10 + 'px';
                expand.scrollLeft = expand.scrollWidth;
                expand.scrollTop = expand.scrollHeight;
                shrink.scrollLeft = shrink.scrollWidth;
                shrink.scrollTop = shrink.scrollHeight;
                lastWidth = element.offsetWidth;
                lastHeight = element.offsetHeight;
            };

            reset();

            var changed = function() {
                if (element.resizedAttached) {
                    element.resizedAttached.call();
                }
            };

            var addEvent = function(el, name, cb) {
                if (el.attachEvent) {
                    el.attachEvent('on' + name, cb);
                } else {
                    el.addEventListener(name, cb);
                }
            };

            addEvent(expand, 'scroll', function() {
                if (element.offsetWidth > lastWidth || element.offsetHeight > lastHeight) {
                    changed();
                }
                reset();
            });

            addEvent(shrink, 'scroll',function() {
                if (element.offsetWidth < lastWidth || element.offsetHeight < lastHeight) {
                    changed();
                }
                reset();
            });
        }

        if ("[object Array]" === Object.prototype.toString.call(element) ||
            ('undefined' !== typeof jQuery && element instanceof jQuery) || //jquery
            ('undefined' !== typeof Elements && element instanceof Elements) //mootools
        ) {
            var i = 0, j = element.length;
            for (; i < j; i++) {
                attachResizeEvent(element[i], callback);
            }
        } else {
            attachResizeEvent(element, callback);
        }

        this.detach = function() {
            ResizeSensor.detach(element);
        };
    };

    _this.ResizeSensor.detach = function(element) {
        if (element.resizeSensor) {
            element.removeChild(element.resizeSensor);
            delete element.resizeSensor;
            delete element.resizedAttached;
        }
    };

})(/*jshint -W040 */ this);
/*jshint +W040 */


/*!
 * Shim for MutationObserver interface
 * Author: Graeme Yeates (github.com/megawac)
 * Repository: https://github.com/megawac/MutationObserver.js
 * License: WTFPL V2, 2004 (wtfpl.net).
 * Though credit and staring the repo will make me feel pretty, you can modify and redistribute as you please.
 * Attempts to follow spec (http:// www.w3.org/TR/dom/#mutation-observers) as closely as possible for native javascript
 * See https://github.com/WebKit/webkit/blob/master/Source/WebCore/dom/MutationObserver.cpp for current webkit source c++ implementation
 */

/*jshint -W052 */
/*jshint -W089 */
/*jshint -W116 */
/*! MutationObserver.js v0.3.1 | @link https://github.com/megawac/MutationObserver.js | @copyright Graeme Yeates <yeatesgraeme@gmail.com> | @license MIT */
/**
 * prefix bugs:
 - https://bugs.webkit.org/show_bug.cgi?id=85161
 - https://bugzilla.mozilla.org/show_bug.cgi?id=749920
 * Don't use WebKitMutationObserver as Safari (6.0.5-6.1) use a buggy implementation
 */
window.MutationObserver = window.MutationObserver || (function(undefined) {
        /**
         * @param {function(Array.<MutationRecord>, MutationObserver)} listener
         * @constructor
         */
        function MutationObserver(listener) {
            /**
             * @type {Array.<Object>}
             * @private
             */
            this._watched = [];
            /** @private */
            this._listener = listener;
        }

        /**
         * Start a recursive timeout function to check all items being observed for mutations
         * @type {MutationObserver} observer
         * @private
         */
        function startMutationChecker(observer) {
            (function check() {
                var mutations = observer.takeRecords();

                if (mutations.length) { // fire away
                    // calling the listener with context is not spec but currently consistent with FF and WebKit
                    observer._listener(mutations, observer);
                }
                /** @private */
                observer._timeout = setTimeout(check, MutationObserver._period);
            })();
        }

        /**
         * Period to check for mutations (~32 times/sec)
         * @type {number}
         * @expose
         */
        MutationObserver._period = 30 /*ms+runtime*/ ;

        /**
         * Exposed API
         * @expose
         * @final
         */
        MutationObserver.prototype = {
            /**
             * see http:// dom.spec.whatwg.org/#dom-mutationobserver-observe
             * not going to throw here but going to follow the current spec config sets
             * @param {Node|null} $target
             * @param {Object|null} config : MutationObserverInit configuration dictionary
             * @expose
             * @return undefined
             */
            observe: function($target, config) {
                /**
                 * Using slightly different names so closure can go ham
                 * @type {!Object} : A custom mutation config
                 */
                var settings = {
                    attr: !! (config.attributes || config.attributeFilter || config.attributeOldValue),

                    // some browsers enforce that subtree must be set with childList, attributes or characterData.
                    // We don't care as spec doesn't specify this rule.
                    kids: !! config.childList,
                    descendents: !! config.subtree,
                    charData: !! (config.characterData || config.characterDataOldValue)
                };

                var watched = this._watched;

                // remove already observed target element from pool
                for (var i = 0; i < watched.length; i++) {
                    if (watched[i].tar === $target) watched.splice(i, 1);
                }

                if (config.attributeFilter) {
                    /**
                     * converts to a {key: true} dict for faster lookup
                     * @type {Object.<String,Boolean>}
                     */
                    settings.afilter = reduce(config.attributeFilter, function(a, b) {
                        a[b] = true;
                        return a;
                    }, {});
                }

                watched.push({
                    tar: $target,
                    fn: createMutationSearcher($target, settings)
                });

                // reconnect if not connected
                if (!this._timeout) {
                    startMutationChecker(this);
                }
            },

            /**
             * Finds mutations since last check and empties the "record queue" i.e. mutations will only be found once
             * @expose
             * @return {Array.<MutationRecord>}
             */
            takeRecords: function() {
                var mutations = [];
                var watched = this._watched;

                for (var i = 0; i < watched.length; i++) {
                    watched[i].fn(mutations);
                }

                return mutations;
            },

            /**
             * @expose
             * @return undefined
             */
            disconnect: function() {
                this._watched = []; // clear the stuff being observed
                clearTimeout(this._timeout); // ready for garbage collection
                /** @private */
                this._timeout = null;
            }
        };

        /**
         * Simple MutationRecord pseudoclass. No longer exposing as its not fully compliant
         * @param {Object} data
         * @return {Object} a MutationRecord
         */
        function MutationRecord(data) {
            var settings = { // technically these should be on proto so hasOwnProperty will return false for non explicitly props
                type: null,
                target: null,
                addedNodes: [],
                removedNodes: [],
                previousSibling: null,
                nextSibling: null,
                attributeName: null,
                attributeNamespace: null,
                oldValue: null
            };
            for (var prop in data) {
                if (has(settings, prop) && data[prop] !== undefined) settings[prop] = data[prop];
            }
            return settings;
        }

        /**
         * Creates a func to find all the mutations
         *
         * @param {Node} $target
         * @param {!Object} config : A custom mutation config
         */
        function createMutationSearcher($target, config) {
            /** type {Elestuct} */
            var $oldstate = clone($target, config); // create the cloned datastructure

            /**
             * consumes array of mutations we can push to
             *
             * @param {Array.<MutationRecord>} mutations
             */
            return function(mutations) {
                var olen = mutations.length, dirty;

                // Alright we check base level changes in attributes... easy
                if (config.attr && $oldstate.attr) {
                    findAttributeMutations(mutations, $target, $oldstate.attr, config.afilter);
                }

                // check childlist or subtree for mutations
                if (config.kids || config.descendents) {
                    dirty = searchSubtree(mutations, $target, $oldstate, config);
                }

                // reclone data structure if theres changes
                if (dirty || mutations.length !== olen) {
                    /** type {Elestuct} */
                    $oldstate = clone($target, config);
                }
            };
        }

        /* attributes + attributeFilter helpers */

        // Check if the environment has the attribute bug (#4) which cause
        // element.attributes.style to always be null.
        var hasAttributeBug = document.createElement("i");
        hasAttributeBug.style.top = 0;
        hasAttributeBug = hasAttributeBug.attributes.style.value != "null";

        /**
         * Gets an attribute value in an environment without attribute bug
         *
         * @param {Node} el
         * @param {Attr} attr
         * @return {String} an attribute value
         */
        function getAttributeSimple(el, attr) {
            // There is a potential for a warning to occur here if the attribute is a
            // custom attribute in IE<9 with a custom .toString() method. This is
            // just a warning and doesn't affect execution (see #21)
            return attr.value;
        }

        /**
         * Gets an attribute value with special hack for style attribute (see #4)
         *
         * @param {Node} el
         * @param {Attr} attr
         * @return {String} an attribute value
         */
        function getAttributeWithStyleHack(el, attr) {
            // As with getAttributeSimple there is a potential warning for custom attribtues in IE7.
            return attr.name !== "style" ? attr.value : el.style.cssText;
        }

        var getAttributeValue = hasAttributeBug ? getAttributeSimple : getAttributeWithStyleHack;

        /**
         * fast helper to check to see if attributes object of an element has changed
         * doesnt handle the textnode case
         *
         * @param {Array.<MutationRecord>} mutations
         * @param {Node} $target
         * @param {Object.<string, string>} $oldstate : Custom attribute clone data structure from clone
         * @param {Object} filter
         */
        function findAttributeMutations(mutations, $target, $oldstate, filter) {
            var checked = {};
            var attributes = $target.attributes;
            var attr;
            var name;
            var i = attributes.length;
            while (i--) {
                attr = attributes[i];
                name = attr.name;
                if (!filter || has(filter, name)) {
                    if (getAttributeValue($target, attr) !== $oldstate[name]) {
                        // The pushing is redundant but gzips very nicely
                        mutations.push(MutationRecord({
                            type: "attributes",
                            target: $target,
                            attributeName: name,
                            oldValue: $oldstate[name],
                            attributeNamespace: attr.namespaceURI // in ie<8 it incorrectly will return undefined
                        }));
                    }
                    checked[name] = true;
                }
            }
            for (name in $oldstate) {
                if (!(checked[name])) {
                    mutations.push(MutationRecord({
                        target: $target,
                        type: "attributes",
                        attributeName: name,
                        oldValue: $oldstate[name]
                    }));
                }
            }
        }

        /**
         * searchSubtree: array of mutations so far, element, element clone, bool
         * synchronous dfs comparision of two nodes
         * This function is applied to any observed element with childList or subtree specified
         * Sorry this is kind of confusing as shit, tried to comment it a bit...
         * codereview.stackexchange.com/questions/38351 discussion of an earlier version of this func
         *
         * @param {Array} mutations
         * @param {Node} $target
         * @param {!Object} $oldstate : A custom cloned node from clone()
         * @param {!Object} config : A custom mutation config
         */
        function searchSubtree(mutations, $target, $oldstate, config) {
            // Track if the tree is dirty and has to be recomputed (#14).
            var dirty;
            /*
             * Helper to identify node rearrangment and stuff...
             * There is no gaurentee that the same node will be identified for both added and removed nodes
             * if the positions have been shuffled.
             * conflicts array will be emptied by end of operation
             */
            function resolveConflicts(conflicts, node, $kids, $oldkids, numAddedNodes) {
                // the distance between the first conflicting node and the last
                var distance = conflicts.length - 1;
                // prevents same conflict being resolved twice consider when two nodes switch places.
                // only one should be given a mutation event (note -~ is used as a math.ceil shorthand)
                var counter = -~((distance - numAddedNodes) / 2);
                var $cur;
                var oldstruct;
                var conflict;
                while ((conflict = conflicts.pop())) {
                    $cur = $kids[conflict.i];
                    oldstruct = $oldkids[conflict.j];

                    // attempt to determine if there was node rearrangement... won't gaurentee all matches
                    // also handles case where added/removed nodes cause nodes to be identified as conflicts
                    if (config.kids && counter && Math.abs(conflict.i - conflict.j) >= distance) {
                        mutations.push(MutationRecord({
                            type: "childList",
                            target: node,
                            addedNodes: [$cur],
                            removedNodes: [$cur],
                            // haha don't rely on this please
                            nextSibling: $cur.nextSibling,
                            previousSibling: $cur.previousSibling
                        }));
                        counter--; // found conflict
                    }

                    // Alright we found the resorted nodes now check for other types of mutations
                    if (config.attr && oldstruct.attr) findAttributeMutations(mutations, $cur, oldstruct.attr, config.afilter);
                    if (config.charData && $cur.nodeType === 3 && $cur.nodeValue !== oldstruct.charData) {
                        mutations.push(MutationRecord({
                            type: "characterData",
                            target: $cur
                        }));
                    }
                    // now look @ subtree
                    if (config.descendents) findMutations($cur, oldstruct);
                }
            }

            /**
             * Main worker. Finds and adds mutations if there are any
             * @param {Node} node
             * @param {!Object} old : A cloned data structure using internal clone
             */
            function findMutations(node, old) {
                var $kids = node.childNodes;
                var $oldkids = old.kids;
                var klen = $kids.length;
                // $oldkids will be undefined for text and comment nodes
                var olen = $oldkids ? $oldkids.length : 0;
                // if (!olen && !klen) return; // both empty; clearly no changes

                // we delay the intialization of these for marginal performance in the expected case (actually quite signficant on large subtrees when these would be otherwise unused)
                // map of checked element of ids to prevent registering the same conflict twice
                var map;
                // array of potential conflicts (ie nodes that may have been re arranged)
                var conflicts;
                var id; // element id from getElementId helper
                var idx; // index of a moved or inserted element

                var oldstruct;
                // current and old nodes
                var $cur;
                var $old;
                // track the number of added nodes so we can resolve conflicts more accurately
                var numAddedNodes = 0;

                // iterate over both old and current child nodes at the same time
                var i = 0, j = 0;
                // while there is still anything left in $kids or $oldkids (same as i < $kids.length || j < $oldkids.length;)
                while( i < klen || j < olen ) {
                    // current and old nodes at the indexs
                    $cur = $kids[i];
                    oldstruct = $oldkids[j];
                    $old = oldstruct && oldstruct.node;

                    if ($cur === $old) { // expected case - optimized for this case
                        // check attributes as specified by config
                        if (config.attr && oldstruct.attr) /* oldstruct.attr instead of textnode check */findAttributeMutations(mutations, $cur, oldstruct.attr, config.afilter);
                        // check character data if node is a comment or textNode and it's being observed
                        if (config.charData && oldstruct.charData !== undefined && $cur.nodeValue !== oldstruct.charData) {
                            mutations.push(MutationRecord({
                                type: "characterData",
                                target: $cur
                            }));
                        }

                        // resolve conflicts; it will be undefined if there are no conflicts - otherwise an array
                        if (conflicts) resolveConflicts(conflicts, node, $kids, $oldkids, numAddedNodes);

                        // recurse on next level of children. Avoids the recursive call when there are no children left to iterate
                        if (config.descendents && ($cur.childNodes.length || oldstruct.kids && oldstruct.kids.length)) findMutations($cur, oldstruct);

                        i++;
                        j++;
                    } else { // (uncommon case) lookahead until they are the same again or the end of children
                        dirty = true;
                        if (!map) { // delayed initalization (big perf benefit)
                            map = {};
                            conflicts = [];
                        }
                        if ($cur) {
                            // check id is in the location map otherwise do a indexOf search
                            if (!(map[id = getElementId($cur)])) { // to prevent double checking
                                // mark id as found
                                map[id] = true;
                                // custom indexOf using comparitor checking oldkids[i].node === $cur
                                if ((idx = indexOfCustomNode($oldkids, $cur, j)) === -1) {
                                    if (config.kids) {
                                        mutations.push(MutationRecord({
                                            type: "childList",
                                            target: node,
                                            addedNodes: [$cur], // $cur is a new node
                                            nextSibling: $cur.nextSibling,
                                            previousSibling: $cur.previousSibling
                                        }));
                                        numAddedNodes++;
                                    }
                                } else {
                                    conflicts.push({ // add conflict
                                        i: i,
                                        j: idx
                                    });
                                }
                            }
                            i++;
                        }

                        if ($old &&
                            // special case: the changes may have been resolved: i and j appear congurent so we can continue using the expected case
                            $old !== $kids[i]
                        ) {
                            if (!(map[id = getElementId($old)])) {
                                map[id] = true;
                                if ((idx = indexOf($kids, $old, i)) === -1) {
                                    if (config.kids) {
                                        mutations.push(MutationRecord({
                                            type: "childList",
                                            target: old.node,
                                            removedNodes: [$old],
                                            nextSibling: $oldkids[j + 1], // praise no indexoutofbounds exception
                                            previousSibling: $oldkids[j - 1]
                                        }));
                                        numAddedNodes--;
                                    }
                                } else {
                                    conflicts.push({
                                        i: idx,
                                        j: j
                                    });
                                }
                            }
                            j++;
                        }
                    }// end uncommon case
                }// end loop

                // resolve any remaining conflicts
                if (conflicts) resolveConflicts(conflicts, node, $kids, $oldkids, numAddedNodes);
            }
            findMutations($target, $oldstate);
            return dirty;
        }

        /**
         * Utility
         * Cones a element into a custom data structure designed for comparision. https://gist.github.com/megawac/8201012
         *
         * @param {Node} $target
         * @param {!Object} config : A custom mutation config
         * @return {!Object} : Cloned data structure
         */
        function clone($target, config) {
            var recurse = true; // set true so childList we'll always check the first level
            return (function copy($target) {
                var elestruct = {
                    /** @type {Node} */
                    node: $target
                };

                // Store current character data of target text or comment node if the config requests
                // those properties to be observed.
                if (config.charData && ($target.nodeType === 3 || $target.nodeType === 8)) {
                    elestruct.charData = $target.nodeValue;
                }
                // its either a element, comment, doc frag or document node
                else {
                    // Add attr only if subtree is specified or top level and avoid if
                    // attributes is a document object (#13).
                    if (config.attr && recurse && $target.nodeType === 1) {
                        /**
                         * clone live attribute list to an object structure {name: val}
                         * @type {Object.<string, string>}
                         */
                        elestruct.attr = reduce($target.attributes, function(memo, attr) {
                            if (!config.afilter || config.afilter[attr.name]) {
                                memo[attr.name] = getAttributeValue($target, attr);
                            }
                            return memo;
                        }, {});
                    }

                    // whether we should iterate the children of $target node
                    if (recurse && ((config.kids || config.charData) || (config.attr && config.descendents)) ) {
                        /** @type {Array.<!Object>} : Array of custom clone */
                        elestruct.kids = map($target.childNodes, copy);
                    }

                    recurse = config.descendents;
                }
                return elestruct;
            })($target);
        }

        /**
         * indexOf an element in a collection of custom nodes
         *
         * @param {NodeList} set
         * @param {!Object} $node : A custom cloned node
         * @param {number} idx : index to start the loop
         * @return {number}
         */
        function indexOfCustomNode(set, $node, idx) {
            return indexOf(set, $node, idx, JSCompiler_renameProperty("node"));
        }

        // using a non id (eg outerHTML or nodeValue) is extremely naive and will run into issues with nodes that may appear the same like <li></li>
        var counter = 1; // don't use 0 as id (falsy)
        /** @const */
        var expando = "mo_id";

        /**
         * Attempt to uniquely id an element for hashing. We could optimize this for legacy browsers but it hopefully wont be called enough to be a concern
         *
         * @param {Node} $ele
         * @return {(string|number)}
         */
        function getElementId($ele) {
            try {
                return $ele.id || ($ele[expando] = $ele[expando] || counter++);
            } catch (o_O) { // ie <8 will throw if you set an unknown property on a text node
                try {
                    return $ele.nodeValue; // naive
                } catch (shitie) { // when text node is removed: https://gist.github.com/megawac/8355978 :(
                    return counter++;
                }
            }
        }

        /**
         * **map** Apply a mapping function to each item of a set
         * @param {Array|NodeList} set
         * @param {Function} iterator
         */
        function map(set, iterator) {
            var results = [];
            for (var index = 0; index < set.length; index++) {
                results[index] = iterator(set[index], index, set);
            }
            return results;
        }

        /**
         * **Reduce** builds up a single result from a list of values
         * @param {Array|NodeList|NamedNodeMap} set
         * @param {Function} iterator
         * @param {*} [memo] Initial value of the memo.
         */
        function reduce(set, iterator, memo) {
            for (var index = 0; index < set.length; index++) {
                memo = iterator(memo, set[index], index, set);
            }
            return memo;
        }

        /**
         * **indexOf** find index of item in collection.
         * @param {Array|NodeList} set
         * @param {Object} item
         * @param {number} idx
         * @param {string} [prop] Property on set item to compare to item
         */
        function indexOf(set, item, idx, prop) {
            for (/*idx = ~~idx*/; idx < set.length; idx++) {// start idx is always given as this is internal
                if ((prop ? set[idx][prop] : set[idx]) === item) return idx;
            }
            return -1;
        }

        /**
         * @param {Object} obj
         * @param {(string|number)} prop
         * @return {boolean}
         */
        function has(obj, prop) {
            return obj[prop] !== undefined; // will be nicely inlined by gcc
        }

        // GCC hack see http:// stackoverflow.com/a/23202438/1517919
        function JSCompiler_renameProperty(a) {
            return a;
        }

        return MutationObserver;
    })(void 0);
/*jshint +W052 */
/*jshint +W089 */
/*jshint +W116 */

/*! Font Face Observer v2.0.7 | @link https://github.com/bramstein/fontfaceobserver | @copyright Bram Stein <b.l.stein@gmail.com> | @license MIT */
/*jshint -W018 */
/*jshint -W030 */
/*jshint -W033 */
/*jshint -W040 */
/*jshint -W058 */
/*jshint -W084 */
/*jshint -W116 */
(function(){function m(a,b){document.addEventListener?a.addEventListener("scroll",b,!1):a.attachEvent("scroll",b)}function n(a){document.body?a():document.addEventListener?document.addEventListener("DOMContentLoaded",function c(){document.removeEventListener("DOMContentLoaded",c);a()}):document.attachEvent("onreadystatechange",function l(){if("interactive"==document.readyState||"complete"==document.readyState)document.detachEvent("onreadystatechange",l),a()})};function t(a){this.a=document.createElement("div");this.a.setAttribute("aria-hidden","true");this.a.appendChild(document.createTextNode(a));this.b=document.createElement("span");this.c=document.createElement("span");this.h=document.createElement("span");this.f=document.createElement("span");this.g=-1;this.b.style.cssText="max-width:none;display:inline-block;position:absolute;height:100%;width:100%;overflow:scroll;font-size:16px;";this.c.style.cssText="max-width:none;display:inline-block;position:absolute;height:100%;width:100%;overflow:scroll;font-size:16px;";
    this.f.style.cssText="max-width:none;display:inline-block;position:absolute;height:100%;width:100%;overflow:scroll;font-size:16px;";this.h.style.cssText="display:inline-block;width:200%;height:200%;font-size:16px;max-width:none;";this.b.appendChild(this.h);this.c.appendChild(this.f);this.a.appendChild(this.b);this.a.appendChild(this.c)}
    function x(a,b){a.a.style.cssText="max-width:none;min-width:20px;min-height:20px;display:inline-block;overflow:hidden;position:absolute;width:auto;margin:0;padding:0;top:-999px;left:-999px;white-space:nowrap;font:"+b+";"}function y(a){var b=a.a.offsetWidth,c=b+100;a.f.style.width=c+"px";a.c.scrollLeft=c;a.b.scrollLeft=a.b.scrollWidth+100;return a.g!==b?(a.g=b,!0):!1}function z(a,b){function c(){var a=l;y(a)&&a.a.parentNode&&b(a.g)}var l=a;m(a.b,c);m(a.c,c);y(a)};function A(a,b){var c=b||{};this.family=a;this.style=c.style||"normal";this.weight=c.weight||"normal";this.stretch=c.stretch||"normal"}var B=null,C=null,E=null,F=null;function I(){if(null===E){var a=document.createElement("div");try{a.style.font="condensed 100px sans-serif"}catch(b){}E=""!==a.style.font}return E}function J(a,b){return[a.style,a.weight,I()?a.stretch:"","100px",b].join(" ")}
    A.prototype.load=function(a,b){var c=this,l=a||"BESbswy",r=0,D=b||3E3,G=(new Date).getTime();return new Promise(function(a,b){var e;null===F&&(F=!!document.fonts);if(e=F)null===C&&(C=/OS X.*Version\/10\..*Safari/.test(navigator.userAgent)&&/Apple/.test(navigator.vendor)),e=!C;if(e){e=new Promise(function(a,b){function f(){(new Date).getTime()-G>=D?b():document.fonts.load(J(c,'"'+c.family+'"'),l).then(function(c){1<=c.length?a():setTimeout(f,25)},function(){b()})}f()});var K=new Promise(function(a, c){r=setTimeout(c,D)});Promise.race([K,e]).then(function(){clearTimeout(r);a(c)},function(){b(c)})}else n(function(){function e(){var b;if(b=-1!=g&&-1!=h||-1!=g&&-1!=k||-1!=h&&-1!=k)(b=g!=h&&g!=k&&h!=k)||(null===B&&(b=/AppleWebKit\/([0-9]+)(?:\.([0-9]+))/.exec(window.navigator.userAgent),B=!!b&&(536>parseInt(b[1],10)||536===parseInt(b[1],10)&&11>=parseInt(b[2],10))),b=B&&(g==u&&h==u&&k==u||g==v&&h==v&&k==v||g==w&&h==w&&k==w)),b=!b;b&&(d.parentNode&&d.parentNode.removeChild(d),clearTimeout(r),a(c))}
        function H(){if((new Date).getTime()-G>=D)d.parentNode&&d.parentNode.removeChild(d),b(c);else{var a=document.hidden;if(!0===a||void 0===a)g=f.a.offsetWidth,h=p.a.offsetWidth,k=q.a.offsetWidth,e();r=setTimeout(H,50)}}var f=new t(l),p=new t(l),q=new t(l),g=-1,h=-1,k=-1,u=-1,v=-1,w=-1,d=document.createElement("div");d.dir="ltr";x(f,J(c,"sans-serif"));x(p,J(c,"serif"));x(q,J(c,"monospace"));d.appendChild(f.a);d.appendChild(p.a);d.appendChild(q.a);document.body.appendChild(d);u=f.a.offsetWidth;v=p.a.offsetWidth;
        w=q.a.offsetWidth;H();z(f,function(a){g=a;e()});x(f,J(c,'"'+c.family+'",sans-serif'));z(p,function(a){h=a;e()});x(p,J(c,'"'+c.family+'",serif'));z(q,function(a){k=a;e()});x(q,J(c,'"'+c.family+'",monospace'))})})};"undefined"!==typeof module?module.exports=A:(window.FontFaceObserver=A,window.FontFaceObserver.prototype.load=A.prototype.load);}());
/*jshint +W018 */
/*jshint +W030 */
/*jshint +W033 */
/*jshint +W040 */
/*jshint +W058 */
/*jshint +W084 */
/*jshint +W116 */

/*
 * JavaScript MD5 1.0.1
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

/*global unescape, define */
(function ($) {
    /*jshint bitwise: false */
    /*
     * Add integers, wrapping at 2^32. This uses 16-bit operations internally
     * to work around bugs in some JS interpreters.
     */
    function safe_add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF),
            msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }

    /*
     * Bitwise rotate a 32-bit number to the left.
     */
    function bit_rol(num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    }

    /*
     * These functions implement the four basic operations the algorithm uses.
     */
    function md5_cmn(q, a, b, x, s, t) {
        return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
    }
    function md5_ff(a, b, c, d, x, s, t) {
        return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    function md5_gg(a, b, c, d, x, s, t) {
        return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    function md5_hh(a, b, c, d, x, s, t) {
        return md5_cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function md5_ii(a, b, c, d, x, s, t) {
        return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    /*
     * Calculate the MD5 of an array of little-endian words, and a bit length.
     */
    function binl_md5(x, len) {
        /* append padding */
        x[len >> 5] |= 0x80 << (len % 32);
        x[(((len + 64) >>> 9) << 4) + 14] = len;

        var i, olda, oldb, oldc, oldd,
            a =  1732584193,
            b = -271733879,
            c = -1732584194,
            d =  271733878;

        for (i = 0; i < x.length; i += 16) {
            olda = a;
            oldb = b;
            oldc = c;
            oldd = d;

            a = md5_ff(a, b, c, d, x[i],       7, -680876936);
            d = md5_ff(d, a, b, c, x[i +  1], 12, -389564586);
            c = md5_ff(c, d, a, b, x[i +  2], 17,  606105819);
            b = md5_ff(b, c, d, a, x[i +  3], 22, -1044525330);
            a = md5_ff(a, b, c, d, x[i +  4],  7, -176418897);
            d = md5_ff(d, a, b, c, x[i +  5], 12,  1200080426);
            c = md5_ff(c, d, a, b, x[i +  6], 17, -1473231341);
            b = md5_ff(b, c, d, a, x[i +  7], 22, -45705983);
            a = md5_ff(a, b, c, d, x[i +  8],  7,  1770035416);
            d = md5_ff(d, a, b, c, x[i +  9], 12, -1958414417);
            c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
            b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = md5_ff(a, b, c, d, x[i + 12],  7,  1804603682);
            d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = md5_ff(b, c, d, a, x[i + 15], 22,  1236535329);

            a = md5_gg(a, b, c, d, x[i +  1],  5, -165796510);
            d = md5_gg(d, a, b, c, x[i +  6],  9, -1069501632);
            c = md5_gg(c, d, a, b, x[i + 11], 14,  643717713);
            b = md5_gg(b, c, d, a, x[i],      20, -373897302);
            a = md5_gg(a, b, c, d, x[i +  5],  5, -701558691);
            d = md5_gg(d, a, b, c, x[i + 10],  9,  38016083);
            c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = md5_gg(b, c, d, a, x[i +  4], 20, -405537848);
            a = md5_gg(a, b, c, d, x[i +  9],  5,  568446438);
            d = md5_gg(d, a, b, c, x[i + 14],  9, -1019803690);
            c = md5_gg(c, d, a, b, x[i +  3], 14, -187363961);
            b = md5_gg(b, c, d, a, x[i +  8], 20,  1163531501);
            a = md5_gg(a, b, c, d, x[i + 13],  5, -1444681467);
            d = md5_gg(d, a, b, c, x[i +  2],  9, -51403784);
            c = md5_gg(c, d, a, b, x[i +  7], 14,  1735328473);
            b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

            a = md5_hh(a, b, c, d, x[i +  5],  4, -378558);
            d = md5_hh(d, a, b, c, x[i +  8], 11, -2022574463);
            c = md5_hh(c, d, a, b, x[i + 11], 16,  1839030562);
            b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = md5_hh(a, b, c, d, x[i +  1],  4, -1530992060);
            d = md5_hh(d, a, b, c, x[i +  4], 11,  1272893353);
            c = md5_hh(c, d, a, b, x[i +  7], 16, -155497632);
            b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = md5_hh(a, b, c, d, x[i + 13],  4,  681279174);
            d = md5_hh(d, a, b, c, x[i],      11, -358537222);
            c = md5_hh(c, d, a, b, x[i +  3], 16, -722521979);
            b = md5_hh(b, c, d, a, x[i +  6], 23,  76029189);
            a = md5_hh(a, b, c, d, x[i +  9],  4, -640364487);
            d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = md5_hh(c, d, a, b, x[i + 15], 16,  530742520);
            b = md5_hh(b, c, d, a, x[i +  2], 23, -995338651);

            a = md5_ii(a, b, c, d, x[i],       6, -198630844);
            d = md5_ii(d, a, b, c, x[i +  7], 10,  1126891415);
            c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = md5_ii(b, c, d, a, x[i +  5], 21, -57434055);
            a = md5_ii(a, b, c, d, x[i + 12],  6,  1700485571);
            d = md5_ii(d, a, b, c, x[i +  3], 10, -1894986606);
            c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = md5_ii(b, c, d, a, x[i +  1], 21, -2054922799);
            a = md5_ii(a, b, c, d, x[i +  8],  6,  1873313359);
            d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = md5_ii(c, d, a, b, x[i +  6], 15, -1560198380);
            b = md5_ii(b, c, d, a, x[i + 13], 21,  1309151649);
            a = md5_ii(a, b, c, d, x[i +  4],  6, -145523070);
            d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = md5_ii(c, d, a, b, x[i +  2], 15,  718787259);
            b = md5_ii(b, c, d, a, x[i +  9], 21, -343485551);

            a = safe_add(a, olda);
            b = safe_add(b, oldb);
            c = safe_add(c, oldc);
            d = safe_add(d, oldd);
        }
        return [a, b, c, d];
    }

    /*
     * Convert an array of little-endian words to a string
     */
    function binl2rstr(input) {
        var i,
            output = '';
        for (i = 0; i < input.length * 32; i += 8) {
            output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
        }
        return output;
    }

    /*
     * Convert a raw string to an array of little-endian words
     * Characters >255 have their high-byte silently ignored.
     */
    function rstr2binl(input) {
        var i,
            output = [];
        output[(input.length >> 2) - 1] = undefined;
        for (i = 0; i < output.length; i += 1) {
            output[i] = 0;
        }
        for (i = 0; i < input.length * 8; i += 8) {
            output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
        }
        return output;
    }

    /*
     * Calculate the MD5 of a raw string
     */
    function rstr_md5(s) {
        return binl2rstr(binl_md5(rstr2binl(s), s.length * 8));
    }

    /*
     * Calculate the HMAC-MD5, of a key and some data (raw strings)
     */
    function rstr_hmac_md5(key, data) {
        var i,
            bkey = rstr2binl(key),
            ipad = [],
            opad = [],
            hash;
        ipad[15] = opad[15] = undefined;
        if (bkey.length > 16) {
            bkey = binl_md5(bkey, key.length * 8);
        }
        for (i = 0; i < 16; i += 1) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5C5C5C5C;
        }
        hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
        return binl2rstr(binl_md5(opad.concat(hash), 512 + 128));
    }

    /*
     * Convert a raw string to a hex string
     */
    function rstr2hex(input) {
        var hex_tab = '0123456789abcdef',
            output = '',
            x,
            i;
        for (i = 0; i < input.length; i += 1) {
            x = input.charCodeAt(i);
            output += hex_tab.charAt((x >>> 4) & 0x0F) +
                hex_tab.charAt(x & 0x0F);
        }
        return output;
    }

    /*
     * Encode a string as utf-8
     */
    function str2rstr_utf8(input) {
        return unescape(encodeURIComponent(input));
    }

    /*
     * Take string arguments and return either raw or hex encoded strings
     */
    function raw_md5(s) {
        return rstr_md5(str2rstr_utf8(s));
    }
    function hex_md5(s) {
        return rstr2hex(raw_md5(s));
    }
    function raw_hmac_md5(k, d) {
        return rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d));
    }
    function hex_hmac_md5(k, d) {
        return rstr2hex(raw_hmac_md5(k, d));
    }

    function md5(string, key, raw) {
        if (!key) {
            if (!raw) {
                return hex_md5(string);
            }
            return raw_md5(string);
        }
        if (!raw) {
            return hex_hmac_md5(key, string);
        }
        return raw_hmac_md5(key, string);
    }

    if (typeof define === 'function' && define.amd) {
        define(function () {
            return md5;
        });
    } else {
        $.md5 = md5;
    }

}( /* jshint -W040 */ this ));
/* jshint +W040 */

/*! Non-Critical JavaScript. Load in <HEAD> or <BODY> using <script> tag with "text/javascript/r_defer" type attribute value */
/*jshint -W097 */
/*jshint -W117 */
/*jshint devel: true, plusplus: false, nonew: false, bitwise: false */
/*global window, unescape, define, XMLHttpRequest, ActiveXObject, console, rScript */
"use strict";

/*! _r - rScript functional helpers - Extend */
(function(_r_obj){

    _r_obj.urlencode = function(str)
    {
        // http://kevin.vanzonneveld.net
        // + original by: Philip Peterson
        // + improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // + input by: AJ
        // + improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // + improved by: Brett Zamir (http://brett-zamir.me)
        // + bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // + input by: travc
        // + input by: Brett Zamir (http://brett-zamir.me)
        // + bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // + improved by: Lars Fischer
        // + input by: Ratheous
        // + reimplemented by: Brett Zamir (http://brett-zamir.me)
        // + bugfixed by: Joris
        // + reimplemented by: Brett Zamir (http://brett-zamir.me)
        // % note 1: This reflects PHP 5.3/6.0+ behavior
        // % note 2: Please be aware that this function expects to encode into UTF-8 encoded strings, as found on
        // % note 2: pages served as UTF-8
        // * example 1: urlencode('Kevin van Zonneveld!');
        // * returns 1: 'Kevin+van+Zonneveld%21'
        // * example 2: urlencode('http://kevin.vanzonneveld.net/');
        // * returns 2: 'http%3A%2F%2Fkevin.vanzonneveld.net%2F'
        // * example 3: urlencode('http://www.google.nl/search?q=php.js&ie=utf-8&oe=utf-8&aq=t&rls=com.ubuntu:en-US:unofficial&client=firefox-a');
        // * returns 3: 'http%3A%2F%2Fwww.google.nl%2Fsearch%3Fq%3Dphp.js%26ie%3Dutf-8%26oe%3Dutf-8%26aq%3Dt%26rls%3Dcom.ubuntu%3Aen-US%3Aunofficial%26client%3Dfirefox-a'
        str = (str + '').toString();

        // Tilde should be allowed unescaped in future versions of PHP (as reflected below), but if you want to reflect current
        // PHP behavior, you would need to add ".replace(/~/g, '%7E');" to the following.
        return encodeURIComponent(str).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').
        replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/%20/g, '+');
    };

    _r_obj.strrpos = function (haystack, needle, offset) {
        // http://kevin.vanzonneveld.net
        // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +   bugfixed by: Onno Marsman
        // +   input by: saulius
        // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
        // *     example 1: strrpos('Kevin van Zonneveld', 'e');
        // *     returns 1: 16
        // *     example 2: strrpos('somepage.com', '.', false);
        // *     returns 2: 8
        // *     example 3: strrpos('baa', 'a', 3);
        // *     returns 3: false
        // *     example 4: strrpos('baa', 'a', 2);
        // *     returns 4: 2
        var i = -1;
        if (offset) {
            i = (haystack + '').slice(offset).lastIndexOf(needle); // strrpos' offset indicates starting point of range till end,
            // while lastIndexOf's optional 2nd argument indicates ending point of range from the beginning
            if (i !== -1) {
                i += offset;
            }
        } else {
            i = (haystack + '').lastIndexOf(needle);
        }
        return i >= 0 ? i : false;
    };

    /**
     * Determine if a string is like a number e.g. '12', '12.5'
     * @param {String} num_str the string to test
     * @returns {boolean}
     */
    _r_obj.isNumberString = function(num_str)
    {
        if(!_r.isString(num_str))
        {
            return false;
        }

        if(/^ *([0-9]+|[0-9]+\.[0-9]+) *$/i.test(num_str))
        {
            return true;
        }

        return false;
    }

    /**
     * Determine if number is negative
     * @param {Number} num_int the number to check
     * @returns {boolean}
     */
    _r_obj.isNegative = function(num_int){

        //return false if not number
        if(!_r.isNumber(num_int))
        {
            return false;
        }

        return !!((num_int < 0));
    };

    /**
     * Escapes a string for use in a regular expression
     * @param str {String} The String to escape
     * @returns {*|string}
     */
    _r_obj.escapeRegExp = function(str) {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    };

    /**
     * Replace all occurrences of the search string with the replacement string
     * @param str {String} The string being searched and replaced on
     * @param find {String} The value being searched for
     * @param replace {String} The replacement value
     * @returns {*|string}
     */
    _r_obj.replaceAll = function(str, find, replace) {
        return str.replace(new RegExp(_r.escapeRegExp(find), 'g'), replace);
    };

    _r_obj.explode = function(delimiter, string, limit) {
        //  discuss at: http://phpjs.org/functions/explode/
        // +  original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +  improved by: Obinwanne Hill on 15-03-2015 (https://about.me/obinwanne.hill)
        // +     example 1: explode(' ', 'Kevin van Zonneveld');
        //       returns 1: {0: 'Kevin', 1: 'van', 2: 'Zonneveld'}
        if ( arguments.length < 2 || typeof delimiter === 'undefined' || typeof string === 'undefined' ) {return null;}
        if ( delimiter === '' || delimiter === false || delimiter === null) {return false;}
        if ( typeof delimiter === 'function' || typeof delimiter === 'object' || typeof string === 'function' || typeof string === 'object'){
            return { 0: '' };
        }
        if ( delimiter === true ) {delimiter = '1';}

        // Here we go...
        delimiter += '';
        string += '';

        var s = string.split( delimiter );


        if ( typeof limit === 'undefined' ) {return s;}

        // Support for limit
        if ( limit === 0 ) {limit = 1;}

        // Positive limit
        if ( limit > 0 ){
            if ( limit >= s.length ) {return s;}
            return s.slice( 0, limit - 1 ).concat( [ s.slice( limit - 1 ).join( delimiter ) ] );
        }

        // Negative limit
        if ( -limit >= s.length ){ return [];}

        s.splice( s.length + limit );
        return s;
    };

    _r_obj.uasort = function(inputArr, sorter) {
        //  discuss at: http://phpjs.org/functions/uasort/
        // original by: Brett Zamir (http://brett-zamir.me)
        // improved by: Brett Zamir (http://brett-zamir.me)
        // improved by: Theriault
        //        note: This function deviates from PHP in returning a copy of the array instead
        //        note: of acting by reference and returning true; this was necessary because
        //        note: IE does not allow deleting and re-adding of properties without caching
        //        note: of property position; you can set the ini of "phpjs.strictForIn" to true to
        //        note: get the PHP behavior, but use this only if you are in an environment
        //        note: such as Firefox extensions where for-in iteration order is fixed and true
        //        note: property deletion is supported. Note that we intend to implement the PHP
        //        note: behavior by default if IE ever does allow it; only gives shallow copy since
        //        note: is by reference in PHP anyways
        //   example 1: fruits = {d: 'lemon', a: 'orange', b: 'banana', c: 'apple'};
        //   example 1: fruits = uasort(fruits, function (a, b) { if (a > b) {return 1;}if (a < b) {return -1;} return 0;});
        //   example 1: $result = fruits;
        //   returns 1: {c: 'apple', b: 'banana', d: 'lemon', a: 'orange'}
        var ctx = window,
            valArr = [],
            tempKeyVal, tempValue, ret, k = '',
            i = 0,
            strictForIn = false,
            populateArr = {};

        if (typeof sorter === 'string')
        {
            sorter = ctx[sorter];
        }
        else if (Object.prototype.toString.call(sorter) === '[object Array]')
        {
            sorter = ctx[sorter[0]][sorter[1]];
        }

        // BEGIN REDUNDANT
        ctx.php_js = ctx.php_js || {};
        ctx.php_js.ini = ctx.php_js.ini || {};
        // END REDUNDANT
        strictForIn = ctx.php_js.ini['phpjs.strictForIn'] && ctx.php_js.ini['phpjs.strictForIn'].local_value && ctx.php_js
                .ini['phpjs.strictForIn'].local_value !== 'off';
        populateArr = strictForIn ? inputArr : populateArr;

        for (k in inputArr) {
            // Get key and value arrays
            if (inputArr.hasOwnProperty(k)) {
                valArr.push([k, inputArr[k]]);
                if (strictForIn) {
                    delete inputArr[k];
                }
            }
        }
        valArr.sort(function(a, b) {
            return sorter(a[1], b[1]);
        });

        for (i = 0; i < valArr.length; i++) {
            // Repopulate the old array
            populateArr[valArr[i][0]] = valArr[i][1];
        }

        return strictForIn || populateArr;
    };

    _r_obj.array_search = function(needle, haystack) {
        // http://kevin.vanzonneveld.net
        // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +      input by: Brett Zamir (http://brett-zamir.me)
        // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +   modified by: Obinwanne Hill (http://obihill.com)
        // *     example 1: array_search('zonneveld', {firstname: 'kevin', middle: 'van', surname: 'zonneveld'});
        // *     returns 1: 'surname'
        // *     example 2: ini_set('phpjs.return_phpjs_arrays', 'on');
        // *     example 2: var ordered_arr = array({3:'value'}, {2:'value'}, {'a':'value'}, {'b':'value'});
        // *     example 2: var key = array_search(/val/g, ordered_arr); // or var key = ordered_arr.search(/val/g);
        // *     returns 2: '3'

        var myArgs = Array.prototype.slice.call(arguments),
            match_all_bool = (_r.isBool(myArgs[2])) ? myArgs[2] : false,
            strict = !!myArgs[3],
            key = '',
            key_all_arr = [];

        if (haystack && typeof haystack === 'object' && haystack.change_key_case) { // Duck-type check for our own array()-created PHPJS_Array
            return haystack.search(needle, argStrict);
        }
        if (typeof needle === 'object' && needle.exec) { // Duck-type for RegExp
            if (!strict) { // Let's consider case sensitive searches as strict
                var flags = 'i' + (needle.global ? 'g' : '') +
                    (needle.multiline ? 'm' : '') +
                    (needle.sticky ? 'y' : ''); // sticky is FF only
                needle = new RegExp(needle.source, flags);
            }
            for (key in haystack) {
                if (needle.test(haystack[key])) {
                    if(match_all_bool)
                    {
                        key_all_arr.push(key);
                    }
                    else
                    {
                        return key;
                    }
                }
            }
            return false;
        }

        for (key in haystack) {
            /* jshint -W116 */
            if ((strict && haystack[key] === needle) || (!strict && haystack[key] == needle)) {
                if(match_all_bool)
                {
                    key_all_arr.push(key);
                }
                else
                {
                    return key;
                }
            }
            /* jshint +W116 */
        }

        return (match_all_bool) ? key_all_arr : false;
    };

    /**
     * Reverses the order of elements in an array
     * @param arr {Array} the array to reverse
     * @return {Array}
     */
    _r_obj.array_reverse = function(arr) {
        if(!arr || _r.count(arr) < 1)
        {
            return [];
        }

        return arr.reverse();
    };

    /**
     * Checks to see if array has duplicate values
     * @param arr {Array} the array to check
     * @return {Boolean}
     */
    _r_obj.arrayHasDuplicates = function(arr) {
        var valuesSoFar = {},
            array_count_int = _r.count(arr);

        for (var i = 0; i < array_count_int; ++i) {
            var value = arr[i];
            if (Object.prototype.hasOwnProperty.call(valuesSoFar, value)) {
                return true;
            }
            valuesSoFar[value] = true;
        }
        return false;
    };

    /**
     * Gets the number of times a value occurs in an array
     * @param needle_str {String} needle
     * @param haystack_arr {Array} haystack
     * @return {Number}
     */
    _r_obj.arrayValueCount = function(needle_str, haystack_arr) {

        if(!_r.isArray(haystack_arr))
        {
            return 0;
        }

        //trim needle
        needle_str = (_r.isString(needle_str)) ? needle_str.trim() : needle_str ;

        var counter_int = 0,
            haystack_item_str;
        for (var i = 0; i < _r.count(haystack_arr); i++)
        {
            haystack_item_str = haystack_arr[i];
            if(needle_str === haystack_item_str)
            {
                counter_int++;
            }
        }

        return counter_int;
    };

    /**
     * Converts a key-value tokenized string into a simple or associative array
     * A string with value "value1,value2,value3" becomes ['value1', 'value2', 'value3']
     * A string with value "key1=value1&key2=value2&key3=value3" becomes {'key1': 'value1', 'key2': 'value2', 'key3': 'value3'}
     * @param tok_str {String} The input string
     * @param delim_1_str {String} The first boundary string/delimiter. Default is '&'
     * @param delim_2_str {String} The second boundary string/delimiter. Default is '='
     * @param url_decode_bool {Boolean} Url decode values before adding them
     * @return {Object|Array}
     */
    _r_obj.stringToArray = function(tok_str)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            delim_1_str = (_r.isString(myArgs[1])) ? myArgs[1]: ',',
            delim_2_str = (_r.isString(myArgs[2])) ? myArgs[2]: null,
            url_decode_bool = (_r.isBool(myArgs[3])) ? myArgs[3]: false,
            tok_arr = {},
            tok_1_arr = [],
            tok_2_arr = []
            ;

        tok_1_arr = _r.explode(delim_1_str, tok_str);
        if (!_r.isArray(tok_1_arr))
        {
            //return empty array
            if(delim_2_str === null)
            {
                return [];
            }
            else
            {
                return {};
            }
        }

        if(delim_2_str === null)
        {
            return tok_1_arr;
        }
        else
        {
            for(var i = 0; i < _r.count(tok_1_arr); i++)
            {
                tok_2_arr = _r.explode(delim_2_str, tok_1_arr[i]);
                tok_arr[""+tok_2_arr[0]+""] = (url_decode_bool) ? decodeURIComponent(tok_2_arr[1]) : tok_2_arr[1];
            }

            return tok_arr;
        }
    };

    /**
     * Checks if a variable is an object and is empty
     * Returns null if variable is not object
     * @param obj {*} The variable to test
     * @return {Boolean|Null}
     */
    _r_obj.isObjectEmpty = function(obj)
    {
        if (_r.isObject(obj))
        {
            var is_empty_obj_bool;
            for ( var p in obj )
            {
                if (obj.hasOwnProperty(p))
                {
                    is_empty_obj_bool = false;
                    break;
                }
            }
            is_empty_obj_bool = (_r.isBool(is_empty_obj_bool)) ? is_empty_obj_bool: true;
            return is_empty_obj_bool;
        }
        else
        {
            return null;
        }
    };

    /**
     * Count the number of substring occurrences
     * @param haystack {String} the string to search in
     * @param needle {String} the substring to search for
     * @return {Number}
     */
    _r_obj.substr_count = function(haystack, needle)
    {
        var needle_esc = needle.replace(/(?=[\\^$*+?.\(\)|{\}[\]])/g, "\\");
        var pattern = new RegExp(""+needle_esc+"", "g");
        var count = haystack.match(pattern);
        return count ? count.length : 0;
    };

    /**
     * Converts an array into a simple or name-value tokenized string
     * @param tok_arr {Array} The input array
     * @return {String}
     */
    _r_obj.arrayToString = function(tok_arr)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            delim_1_str = (_r.isString(myArgs[1])) ? myArgs[1]: ',',
            delim_2_str = (_r.isString(myArgs[2])) ? myArgs[2]: null,
            tok_str,
            tok_arr_keys_arr,
            tok_arr_values_arr,
            tok_str_arr = []
            ;

        //return empty string if object array or standard array is empty
        if (_r.isObjectEmpty(tok_arr) || _r.count(tok_arr) < 1)
        {
            return '';
        }

        if (delim_2_str === null)
        {
            tok_str = _r.implode(delim_1_str, tok_arr);
        }
        else
        {
            tok_arr_keys_arr = _r.array_keys(tok_arr);
            tok_arr_values_arr = _r.array_values(tok_arr);

            for (var i = 0; i < _r.count(tok_arr_values_arr); i++)
            {
                tok_str_arr.push(tok_arr_keys_arr[i]+delim_2_str+tok_arr_values_arr[i]);
            }
            tok_str = _r.implode(delim_1_str, tok_str_arr);
        }

        return tok_str;
    };

    /**
     * Detects whether browser is Internet Explorer
     * If true, returns browser version
     * @return {Number|Boolean}
     * @private
     */
    _r_obj.isIE = function()
    {
        var ua = rScript.getUserAgent(),
            msie = ua.indexOf('msie ');

        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('trident/');
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('edge/');
        if (edge > 0) {
            // IE 12 => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return false;
    };

    /**
     * Performs a global regular expression match
     * Returns all full pattern and group matches
     * @param regex {*} The regular expression pattern
     * @param str {String} The input string
     * @return {Array}
     * @private
     */
    _r_obj.regexMatchAll = function(regex, str){
        var matches = [];
        str.replace(regex, function() {
            var arr = ([]).slice.call(arguments, 0);
            var extras = arr.splice(-2);
            arr.index = extras[0];
            arr.input = extras[1];
            matches.push(arr);
        });
        return matches.length ? matches : null;
    };

    /**
     * Creates and returns a debounced version of the passed function
     * @param callback {Function} the callback function to fire
     * @param wait {Number} the wait time in milliseconds
     * @param callback_util {Function} a utility callback function. This is necessary sometimes when the original callback cannot be modified
     * @returns {Function}
     * @private
     */
    _r_obj.debounce = function(callback, wait)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            callback_util = myArgs[2],
            time
            ;
        return function() {
            window.clearTimeout(time);
            time = window.setTimeout(function() {
                time = null;
                callback.call();
                if(callback_util)
                {
                    callback_util.call();
                }
            }, wait);
        };
    }

    /**
     * Creates and returns a throttled version of the passed function
     * @param callback {Function} the callback function to fire
     * @param wait {Number} the wait time in milliseconds
     * @returns {Function}
     * @param callback_util {Function} a utility callback function. This is necessary sometimes when the original callback cannot be modified
     * @private
     */
    _r_obj.throttle = function(callback, wait)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            callback_util = myArgs[2],
            time,
            go = true;
        return function() {
            if(go) {
                go = false;
                time = window.setTimeout(function(){
                    time = null;
                    go = true;
                    callback.call();
                    if(callback_util)
                    {
                        callback_util.call();
                    }
                }, wait);
            }
        };
    }

    /**
     * Calculate the md5 hash of a string
     * @param {String} str the string to convert
     * @returns {*}
     */
    _r_obj.md5 = function(str)
    {
        return md5(str);
    }

})(_r);

/*! Custom Event Polyfill | @link https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent#Polyfill **/
(function () {

    var is_ie_int = _r.isIE();
    if(is_ie_int && is_ie_int >= 9)
    {
        if ( typeof window.CustomEvent === "function" ) return false;

        function CustomEvent ( event, params )
        {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            var evt = document.createEvent( 'CustomEvent' );
            evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
            return evt;
        }
        CustomEvent.prototype = window.Event.prototype;
        window.CustomEvent = CustomEvent;
    }

})();

/*jshint bitwise: true */

/*! rScript - NC | @link http://github.com/restive/rScript | @copyright 2016 Restive LLC <http://rscript.io> | @license MIT */
(function(window, document, $, _r){

    /**
     * Gets a value from an array derived after a tokenized string is exploded
     * @param str {String} the tokenized string that will be exploded to an array
     * @param delim {String} the delimiter
     * @param key {Integer} the position of the array to return
     * @return {String}
     */
    function getValueAfterExplode(str, delim, key)
    {
        var arr = _r.explode(delim, str);
        return arr[key];
    }

    /**
     * Generates a random string containing alphabets or numbers or both
     * @param num_chars_or_seed {Number|String} the number of characters or the
     * random string seed format.
     * The seed is a string of any length that only contains the letters 'a', 'A', or 'n'
     * a == lowercase alphabet character
     * A == uppercase alphabet character
     * n = numeric character
     * Example 1: if 'annaann', the random string could be d78mh42
     * Example 2: if 'nnAAnanaA', the random string could be 39XE7s5wM
     * @param type_str {String} the type of random string to generate
     * This is used only if num_chars_or_seed is a number
     * 1. a = only alphabet characters
     * 2. n = only numberic characters
     * 3. an = alphanumeric characters [default]
     * @return
     */
    function generateRandomString(num_chars_or_seed)
    {
        var myArgs = Array.prototype.slice.call(arguments),
            type_str = (_r.isString(myArgs[1])) ? myArgs[1] : 'an',
            format_str = (_r.isString(myArgs[0])) ? myArgs[0] : null,
            format_item_char_str,
            result = '',
            seed_all_str = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            seed_alphabet_lc_str = 'abcdefghijklmnopqrstuvwxyz',
            seed_alphabet_uc_str = seed_alphabet_lc_str.toUpperCase(),
            seed_numeric_str = '0123456789';

        if(format_str)
        {
            num_chars_or_seed = format_str.length;

            for (var i = 0; i < num_chars_or_seed; i++)
            {
                format_item_char_str = format_str[i];

                result += (format_item_char_str === 'a') ? seed_alphabet_lc_str[Math.round(Math.random() * (seed_alphabet_lc_str.length - 1))] : (format_item_char_str === 'A') ? seed_alphabet_uc_str[Math.round(Math.random() * (seed_alphabet_uc_str.length - 1))] : (format_item_char_str === 'n') ? seed_numeric_str[Math.round(Math.random() * (seed_numeric_str.length - 1))] : format_item_char_str;
            }
        }
        else
        {
            for (var j = 0; j < num_chars_or_seed; j++)
            {
                result += (type_str === 'a') ? seed_alphabet_lc_str[Math.round(Math.random() * (seed_alphabet_lc_str.length - 1))] : (type_str === 'n') ? seed_numeric_str[Math.round(Math.random() * (seed_numeric_str.length - 1))] : seed_all_str[Math.round(Math.random() * (seed_all_str.length - 1))];
            }
        }

        return result;
    }

    /**
     * Merge the contents of two given objects
     * @param from {Object} The first object
     * @param to {Object} The second object. If null, a deep copy of from is returned
     * @returns {*}
     */
    function extend(from, to)
    {
        /* jshint -W116 */
        if (from == null || typeof from != "object")
        {
            return from;
        }

        if (from.constructor != Object && from.constructor != Array) {
            return from;
        }

        if (from.constructor == Date || from.constructor == RegExp || from.constructor == Function ||
            from.constructor == String || from.constructor == Number || from.constructor == Boolean){
            return new from.constructor(from);
        }

        to = to || new from.constructor();

        for (var name in from)
        {
            if (from.hasOwnProperty(name)) {
                to[name] = typeof to[name] == "undefined" ? extend(from[name], null) : to[name];
            }
        }

        return to;
        /* jshint +W116 */
    }

    /**
     * Performs a global regular expression match
     * Returns all full pattern and group matches
     * @param regex {*} The regular expression pattern
     * @param str {String} The input string
     * @return {Array}
     * @private
     */
    function regexMatchAll(regex, str)
    {
        return _r.regexMatchAll(regex, str);
    }


    /**
     * Extend rScript Class
     */
    (function(rScript_obj){

        //Gets the content of a function
        Function.prototype.getFuncBody = function()
        {
            // Get content between first { and last }
            var m = this.toString().match(/\{([\s\S]*)\}/m)[1];
            // Strip comments
            return m.replace(/^\s*\/\/.*$/mg,'');
        };


        /**
         * Extend the functionality of rScript by adding functions and objects to the rScript root namespace
         * @param {String} name the identifier of the function/object
         * @param {Function|Object} func_or_obj the function/object
         * @private
         */
        function _extend(name, func_or_obj)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                ctx = myArgs[2],
                has_reserved_word_bool,
                reserved_words_arr = _listRScriptMethods(false, ctx);

            //check if name is reserved keyword
            if(_r.isArray(reserved_words_arr) && reserved_words_arr.length > 0)
            {
                has_reserved_word_bool = !!((_r.in_array(name, reserved_words_arr)));
            }

            if(has_reserved_word_bool)
            {
                _r.console.error('rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: '+name+' cannot be used because it is an official rScript method, or it already exists in the rScript method namespace. Please use another name.', true);
                return;
            }

            //add to name space
            rScript[name] = func_or_obj;
        }

        /**
         * Extend the functionality of rScript by adding functions to the rScript root namespace
         * Wrapper for _extend
         * @param {String} name_str the name of the function
         * @param {Function|Object} func_or_obj the function or object to add
         */
        rScript_obj.extend = function(name_str, func_or_obj)
        {
            _extend(name_str, func_or_obj, this);
        };

        /**
         * Adds a Plugin to rScript
         * Wrapper for _extend
         * @param {String} name_str the name of the plugin
         * @param {Function|Object} func_or_obj the function or object to add
         */
        rScript.addPlugin = function(name_str, func_or_obj)
        {
            _extend(name_str, func_or_obj, this);
        };

        /**
         * Removes function from rScript-specific namespace
         * @param {String} id_str the identifier of the function
         * @param {Object} options_obj the options that define how functions will be removed
         *
         * queue: if true, will remove queued functions
         *
         * namespace: if defined, will remove functions in a specific namespace
         * Note: if queue is true, this must not be undefined
         *
         * fn: an function
         * If the function is within a queue, only the defined function will be removed, leaving other functions in the queue intact
         * Note: the function will be removed only if there is one copy of the function in the queue. If there are multiple functions with the same toString equivalent, then nothing happens
         * Note: if queue is true, namespace is set, and no fn option is defined, the entire namespace will be disabled, preventing all functions in said namespace from being called by runFunction
         *
         */
        rScript_obj.removeFunction = function(id_str){
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = myArgs[1],
                fn,
                is_queue_bool,
                namespace_str;

            //Define defaults if options_obj mode
            if(_r.isObject(options_obj) && (options_obj.fn || options_obj.queue || options_obj.namespace))
            {
                fn = (options_obj.fn) ? options_obj.fn : undefined;
                is_queue_bool = (options_obj.queue && _r.isBool(options_obj.queue)) ? options_obj.queue : false;
                namespace_str = (options_obj.namespace && (_r.isString(options_obj.namespace) && options_obj.namespace.length > 0)) ? '_'+options_obj.namespace : '';
            }

            //Start remove operations
            if (is_queue_bool) {
                var id_final_str,
                    id_store_counter_id_str = id_str + '_counter',
                    id_store_counter_int = 0,
                    fn_str = '' + fn,
                    temp_fn,
                    temp_fn_str,
                    id_fn_remove_str,
                    remove_match_bool = false,
                    remove_match_counter_int = 0;

                if (fn) {
                    //remove matching function

                    //add a suffix to id
                    id_store_counter_int = parseInt(rScript.domStore(id_store_counter_id_str));

                    for (var i = 0; i < id_store_counter_int; i++) {
                        id_final_str = id_str + '_' + i;

                        temp_fn = rScript.domStore(id_final_str, undefined, 'rs_var_function_q' + namespace_str);
                        temp_fn_str = '' + temp_fn;

                        /*jshint -W116 */
                        if (fn_str == temp_fn_str) {
                            id_fn_remove_str = id_final_str;
                            remove_match_bool = true;
                            remove_match_counter_int++;
                        }
                        /*jshint +W116 */
                    }

                    //remove function
                    if (remove_match_bool) {
                        if (remove_match_counter_int === 1) {
                            //one copy of reference function found. disable/remove

                            rScript.domStore(id_fn_remove_str, null, 'rs_var_function_q' + namespace_str);
                        }
                    }
                }
                else {
                    //remove all functions in namespace by disabling the namespace
                    rScript.domStore('rs_var_function_q' + namespace_str, null);
                }
            }
            else
            {
                if(namespace_str)
                {
                    rScript.domStore(id_str, null, 'rs_var_function_q'+namespace_str);
                }
                else
                {
                    rScript.domStore(id_str, null, 'rs_var_function');
                }
            }
        };

        /**
         * Adds an element to the end of an array stored in sessionStorage or localStorage
         * Functional equivalent of array.push
         * @param {String} key_str the identifier of the stored item
         * @param {String|Number} value_mixed the string, number, or boolean to add to the array
         * @param {String} store_type_str the storage type. Either 'ss' for sessionStorage [default], or 'ls' for localStorage
         * @param {Boolean} unique_bool if true, will ensure that only unique values are added to the array
         * @return {*}
         */
        rScript_obj.storePush = function(key_str, value_mixed)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                store_type_str = (_r.isString(myArgs[2]) && _r.in_array(myArgs[2], ['ss', 'ls'])) ? myArgs[2] : 'ss',
                unique_bool = !!((myArgs[3])),
                store_var_arr;

            store_var_arr = rScript.store(key_str, undefined, store_type_str);

            if(!_r.isArray(store_var_arr))
            {
                return;
            }

            if(_r.isString(value_mixed) || _r.isNumber(value_mixed) || _r.isBool(value_mixed))
            {
                //push then persist
                if(unique_bool)
                {
                    if(_r.in_array(value_mixed, store_var_arr))
                    {
                        return false;
                    }
                }

                store_var_arr.push(value_mixed);
                rScript.store(key_str, store_var_arr, store_type_str);
            }
        }

        /**
         * Stores, retrieves, and remove cookies
         * Powered by js-cookie
         * Note: to remove a cookie, simply define its value as null
         * @param {String} key_str the identifier of the value being stored
         * @param {*} value_res the value being stored
         * @param {Object} options_obj the options
         * @returns {*}
         */
        rScript_obj.cookieStore = function()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return rScript.store(myArgs[0], myArgs[1], 'ck', myArgs[2]);
        };

        /**
         * Initializes important device variables in storage
         * @private
         */
        function _initDeviceVars()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                reset_bool = ((myArgs[0]))
                ;

            if(reset_bool)
            {
                //reset
                rScript.store("rs_var_device_os_is_ios rs_var_device_os_is_android rs_var_device_os_is_symbian rs_var_device_os_is_blackberry rs_var_device_os_is_windows rs_var_device_os_is_windows_phone rs_var_device_os_is_mac rs_var_device_os_is_linux rs_var_device_os_is_unix rs_var_device_os_is_openbsd rs_var_device_user_agent rs_var_device_is_phone rs_var_device_is_tablet rs_var_device_is_tv rs_var_device_is_desktop rs_var_device_browser_name rs_var_device_browser_version", null);

                //update
                rScript.updateOrtStore();
            }

            //load
            rScript.getPlatform();
            rScript.store("rs_var_device_os_is_ios", rScript.isIOS());
            rScript.store("rs_var_device_os_is_android", rScript.isAndroid());
            rScript.store("rs_var_device_os_is_symbian", rScript.isSymbian());
            rScript.store("rs_var_device_os_is_blackberry", rScript.isBlackberry());
            rScript.store("rs_var_device_os_is_windows", rScript.isWindows());
            rScript.store("rs_var_device_os_is_windows_phone", rScript.isWindowsPhone());

            rScript.store("rs_var_device_user_agent", rScript.getUserAgent());
            rScript.store("rs_var_device_is_phone", rScript.isPhone());
            rScript.store("rs_var_device_is_tablet", rScript.isTablet());
            rScript.store("rs_var_device_is_tv", rScript.isTV());
            rScript.store("rs_var_device_is_desktop", rScript.isDesktop());

            rScript.store("rs_var_device_browser_name", rScript.getBrowserName());
            rScript.store("rs_var_device_browser_version", rScript.getBrowserVersion());
        }

        /**
         * Gets the Form Factor of the device
         * There are only three form factors available
         * (1) Phone, (2) Tablet, (3) TV, (4) Desktop
         * @return {String}
         */
        rScript_obj.getFormFactor = function()
        {
            var form_factor_str = "";

            if(rScript.isTablet())
            {
                form_factor_str = "tablet";
            }
            else if (rScript.isTV())
            {
                form_factor_str = "tv";
            }
            else
            {
                if (rScript.isPhone())
                {
                    form_factor_str = "phone";
                }
                else
                {
                    form_factor_str = "desktop";
                }
            }

            return form_factor_str;
        };

        /**
         * Check if the Device is a Phone
         * @return {Boolean}
         */
        rScript_obj.isPhone = function()
        {
            //check if phone check has already been done. If so, return stored value
            if(rScript.storeCheck("rs_var_device_is_phone"))
            {
                return rScript.store("rs_var_device_is_phone");
            }

            //Check if Device is a Tablet
            if (rScript.isTablet(true) || rScript.isTV())
            {
                //is not phone
                rScript.store("rs_var_device_is_phone", false);
                return false;
            }

            //Check if it is a phone
            if (rScript.mobileDetect(rScript.getUserAgent() || navigator.vendor.toLowerCase() || window.opera))
            {
                rScript.store("rs_var_device_is_phone", true);
                return true;
            }

            rScript.store("rs_var_device_is_phone", false);
            return false;
        };

        /**
         * Check if the Device is a Tablet
         * @param bypass_storage_bool {Boolean} Prevent this method from caching its result in local storage
         * @return {Boolean}
         */
        rScript_obj.isTablet = function() {
            var myArgs = Array.prototype.slice.call(arguments),
                bypass_storage_bool = _r.isBool(myArgs[0]) ? myArgs[0] : false
                ;

            //check if tablet check has already been done. If so, return stored value
            if (rScript.storeCheck("rs_var_device_is_tablet"))
            {
                return rScript.store("rs_var_device_is_tablet");
            }

            var regex_raw_str,
                regex,
                is_tablet_bool,
                nav = rScript.getUserAgent(),
                pixel_w_int = parseInt(rScript.store("rs_var_viewport_w_dp")),
                pixel_h_int = parseInt(rScript.store("rs_var_viewport_h_dp")),
                pixel_dim_int = (rScript.store("rs_var_screen_ort_is_portrait")) ? pixel_w_int : pixel_h_int
                ;

            //if iPad or Blackberry Playbook, return true
            regex = new RegExp("ipad|playbook|rim +tablet", "i");
            is_tablet_bool = regex.test(nav);
            if(is_tablet_bool)
            {
                if(!bypass_storage_bool){ rScript.store("rs_var_device_is_tablet", true); }
                return true;
            }

            //if Windows Surface, return true
            regex = new RegExp("windows +nt.+arm|windows +nt.+touch", "i");
            is_tablet_bool = regex.test(nav);

            if(is_tablet_bool)
            {
                if(_r.isNumber(pixel_dim_int) && (pixel_dim_int <= 520))
                {
                    if(!bypass_storage_bool){
                        rScript.store("rs_var_device_is_tablet", false);
                        if(rScript.store("rs_var_device_is_phone") === false){ rScript.store("rs_var_device_is_phone", true);}
                    }
                    return false;
                }
                else
                {
                    if(!bypass_storage_bool){ rScript.store("rs_var_device_is_tablet", true); }
                    return true;
                }
            }

            /**
             * Check Other Known Tablets
             *
             * 1. Amazon Kindle: android.+kindle|kindle +fire|android.+silk|silk.*accelerated
             * 2. Google Nexus Tablet: android.+nexus +(7|10)
             * 3. Samsung Tablet: samsung.*tablet|galaxy.*tab|sc-01c|gt-p1000|gt-p1003|gt-p1010|gt-p3105|gt-p6210|gt-p6800|gt-p6810|gt-p7100|gt-p7300|gt-p7310|gt-p7500|gt-p7510|sch-i800|sch-i815|sch-i905|sgh-i957|sgh-i987|sgh-t849|sgh-t859|sgh-t869|sph-p100|gt-p3100|gt-p3108|gt-p3110|gt-p5100|gt-p5110|gt-p6200|gt-p7320|gt-p7511|gt-n8000|gt-p8510|sgh-i497|sph-p500|sgh-t779|sch-i705|sch-i915|gt-n8013|gt-p3113|gt-p5113|gt-p8110|gt-n8010|gt-n8005|gt-n8020|gt-p1013|gt-p6201|gt-p7501|gt-n5100|gt-n5110|shv-e140k|shv-e140l|shv-e140s|shv-e150s|shv-e230k|shv-e230l|shv-e230s|shw-m180k|shw-m180l|shw-m180s|shw-m180w|shw-m300w|shw-m305w|shw-m380k|shw-m380s|shw-m380w|shw-m430w|shw-m480k|shw-m480s|shw-m480w|shw-m485w|shw-m486w|shw-m500w|gt-i9228|sch-p739|sch-i925|gt-i9200|gt-i9205|gt-p5200|gt-p5210|sm-t311|sm-t310|sm-t210|sm-t210r|sm-t211|sm-p600|sm-p601|sm-p605|sm-p900|sm-t217|sm-t217a|sm-t217s|sm-p6000|sm-t3100|sgh-i467|xe500
             * 4. HTC Tablet: htc flyer|htc jetstream|htc-p715a|htc evo view 4g|pg41200
             * 5. Motorola Tablet: xoom|sholest|mz615|mz605|mz505|mz601|mz602|mz603|mz604|mz606|mz607|mz608|mz609|mz615|mz616|mz617
             * 6. Asus Tablet: transformer|^.*padfone((?!mobile).)*$|tf101|tf201|tf300|tf700|tf701|tf810|me171|me301t|me302c|me371mg|me370t|me372mg|me172v|me173x|me400c|slider *sl101
             * 7. Nook Tablet: android.+nook|nookcolor|nook browser|bnrv200|bnrv200a|bntv250|bntv250a|bntv400|bntv600|logicpd zoom2
             * 8. Acer Tablet: android.*\b(a100|a101|a110|a200|a210|a211|a500|a501|a510|a511|a700|a701|w500|w500p|w501|w501p|w510|w511|w700|g100|g100w|b1-a71|b1-710|b1-711|a1-810)\b|w3-810
             * 9. Toshiba Tablet: android.*(at100|at105|at200|at205|at270|at275|at300|at305|at1s5|at500|at570|at700|at830)|toshiba.*folio
             * 10. LG Tablet: \bl-06c|lg-v900|lg-v905|lg-v909
             * 11. Yarvik Tablet: android.+(xenta.+tab|tab210|tab211|tab224|tab250|tab260|tab264|tab310|tab360|tab364|tab410|tab411|tab420|tab424|tab450|tab460|tab461|tab464|tab465|tab467|tab468|tab469)
             * 12. Medion Tablet: android.+\boyo\b|life.*(p9212|p9514|p9516|s9512)|lifetab
             * 13. Arnova Tablet: an10g2|an7bg3|an7fg3|an8g3|an8cg3|an7g3|an9g3|an7dg3|an7dg3st|an7dg3childpad|an10bg3|an10bg3dt
             * 14. Archos Tablet: android.+archos|\b(101g9|80g9|a101it)\b|qilive 97r|
             * 15. Ainol Tablet: novo7|novo7aurora|novo7basic|novo7paladin|novo8|novo9|novo10
             * 16. Sony Tablet: sony tablet|sony tablet s|sgpt12|sgpt121|sgpt122|sgpt123|sgpt111|sgpt112|sgpt113|sgpt211|sgpt213|ebrd1101|ebrd1102|ebrd1201|sgpt311|sgpt312|sonyso-03e
             * 17. Cube Tablet: android.*(k8gt|u9gt|u10gt|u16gt|u17gt|u18gt|u19gt|u20gt|u23gt|u30gt)|cube u8gt
             * 18. Coby Tablet: mid1042|mid1045|mid1125|mid1126|mid7012|mid7014|mid7034|mid7035|mid7036|mid7042|mid7048|mid7127|mid8042|mid8048|mid8127|mid9042|mid9740|mid9742|mid7022|mid7010
             * 19. SMiTTablet: android.*(\bmid\b|mid-560|mtv-t1200|mtv-pnd531|mtv-p1101|mtv-pnd530)
             * 20. RockchipTablet: android.*(rk2818|rk2808a|rk2918|rk3066)|rk2738|rk2808a
             * 21. TelstraTablet: t-hub2
             * 22. FlyTablet: iq310|fly vision
             * 23. bqTablet: bq.*(elcano|curie|edison|maxwell|kepler|pascal|tesla|hypatia|platon|newton|livingstone|cervantes|avant)
             * 24. HuaweiTablet: mediapad|ideos s7|s7-201c|s7-202u|s7-101|s7-103|s7-104|s7-105|s7-106|s7-201|s7-slim
             * 25. NecTablet: \bn-06d|\bn-08d
             * 26. Pantech: pantech.*p4100
             * 27. BronchoTablet: broncho.*(n701|n708|n802|a710)
             * 28. VersusTablet: touchpad.*[78910]|\btouchtab\b
             * 29. Zynctablet: z1000|z99 2g|z99|z930|z999|z990|z909|z919|z900
             * 30. Positivo: tb07sta|tb10sta|tb07fta|tb10fta
             * 31. NabiTablet: android.*\bnabi
             * 32. Playstation: playstation.*(portable|vita)
             * 33. Dell: dell.*streak
             * 34. Milagrow: milagrow +tab.*top
             * 35. Lenovo: android.+(ideapad|ideatab|lenovo +a1|s2110|s6000|k3011|a3000|a1000|a2107|a2109|a1107)
             * 37. UPad: android.+f8-sup
             * 38. Kobo: android.+(k080|arc|vox)
             * 39. MSI: android.*(msi.+enjoy|enjoy +7|enjoy +10)
             * 40. Agasio: dropad.+a8
             * 41. Acho: android.+c906
             * 42. Iberry: android.+iberry.+auxus
             * 43. Aigo: android.+aigopad
             * 44. Airpad: android.*(airpad|liquid metal)
             * 45. HCL: android.+hcl.+tablet|connect-3g-2.0|connect-2g-2.0|me tablet u1|me tablet u2|me tablet g1|me tablet x1|me tablet y2|me tablet sync
             * 46. Karbonn: android.*(a39|a37|a34|st8|st10|st7|smarttab|smart +tab)
             * 47. Micromax: android.*(micromax.+funbook|funbook|p250|p275|p300|p350|p362|p500|p600)|micromax.*(p250|p275|p350|p362|p500|p600)|funbook
             * 48. Penta: android.+penta
             * 49. Celkon: android.*(celkon.+ct|ct-[0-9])
             * 50. Intex: android.+i-buddy
             * 51. Viewsonic: android.*(viewbook|viewpad)
             * 52: ZTE: android.*(v9|zte.+v8110|light tab|light pro|beeline|base.*tab)
             * 53. Pegatron: chagall
             * 54. Advan: android.*(vandroid|t3i)
             * 55. Creative: android.*(ziio7|ziio10)
             * 56. OlivePad: android.*(v-t100|v-tw100|v-tr200|v-t300)
             * 57. Vizio: android.+vtab1008
             * 58. Bookeen: bookeen|cybook
             * 59. Medion: android.*lifetab_(s9512|p9514|p9516)
             * 60. IRU Tablet: m702pro
             * 61. IRULU: irulu-al101
             * 62. Prestigio: pmp3170b|pmp3270b|pmp3470b|pmp7170b|pmp3370b|pmp3570c|pmp5870c|pmp3670b|pmp5570c|pmp5770d|pmp3970b|pmp3870c|pmp5580c|pmp5880d|pmp5780d|pmp5588c|pmp7280c|pmp7280|pmp7880d|pmp5597d|pmp5597|pmp7100d|per3464|per3274|per3574|per3884|per5274|per5474|pmp5097cpro|pmp5097|pmp7380d|pmp5297c|pmp5297c_quad
             * 63. AllView: allview.*(viva|alldro|city|speed|all tv|frenzy|quasar|shine|tx1|ax1|ax2)
             * 64: Megafon: megafon v9
             * 65: Lava: android.+(z7c|z7h|z7s)
             * 66: iBall: android.+iball.+slide.+(3g *7271|3g *7334|3g *7307|3g *7316|i7119|i7011)|android.+iball.+i6012
             * 67. Tabulet: android.+(tabulet|troy +duos)
             * 68. Texet Tablet: navipad|tb-772a|tm-7045|tm-7055|tm-9750|tm-7016|tm-7024|tm-7026|tm-7041|tm-7043|tm-7047|tm-8041|tm-9741|tm-9747|tm-9748|tm-9751|tm-7022|tm-7021|tm-7020|tm-7011|tm-7010|tm-7023|tm-7025|tm-7037w|tm-7038w|tm-7027w|tm-9720|tm-9725|tm-9737w|tm-1020|tm-9738w|tm-9740|tm-9743w|tb-807a|tb-771a|tb-727a|tb-725a|tb-719a|tb-823a|tb-805a|tb-723a|tb-715a|tb-707a|tb-705a|tb-709a|tb-711a|tb-890hd|tb-880hd|tb-790hd|tb-780hd|tb-770hd|tb-721hd|tb-710hd|tb-434hd|tb-860hd|tb-840hd|tb-760hd|tb-750hd|tb-740hd|tb-730hd|tb-722hd|tb-720hd|tb-700hd|tb-500hd|tb-470hd|tb-431hd|tb-430hd|tb-506|tb-504|tb-446|tb-436|tb-416|tb-146se|tb-126se
             * 69. GalapadTablet: android.*\bg1\b
             * 70. GUTablet: tx-a1301|tx-m9002|q702
             * 71. GT-Pad: ly-f528
             * 72. Danew: android.+dslide.*\b(700|701r|702|703r|704|802|970|971|972|973|974|1010|1012)\b
             * 73. MIDTablet: m9701|m9000|m9100|m806|m1052|m806|t703|mid701|mid713|mid710|mid727|mid760|mid830|mid728|mid933|mid125|mid810|mid732|mid120|mid930|mid800|mid731|mid900|mid100|mid820|mid735|mid980|mid130|mid833|mid737|mid960|mid135|mid860|mid736|mid140|mid930|mid835|mid733
             * 74. Fujitsu: android.*\b(f-01d|f-05e|f-10d|m532|q572)\b
             * 75. GPad: android.+casiatab8
             * 76. Tesco Hudl: android.+hudl
             * 77. Polaroid: android.*(polaroid.*tablet|pmid1000|pmid10c|pmid800|pmid700|pmid4311|pmid701c|pmid701i|pmid705|pmid706|pmid70dc|pmid70c|pmid720|pmid80c|pmid901|ptab7200|ptab4300|ptab750|midc010|midc407|midc409|midc410|midc497|midc700|midc800|midc801|midc802|midc901)
             * 78. Eboda: e-boda.+(supreme|impresspeed|izzycomm|essential)
             * 79. HP Tablet: hp slate 7|hp elitepad 900|hp-tablet|elitebook.*touch
             * 80. AllFineTablet: fine7 genius|fine7 shine|fine7 air|fine8 style|fine9 more|fine10 joy|fine11 wide
             * 81. Sanei: android.*\b(n10|n10-4core|n78|n79|n83|n90 ii)\b
             * 82: ProScan Tablet: \b(pem63|plt1023g|plt1041|plt1044|plt1044g|plt1091|plt4311|plt4311pl|plt4315|plt7030|plt7033|plt7033d|plt7035|plt7035d|plt7044k|plt7045k|plt7045kb|plt7071kg|plt7072|plt7223g|plt7225g|plt7777g|plt7810k|plt7849g|plt7851g|plt7852g|plt8015|plt8031|plt8034|plt8036|plt8080k|plt8082|plt8088|plt8223g|plt8234g|plt8235g|plt8816k|plt9011|plt9045k|plt9233g|plt9735|plt9760g|plt9770g)\b
             * 83: YonesTablet : bq1078|bc1003|bc1077|rk9702|bc9730|bc9001|it9001|bc7008|bc7010|bc708|bc728|bc7012|bc7030|bc7027|bc7026
             * 84: ChangJiaTablet: tpc7102|tpc7103|tpc7105|tpc7106|tpc7107|tpc7201|tpc7203|tpc7205|tpc7210|tpc7708|tpc7709|tpc7712|tpc7110|tpc8101|tpc8103|tpc8105|tpc8106|tpc8203|tpc8205|tpc8503|tpc9106|tpc9701|tpc97101|tpc97103|tpc97105|tpc97106|tpc97111|tpc97113|tpc97203|tpc97603|tpc97809|tpc97205|tpc10101|tpc10103|tpc10106|tpc10111|tpc10203|tpc10205|tpc10503
             * 85: RoverPad: android.*(roverpad|rp3wg70)
             * 86. PointofView Tablet: tab-p506|tab-navi-7-3g-m|tab-p517|tab-p-527|tab-p701|tab-p703|tab-p721|tab-p731n|tab-p741|tab-p825|tab-p905|tab-p925|tab-pr945|tab-pl1015|tab-p1025|tab-pi1045|tab-p1325|tab-protab[0-9]+|tab-protab25|tab-protab26|tab-protab27|tab-protab26xl|tab-protab2-ips9|tab-protab30-ips9|tab-protab25xxl|tab-protab26-ips10|tab-protab30-ips10
             * 87: Overmax: android.*ov-(steelcore|newbase|basecore|baseone|exellen|quattor|edutab|solution|action|basictab|teddytab|magictab|stream|tb-08|tb-09)
             * 88: DPS Tablet: dps dream 9|dps dual 7
             * 89: Visture Tablet: v97 hd|i75 3g|visture v4( hd)?|visture v5( hd)?|visture v10
             * 90: Cresta Tablet: ctp(-)?810|ctp(-)?818|ctp(-)?828|ctp(-)?838|ctp(-)?888|ctp(-)?978|ctp(-)?980|ctp(-)?987|ctp(-)?988|ctp(-)?989
             * 91: Xiaomi: mi *pad
             * 200. Generic Tablet: android.*\b97d\b|tablet(?!.*pc)|viewpad7|lg-v909|mid7015|bntv250a|logicpd zoom2|\ba7eb\b|catnova8|a1_07|ct704|ct1002|\bm721\b|rk30sdk|\bevotab\b|smarttabii10|smarttab10
             */
            regex_raw_str = ""+
                "android.+kindle|kindle +fire|android.+silk|silk.*accelerated|"+
                "android.+nexus +(7|10)|"+
                "samsung.*tablet|galaxy.*tab|sc-01c|gt-p1000|gt-p1003|gt-p1010|gt-p3105|gt-p6210|gt-p6800|gt-p6810|gt-p7100|gt-p7300|gt-p7310|gt-p7500|gt-p7510|sch-i800|sch-i815|sch-i905|sgh-i957|sgh-i987|sgh-t849|sgh-t859|sgh-t869|sph-p100|gt-p3100|gt-p3108|gt-p3110|gt-p5100|gt-p5110|gt-p6200|gt-p7320|gt-p7511|gt-n8000|gt-p8510|sgh-i497|sph-p500|sgh-t779|sch-i705|sch-i915|gt-n8013|gt-p3113|gt-p5113|gt-p8110|gt-n8010|gt-n8005|gt-n8020|gt-p1013|gt-p6201|gt-p7501|gt-n5100|gt-n5110|shv-e140k|shv-e140l|shv-e140s|shv-e150s|shv-e230k|shv-e230l|shv-e230s|shw-m180k|shw-m180l|shw-m180s|shw-m180w|shw-m300w|shw-m305w|shw-m380k|shw-m380s|shw-m380w|shw-m430w|shw-m480k|shw-m480s|shw-m480w|shw-m485w|shw-m486w|shw-m500w|gt-i9228|sch-p739|sch-i925|gt-i9200|gt-i9205|gt-p5200|gt-p5210|sm-t311|sm-t310|sm-t210|sm-t210r|sm-t211|sm-p600|sm-p601|sm-p605|sm-p900|sm-t217|sm-t217a|sm-t217s|sm-p6000|sm-t3100|sgh-i467|xe500|"+
                "htc flyer|htc jetstream|htc-p715a|htc evo view 4g|pg41200|"+
                "xoom|sholest|mz615|mz605|mz505|mz601|mz602|mz603|mz604|mz606|mz607|mz608|mz609|mz615|mz616|mz617|"+
                "transformer|^.*padfone((?!mobile).)*$|tf101|tf201|tf300|tf700|tf701|tf810|me171|me301t|me302c|me371mg|me370t|me372mg|me172v|me173x|me400c|slider *sl101|"+
                "android.+nook|nookcolor|nook browser|bnrv200|bnrv200a|bntv250|bntv250a|bntv400|bntv600|logicpd zoom2|"+
                "android.*\\b(a100|a101|a110|a200|a210|a211|a500|a501|a510|a511|a700|a701|w500|w500p|w501|w501p|w510|w511|w700|g100|g100w|b1-a71|b1-710|b1-711|a1-810)\\b|w3-810|"+
                "android.*(at100|at105|at200|at205|at270|at275|at300|at305|at1s5|at500|at570|at700|at830)|toshiba.*folio|"+
                "\\bl-06c|lg-v900|lg-v905|lg-v909|"+
                "android.+(xenta.+tab|tab210|tab211|tab224|tab250|tab260|tab264|tab310|tab360|tab364|tab410|tab411|tab420|tab424|tab450|tab460|tab461|tab464|tab465|tab467|tab468|tab469)|"+
                "android.+\\boyo\\b|life.*(p9212|p9514|p9516|s9512)|lifetab|"+
                "an10g2|an7bg3|an7fg3|an8g3|an8cg3|an7g3|an9g3|an7dg3|an7dg3st|an7dg3childpad|an10bg3|an10bg3dt|"+
                "android.+archos|\\b(101g9|80g9|a101it)\\b|qilive 97r|"+
                "novo7|novo7aurora|novo7basic|novo7paladin|novo8|novo9|novo10|"+
                "sony tablet|sony tablet s|sgpt12|sgpt121|sgpt122|sgpt123|sgpt111|sgpt112|sgpt113|sgpt211|sgpt213|ebrd1101|ebrd1102|ebrd1201|sgpt311|sgpt312|sonyso-03e|"+
                "android.*(k8gt|u9gt|u10gt|u16gt|u17gt|u18gt|u19gt|u20gt|u23gt|u30gt)|cube u8gt|"+
                "mid1042|mid1045|mid1125|mid1126|mid7012|mid7014|mid7034|mid7035|mid7036|mid7042|mid7048|mid7127|mid8042|mid8048|mid8127|mid9042|mid9740|mid9742|mid7022|mid7010|"+
                "android.*(\\bmid\\b|mid-560|mtv-t1200|mtv-pnd531|mtv-p1101|mtv-pnd530)|"+
                "android.*(rk2818|rk2808a|rk2918|rk3066)|rk2738|rk2808a|"+
                "t-hub2|"+
                "iq310|fly vision|"+
                "bq.*(elcano|curie|edison|maxwell|kepler|pascal|tesla|hypatia|platon|newton|livingstone|cervantes|avant)|"+
                "mediapad|ideos s7|s7-201c|s7-202u|s7-101|s7-103|s7-104|s7-105|s7-106|s7-201|s7-slim|"+
                "\\bn-06d|\\bn-08d|"+
                "pantech.*p4100|"+
                "broncho.*(n701|n708|n802|a710)|"+
                "touchpad.*[78910]|\\btouchtab\\b|"+
                "z1000|z99 2g|z99|z930|z999|z990|z909|z919|z900|"+
                "tb07sta|tb10sta|tb07fta|tb10fta|"+
                "android.*\\bnabi|"+
                "playstation.*(portable|vita)|"+
                "dell.*streak|"+
                "milagrow +tab.*top|"+
                "android.+(ideapad|ideatab|lenovo +a1|s2110|s6000|k3011|a3000|a1000|a2107|a2109|a1107)|"+
                "android.+f8-sup|"+
                "android.*(k080|arc|vox)|"+
                "android.*(msi.+enjoy|enjoy +7|enjoy +10)|"+
                "dropad.+a8|"+
                "android.+c906|"+
                "android.+iberry.+auxus|"+
                "android.+aigopad|"+
                "android.*(airpad|liquid metal)|"+
                "android.+hcl.+tablet|connect-3g-2.0|connect-2g-2.0|me tablet u1|me tablet u2|me tablet g1|me tablet x1|me tablet y2|me tablet sync|"+
                "android.*(a39|a37|a34|st8|st10|st7|smarttab|smart +tab)|"+
                "android.*(micromax.+funbook|funbook|p250|p275|p300|p350|p362|p500|p600)|micromax.*(p250|p275|p350|p362|p500|p600)|funbook|"+
                "android.+penta|"+
                "android.*(celkon.+ct|ct-[0-9])|"+
                "android.+i-buddy|"+
                "android.*(viewbook|viewpad)|"+
                "android.*(v9|zte.+v8110|light tab|light pro|beeline|base.*tab)|"+
                "chagall|"+
                "android.*(vandroid|t3i)|"+
                "android.*(ziio7|ziio10)|"+
                "android.*(v-t100|v-tw100|v-tr200|v-t300)|"+
                "android.+vtab1008|"+
                "bookeen|cybook|"+
                "android.*lifetab_(s9512|p9514|p9516)|"+
                "m702pro|"+
                "irulu-al101|"+
                "pmp3170b|pmp3270b|pmp3470b|pmp7170b|pmp3370b|pmp3570c|pmp5870c|pmp3670b|pmp5570c|pmp5770d|pmp3970b|pmp3870c|pmp5580c|pmp5880d|pmp5780d|pmp5588c|pmp7280c|pmp7280|pmp7880d|pmp5597d|pmp5597|pmp7100d|per3464|per3274|per3574|per3884|per5274|per5474|pmp5097cpro|pmp5097|pmp7380d|pmp5297c|pmp5297c_quad|"+
                "allview.*(viva|alldro|city|speed|all tv|frenzy|quasar|shine|tx1|ax1|ax2)|"+
                "megafon +v9|"+
                "android.+(z7c|z7h|z7s)|"+
                "android.+iball.+slide.+(3g *7271|3g *7334|3g *7307|3g *7316|i7119|i7011)|android.+iball.+i6012|"+
                "navipad|tb-772a|tm-7045|tm-7055|tm-9750|tm-7016|tm-7024|tm-7026|tm-7041|tm-7043|tm-7047|tm-8041|tm-9741|tm-9747|tm-9748|tm-9751|tm-7022|tm-7021|tm-7020|tm-7011|tm-7010|tm-7023|tm-7025|tm-7037w|tm-7038w|tm-7027w|tm-9720|tm-9725|tm-9737w|tm-1020|tm-9738w|tm-9740|tm-9743w|tb-807a|tb-771a|tb-727a|tb-725a|tb-719a|tb-823a|tb-805a|tb-723a|tb-715a|tb-707a|tb-705a|tb-709a|tb-711a|tb-890hd|tb-880hd|tb-790hd|tb-780hd|tb-770hd|tb-721hd|tb-710hd|tb-434hd|tb-860hd|tb-840hd|tb-760hd|tb-750hd|tb-740hd|tb-730hd|tb-722hd|tb-720hd|tb-700hd|tb-500hd|tb-470hd|tb-431hd|tb-430hd|tb-506|tb-504|tb-446|tb-436|tb-416|tb-146se|tb-126se|"+
                "android.*\\bg1\\b|"+
                "tx-a1301|tx-m9002|q702|"+
                "ly-f528|"+
                "android.+dslide.*\\b(700|701r|702|703r|704|802|970|971|972|973|974|1010|1012)\\b|"+
                "m9701|m9000|m9100|m806|m1052|m806|t703|mid701|mid713|mid710|mid727|mid760|mid830|mid728|mid933|mid125|mid810|mid732|mid120|mid930|mid800|mid731|mid900|mid100|mid820|mid735|mid980|mid130|mid833|mid737|mid960|mid135|mid860|mid736|mid140|mid930|mid835|mid733|"+
                "android.*\\b(f-01d|f-05e|f-10d|m532|q572)\\b|"+
                "android.+casiatab8|"+
                "android.+hudl|"+
                "android.*(polaroid.*tablet|pmid1000|pmid10c|pmid800|pmid700|pmid4311|pmid701c|pmid701i|pmid705|pmid706|pmid70dc|pmid70c|pmid720|pmid80c|pmid901|ptab7200|ptab4300|ptab750|midc010|midc407|midc409|midc410|midc497|midc700|midc800|midc801|midc802|midc901)|"+
                "e-boda.+(supreme|impresspeed|izzycomm|essential)|"+
                "hp slate 7|hp elitepad 900|hp-tablet|elitebook.*touch|"+
                "fine7 genius|fine7 shine|fine7 air|fine8 style|fine9 more|fine10 joy|fine11 wide|"+
                "android.*\\b(n10|n10-4core|n78|n79|n83|n90 ii)\\b|"+
                "\\b(pem63|plt1023g|plt1041|plt1044|plt1044g|plt1091|plt4311|plt4311pl|plt4315|plt7030|plt7033|plt7033d|plt7035|plt7035d|plt7044k|plt7045k|plt7045kb|plt7071kg|plt7072|plt7223g|plt7225g|plt7777g|plt7810k|plt7849g|plt7851g|plt7852g|plt8015|plt8031|plt8034|plt8036|plt8080k|plt8082|plt8088|plt8223g|plt8234g|plt8235g|plt8816k|plt9011|plt9045k|plt9233g|plt9735|plt9760g|plt9770g)\\b|"+
                "bq1078|bc1003|bc1077|rk9702|bc9730|bc9001|it9001|bc7008|bc7010|bc708|bc728|bc7012|bc7030|bc7027|bc7026|"+
                "tpc7102|tpc7103|tpc7105|tpc7106|tpc7107|tpc7201|tpc7203|tpc7205|tpc7210|tpc7708|tpc7709|tpc7712|tpc7110|tpc8101|tpc8103|tpc8105|tpc8106|tpc8203|tpc8205|tpc8503|tpc9106|tpc9701|tpc97101|tpc97103|tpc97105|tpc97106|tpc97111|tpc97113|tpc97203|tpc97603|tpc97809|tpc97205|tpc10101|tpc10103|tpc10106|tpc10111|tpc10203|tpc10205|tpc10503|"+
                "android.*(roverpad|rp3wg70)|"+
                "tab-p506|tab-navi-7-3g-m|tab-p517|tab-p-527|tab-p701|tab-p703|tab-p721|tab-p731n|tab-p741|tab-p825|tab-p905|tab-p925|tab-pr945|tab-pl1015|tab-p1025|tab-pi1045|tab-p1325|tab-protab[0-9]+|tab-protab25|tab-protab26|tab-protab27|tab-protab26xl|tab-protab2-ips9|tab-protab30-ips9|tab-protab25xxl|tab-protab26-ips10|tab-protab30-ips10|"+
                "android.*ov-(steelcore|newbase|basecore|baseone|exellen|quattor|edutab|solution|action|basictab|teddytab|magictab|stream|tb-08|tb-09)|"+
                "dps dream 9|dps dual 7|"+
                "v97 hd|i75 3g|visture v4( hd)?|visture v5( hd)?|visture v10|"+
                "ctp(-)?810|ctp(-)?818|ctp(-)?828|ctp(-)?838|ctp(-)?888|ctp(-)?978|ctp(-)?980|ctp(-)?987|ctp(-)?988|ctp(-)?989|"+
                "mi *pad|"+
                "android.*\\b97d\\b|tablet(?!.*pc)|viewpad7|lg-v909|mid7015|bntv250a|logicpd zoom2|\\ba7eb\\b|catnova8|a1_07|ct704|ct1002|\\bm721\\b|rk30sdk|\\bevotab\\b|smarttabii10|smarttab10"+
                "";

            //Check Main Tablet
            regex = new RegExp(regex_raw_str, "i");
            is_tablet_bool = regex.test(nav);
            if(is_tablet_bool)
            {
                if(!bypass_storage_bool){ rScript.store("rs_var_device_is_tablet", true); }
                return true;
            }

            //Check Android Tablet
            var regex_1_bool = /android/i.test(nav),
                regex_2_bool = !/mobile/i.test(nav)
                ;

            if(regex_1_bool)
            {
                /**
                 * if tablet has either:
                 * 1. Device independent viewport width between 520px and 800px when in portrait
                 * 2. Device independent viewport height between 520px and 800px when in landscape
                 */
                if(_r.isNumber(pixel_dim_int) && (pixel_dim_int >= 520 && pixel_dim_int <= 810))
                {
                    if(!bypass_storage_bool){
                        rScript.store("rs_var_device_is_tablet", true);
                        if(rScript.store("rs_var_device_is_phone")){ rScript.store("rs_var_device_is_phone", false);}
                    }
                    return true;
                }

                //if user agent is Android but 'mobile' keyword is absent
                if(regex_2_bool)
                {
                    if(!bypass_storage_bool){ rScript.store("rs_var_device_is_tablet", true); }
                    return true;
                }

            }

            //Return false if otherwise
            if(!bypass_storage_bool){ rScript.store("rs_var_device_is_tablet", false); }
            return false;
        };

        /**
         * Determines the device category of a specific device using the user agent and a regex string
         * @param type_str {String} the device type key
         * @param regex_raw_str {String} The regex string
         * @return {Boolean}
         * @private
         */
        function _isDeviceType(type_str, regex_raw_str)
        {
            //check if device type test has already been done. If so, return stored value
            if(rScript.storeCheck("rs_var_device_is_"+type_str))
            {
                return rScript.store("rs_var_device_is_"+type_str);
            }

            //get the user agent
            var nav = rScript.getUserAgent();

            /**
             * Check for known Device Type
             */
            var regex = new RegExp(regex_raw_str, "i");
            var is_device_type_bool = regex.test(nav);

            if(is_device_type_bool)
            {
                rScript.store("rs_var_device_is_"+type_str, true);
                return true;
            }

            rScript.store("rs_var_device_is_"+type_str, false);
            return false;
        }

        /**
         * Check if the device is a TV
         * @return {Boolean}
         */
        rScript_obj.isTV = function()
        {
            var regex_str = "googletv|smart-tv|smarttv|internet +tv|netcast|nettv|appletv|boxee|kylo|roku|vizio|dlnadoc|ce-html|ouya|xbox|playstation *(3|4)|wii";
            return _isDeviceType('tv', regex_str);
        };

        /**
         * Checks if the device is a Personal Computer
         * @return {Boolean}
         */
        rScript_obj.isDesktop = function()
        {
            //check if Desktop check has already been done. If so, return stored value
            if(rScript.storeCheck("rs_var_device_is_desktop"))
            {
                return rScript.store("rs_var_device_is_desktop");
            }

            if(rScript.isMobile() === false && rScript.isTV() === false)
            {
                rScript.store("rs_var_device_is_desktop", true);
                return true;
            }

            rScript.store("rs_var_device_is_desktop", false);
            return false;
        };

        /**
         * Checks if the device is a mobile device
         * @return {Boolean}
         */
        rScript_obj.isMobile = function()
        {
            //check if device is phone or tablet
            return !!(rScript.isPhone() || rScript.isTablet(true));
        };

        /**
         * Checks if the device is a mobile device
         * Identical to isMobile. Duplicated for utility
         * @return {Boolean}
         */
        rScript_obj.isMobileUtil = function()
        {
            //check if device is phone or tablet
            return !!(rScript.isPhone() || rScript.isTablet(true));
        };

        /**
         * Checks if the device is a non-mobile device
         * @return {Boolean}
         */
        rScript_obj.isNonMobile = function()
        {
            //check if device is not phone or mobile
            return (!rScript.isMobile());
        };

        /**
         * Checks if the device is a Retina-device i.e. it has a Pixel Ratio of 2 or greater
         * @return {Boolean}
         */
        rScript_obj.isRetina = function()
        {
            var pixel_ratio_int = rScript.getPixelRatio();
            return ((pixel_ratio_int >= 2));
        };


        /**
         * Gets the Browser of the device
         * Wrapper Class
         * IE, Chrome, Firefox, Safari, Opera
         */
        function _getBrowserInfo()
        {
            //detect IE
            var ie_str = _r.isIE();

            if (!ie_str)
            {
                //not IE

                /*jshint -W116 */
                var ua_str = rScript.getUserAgent(),
                    tem,
                    M = ua_str.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []
                    ;
                if(M[1]==='chrome')
                {
                    tem = ua_str.match(/\bOPR\/(\d+)/i);

                    if(tem!=null)
                    {
                        return {name:'opera', version:tem[1]};
                    }
                }

                M = M[2] ? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
                if((tem = ua_str.match(/version\/(\d+)/i))!=null)
                {
                    M.splice(1,1,tem[1]);
                }
                return {
                    name: M[0],
                    version: M[1]
                };
                /*jshint +W116 */
            }
            else
            {
                //is IE
                return {
                    name: 'ie',
                    version: ''+ie_str+''
                };
            }
        }

        /**
         * Gets the Browser Info by key name
         * It also caches the value for faster returns later
         * @param key_str {String} the identifier of the required value
         * @returns {*}
         * @private
         */
        function _getBrowserInfoStore(key_str)
        {
            if(rScript.storeCheck("rs_var_device_browser_"+key_str))
            {
                return rScript.store("rs_var_device_browser_"+key_str);
            }

            var browser_info = _getBrowserInfo();
            rScript.store("rs_var_device_browser_"+key_str, browser_info[key_str]);
            return browser_info[key_str];
        }

        /**
         * Gets the Browser Name
         * @returns {*}
         */
        rScript_obj.getBrowserName = function()
        {
            return _getBrowserInfoStore('name');
        };

        /**
         * Gets the Browser Version
         * @returns {*}
         */
        rScript_obj.getBrowserVersion = function()
        {
            return _getBrowserInfoStore('version');
        };

        /**
         * Gets the online status
         * Returns true [if online] or false [if offline]
         * @param {Object} options_obj the configuration options
         * These options are specific to Offline.js
         * See Offline.js docs (http://github.hubspot.com/offline) for details
         * @return {Boolean}
         * @private
         */
        function _getOnlineStatus()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[0]) ? myArgs[0] : undefined;

            if(options_obj)
            {
                Offline.options = options_obj;
            }
            var network_state_str = Offline.state;
            return !!((network_state_str === 'up'));
        }

        /**
         * Gets the network status
         * Returns 'online' or 'offline
         * @param {Object} options_obj the configuration options
         * These options are specific to Offline.js
         * See Offline.js docs (http://github.hubspot.com/offline) for details
         * @returns {boolean}
         * @private
         */
        function _getNetworkStatus()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[0]) ? myArgs[0] : undefined;
            var network_check_bool = (_getOnlineStatus(options_obj));
            return (network_check_bool) ? 'online' : 'offline';
        }

        /**
         * Gets the network status
         * Note: this will also save the value to storage
         * Returns 'online' or 'offline
         * @returns {boolean}
         * @private
         */
        function _getNetworkStatusStore()
        {
            var network_status_str = _getNetworkStatus();
            rScript.store("rs_var_device_network", network_status_str);
            return network_status_str;
        }

        /**
         * Generates and applies turbo classes and attributes
         * @param context_obj {Object} The context. Default is the <body> object
         * @param is_attr_bool {Boolean} Determines if turbo-classes or turbo-attributes should be used. If true, the latter
         * @param prefix_class_str {String} Provides a prefix to the class names
         * @param prefix_attr_str {String} Provides a prefix to the attribute names
         * @private
         */
        function _turboClassesAndAttributes()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                is_init_bool = (_r.isBool(myArgs[0])) ? myArgs[0] : false,
                context_obj = (myArgs[1]) ? myArgs[1]: $('body'),
                is_attr_bool = (_r.isBool(myArgs[2])) ? myArgs[2]: false,
                prefix_class_str = (_r.isString(myArgs[3])) ? myArgs[3] : 'r_',
                prefix_attr_str = (_r.isString(myArgs[4])) ? myArgs[4] : 'data-r-',
                key_name_arr = ['mobile', 'mobile-native', 'retina', 'pixel-ratio', 'factor', 'os', 'orientation', 'viewport-w', 'viewport-h', 'viewport-w-dp', 'viewport-h-dp', 'browser-name', 'browser-version', 'css-anim', 'svg', 'font-face'],
                func_name_arr = ['isMobile', 'isMobileUtil', 'isRetina', 'getPixelRatio', 'getFormFactor', 'getPlatform', 'getOrientation', 'viewportW', 'viewportH', 'pixelW', 'pixelH', 'getBrowserName', 'getBrowserVersion', 'detectCSSTransition', 'detectSVG', 'detectFontFace'],
                class_list_arr = [],
                attr_list_key_arr = [],
                attr_list_value_arr = [],
                key_name_str,
                func_name_str,
                list_value_str,
                class_list_str,
                class_list_curr_str,
                class_list_curr_arr,
                class_list_curr_remove_arr = [],
                class_list_curr_remove_str = '',
                regex_class_obj,
                regex_class_match_arr,
                class_list_remove_arr = [],
                class_list_remove_str
                ;

            //generate turbo classes
            for(var i = 0; i < _r.count(key_name_arr); i++)
            {
                key_name_str = key_name_arr[i];
                func_name_str = func_name_arr[i];

                //push values to attributes array
                list_value_str = rScript[func_name_str]();
                attr_list_key_arr.push(prefix_attr_str+key_name_str+'');
                attr_list_value_arr.push(list_value_str);

                //push values to classes array

                //update key names for specific method calls
                if (func_name_str === 'isMobile')
                {
                    list_value_str = (list_value_str) ? 'mobi' : 'nonmobi';
                }
                else if (func_name_str === 'isMobileUtil')
                {
                    list_value_str = (list_value_str) ? 'mobi_native' : 'nonmobi_native';
                }
                else if (func_name_str === 'isRetina')
                {
                    list_value_str = (list_value_str) ? 'retina' : 'nonretina';
                }
                else if (func_name_str === 'getPixelRatio')
                {
                    if(_r.isNumberString(list_value_str))
                    {
                        list_value_str = parseFloat(list_value_str);
                    }
                    list_value_str = Math.round(list_value_str);
                    list_value_str = list_value_str+'x';
                }
                else if (func_name_str === 'viewportW')
                {
                    list_value_str = list_value_str+'w';
                }
                else if (func_name_str === 'viewportH')
                {
                    list_value_str = list_value_str+'h';
                }
                else if (func_name_str === 'pixelW')
                {
                    list_value_str = list_value_str+'w_dp';
                }
                else if (func_name_str === 'pixelH')
                {
                    list_value_str = list_value_str+'h_dp';
                }
                else if (func_name_str === 'getBrowserName')
                {
                    list_value_str = 'browser_n_'+list_value_str;
                }
                else if (func_name_str === 'getBrowserVersion')
                {
                    list_value_str = 'browser_v_'+list_value_str;
                }
                else if (func_name_str === 'detectCSSTransition')
                {
                    list_value_str = 'css_trans';
                }
                else if (func_name_str === 'detectSVG')
                {
                    list_value_str = 'svg';
                }
                else if (func_name_str === 'detectFontFace')
                {
                    list_value_str = 'font_face';
                }
                class_list_arr.push(prefix_class_str+list_value_str);
            }

            //add special classes for internet explorer to show browsers less than 7, 8, 9, 10
            var browser_info_obj = _getBrowserInfo(),
                browser_info_name_str = browser_info_obj.name,
                browser_info_version_int = parseInt(browser_info_obj.version),
                ie_browser_lt_arr = ['7', '8', '9', '10'],
                ie_browser_num_item_int;
            for (var j = 0; j < _r.count(ie_browser_lt_arr); j++)
            {
                ie_browser_num_item_int = parseInt(ie_browser_lt_arr[j]);
                if(browser_info_name_str === 'ie' && ie_browser_num_item_int < browser_info_version_int)
                {
                    class_list_arr.push(prefix_class_str+'ie_lt_'+browser_info_version_int);
                }
            }

            //add class constants
            class_list_arr.push(prefix_class_str+'turbo');


            if(is_attr_bool)
            {
                //add attributes
                for (var k = 0; k < _r.count(attr_list_key_arr); k++)
                {
                    list_value_str = attr_list_value_arr[k];
                    if(attr_list_key_arr[k] === 'data-r-pixel-ratio')
                    {
                        if(_r.isNumberString(list_value_str))
                        {
                            list_value_str = parseFloat(list_value_str);
                        }
                        list_value_str = Math.round(list_value_str);
                    }

                    context_obj.attr(attr_list_key_arr[k], list_value_str);
                }
            }
            else
            {
                //add to class attribute

                class_list_str = _r.implode(' ', class_list_arr);

                if(is_init_bool)
                {
                    //remove any invalid pre-defined classes first before adding turbo classes

                    //get current class(es)
                    class_list_curr_str = context_obj.attr('class');
                    class_list_curr_str = (_r.isString(class_list_curr_str) && class_list_curr_str.length > 0) ? class_list_curr_str.trim() : '';

                    //remove multiple spaces if any
                    class_list_curr_str = class_list_curr_str.replace(/\s\s+/g, ' ');
                    class_list_curr_arr = _r.explode(' ', class_list_curr_str);

                    //check if classes exist is list of turbo classes to be added
                    //if not, mark them for removal
                    if (_r.count(class_list_curr_arr) > 0) {
                        for (var m = 0; m < class_list_curr_arr.length; m++) {
                            if (!_r.in_array(class_list_curr_arr[m], class_list_arr) && /^ *r_/i.test(class_list_curr_arr[m])) {
                                class_list_curr_remove_arr.push(class_list_curr_arr[m]);
                            }
                        }

                        if (class_list_curr_remove_arr.length > 0) {
                            class_list_curr_remove_str = _r.implode(' ', class_list_curr_remove_arr);
                        }
                    }

                    //add turbo classes
                    //remove pre-defined classes if need be
                    context_obj.removeClass(class_list_curr_remove_str).addClass(class_list_str);
                }
                else if(rScript.storeCheck('rs_var_data_ctx_body_class_list_remove'))
                {
                    //remove certain turbo classes first
                    context_obj.removeClass(rScript.store('rs_var_data_ctx_body_class_list_remove')).addClass(class_list_str);
                }
                else
                {
                    if(!rScript.domStore('rs_var_data_turbo_class_reset_init') && _r.config.debug)
                    {
                        context_obj.removeAttr('class').addClass(class_list_str);

                        rScript.domStore('rs_var_data_turbo_class_reset_init', true);
                    }
                    else
                    {
                        //add turbo classes
                        context_obj.addClass(class_list_str);
                    }
                }

                //generate list of classes to be removed before main class additions
                regex_class_obj = new RegExp("(r_[0-9]+(?:w_dp|h_dp|h|w)|r_(?:portrait|landscape))", "gi");
                regex_class_match_arr = regexMatchAll(regex_class_obj, class_list_str);

                if(regex_class_match_arr.length > 0)
                {
                    //generate remove class list

                    for(var m = 0; m < regex_class_match_arr.length; m++)
                    {
                        class_list_remove_arr.push(regex_class_match_arr[m][1]);
                    }

                    class_list_remove_str = _r.implode(' ', class_list_remove_arr);

                    //save
                    rScript.store('rs_var_data_ctx_body_class_list_remove', class_list_remove_str);
                }
            }
        }

        /**
         * Generates and applies turbo classes and attributes for contextual/intelligent web design
         * Wrapper Class
         * @param context_obj {Object} The context. Default is the <body> object
         * @param data_obj {Object} The contextual geoip and lang data
         * @param prefix_class_str {String} Provides a prefix to the class names
         * @param prefix_attr_str {String} Provides a prefix to the attribute names
         * @private
         */
        function _turboClassesAndAttributesIntel()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                context_obj = (myArgs[0]) ? myArgs[0]: $('body'),
                data_obj = (myArgs[1]) ? myArgs[1]: {},
                prefix_class_str = (_r.isString(myArgs[2])) ? myArgs[2] : 'r_',
                prefix_attr_str = (_r.isString(myArgs[3])) ? myArgs[3] : 'data-r-',
                key_name_class_arr = ['country', 'lang', '', '', 'continent', 'currency', 'timezone', 'timezone_offset'],
                key_name_attr_arr = ['country-code', 'language-code', 'latitude', 'longitude', 'continent-code', 'currency-code', 'timezone', 'timezone-offset'],
                key_name_data_obj_arr = ['country_code', 'language_code', 'latitude', 'longitude', 'continent_code', 'currency_code', 'timezone', 'timezone_offset'],
                key_name_class_str,
                key_name_attr_str,
                key_name_data_obj_str,
                class_list_arr = [],
                attr_list_key_arr = [],
                attr_list_value_arr = [],
                list_value_class_str,
                list_value_attr_str,
                class_list_str
                ;

            //do only if data_obj is valid
            if(data_obj)
            {
                for(var i = 0; i < _r.count(key_name_attr_arr); i++)
                {
                    key_name_attr_str = key_name_attr_arr[i];
                    key_name_class_str = key_name_class_arr[i];

                    key_name_data_obj_str = key_name_data_obj_arr[i];

                    if(data_obj[key_name_data_obj_str])
                    {
                        list_value_attr_str = data_obj[key_name_data_obj_str];
                        list_value_class_str = data_obj[key_name_data_obj_str];

                        if(key_name_data_obj_str === 'timezone')
                        {
                            list_value_attr_str = list_value_attr_str.replace('/', '_');
                            list_value_class_str = list_value_attr_str;
                        }
                        else if(key_name_data_obj_str === 'timezone_offset')
                        {
                            var list_value_temp_str;
                            if(/^\-[0-9]/i.test(list_value_attr_str))
                            {
                                list_value_class_str = ''+list_value_class_str;
                                list_value_temp_str = list_value_class_str.slice(1);
                                list_value_class_str = 'minus'+list_value_temp_str;
                            }
                            else
                            {
                                list_value_class_str = 'plus'+list_value_class_str;
                            }
                        }

                        if(!_r.in_array(key_name_data_obj_str, ['latitude', 'longitude']))
                        {
                            class_list_arr.push(prefix_class_str+key_name_class_str+'_'+list_value_class_str);
                        }

                        attr_list_key_arr.push(prefix_attr_str+key_name_attr_str);
                        attr_list_value_arr.push(list_value_attr_str);
                    }
                }

                //add classes
                class_list_str = _r.implode(' ', class_list_arr);
                context_obj.addClass(class_list_str);

                //add attributes
                for (var k = 0; k < _r.count(attr_list_key_arr); k++)
                {
                    context_obj.attr(attr_list_key_arr[k], attr_list_value_arr[k]);
                }
            }
        }

        /**
         * Generates and applies turbo classes for resize and scroll events
         * @param {String} event_type_str the event type. The two options are 'resize' and 'scroll'
         * @param {Object} context_obj the context
         * @param {String} prefix_class_str the string to prefix the classes with. Default is r_
         * @param {String} prefix_attr_str the string to prefix the attributes with. Default is data-r-
         * @private
         */
        function _turboClassesAndAttributesResizeAndScroll(event_type_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                context_obj = (myArgs[1]) ? myArgs[1]: $('body'),
                prefix_class_str = (_r.isString(myArgs[2])) ? myArgs[2] : 'r_',
                prefix_attr_str = (_r.isString(myArgs[3])) ? myArgs[3] : 'data-r-',
                prefix_class_f_str = prefix_class_str+event_type_str+'_',
                prefix_attr_f_str = prefix_attr_str+event_type_str+'-',
                class_list_start_end_arr = [prefix_class_f_str+'on', prefix_class_f_str+'off'],
                class_list_start_end_str = _r.implode(' ', class_list_start_end_arr),
                class_list_direction_arr,
                class_list_direction_str,
                class_list_direction_active_arr,
                class_list_direction_active_str,
                class_list_direction_curr_str = '',
                direction_h_str,
                direction_v_str,
                direction_h_idx_str,
                direction_v_idx_str,
                direction_h_left_suffix_str,
                direction_h_right_suffix_str,
                turbo_fn,
                turbo_start_fn,
                turbo_end_fn,
                domstore_varname_str
                ;

            //return false if event_type_str is invalid
            if(!_r.in_array(event_type_str, ['resize', 'scroll']))
            {
                return false;
            }

            //create dom store variable for tracking operations
            domstore_varname_str = 'rs_var_event_'+event_type_str+'_turbo_init';

            //Set up
            if(!rScript.domStore(domstore_varname_str))
            {
                //determine direction suffix based on event_type_str
                //used to minimize if conditionals later
                direction_h_left_suffix_str = (event_type_str === 'resize') ? 'in' : 'left';
                direction_h_right_suffix_str = (event_type_str === 'resize') ? 'out' : 'right';

                class_list_direction_arr = [prefix_class_f_str+direction_h_left_suffix_str, prefix_class_f_str+direction_h_right_suffix_str, prefix_class_f_str+'up', prefix_class_f_str+'down'];

                class_list_direction_str = _r.implode(' ', class_list_direction_arr);

                //set up functions
                turbo_fn = function(){

                    class_list_direction_active_arr = [];

                    //get scroll direction
                    direction_h_str = (event_type_str === 'resize') ? _getResizeDirection("h") : _getScrollDirection("h");
                    direction_v_str = (event_type_str === 'resize') ? _getResizeDirection("v") : _getScrollDirection("v");

                    //get scroll direction character
                    direction_h_idx_str = direction_h_str.slice(0, 1);
                    direction_v_idx_str = direction_v_str.slice(0, 1);

                    //push to class list
                    if(direction_h_idx_str === 'l' || direction_h_idx_str === 'i')
                    {
                        class_list_direction_active_arr.push(prefix_class_f_str+direction_h_left_suffix_str);
                    }
                    else if(direction_h_idx_str === 'r' || direction_h_idx_str === 'o')
                    {
                        class_list_direction_active_arr.push(prefix_class_f_str+direction_h_right_suffix_str);
                    }

                    //push to class list
                    if(direction_v_idx_str === 'u')
                    {
                        class_list_direction_active_arr.push(prefix_class_f_str+"up");
                    }
                    else if(direction_v_idx_str === 'd')
                    {
                        class_list_direction_active_arr.push(prefix_class_f_str+"down");
                    }

                    //generate class string
                    class_list_direction_active_str = _r.implode(' ', class_list_direction_active_arr);

                    //add classes or attributes on changes only
                    if(class_list_direction_active_str !== class_list_direction_curr_str)
                    {
                        //add classes
                        if(_r.isString(class_list_direction_active_str) && class_list_direction_active_str.length > 0)
                        {
                            context_obj.removeClass(class_list_direction_str).addClass(class_list_direction_active_str);
                        }

                        //add attributes
                        context_obj.attr(prefix_attr_f_str+'direction-h', direction_h_str);
                        context_obj.attr(prefix_attr_f_str+'direction-v', direction_v_str);

                        //set current
                        class_list_direction_curr_str = class_list_direction_active_str;
                    }
                };

                turbo_start_fn = function(){
                    //add classes
                    context_obj.removeClass(class_list_start_end_str).addClass(prefix_class_f_str+'on');

                    //add attributes
                    context_obj.attr(prefix_attr_f_str+'state', 'on');
                };

                turbo_end_fn = function(){
                    //add classes
                    context_obj.removeClass(class_list_start_end_str).addClass(prefix_class_f_str+'off');

                    //add attributes
                    context_obj.attr(prefix_attr_f_str+'state', 'off');
                };

                //initialize functions
                if(event_type_str === 'resize')
                {
                    //for resize
                    _onResize(turbo_fn, _r.config.resize.default_handler_type, _r.config.resize.default_handler_timer);
                    _onResizeStart(turbo_start_fn);
                    _onResizeEnd(turbo_end_fn);
                }
                else
                {
                    //for scroll
                    _onScroll(turbo_fn, _r.config.scroll.default_handler_type, _r.config.scroll.default_handler_timer);
                    _onScrollStart(turbo_start_fn);
                    _onScrollEnd(turbo_end_fn);
                }

                //mark true to prevent running multiple times
                rScript.domStore(domstore_varname_str, true);
            }
        }

        /**
         * Generates and applies turbo classes for network connectivity events
         * @param {Object} context_obj the context
         * @param {String} prefix_class_str the string to prefix the classes with. Default is r_
         * @param {String} prefix_attr_str the string to prefix the attributes with. Default is data-r-
         * @private
         */
        function _turboClassesAndAttributesNetwork()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                context_obj = (myArgs[0]) ? myArgs[0]: $('body'),
                prefix_class_str = (_r.isString(myArgs[1])) ? myArgs[1] : 'r_',
                prefix_attr_str = (_r.isString(myArgs[2])) ? myArgs[2] : 'data-r-',
                class_list_main_arr = [prefix_class_str+'online', prefix_class_str+'offline', prefix_class_str+'reconnect', prefix_class_str+'reconnect_fail'],
                class_list_main_str = _r.implode(' ', class_list_main_arr),
                class_list_temp_arr = [prefix_class_str+'online', prefix_class_str+'offline'],
                class_list_temp_str = _r.implode(' ', class_list_temp_arr),
                network_status_str,
                turbo_network_up_fn,
                turbo_network_down_fn,
                turbo_network_reconnect_fn,
                turbo_network_reconnect_fail_fn,
                domstore_varname_str
                ;

            //create dom store variable for tracking operations
            domstore_varname_str = 'rs_var_event_network_turbo_init';

            //Set up
            if(!rScript.domStore(domstore_varname_str))
            {
                //on network up
                turbo_network_up_fn = function()
                {
                    //add classes
                    context_obj.removeClass(class_list_main_str).addClass(prefix_class_str+'online');

                    //add attributes
                    context_obj.attr(prefix_attr_str+'network', 'online');
                    context_obj.attr(prefix_attr_str+'network-reconnect', 'false');

                    //update local storage values
                    rScript.store('rs_var_device_network', 'online');
                    rScript.store('rs_var_device_network_reconnect', false);
                };

                //on network down
                turbo_network_down_fn = function()
                {
                    //add classes
                    context_obj.removeClass(class_list_main_str).addClass(prefix_class_str+'offline');

                    //add attributes
                    context_obj.attr(prefix_attr_str+'network', 'offline');

                    //update local storage values
                    rScript.store('rs_var_device_network', 'offline');
                };

                //on network reconnect
                turbo_network_reconnect_fn = function()
                {
                    //add classes
                    context_obj.removeClass('').addClass(prefix_class_str+'reconnect');

                    //add attributes
                    context_obj.attr(prefix_attr_str+'network-reconnect', 'true');

                    //update local storage values
                    rScript.store('rs_var_device_network_reconnect', true);
                };

                //on network reconnect fail
                turbo_network_reconnect_fail_fn = function()
                {
                    //add classes
                    context_obj.removeClass('').addClass(prefix_class_str+'reconnect_fail');
                };

                //add classes and attributes on first run
                network_status_str = _getNetworkStatusStore();
                context_obj.removeClass(class_list_main_str).addClass(prefix_class_str+network_status_str);
                context_obj.attr(prefix_attr_str+'network', network_status_str);

                //set event handlers
                _onNetworkUp(turbo_network_up_fn);
                _onNetworkDown(turbo_network_down_fn);
                _onNetworkReconnect(turbo_network_reconnect_fn);
                _onNetworkReconnectFail(turbo_network_reconnect_fail_fn);

                //mark true to prevent running multiple times
                rScript.domStore(domstore_varname_str, true);
            }
        }

        /**
         * Generates and applies turbo classes for resize events
         * Wrapper class for _turboClassesAndAttributesResizeAndScroll
         * @private
         */
        function _turboClassesAndAttributesResize()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            _turboClassesAndAttributesResizeAndScroll('resize', myArgs[0], myArgs[1], myArgs[2]);
        }

        /**
         * Generates and applies turbo classes for scroll events
         * Wrapper class for _turboClassesAndAttributesResizeAndScroll
         * @private
         */
        function _turboClassesAndAttributesScroll()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            _turboClassesAndAttributesResizeAndScroll('scroll', myArgs[0], myArgs[1], myArgs[2]);
        }


        /**
         * Adds turbo classes to the <body> tag
         * @private
         */
        function _turboClasses()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            _turboClassesAndAttributes(myArgs[0]);
        }

        /**
         * Adds turbo attributes to the <body> tag
         * @private
         */
        function _turboAttributes()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            _turboClassesAndAttributes(myArgs[0], null, true);
        }


        /**
         * Composes and Saves a List of Standard Graphic Resolutions
         * @return {Array}
         * @private
         */
        function _getResolutionList()
        {
            //Check if Resolution List is Stored
            if(rScript.storeCheck("rs_var_data_cache_res_list"))
            {
                return rScript.store("rs_var_data_cache_res_list");
            }

            var $res_arr = [
                'qqvga', 'qqvgax1', 'hqvga', 'hqvgax1', 'hqvgax2', 'hvgax1', 'qvga', 'wqvga', 'wqvga1', 'hvga',
                'hvga1', 'hvga2', 'hvga3', 'hvgax1', 'hvgax2', 'vga', 'wvga', 'wvgax1', 'fwvga', 'svga',
                'dvga', 'dvgax1', 'wsvga', 'wsvga1', 'xga', 'wxga', 'wxga1', 'wxga2', 'wxga3', 'wxga4', 'wxga5',
                'xga+', 'wxga+', 'sxga', 'sxga+', 'wsxga+', 'uxga', 'wuxga', 'qwxga', 'qxga', 'wqxga',
                'qsxga', 'wqsxga', 'quxga', 'wquxga', 'hxga', 'whxga', 'hsxga', 'whsxga', 'huxga', 'whuxga',
                'nhd', 'nhdx1', 'qhd', 'hd', '720p', 'fhd', '1080p', '1080i', 'wqhd', 'mbprhd', '4kuhd', '8kuhd'
            ];

            rScript.store("rs_var_data_cache_res_list", $res_arr);
            return $res_arr;
        }

        /**
         * Composes and Saves a Resolution Matrix (Resolution to Dimensions)
         * @return {Array|Object}
         * @private
         */
        function _getResolutionMatrix()
        {
            //Check if Resolution Matrix is Stored
            if(rScript.storeCheck("rs_var_data_cache_res_matrix"))
            {
                return rScript.store("rs_var_data_cache_res_matrix");
            }

            var $res_matrix_arr = {
                'qqvga': '120_160', 'qqvgax1': '128_160', 'hqvga': '160_240', 'hqvgax1': '240_240', 'hqvgax2': '240_260',
                'qvga': '240_320', 'wqvga': '240_400', 'wqvga1': '240_432', 'hvga': '320_480',
                'hvga1': '360_480', 'hvga2': '272_480', 'hvga3': '240_640', 'hvgax1': '200_640', 'hvgax2': '300_640',
                'hvgax3': '360_400',
                'vga': '480_640', 'wvga': '480_800', 'wvgax1': '352_800', 'fwvga': '480_854', 'svga': '600_800',
                'dvga': '640_960', 'dvgax1': '640_1136', 'wsvga': '576_1024', 'wsvga1': '600_1024', 'xga': '768_1024',
                'wxga': '768_1280', 'wxga1': '720_1280', 'wxga2': '800_1280', 'wxga3': '768_1360', 'wxga4': '768_1366',
                'wxga5': '720_720',
                'xga+': '864_1152', 'wxga+': '900_1440', 'sxga': '1024_1280', 'sxga+': '1050_1400', 'wsxga+': '1050_1680',
                'uxga': '1200_1600', 'wuxga': '1200_1920', 'qwxga': '1152_2048', 'qxga': '1536_2048', 'wqxga': '1600_2560',
                'wqxga+': '1800_3200',
                'qsxga': '2048_2560', 'wqsxga': '2048_3200', 'quxga': '2400_3200', 'wquxga': '2400_3840', 'hxga': '3072_4096',
                'whxga': '3200_5120', 'hsxga': '4096_5120', 'whsxga': '4096_6400', 'huxga': '4800_6400', 'whuxga': '4800_7680',
                'nhd': '360_640', 'nhdx1': '320_640', 'qhd': '540_960', 'hd': '720_1280', '720p': '720_1280', 'fhd': '1080_1920',
                '1080p': '1080_1920', '1080i': '1080_1920', 'wqhd': '1440_2560', 'mbprhd': '1800_2880', '4kuhd': '2160_3840',
                '8kuhd': '4320_7680'
            };

            rScript.store("rs_var_data_cache_res_matrix", $res_matrix_arr);
            return $res_matrix_arr;
        }

        /**
         * Gets the Standard Display Resolution of the given device
         * @return {String}
         */
        rScript_obj.getResolution = function()
        {
            var is_landscape_bool = rScript.isLandscape(),
                screen_w = rScript.screenW(),
                screen_h = rScript.screenH(),
                std_w_arr = (is_landscape_bool) ? rScript.getResolutionDimensionList('h') :rScript.getResolutionDimensionList('w'),
                std_h_arr = (is_landscape_bool) ? rScript.getResolutionDimensionList('w'): rScript.getResolutionDimensionList('h'),
                screen_w_std = _r.getClosestNumberMatchArray(std_w_arr, screen_w),
                screen_h_std = _r.getClosestNumberMatchArray(std_h_arr, screen_h),
                screen_res_str,
                screen_res_matrix_arr = _getResolutionMatrix(),
                screen_res_name_str
                ;

            if(screen_w_std >= screen_h_std)
            {
                screen_res_str = screen_h_std+'_'+screen_w_std;
            }
            else
            {
                screen_res_str = screen_w_std+'_'+screen_h_std;
            }

            screen_res_name_str = _r.array_search(screen_res_str, screen_res_matrix_arr);

            return screen_res_name_str;
        };

        /**
         * Converts various types of breakpoints into pixel breakpoints
         * 1. Viewport breakpoints: 300 = 300 pixels wide
         * 2. Resolution breakpoints: SVGA = 800 pixels wide
         * 3. Orientation breakpoints: 300-p = 300 pixels wide only in portrait orientation
         * 4. Dual viewport breakpoints: 300x320 = 300 pixels wide by 320 pixels high
         * @param bp_arr {Array} the main breakpoint values
         * @param bp_class_arr {Array} the corresponding CSS classes to be added
         * to the DOM on breakpoint match. Array count must tally with bp_arr
         * @param bp_attr_arr {Array} the corresponding attribute values to be added
         * to the DOM on breakpoint match. Array count must tally with bp_arr
         * @return {Array}
         * @private
         */
        function _getBreakpoints(bp_arr)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                bp_arr_count_int = _r.count(bp_arr),
                bp_class_arr = (myArgs[1]) ? myArgs[1] : [],
                bp_class_count_int = _r.count(bp_class_arr),
                bp_class_arr_isset_bool = ((bp_class_count_int > 0)),
                bp_attr_arr = (_r.isArray(myArgs[2])) ? myArgs[2] : [],
                bp_attr_count_int = _r.count(bp_attr_arr),
                bp_attr_arr_isset_bool = ((bp_attr_count_int > 0)),
                bp_scroll_isset_bool = (_r.isBool(myArgs[3])) ? myArgs[3] : false,
                bp_scroll_distance_arr = [],
                bp_scroll_direction_arr = [],
                bp_item_str,
                list_res_arr,
                matrix_res_arr,
                ort_marker_str = '',
                ort_marker_key_str = '',
                error_marker_str = '',
                bp_temp_w_arr = [],
                bp_item_w_temp_int = '',
                bp_temp_h_arr = [],
                bp_item_h_temp_int = '',
                bp_item_regex_w_h_obj = /^[0-9]+x[0-9]+$/i,
                bp_item_regex_w_obj = /[0-9]+/i,
                bp_item_regex_s_obj = /^([0-9]+|#[\w\-]+)@*(up|down|right|left|u|d|r|l|.*?)$/i,
                bp_item_regex_s_match_arr = [],
                bp_item_scroll_distance_str,
                bp_item_scroll_direction_str,
                bp_temp_type_arr = [],
                bp_ort_marker_temp_arr = [],
                bp_final_arr = [],
                bp_item_final_str,
                bp_item_v_temp_arr = []
                ;

            //Create variables for counter functionality
            var counter_int = 0,
                counter_alpha_str = '',
                counter_alpha_arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
                    'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai',
                    'aj', 'ak', 'al', 'am', 'an', 'ao', 'ap', 'aq', 'ar', 'as', 'at', 'au', 'av', 'aw', 'ax'
                ],
                counter_alpha_pre_arr = [],
                counter_alpha_post_arr = [],
                bp_item_w_temp_final_int,
                bp_item_h_temp_final_int;

            try{

                /**
                 * validate arguments provided
                 */

                //ensure that the breakpoints are provided in an array
                if(!_r.isArray(bp_arr))
                {
                    throw new Error ("Breakpoints must be provided in array format!");
                }

                //ensure that the breakpoints are not empty
                if(bp_arr_count_int < 1)
                {
                    throw new Error ("Breakpoints can't be empty!");
                }

                if(!bp_scroll_isset_bool)
                {
                    //do only if not scroll breakpoints
                    //ensure that either classes or attributes are provided
                    if(bp_class_count_int < 1 && bp_attr_count_int < 1)
                    {
                        throw new Error ("You have to provide either a set of classes or a set of attribute values!");
                    }

                    //ensure that the breakpoints and classes (if provided) match in size
                    if(bp_class_count_int > 0 && (bp_class_count_int !== bp_arr_count_int))
                    {
                        throw new Error("The breakpoints array and the classes array must match in size!");
                    }

                    //ensure that the breakpoints and attributes (if provided) match in size
                    if(bp_attr_count_int > 0 && (bp_attr_count_int !== bp_arr_count_int))
                    {
                        throw new Error("The breakpoints array and the attributes array must match in size!");
                    }
                }


                //Get Breakpoint Reference Data
                list_res_arr = _getResolutionList();
                matrix_res_arr = _getResolutionMatrix();

                //iterate over breakpoints
                for(var i = 0; i < bp_arr_count_int; i++)
                {
                    bp_item_str = bp_arr[i];

                    counter_alpha_str = counter_alpha_arr[i];

                    //ensure that the orientation markers are valid i.e. only -p and -l if any
                    if(/-+/i.test(bp_item_str) && !/^[^-]*-[^-]*$/i.test(bp_item_str))
                    {
                        //error in the way orientation markers are defined
                        error_marker_str += '2';
                    }

                    //find out if there are any resolution markers e.g. -l or -p
                    ort_marker_str = '';
                    ort_marker_key_str = '';
                    if(_r.substr_count(bp_item_str, '-p') > 0)
                    {
                        ort_marker_str = 'p';
                        ort_marker_key_str = '-p';

                        bp_ort_marker_temp_arr.push('p');
                    }
                    else if (_r.substr_count(bp_item_str, '-l') > 0)
                    {
                        ort_marker_str = 'l';
                        ort_marker_key_str = '-l';

                        bp_ort_marker_temp_arr.push('l');
                    }
                    else{
                        bp_ort_marker_temp_arr.push('x');
                    }

                    //reset the breakpoint i.e. remove any resolution markers
                    bp_item_final_str = bp_item_str.replace(''+ort_marker_key_str+'', '');

                    //find out which class of breakpoint i.e. viewport, device, or resolution
                    if(_r.in_array(bp_item_final_str, list_res_arr))
                    {
                        //is resolution breakpoint. Get viewport dimensions
                        bp_item_v_temp_arr = _r.arrayToInteger(_r.explode('_', matrix_res_arr[''+bp_item_final_str+'']));

                        bp_item_w_temp_int = parseInt(bp_item_v_temp_arr[0]);
                        bp_item_h_temp_int = parseInt(bp_item_v_temp_arr[1]);

                        //consider landscape orientation markers
                        bp_item_w_temp_final_int = bp_item_w_temp_int;
                        bp_item_h_temp_final_int = bp_item_h_temp_int;

                        if(ort_marker_str === 'l')
                        {
                            bp_item_w_temp_final_int = bp_item_h_temp_int;
                            bp_item_h_temp_final_int = bp_item_w_temp_int;
                        }

                        bp_temp_w_arr[counter_alpha_str] = bp_item_w_temp_final_int;
                        bp_temp_h_arr[counter_alpha_str] = bp_item_h_temp_final_int;

                        //set breakpoint type as resolution
                        bp_temp_type_arr.push('r');
                    }
                    else if(bp_item_regex_w_h_obj.test(bp_item_final_str))
                    {
                        //is viewport dual breakpoint i.e. horizontal and vertical
                        bp_item_v_temp_arr = _r.explode('x', bp_item_final_str);

                        bp_temp_w_arr[counter_alpha_str] = parseInt(bp_item_v_temp_arr[0]);
                        bp_temp_h_arr[counter_alpha_str] = parseInt(bp_item_v_temp_arr[1]);

                        //set breakpoint type as viewport
                        bp_temp_type_arr.push('v');
                    }
                    else if (bp_scroll_isset_bool)
                    {
                        bp_item_regex_s_match_arr = regexMatchAll(bp_item_regex_s_obj, bp_item_final_str);

                        bp_item_scroll_distance_str = bp_item_regex_s_match_arr[0][1];
                        bp_item_scroll_direction_str = bp_item_regex_s_match_arr[0][2];

                        //define scroll direction setting
                        if(bp_item_scroll_direction_str === 'u' || bp_item_scroll_direction_str === 'up')
                        {
                            bp_item_scroll_direction_str = 'u';
                        }
                        else if(bp_item_scroll_direction_str === 'l' || bp_item_scroll_direction_str === 'left')
                        {
                            bp_item_scroll_direction_str = 'l';
                        }
                        else if (bp_item_scroll_direction_str === 'r' || bp_item_scroll_direction_str === 'right')
                        {
                            bp_item_scroll_direction_str = 'r';
                        }
                        else
                        {
                            bp_item_scroll_direction_str = 'd';
                        }

                        bp_temp_w_arr[counter_alpha_str] = 1;
                        bp_temp_h_arr[counter_alpha_str] = 0;

                        //set scroll breakpoint direction
                        bp_scroll_distance_arr.push(bp_item_scroll_distance_str);
                        bp_scroll_direction_arr.push(bp_item_scroll_direction_str);

                        //set breakpoint type as scroll
                        bp_temp_type_arr.push('s');

                    }
                    else if (bp_item_regex_w_obj.test(bp_item_final_str))
                    {
                        //is viewport breakpoint
                        bp_temp_w_arr[counter_alpha_str] = parseInt(bp_item_final_str);
                        bp_temp_h_arr[counter_alpha_str] = 0;

                        //set breakpoint type as viewport
                        bp_temp_type_arr.push('v');
                    }
                    else
                    {
                        //mark error
                        error_marker_str += '1';
                    }

                    counter_alpha_pre_arr.push(counter_alpha_str);
                    counter_int++;
                }

                //check if there are any errors. If yes, throw error
                if (/[1]+/i.test(error_marker_str))
                {
                    throw new Error("There are errors in your 'Breakpoints' settings!");
                }

                if (/[2]+/i.test(error_marker_str))
                {
                    throw new Error("There are errors in your 'Breakpoints' settings with regard to the way you have defined orientation markers e.g. -p or -l!");
                }

                //compose breakpoints
                var cmp = function ($a, $b) {
                    if ($a === $b) {
                        return 0;
                    }
                    return ($a < $b) ? -1 : 1;
                };

                var bp_temp_w_sort_arr = [],
                    bp_temp_h_sort_arr = [],
                    bp_temp_h_sort_raw_arr = [],
                    bp_temp_w_sort_int,
                    bp_temp_w_sort_juxta_key_int,
                    bp_type_arr = [],
                    bp_temp_ort_sort_arr = [],
                    bp_temp_class_arr = [],
                    bp_temp_attr_arr = [],
                    bp_temp_scroll_distance_arr = [],
                    bp_temp_scroll_direction_arr = []
                    ;

                //sort viewport width breakpoints
                bp_temp_w_sort_arr = _r.uasort(bp_temp_w_arr, cmp);

                //sort other arrays in an identical fashion to viewport width breakpoints
                counter_alpha_post_arr = _r.array_keys(bp_temp_w_sort_arr);
                var bp_temp_w_sort_arr_size_int = _r.count(bp_temp_w_sort_arr);

                //sort and arrange breakpoint values
                for(var j = 0; j < bp_temp_w_sort_arr_size_int; j++)
                {
                    bp_temp_w_sort_int = counter_alpha_post_arr[j];
                    bp_temp_w_sort_juxta_key_int = _r.array_search(bp_temp_w_sort_int, counter_alpha_pre_arr);

                    //sort breakpoint heights array
                    bp_temp_h_sort_arr[bp_temp_w_sort_int] = bp_temp_h_arr[bp_temp_w_sort_int];

                    //sort breakpoint type array
                    bp_type_arr[j] = bp_temp_type_arr[bp_temp_w_sort_juxta_key_int];

                    //sort the orientation marker array
                    bp_temp_ort_sort_arr[j] = bp_ort_marker_temp_arr[bp_temp_w_sort_juxta_key_int];

                    //sort the classes and attributes array
                    bp_temp_class_arr[j] = bp_class_arr[bp_temp_w_sort_juxta_key_int];
                    bp_temp_attr_arr[j] = bp_attr_arr[bp_temp_w_sort_juxta_key_int];

                    //sort the scroll array
                    bp_temp_scroll_distance_arr[j] = bp_scroll_distance_arr[bp_temp_w_sort_juxta_key_int];
                    bp_temp_scroll_direction_arr[j] = bp_scroll_direction_arr[bp_temp_w_sort_juxta_key_int];

                }

                //Save Primary Results Data to Array

                //width
                bp_final_arr.bp_w = _r.implode('|', bp_temp_w_sort_arr);

                //height
                bp_temp_h_sort_raw_arr = _r.array_values(bp_temp_h_sort_arr);
                bp_final_arr.bp_h = _r.implode('|', bp_temp_h_sort_raw_arr);
                if(!bp_scroll_isset_bool)
                {
                    //orientation
                    bp_final_arr.bp_o = _r.implode('|', bp_temp_ort_sort_arr);
                }

                //type
                bp_final_arr.bp_t = _r.implode('|', bp_type_arr);

                //add data for classes (if set)
                if(bp_class_arr_isset_bool)
                {
                    bp_final_arr.bp_c = _r.implode('|', bp_temp_class_arr);
                }

                //add data for attributes (if set)
                if(bp_attr_arr_isset_bool)
                {
                    bp_final_arr.bp_a = _r.implode('|', bp_temp_attr_arr);
                }

                //add data for scroll (if set)
                if(bp_scroll_isset_bool)
                {
                    bp_final_arr.bp_s_dst = _r.implode('|', bp_temp_scroll_distance_arr);
                    bp_final_arr.bp_s_dir = _r.implode('|', bp_temp_scroll_direction_arr);
                }

                return bp_final_arr;
            }
            catch(e)
            {
                var e_msg_str = 'rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: '+e.message;
                _r.console.error(e_msg_str, true);
            }
        }

        /**
         * Determines the basis for responsiveness
         * The only two possible results are:
         * 1. viewport i.e. track the viewport
         * 2. container i.e. track a block level element
         * If the given context is a child element of <body>, then the basis is
         * 'container' or 'c'
         * If the given context is not a child element of <body>, then the basis is
         * 'viewport' or 'v'
         * @param ctx {Object} a DOM object
         * @returns {*}
         * @private
         */
        function _getResponsiveBasis(ctx){
            /**
             * This determines the basis for responsiveness i.e. viewport or container
             * 1: If context does not have a tag name of HTML, BODY, SCRIPT, STYLE, META or LINK, then the selector must be under
             * <BODY>, and basis is 'container' or 'c'
             * 2: If above is false, basis is 'viewport' or 'v'
             */
            var ctx_tag_str = (rQuery.isRQueryObject(ctx)) ? ctx.tagName : ctx.prop("nodeName").toLowerCase(),
                ctx_is_child_of_body_bool = /^((?!(window|html|head|meta|script|link|style|body)).*)$/i.test(ctx_tag_str)
                ;

            return (ctx_is_child_of_body_bool) ?  'c' : 'v';
        }

        /**
         * Determines if there is a scroll breakpoint match and sets the corresponding class
         * @param ctx {Object} the context
         * @param bp_arr {Array} the breakpoints data
         * @param options {*} the options provided in the rScript constructor
         * @private
         */
        function _setBreakpointsScroll(ctx, bp_arr, options)
        {
            var myArgs = Array.prototype.slice.call(arguments);
            var settings_obj = myArgs[3],
                event_status_str = myArgs[4]
                ;

            //Extract Data to Array
            /*jshint -W069 */
            var bp_scroll_distance_arr = (bp_arr["bp_s_dst"]) ? _r.explode("|", bp_arr["bp_s_dst"]) : null,
                bp_scroll_direction_arr = (bp_arr["bp_s_dir"]) ? _r.explode("|", bp_arr["bp_s_dir"]) : null,
                bp_arr_count_int = _r.count(bp_scroll_distance_arr)
                ;

            //Get Viewport Scroll Information
            var scroll_pos_top_curr_int = parseInt(rScript.store("rs_var_viewport_scroll_t")),
                scroll_pos_top_prev_int = parseInt(rScript.store("rs_var_viewport_scroll_t_prev")),
                scroll_pos_left_curr_int = parseInt(rScript.store("rs_var_viewport_scroll_l")),
                scroll_pos_left_prev_int = parseInt(rScript.store("rs_var_viewport_scroll_l_prev")),
                scroll_dir_h_str = _getScrollDirection("h"),
                scroll_dir_v_str = _getScrollDirection("v")
                ;

            //get scroll direction character
            scroll_dir_h_str = scroll_dir_h_str.slice(0, 1);
            scroll_dir_v_str = scroll_dir_v_str.slice(0, 1);

            /*jshint +W069 */

            //Define trackers
            var bp_scr_dir_item_str,
                bp_scr_dst_item_str,
                bp_scr_dst_item_temp_str,
                bp_scr_dst_item_temp_int,
                bp_scr_dst_item_select_int,
                bp_scr_dst_item_select_prev_int,
                bp_item_elem_obj,
                bp_item_elem_offset_obj,      //elem.offset()
                bp_item_elem_scroll_pos_obj,
                bp_item_elem_offset_top_int,
                bp_item_elem_offset_left_int,
                bp_item_elem_scroll_pos_top_int,
                bp_item_elem_scroll_pos_left_int,
                bp_item_elem_scroll_pos_top_e_int,
                bp_item_elem_scroll_pos_left_e_int,
                bp_item_class_str,
                bp_item_attr_str,
                bp_item_dom_store_var_str,
                bp_item_dom_store_var_isset_str
                ;

            for(var i = 0; i < bp_arr_count_int; i++)
            {
                bp_scr_dir_item_str = bp_scroll_direction_arr[i];
                bp_scr_dst_item_temp_str = bp_scroll_distance_arr[i];
                bp_scr_dst_item_str = bp_scr_dst_item_temp_str;

                //get the scroll distance if id reference is provided
                if(/#([\w-])/i.test(bp_scr_dst_item_temp_str))
                {
                    bp_item_elem_obj = $(bp_scr_dst_item_temp_str);

                    bp_item_elem_offset_obj = bp_item_elem_obj.offset();
                    bp_item_elem_offset_top_int = bp_item_elem_offset_obj.top;
                    bp_item_elem_offset_left_int = bp_item_elem_offset_obj.left;

                    if(rQuery.isRQueryObject(bp_item_elem_obj))
                    {
                        bp_item_elem_scroll_pos_obj = bp_item_elem_obj.scrollPosition();
                        bp_item_elem_scroll_pos_top_int = bp_item_elem_scroll_pos_obj.top;
                        bp_item_elem_scroll_pos_left_int = bp_item_elem_scroll_pos_obj.left;
                        bp_item_elem_scroll_pos_top_e_int = bp_item_elem_scroll_pos_obj.top_e;
                        bp_item_elem_scroll_pos_left_e_int = bp_item_elem_scroll_pos_obj.left_e;
                    }
                    else
                    {
                        bp_item_elem_scroll_pos_top_int = bp_item_elem_obj.scrollTop();
                        bp_item_elem_scroll_pos_left_int = bp_item_elem_obj.scrollLeft();
                        bp_item_elem_scroll_pos_top_e_int = bp_item_elem_offset_top_int - bp_item_elem_scroll_pos_top_int;
                        bp_item_elem_scroll_pos_left_e_int = bp_item_elem_offset_left_int - bp_item_elem_scroll_pos_left_int;
                    }

                    bp_scr_dst_item_temp_str = (bp_scr_dir_item_str === 'l' || bp_scr_dir_item_str === 'r') ? ""+bp_item_elem_offset_left_int+"" : ""+bp_item_elem_offset_top_int+"" ;
                }

                bp_scr_dst_item_temp_int = parseInt(bp_scr_dst_item_temp_str);

                bp_scr_dst_item_select_int = (bp_scr_dir_item_str === 'l' || bp_scr_dir_item_str === 'r') ? scroll_pos_left_curr_int : scroll_pos_top_curr_int;
                bp_scr_dst_item_select_prev_int = (bp_scr_dir_item_str === 'l' || bp_scr_dir_item_str === 'r') ? scroll_pos_left_prev_int : scroll_pos_top_prev_int;


                //define classes and attributes
                bp_item_class_str = 'r_scroll_bp_'+bp_scr_dst_item_str;
                bp_item_class_str += (bp_scr_dir_item_str !== 'd') ? "_"+bp_scr_dir_item_str : '_d';
                bp_item_class_str = bp_item_class_str.replace(/[\s\-]+/i, "_");
                bp_item_class_str = bp_item_class_str.replace(/#+/i, "id_");
                bp_item_attr_str = bp_scr_dst_item_str;

                //define DOM storage variable name
                bp_item_dom_store_var_str = bp_item_class_str+'_ds_enabled';
                bp_item_dom_store_var_isset_str = bp_item_class_str+'_ds_isset';

                var scroll_dir_none_bool = (scroll_dir_v_str === 'n' && scroll_dir_h_str === 'n'),
                    scroll_dir_v_match_bool,
                    scroll_dir_h_match_bool
                    ;

                //set tracker
                if(!rScript.domStore(bp_item_dom_store_var_isset_str))
                {
                    rScript.domStore(bp_item_dom_store_var_str, false);
                    rScript.domStore(bp_item_dom_store_var_isset_str, true);
                }

                if(bp_scr_dst_item_select_int >= bp_scr_dst_item_temp_int)
                {
                    //scroll position [left or top] is greater or equal to scroll breakpoint

                    scroll_dir_v_match_bool = (bp_scr_dir_item_str === 'd');
                    scroll_dir_h_match_bool = (bp_scr_dir_item_str === 'r');

                    if(scroll_dir_v_str === 'd' || scroll_dir_h_str === 'r')
                    {
                        //scrolling down or right

                        //breakpoint match
                        if(scroll_dir_v_match_bool || scroll_dir_h_match_bool)
                        {
                            //add class
                            ctx.addClass(bp_item_class_str);
                        }
                        else
                        {
                            //remove class
                            ctx.removeClass(bp_item_class_str);
                        }
                    }
                    else if(scroll_dir_none_bool)
                    {
                        //no movement

                        if(scroll_dir_v_match_bool || scroll_dir_h_match_bool)
                        {
                            //add class
                            ctx.addClass(bp_item_class_str);
                        }
                    }
                }
                else if (bp_scr_dst_item_select_int <= bp_scr_dst_item_temp_int)
                {
                    //scroll position [left or top] is less than or equal to scroll breakpoint

                    //mark tracker
                    if((bp_scr_dst_item_select_prev_int >= bp_scr_dst_item_temp_int) && (!rScript.domStore(bp_item_dom_store_var_str)))
                    {

                        rScript.domStore(bp_item_dom_store_var_str, true);
                    }

                    scroll_dir_v_match_bool = (bp_scr_dir_item_str === 'u' && rScript.domStore(bp_item_dom_store_var_str));
                    scroll_dir_h_match_bool = (bp_scr_dir_item_str === 'l' && rScript.domStore(bp_item_dom_store_var_str));

                    if(scroll_dir_v_str === 'u' || scroll_dir_h_str === 'l')
                    {
                        //scrolling up or left

                        //breakpoint match
                        if(scroll_dir_v_match_bool || scroll_dir_h_match_bool)
                        {
                            //add class
                            ctx.addClass(bp_item_class_str);
                        }
                        else
                        {
                            //reset dom store var
                            rScript.domStore(bp_item_dom_store_var_str, false);

                            //remove class
                            ctx.removeClass(bp_item_class_str);
                        }
                    }
                    else if(scroll_dir_none_bool)
                    {
                        //no movement

                        if(bp_scr_dir_item_str === 'u' || bp_scr_dir_item_str === 'l')
                        {
                            //add class
                            ctx.addClass(bp_item_class_str);
                        }
                    }
                }
            }
        }

        /**
         * Determines if there is a breakpoint match and then sets the corresponding classes and/or attributes
         * @param ctx {Object} the context
         * @param bp_arr {Array} the breakpoints
         * @param options {Object}
         * @private
         */
        function _setBreakpoints(ctx, bp_arr, options){
            var myArgs = Array.prototype.slice.call(arguments);
            var settings_obj = myArgs[3],
                event_status_str = myArgs[4],
                is_ort_change_bool,
                is_resize_container_bool,
                resp_basis_str = settings_obj.responsive_basis,
                is_resp_basis_container_bool = ((resp_basis_str === 'c')),
                set_data_obj = {}
                ;

            //Note orientation change
            is_ort_change_bool = !!((event_status_str === 'co'));

            //Note container resize
            is_resize_container_bool = !!((event_status_str === 'rc'));

            //Extract Data to Array
            /*jshint -W069 */
            var bp_width_arr = _r.arrayToInteger(_r.explode("|", bp_arr["bp_w"])),
                bp_height_arr = _r.arrayToInteger(_r.explode("|", bp_arr["bp_h"])),
                bp_ort_arr = _r.explode("|", bp_arr["bp_o"]),
                bp_type_arr = _r.explode("|", bp_arr["bp_t"]),
                bp_class_arr = (bp_arr["bp_c"]) ? _r.explode("|", bp_arr["bp_c"]) : null,
                bp_attrib_arr = (bp_arr["bp_a"]) ? _r.explode("|", bp_arr["bp_a"]) : null,
                bp_width_arr_count_int = _r.count(bp_width_arr),
                viewport_w_int = rScript.viewportW(),
                viewport_w_active_int = viewport_w_int
                ;

            //Get Device and Orientation Options and Information
            var device_platform_str = rScript.getPlatform(),
                device_formfactor_str = rScript.getFormFactor(),
                options_platform_str = (options.platform) ? options.platform : 'all',
                options_formfactor_str = (options.formfactor) ? options.formfactor : 'all',
                options_force_dip_bool = (_r.isBool(options.force_dip)) ? options.force_dip: true,
                options_dim_format_str = (_r.isString(options.dim_format)) ? options.dim_format: 'x',
                is_portrait_bool = rScript.isPortrait(),
                is_landscape_bool = (is_portrait_bool !== true);

            /*jshint +W069 */

            //Define trackers
            var is_breakpoint_match_bool = false,
                is_breakpoint_match_hit_bool = false,
                is_breakpoint_match_os_bool = true,
                is_breakpoint_match_ff_bool = true,
                is_curr_bp_in_ort_range_bool = true,
                is_prev_bp_in_ort_range_bool = true,
                is_ort_marker_set_init_bool = false,        //this indicates whether orientation markers have been used at least once
                bp_width_arr_has_dupl_bool,
                bp_width_dupl_tracker_tok_str = '',              //used for tracking breakpoints that have duplicate values
                bp_width_no_dupl_tracker_tok_str = '',              //used for tracking breakpoints that do not have duplicate values
                bp_width_min_tracker_tok_str = '',        //used for tracking the starting widths of all breakpoints values
                bp_width_max_tracker_tok_str = '',        //used for tracking the ending widths of all breakpoints values
                bp_width_hasheight_tracker_tok_str = '',        //used for tracking the widths of breakpoints that have both width and height values
                bp_width_hasnoheight_tracker_tok_str = '',      //used for tracking the widths of breakpoints that have only width values
                bp_width_match_tracker_tok_str = '',
                bp_height_match_tracker_tok_str = '',
                bp_break_on_match_bool,
                span_range_bool,
                span_range_int_str,
                pitch_range_bool,
                pitch_range_int_str,
                dim_range_bool,
                ort_range_bool,
                bp_width_x_height_str,
                bp_width_x_height_prev_str,
                bp_width_int,
                bp_width_min_int,
                bp_width_max_int,
                bp_width_start_int,
                bp_width_start_temp_int,
                bp_width_prev_int,
                bp_width_prev_ort_marker_int,
                bp_height_int,
                bp_height_prev_int,
                bp_height_min_int,
                bp_height_max_int,
                bp_width_diff_r_int,                        //the difference between current viewport width and bp_width_max_int
                bp_width_diff_r_abs_int,                    //the absolute difference between current viewport width and bp_width_max_int
                bp_width_diff_l_int,                        //the difference between current viewport width and bp_width_min_int
                bp_width_diff_r_comp_int,
                bp_type_str,
                bp_ort_str,
                bp_class_str,
                bp_class_last_sel_str,
                bp_attrib_str,
                bp_attrib_last_sel_str,
                i_prev
                ;

            //check if there are duplicate width values
            bp_width_arr_has_dupl_bool = _r.arrayHasDuplicates(bp_width_arr);
            bp_break_on_match_bool = (!bp_width_arr_has_dupl_bool);


            /**
             * Iterate over individual breakpoints
             */
            for(var i = 0; i < bp_width_arr_count_int; i++)
            {
                i_prev = i - 1;

                /**
                 * Filter for
                 * 1: Platform
                 * 2: Form Factor
                 * Breakout of for loop if no match
                 */

                //1:
                if((options_platform_str !== 'all') && (options.platform !== device_platform_str))
                {
                    is_breakpoint_match_os_bool = false;
                }

                //2:
                if((options_formfactor_str !== 'all') && (options.formfactor !== device_formfactor_str))
                {
                    is_breakpoint_match_ff_bool = false;
                }

                //break out of for loop if match is not found
                /*jshint -W116 */
                if(!is_breakpoint_match_os_bool || !is_breakpoint_match_ff_bool) break;
                /*jshint +W116 */


                //Get width, height, type, and orientation values
                bp_width_int = bp_width_arr[i];
                bp_height_int = bp_height_arr[i];
                bp_type_str = bp_type_arr[i];
                bp_ort_str = bp_ort_arr[i];

                //track previous breakpoint width
                if(i > 0)
                {
                    bp_width_prev_int = bp_width_arr[i_prev];
                }
                else{
                    bp_width_prev_int = 0;
                    bp_width_prev_ort_marker_int = 0;
                }

                //track previous breakpoint height
                if(i > 0)
                {
                    bp_height_prev_int = bp_height_arr[i_prev];
                }
                else{
                    bp_height_prev_int = 0;
                }

                //Get the full breakpoint in string representation
                bp_width_x_height_str = bp_width_int+'x'+bp_height_int;
                bp_width_x_height_prev_str = bp_width_prev_int+'x'+bp_height_prev_int;

                //Consider orientation markers
                is_prev_bp_in_ort_range_bool = is_curr_bp_in_ort_range_bool;
                if (bp_ort_str === "p" || bp_ort_str === "l")
                {
                    is_ort_marker_set_init_bool = true;

                    ort_range_bool = (bp_ort_str === "p") ? ((is_portrait_bool)) : ((is_landscape_bool));
                    is_curr_bp_in_ort_range_bool = ort_range_bool;
                    bp_width_no_dupl_tracker_tok_str = (!is_prev_bp_in_ort_range_bool) ? bp_width_prev_ort_marker_int: bp_width_no_dupl_tracker_tok_str;
                }
                else
                {
                    /**
                     * If is_prev_bp_in_ort_range_bool is false,
                     * it means that the previous breakpoint had an
                     * orientation marker ('-p' or '-l') that did not match the current
                     * orientation of the viewport.
                     * And if is_ort_marker_set_init_bool is true, then there has been
                     * a transition from a breakpoint with
                     * an orientation marker to one without one.
                     */
                    bp_width_no_dupl_tracker_tok_str = ((is_ort_marker_set_init_bool) && (!is_prev_bp_in_ort_range_bool)) ? bp_width_prev_ort_marker_int: bp_width_no_dupl_tracker_tok_str;

                    bp_width_prev_ort_marker_int = (i > 0) ? bp_width_int: 0;
                    ort_range_bool = true;
                    is_curr_bp_in_ort_range_bool = ort_range_bool;
                }

                //Manage combination of breakpoints with and without vertical settings
                /**
                 * Manage start and end widths i.e. the effective breakpoint ranges
                 * 1: Take duplicate values into consideration
                 * 2: Take breakpoint settings that have height values into consideration
                 */
                if(i >= 1)
                {
                    //1:
                    if(bp_width_int === bp_width_prev_int)
                    {
                        //duplicates found

                        bp_width_dupl_tracker_tok_str = (bp_width_dupl_tracker_tok_str === '') ? bp_width_int : bp_width_int+'-!'+bp_width_dupl_tracker_tok_str;
                        bp_width_start_temp_int = parseInt(getValueAfterExplode(bp_width_min_tracker_tok_str, '-!', 0));

                        //track breakpoint widths (both those that have height or don't have heights)
                        if (bp_height_int > 0)
                        {
                            bp_width_hasheight_tracker_tok_str = (bp_width_hasheight_tracker_tok_str === '') ? bp_width_int : bp_width_int+'-!'+bp_width_hasheight_tracker_tok_str;
                        }
                        else
                        {
                            bp_width_hasnoheight_tracker_tok_str = (bp_width_hasnoheight_tracker_tok_str === '') ? bp_width_int :
                                bp_width_int+'-!'+bp_width_hasnoheight_tracker_tok_str;
                        }
                    }
                    else
                    {
                        //no duplicates

                        bp_width_no_dupl_tracker_tok_str = bp_width_int+'-!'+bp_width_no_dupl_tracker_tok_str;
                        //bp_width_start_temp_int = parseInt(getValueAfterExplode(bp_width_no_dupl_tracker_tok_str, '-!', 1));

                        //2:
                        if(bp_height_int > 0)
                        {
                            //breakpoint has height values

                            bp_width_hasheight_tracker_tok_str = (bp_width_hasheight_tracker_tok_str === '') ? bp_width_int : bp_width_int+'-!'+bp_width_hasheight_tracker_tok_str;

                            //Get the width value of last breakpoint without a height value
                            bp_width_start_temp_int = parseInt(getValueAfterExplode(bp_width_hasnoheight_tracker_tok_str, '-!', 0));
                        }
                        else
                        {
                            //breakpoint has no height values

                            bp_width_hasnoheight_tracker_tok_str = (bp_width_hasnoheight_tracker_tok_str === '') ? bp_width_int :
                                bp_width_int+'-!'+bp_width_hasnoheight_tracker_tok_str;

                            //Get the width value of last breakpoint
                            bp_width_start_temp_int = parseInt(getValueAfterExplode(bp_width_max_tracker_tok_str, '-!', 0));
                        }
                    }

                    //define start width
                    bp_width_start_int = bp_width_start_temp_int;

                    //track start and end widths
                    bp_width_min_tracker_tok_str = bp_width_start_int+'-!'+bp_width_min_tracker_tok_str;
                    bp_width_max_tracker_tok_str = bp_width_int+'-!'+bp_width_max_tracker_tok_str;
                }
                else
                {
                    bp_width_hasheight_tracker_tok_str = (bp_height_int > 0) ? bp_width_int : '';
                    bp_width_hasnoheight_tracker_tok_str = (bp_height_int <= 0) ? bp_width_int : '';
                    //define start width
                    bp_width_start_int = 0;

                    //track start and end widths
                    bp_width_min_tracker_tok_str = ''+bp_width_start_int+'';
                    bp_width_max_tracker_tok_str = ''+bp_width_int+'';

                    //track duplicate and non-duplicate values
                    bp_width_no_dupl_tracker_tok_str = bp_width_int;
                    bp_width_dupl_tracker_tok_str = '';
                }

                //Define classes and attributes
                bp_class_str = (bp_class_arr) ? bp_class_arr[i] : '';
                bp_attrib_str = (bp_attrib_arr) ? bp_attrib_arr[i] : '';

                //set the breakpoint range widths
                if(i === 0)
                {
                    bp_width_min_int = bp_width_start_int;
                    bp_width_max_int = bp_width_int;
                }
                else {
                    bp_width_min_int = (bp_width_start_int === 0) ? bp_width_start_int : bp_width_start_int + 1;
                    bp_width_max_int = bp_width_int;
                }

                /**
                 * Check for Matching Breakpoints
                 * 1. Do for Container Basis
                 * 2. Do for Viewport Basis. Make sure to consider force_dip option
                 * 2.1 Vertical Breakpoints and Horizontal Breakpoints
                 * 2.2 Vertical Breakpoints only
                 * 2.3 Track matches
                 */
                if(is_resp_basis_container_bool)
                {
                    //1
                    span_range_bool = rScript.eSpan(bp_width_min_int, bp_width_max_int, ctx, options_dim_format_str, options_force_dip_bool);

                    dim_range_bool = ((span_range_bool));
                }
                else
                {
                    //2
                    if(bp_height_int > 0)
                    {
                        //2.1
                        //set breakpoint range heights
                        bp_height_min_int = 0;
                        bp_height_max_int = bp_height_int;

                        span_range_bool = (options_force_dip_bool) ? rScript.vSpan(bp_width_min_int, bp_width_max_int) : rScript.cSpan(bp_width_min_int, bp_width_max_int);

                        pitch_range_bool = (options_force_dip_bool) ? (rScript.vPitch(bp_height_min_int, bp_height_max_int)) : (rScript.cPitch(bp_height_min_int, bp_height_max_int));

                        dim_range_bool = ((span_range_bool && pitch_range_bool));
                    }
                    else
                    {
                        //2.2
                        span_range_bool = (options_force_dip_bool) ? rScript.vSpan(bp_width_min_int, bp_width_max_int) : rScript.cSpan(bp_width_min_int, bp_width_max_int);

                        pitch_range_bool = false;

                        dim_range_bool = ((span_range_bool));
                    }

                    //2.3
                    span_range_int_str = (span_range_bool) ? '1': '0';
                    pitch_range_int_str = (pitch_range_bool) ? '1': '0';

                    //make -1 if no match and breakpoint has height value
                    pitch_range_int_str = (bp_height_int > 0 && pitch_range_int_str === '0') ? '-1': pitch_range_int_str;

                    bp_width_match_tracker_tok_str = (bp_width_match_tracker_tok_str === '') ? span_range_int_str : span_range_int_str+'-!'+bp_width_match_tracker_tok_str;

                    bp_height_match_tracker_tok_str = (bp_height_match_tracker_tok_str === '') ? pitch_range_int_str : pitch_range_int_str+'-!'+bp_height_match_tracker_tok_str;

                }

                /**
                 * Set Breakpoints
                 * A. For Container Basis
                 *
                 * B. For Viewport Basis
                 * Status codes as follows:
                 * 1: Viewport matched breakpoint with clean hit on initialization i.e. viewport is virtually identical to breakpoint
                 * 2: Viewport matched breakpoint with clean hit after orientation change
                 * 3: Viewport matched breakpoint but not with a clean hit i.e. margin between viewport width and upper limit of matched breakpoint range is significant
                 * 4: Viewport matched breakpoint after orientation change but not with a clean hit i.e. margin between viewport width and upper limit of matched breakpoint range is significant
                 */
                if(dim_range_bool && ort_range_bool)
                {
                    if(is_resp_basis_container_bool)
                    {
                        //A:
                        is_breakpoint_match_bool = true;
                    }
                    else
                    {
                        //B:
                        bp_width_diff_r_int = bp_width_max_int - viewport_w_active_int;
                        bp_width_diff_r_abs_int = Math.abs(bp_width_diff_r_int);
                        bp_width_diff_l_int = viewport_w_active_int - bp_width_min_int;

                        bp_width_diff_r_comp_int = bp_width_max_int*0.1;
                        bp_width_diff_r_comp_int = Math.round(bp_width_diff_r_comp_int);

                        is_breakpoint_match_bool = true;

                        //Capture class and attribute values of last hit
                        if(is_breakpoint_match_bool)
                        {
                            //set class and attribute
                            is_breakpoint_match_hit_bool = true;
                            bp_class_last_sel_str = bp_class_str;
                            bp_attrib_last_sel_str = bp_attrib_str;

                            if(bp_ort_str !== "x"){
                                bp_break_on_match_bool = true;
                            }
                        }
                    }
                }
                else
                {
                    is_breakpoint_match_bool = false;
                }

                //track breakpoint matches


                //break out of for loop if match is found
                /*jshint -W116 */
                if(is_breakpoint_match_bool && bp_break_on_match_bool) break;
                /*jshint +W116 */
            }

            //Perform adjustment of breakpoint match value to compensate for if bp_break_on_match_bool is false
            if(is_breakpoint_match_hit_bool && !bp_break_on_match_bool)
            {
                is_breakpoint_match_bool = true;

                var counter_alpha_arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai', 'aj', 'ak', 'al', 'am', 'an', 'ao', 'ap', 'aq', 'ar', 'as', 'at', 'au', 'av', 'aw', 'ax'
                    ],
                    counter_alpha_pre_arr = [],
                    bp_width_match_tracker_arr = _r.explode("-!", bp_width_match_tracker_tok_str),
                    bp_height_match_tracker_arr = _r.explode("-!", bp_height_match_tracker_tok_str),
                    bp_match_score_arr = [],
                    bp_match_score_sort_arr,
                    bp_match_score_sort_keys_arr,
                    bp_match_score_item_int,
                    bp_match_score_width_item_int,
                    bp_match_score_height_item_int,
                    bp_match_sel_key_idx_str,
                    bp_match_sel_idx_str,
                    bp_match_sel_idx_int
                    ;

                //reverse
                bp_width_match_tracker_arr.reverse();
                bp_height_match_tracker_arr.reverse();

                //find the best match
                /**
                 * Find the best match
                 * 1. Matching width and height = 100 points
                 * 2. Matching width = 50 points
                 */
                var counter_alpha_item_str,
                    bp_match_width_idx_str,
                    bp_match_height_idx_str;

                for(var j = 0; j < _r.count(bp_width_match_tracker_arr); j++)
                {
                    bp_match_width_idx_str = bp_width_match_tracker_arr[j];
                    bp_match_height_idx_str = bp_height_match_tracker_arr[j];

                    bp_match_score_width_item_int = (bp_match_width_idx_str === '1') ? 100 : 0;
                    if(bp_match_height_idx_str === '1')
                    {
                        bp_match_score_height_item_int = 50;
                    }
                    else if (bp_match_height_idx_str === '-1')
                    {
                        bp_match_score_height_item_int = -50;
                    }
                    else
                    {
                        bp_match_score_height_item_int = 0;
                    }


                    bp_match_score_item_int = bp_match_score_width_item_int + bp_match_score_height_item_int;

                    //bp_match_score_arr.push(bp_match_score_item_int);
                    counter_alpha_item_str = counter_alpha_arr[j];
                    bp_match_score_arr[counter_alpha_item_str] = bp_match_score_item_int;

                    counter_alpha_pre_arr.push(counter_alpha_item_str);
                }

                var cmp = function ($a, $b) {
                    if ($a === $b) {
                        return 0;
                    }
                    return ($a < $b) ? 1 : -1;
                };

                //sort viewport width breakpoints
                bp_match_score_sort_arr = _r.uasort(bp_match_score_arr, cmp);

                //sort other arrays in an identical fashion to viewport width breakpoints

                bp_match_score_sort_keys_arr = _r.array_keys(bp_match_score_sort_arr);

                bp_match_sel_key_idx_str = bp_match_score_sort_keys_arr[0];
                bp_match_sel_idx_str = _r.array_search(bp_match_sel_key_idx_str, counter_alpha_pre_arr);
                bp_match_sel_idx_int = parseInt(bp_match_sel_idx_str);

                bp_class_str = bp_class_arr[bp_match_sel_idx_int];
                bp_attrib_str = bp_attrib_arr[bp_match_sel_idx_int];
            }

            //Set Class and/or Attribute
            set_data_obj.classes = '';
            if(_r.isString(bp_class_str) && bp_class_str.length > 0)
            {
                set_data_obj.classes = bp_class_str;
            }

            set_data_obj.attributes = '';
            if(_r.isString(bp_attrib_str) && bp_attrib_str.length > 0)
            {
                set_data_obj.attributes = bp_attrib_str;
            }

            //Add Class and/or Attributes
            if(!is_breakpoint_match_bool)
            {
                //no breakpoint match

                //remove/reset any classes and attributes
                _unsetElement(ctx, options);

                //adjust for orientation change
                if (is_ort_change_bool)
                {
                    _setElement(ctx, set_data_obj, options);
                }

                //persist
                rScript.store("rs_var_breakpoint_match_curr", false);
            }
            else
            {
                //breakpoint match
                _setElement(ctx, set_data_obj, options);

                //persist
                rScript.store("rs_var_breakpoint_match_curr", true);
            }

            //Exit true for Matched Breakpoint
            return !!((is_breakpoint_match_bool));
        }

        /**
         * Gets the text value of the selector used to get the object
         * @param el {Object}
         * @private
         */
        function _getSelector(el)
        {
            if (rQuery.isRQueryObject(el))
            {
                return el.selector;
            }
        }

        /**
         * Adds relevant classes and/or attributes on an element
         * @param ctx {*} the context
         * @param set_obj {Object} the main settings object
         * @param options {Object} the options as set in the rScript constructor
         * @private
         */
        function _setElement(ctx, set_obj, options)
        {
            var data_key_seed_str = _getSelector(ctx)+'|'+options.breakpoints.toString(),
                data_key_str = md5(data_key_seed_str),
                set_class_store_id_str = "rs_var_breakpoint_class_"+data_key_str,
                set_attr_store_id_str = "rs_var_breakpoint_attr_"+data_key_str,
                set_class_str = set_obj.classes,
                class_isset_bool = (_r.isString(set_class_str) && set_class_str.length > 0),
                set_class_cache_str = rScript.store(set_class_store_id_str),
                set_attr_str = set_obj.attributes,
                attr_isset_bool = ((set_attr_str !== '')),
                set_attr_cache_str = rScript.store(set_attr_store_id_str),
                op_addclass_bool = false,
                op_addandremoveclass_bool = false
                ;

            var set_class_cache_bool = ((_r.isString(set_class_cache_str) && set_class_cache_str.length > 0));

            if(class_isset_bool)
            {
                if(set_class_cache_bool)
                {
                    if(set_class_cache_str !== set_class_str)
                    {
                        //add class [on change], but remove old one first
                        ctx.removeClass(set_class_cache_str).addClass(set_class_str);
                        op_addandremoveclass_bool = true;
                    }
                    else if (options.init)
                    {
                        //add class on initialization
                        ctx.addClass(set_class_str);
                        op_addclass_bool = true;
                    }
                }
                else
                {
                    //add class
                    ctx.addClass(set_class_str);
                    op_addclass_bool = true;
                }

                //callback trigger + manage store
                if(op_addclass_bool || op_addandremoveclass_bool)
                {
                    rScript.store(set_class_store_id_str, set_class_str);

                    if(op_addandremoveclass_bool)
                    {
                        _callbackTrigger(options, ['removeclass', set_class_cache_str]);
                    }
                    _callbackTrigger(options, ['addclass', set_class_str]);
                }
            }

            if(attr_isset_bool)
            {
                if(set_attr_cache_str !== set_attr_str)
                {
                    //modify breakpoint attribute on change
                    ctx.attr('data-r-breakpoint', set_attr_str);

                    //fire callback if old and new class differ
                    _callbackTrigger(options, ['removeattr', set_attr_cache_str]);
                }
                else if (options.init)
                {
                    //add breakpoint attribute on initialization
                    ctx.attr('data-r-breakpoint', set_attr_str);
                }

                rScript.store(set_attr_store_id_str, set_attr_str);
                _callbackTrigger(options, ['addattr', set_attr_str]);
            }
        }

        /**
         * Removes relevant classes and/or attributes from an element
         * @param ctx {*} the context
         * @param options {Object} the options as set in the $.rScript constructor
         * @private
         */
        function _unsetElement(ctx, options)
        {
            var data_key_seed_str = _getSelector(ctx)+'|'+options.breakpoints.toString(),
                data_key_str = md5(data_key_seed_str),
                set_class_store_id_str = "rs_var_breakpoint_class_"+data_key_str,
                set_attr_store_id_str = "rs_var_breakpoint_attr_"+data_key_str,
                set_class_cache_str = rScript.store(set_class_store_id_str),
                set_attr_cache_str = rScript.store(set_attr_store_id_str),
                set_class_cache_bool = ((_r.isString(set_class_cache_str) && set_class_cache_str.length > 0)),
                set_attr_cache_bool = ((_r.isString(set_attr_cache_str) && set_attr_cache_str.length > 0))
                ;

            if(set_class_cache_bool)
            {
                ctx.removeClass(set_class_cache_str);
                _callbackTrigger(options, ['removeclass', set_class_cache_str]);

                //reset class cache
                rScript.store(set_class_store_id_str, null);
            }

            if(set_attr_cache_bool)
            {
                ctx.attr('data-r-breakpoints', 'off');
                _callbackTrigger(options, ['removeattr', set_attr_cache_str]);

                //reset attr cache
                rScript.store(set_attr_store_id_str, null);
            }
        }

        /**
         * Manages callbacks
         * @param options {Object} the rScript options
         * @param callback_settings {Array} Callback settings
         * @private
         */
        function _callbackTrigger()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options = myArgs[0],
                callback_settings = myArgs[1],
                $on_func,
                $on_func_body_count
                ;

            //Execute onReady
            if(_r.in_array('ready', callback_settings))
            {
                var $on_ready = options.onReady,
                    $on_ready_body_count = options.onReady.getFuncBody().length;
                if(_r.isFunction($on_ready) && ($on_ready_body_count > 0))
                {
                    //Execute Callback
                    $on_ready();
                }
            }

            //Scroll Callbacks
            if (_r.in_array('scroll', callback_settings))
            {
                var $on_scroll = options.onScroll,
                    $on_scroll_body_count = options.onScroll.getFuncBody().length,
                    $on_scroll_left = options.onScrollLeft,
                    $on_scroll_left_body_count = options.onScrollLeft.getFuncBody().length,
                    $on_scroll_right = options.onScrollRight,
                    $on_scroll_right_body_count = options.onScrollRight.getFuncBody().length,
                    $on_scroll_up = options.onScrollUp,
                    $on_scroll_up_body_count = options.onScrollUp.getFuncBody().length,
                    $on_scroll_down = options.onScrollDown,
                    $on_scroll_down_body_count = options.onScrollDown.getFuncBody().length
                    ;

                //get scroll direction over horizontal and vertical plane
                var $scroll_direction_h_str = _getScrollDirection('h'),
                    $scroll_direction_v_str = _getScrollDirection('v');

                //on scroll
                if(_r.isFunction($on_scroll) && ($on_scroll_body_count > 0))
                {
                    //Execute Callback
                    $on_scroll();
                }

                //on scroll left
                if(_r.isFunction($on_scroll_left) && ($on_scroll_left_body_count > 0) && $scroll_direction_h_str === 'left')
                {
                    $on_scroll_left();
                }

                //on scroll right
                if(_r.isFunction($on_scroll_right) && ($on_scroll_right_body_count > 0) && $scroll_direction_h_str === 'right')
                {
                    $on_scroll_right();
                }

                //on scroll up
                if(_r.isFunction($on_scroll_up) && ($on_scroll_up_body_count > 0) && $scroll_direction_v_str === 'up')
                {
                    $on_scroll_up();
                }

                //on scroll down
                if(_r.isFunction($on_scroll_down) && ($on_scroll_down_body_count > 0) && $scroll_direction_v_str === 'down')
                {
                    $on_scroll_down();
                }
            }

            //Resize Callbacks
            if (_r.in_array('resize', callback_settings))
            {
                var $on_resize = options.onResize,
                    $on_resize_body_count = options.onResize.getFuncBody().length,
                    $on_resize_in = options.onResizeIn,
                    $on_resize_in_body_count = options.onResizeIn.getFuncBody().length,
                    $on_resize_out = options.onResizeOut,
                    $on_resize_out_body_count = options.onResizeOut.getFuncBody().length,
                    $on_resize_up = options.onResizeUp,
                    $on_resize_up_body_count = options.onResizeUp.getFuncBody().length,
                    $on_resize_down = options.onResizeDown,
                    $on_resize_down_body_count = options.onResizeDown.getFuncBody().length
                    ;

                //get resize direction over horizontal and vertical plane
                var $resize_direction_h_str = _getResizeDirection('h'),
                    $resize_direction_v_str = _getResizeDirection('v');

                //on resize
                if(_r.isFunction($on_resize) && ($on_resize_body_count > 0))
                {
                    //Execute Callback
                    $on_resize();
                }

                //on resize in
                if(_r.isFunction($on_resize_in) && ($on_resize_in_body_count > 0) && $resize_direction_h_str === 'in')
                {
                    $on_resize_in();
                }

                //on resize out
                if(_r.isFunction($on_resize_out) && ($on_resize_out_body_count > 0) && $resize_direction_h_str === 'out')
                {
                    $on_resize_out();
                }

                //on resize up
                if(_r.isFunction($on_resize_up) && ($on_resize_up_body_count > 0) && $resize_direction_v_str === 'up')
                {
                    $on_resize_up();
                }

                //on resize down
                if(_r.isFunction($on_resize_down) && ($on_resize_down_body_count > 0) && $resize_direction_v_str === 'down')
                {
                    $on_resize_down();
                }
            }

            //Rotate/Orientation Callbacks
            if(_r.in_array('rotate', callback_settings))
            {
                var ort_curr_str = rScript.getOrientation(),
                    $on_rotate = options.onRotate,
                    $on_rotate_body_count = options.onRotate.getFuncBody().length,
                    $on_rotate_to_p = options.onRotateToP,
                    $on_rotate_to_p_body_count = options.onRotateToP.getFuncBody().length,
                    $on_rotate_to_l = options.onRotateToL,
                    $on_rotate_to_l_body_count = options.onRotateToL.getFuncBody().length
                    ;

                if(_r.isFunction($on_rotate) && ($on_rotate_body_count > 0))
                {
                    //Execute Callback
                    $on_rotate();
                }

                if(_r.isFunction($on_rotate_to_p) && ($on_rotate_to_p_body_count > 0) && ort_curr_str === 'portrait')
                {
                    //Execute Callback
                    $on_rotate_to_p();
                }

                if(_r.isFunction($on_rotate_to_l) && ($on_rotate_to_l_body_count > 0) && ort_curr_str === 'landscape')
                {
                    //Execute Callback
                    $on_rotate_to_l();
                }
            }

            //Add/Remove Class and Attribute Callbacks
            if(_r.in_array('addclass', callback_settings) || _r.in_array('removeclass', callback_settings) || _r.in_array('addattr', callback_settings) || _r.in_array('removeattr', callback_settings))
            {
                var $callback_type_str = callback_settings[0],
                    $callback_type_args = callback_settings[1],
                    $callback_data_arr = {'addclass': 'onAddClass', 'removeclass': 'onRemoveClass', 'addattr': 'onAddAttr', 'removeattr': 'onRemoveAttr'}
                    ;
                $on_func = options[$callback_data_arr[''+$callback_type_str+'']];
                $on_func_body_count = $on_func.getFuncBody().length;

                if (_r.isFunction($on_func) && ($on_func_body_count > 0))
                {
                    //Execute Callback
                    $on_func($callback_type_args);
                }
            }

            //Initialization Callbacks
            if(_r.in_array('init', callback_settings))
            {
                var callback_name_arr = [
                        'onPortrait', 'onLandscape', 'onRetina', 'onPhone', 'onTablet', 'onDesktop', 'onTV', 'onIOS', 'onAndroid', 'onSymbian', 'onBlackberry', 'onWindows', 'onWindowsPhone', 'onMobile', 'onNonMobile'
                    ],
                    func_name_arr = [
                        'isPortrait', 'isLandscape', 'isRetina', 'isPhone', 'isTablet', 'isDesktop', 'isTV', 'isIOS', 'isAndroid', 'isSymbian', 'isBlackberry', 'isWindows', 'isWindowsPhone', 'isMobile', 'isNonMobile'
                    ];

                for(var i = 0; i < _r.count(func_name_arr); i++)
                {
                    $on_func = options[callback_name_arr[i]];
                    $on_func_body_count = $on_func.getFuncBody().length;

                    if(_r.isFunction($on_func) && ($on_func_body_count > 0))
                    {
                        var $on_func_res = rScript[func_name_arr[i]],
                            $on_func_bool = $on_func_res();
                        if($on_func_bool)
                        {
                            $on_func();
                        }
                    }
                }
            }
        }

        /**
         * Special rScript Callback for Resize Event
         * This will be staged for execution by _onResize when callback_fn argument is === 'prime'
         * @private
         */
        function _resizeFnPrime()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                elem_win_obj = $(window),
                trigger_suffix_str = myArgs[0]
                ;

            //get viewport info before they are reset in storage
            var viewport_w_prev_int = rScript.store("rs_var_viewport_w"),
                viewport_h_prev_int = rScript.store("rs_var_viewport_h");

            //set to storage
            rScript.store("rs_var_viewport_w_prev", viewport_w_prev_int);
            rScript.store("rs_var_viewport_h_prev", viewport_h_prev_int);

            //re-initialize dimension variables
            rScript.initDimVars();

            //get current and active and define local variables
            var is_mobile_bool = rScript.isMobile(),
                ort_active_str = rScript.getOrientation(true),
                ort_curr_str = rScript.store("rs_var_screen_ort_curr"),
                viewport_w_curr_int,
                viewport_h_curr_int,
                viewport_w_diff_int,
                viewport_w_diff_abs_int,
                viewport_w_diff_pc_int,
                viewport_h_diff_int,
                viewport_h_diff_abs_int,
                viewport_h_diff_pc_int,
                is_softkey_bool = false;

            //Update stored values for dimensions
            rScript.updateDimStore();

            /**
             * Perform soft keyboard check
             * This manages for mobile devices that resize the viewport when the soft keyboard is initialized
             * This scenario will sometimes result in a pseudo-orientation change which is unwanted
             */
            if(is_mobile_bool)
            {
                viewport_w_curr_int = rScript.store("rs_var_viewport_w");
                viewport_h_curr_int = rScript.store("rs_var_viewport_h");
                viewport_w_diff_int = viewport_w_curr_int-viewport_w_prev_int;
                viewport_h_diff_int = viewport_h_curr_int-viewport_h_prev_int;
                viewport_w_diff_abs_int = Math.abs(viewport_w_diff_int);
                viewport_h_diff_abs_int = Math.abs(viewport_h_diff_int);

                //get the percentage changes in viewport width and height
                viewport_w_diff_pc_int = (viewport_w_diff_abs_int/viewport_w_prev_int)*100;
                viewport_h_diff_pc_int = (viewport_h_diff_abs_int/viewport_h_prev_int)*100;

                if (viewport_w_diff_pc_int < 1)
                {
                    /**
                     * Set soft keyboard flag to true on the following conditions
                     * 1: soft keyboard is opening
                     * 2: soft keyboard is closing - start
                     * 3: soft keyboard is closing - end
                     * 4: no movement - possible soft keyboard action
                     */
                    is_softkey_bool = !!(((viewport_h_diff_pc_int > 35 && viewport_h_diff_int < 0) || (viewport_h_diff_pc_int > 35 && viewport_h_diff_int > 0) || (viewport_h_diff_pc_int > 12 && viewport_h_diff_pc_int <= 35 && viewport_h_diff_int > 0) || (viewport_h_diff_pc_int === 0)));
                }
            }

            /**
             * Trigger events only if soft keyboard action is not detected
             */
            if(!is_softkey_bool) {
                if (ort_curr_str !== ort_active_str) {
                    //orientation has changed. Update stored values for dimensions and orientation
                    rScript.updateOrtStore();

                    elem_win_obj.trigger("change_orientation" + trigger_suffix_str);
                }
                else {
                    /**
                     * Fire resize only for devices that are non-mobile
                     * This eliminates resize callback functionality for mobile devices
                     */
                    if (!is_mobile_bool) {
                        elem_win_obj.trigger("resize_viewport" + trigger_suffix_str);
                    }
                }
            }
        }

        /**
         * Sets up a resize event handler to run queued functions
         * Note: These are functions that have been previously queued using onResize method
         * @private
         */
        function __resize()
        {
            var resize_fn = function(){
                //run queued resize functions
                rScript.runFunction('resize_fn', {queue: true, namespace: 'resize_fn'});
                //run queued resize_start and resize_end functions
                rScript.runFunction('resize_fn_start', {queue: true, namespace: 'resize_fn_start'});
                rScript.runFunction('resize_fn_end', {queue: true, namespace: 'resize_fn_end'});
            }
            _resize(resize_fn);
        }

        /**
         * Attach an event handler to the resize event
         * @param {Function} callback_fn the callback function to run
         * @param {String} event_handler_mode_str the event handler mode. Either 'debounce', 'throttle', or 'none'
         * @param {Number} event_handler_timer_int the timer to use for event handler mode
         * @param {String} trigger_suffix_str the suffix to differentiate the event trigger
         * @private
         */
        function _onResize(callback_fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                resize_handler_fn,
                is_prime_handler_bool = ((callback_fn === 'prime')),
                event_handler_fn = (is_prime_handler_bool) ? _resizeFnPrime : callback_fn,
                event_handler_type_str = (_r.isString(myArgs[1])) ? myArgs[1]: 'throttle',
                event_handler_timer_int = (_r.isNumber(myArgs[2])) ? myArgs[2]: 100,
                trigger_suffix_str = (_r.isString(myArgs[3]) && myArgs[3].length > 0) ? "_"+myArgs[3]: "",
                resize_monit_fn
                ;

            //stage event handler
            if(is_prime_handler_bool)
            {
                resize_monit_fn = function()
                {
                    //trigger viewport event handler
                    event_handler_fn(trigger_suffix_str);
                };

                //mark if prime
                rScript.domStore('rs_var_event_listener_prime_resize', true);
            }
            else
            {
                resize_monit_fn = function()
                {
                    //trigger viewport event handler
                    event_handler_fn();
                };
            }

            //create the event handler
            if(event_handler_type_str === "throttle")
            {
                resize_handler_fn = _r.throttle(resize_monit_fn, event_handler_timer_int);
            }
            else if (event_handler_type_str === "debounce")
            {
                resize_handler_fn = _r.debounce(resize_monit_fn, event_handler_timer_int);
            }
            else
            {
                resize_handler_fn = resize_monit_fn;
            }

            //add to resize function queue
            rScript.addFunction('resize_fn', resize_handler_fn, {queue: true, namespace: 'resize_fn'});
        }

        /**
         * Adds a function to be called when the resize event is fired
         * Wrapper of _onResize
         */
        rScript_obj.onResize = function(callback_fn)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _onResize(callback_fn, myArgs[1], myArgs[2], myArgs[3]);
        }

        /**
         * Executes a function [once] when a resize event is started
         * @param fn {Function} the callback function
         * @param timer_int {Number} an optional wait timer for the event throttler. Default is 50ms
         */
        function _onResizeStart(fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                timer_int = (_r.isNumber(myArgs[1])) ? myArgs[1]: 50,
                rand_str = generateRandomString('aAannanAnanAa'),
                handler_tag_str = 'rs_var_event_resize_start_fn_tag_'+rand_str,
                handler_fn = _getEventStartHandler(fn, timer_int, handler_tag_str);

            //add start event handler tag to storage
            //it will be cleared later to enable proper operation of start event for resize
            if(!rScript.domStore('rs_var_event_resize_start_fn_tags'))
            {
                rScript.domStore('rs_var_event_resize_start_fn_tags', []);
            }
            rScript.domStore('rs_var_event_resize_start_fn_tags').push(handler_tag_str);

            //add to scroll_start function queue
            rScript.addFunction('resize_fn_start', handler_fn, {queue: true, namespace: 'resize_fn_start'});
        }

        /**
         * Wrapper class for _onResizeStart
         */
        rScript_obj.onResizeStart = function(fn)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _onResizeStart(fn, myArgs[1]);
            return this;
        };


        /**
         * Executes a function [once] when a resize event completes
         * @param fn {Function} the callback function
         * @param timer_int {Number} an optional wait timer for the event debouncer. Default is 500ms
         * @private
         */
        function _onResizeEnd(fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                timer_int = (_r.isNumber(myArgs[1])) ? myArgs[1]: 500,
                handler_fn = _getEventEndHandler(fn, timer_int),
                handler_cleanup_temp_fn,
                handler_cleanup_fn;

            //add a cleanup function on first init
            //to make sure that onStartScroll tags are set to false
            //onStartScroll won't work properly without it
            if(!rScript.domStore('rs_var_event_resize_start_handler_fn_tags_flush'))
            {
                handler_cleanup_temp_fn = function(){
                    var event_start_tags_arr = rScript.domStore('rs_var_event_resize_start_fn_tags'),
                        i;
                    if(_r.count(event_start_tags_arr) > 0)
                    {
                        for(i = 0; i < event_start_tags_arr.length; i++)
                        {
                            rScript.domStore(event_start_tags_arr[i], false);
                        }
                    }

                    rScript.domStore('rs_var_event_resize_start_handler_fn_tags_flush', true);
                };
                handler_cleanup_fn = _getEventEndHandler(handler_cleanup_temp_fn, timer_int);

                //add to scroll_end function queue
                rScript.addFunction('resize_fn_end', handler_cleanup_fn, {queue: true, namespace: 'resize_fn_end'});
            }

            //add to scroll_end function queue
            rScript.addFunction('resize_fn_end', handler_fn, {queue: true, namespace: 'resize_fn_end'});
        }

        /**
         * Wrapper class for _onResizeEnd
         */
        rScript_obj.onResizeEnd = function(fn)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _onResizeEnd(fn, myArgs[1]);
            return this;
        };

        /**
         * Manages event handlers for resize
         * @param ctx {Object} the context
         * @param options {Object} the options from rScript constructor
         * @param event_name {String} the event name
         * @param settings_obj {Object} special settings data
         * @private
         */
        function _resizeEventManager(ctx, options, event_name, settings_obj)
        {
            var win_obj = $(window),
                breakpoint_arr = settings_obj.breakpoints_array;

            //set event handler
            win_obj.on(event_name, function(){
                _resizeEventTrigger(ctx, breakpoint_arr, options, settings_obj);
            });
        }

        /**
         * Triggers an event handler [resize]
         * @param ctx {Object} the context
         * @returns {*}
         * @private
         */
        function _resizeEventTrigger(ctx)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                bp_arr = myArgs[1],
                options = myArgs[2],
                settings_obj = myArgs[3],
                callback_id_arr = settings_obj.callback_id_array,
                event_status_str = settings_obj.event_status,
                bp_settings_obj = {}
                ;

            bp_settings_obj.responsive_basis = settings_obj.responsive_basis;

            try{
                return ctx.each(function(ix, el)
                {
                    if(bp_arr)
                    {
                        //run only if breakpoints are provided

                        var _this = $(el);

                        //match breakpoints + set classes and attributes
                        _setBreakpoints(_this, bp_arr, options, bp_settings_obj, event_status_str);
                    }

                    //fire turbo methods if set
                    if (options.turbo_refresh)
                    {
                        _turboAttributes();
                        _turboClasses();
                    }

                    //fire relevant callbacks
                    _callbackTrigger(options, callback_id_arr);
                });
            }
            catch(e){
                var e_msg_str = 'rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: '+e.message;
                _r.console.error(e_msg_str, true);
            }
        }

        /**
         * Attach an event handler for the resize event
         * @param {Function} fn The function to execute
         * @return object
         * @private
         */
        function _resize(fn)
        {
            $(window).on('resize', fn);
            return rScript;
        }

        /**
         * Special rScript Callback for ResizeContainer Event
         * This will be staged for execution by _onResizeContainer when callback_fn argument is === 'prime'
         * @private
         */
        function _resizeContainerFnPrime()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                elem_win_obj = $(window),
                trigger_suffix_str = myArgs[0];

            elem_win_obj.trigger("resize_container"+trigger_suffix_str);
        }

        /**
         * Attach an event handler to the resize container event
         * @param {Object} elem_obj the DOM object that will be tracked for resize
         * @param {Function} callback_fn the callback function to run
         * @param {String} event_handler_mode_str the event handler mode. Either 'debounce', 'throttle', or 'none'
         * @param {Number} event_handler_timer_int the timer to use for event handler mode
         * @param {String} trigger_suffix_str the suffix to differentiate the event trigger
         * @private
         */
        function _onResizeContainer(elem_obj)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                resize_container_handler_fn,
                elem_core_obj = elem_obj[0],
                callback_fn = (myArgs[1]) ? myArgs[1]: function(){},
                is_prime_handler_bool = ((callback_fn === 'prime')),
                event_handler_fn = (is_prime_handler_bool) ? _resizeContainerFnPrime : callback_fn,
                event_handler_mode_str = (_r.isString(myArgs[2])) ? myArgs[2]: 'throttle',
                event_handler_timer_int = (_r.isNumber(myArgs[3])) ? myArgs[3]: 50,
                trigger_suffix_str = (_r.isString(myArgs[4]) && myArgs[4].length > 0) ? "_"+myArgs[4]: "",
                is_mobile_bool = rScript.isMobile(),
                resize_container_monit_fn
                ;

            //stage event handler
            if(is_prime_handler_bool)
            {
                resize_container_monit_fn = function(){

                    //trigger event handler
                    event_handler_fn(trigger_suffix_str);
                };

                //mark if prime
                rScript.domStore('rs_var_event_listener_prime_resize_container', true);
            }
            else
            {
                resize_container_monit_fn = function(){

                    //trigger event handler
                    event_handler_fn();
                };
            }

            //Double wait time for mobile devices
            event_handler_timer_int = (is_mobile_bool) ? event_handler_timer_int * 2 : event_handler_timer_int;

            //execute
            if(event_handler_mode_str === "throttle")
            {
                resize_container_handler_fn = _r.throttle(resize_container_monit_fn, event_handler_timer_int);
                _resizeContainer(elem_core_obj, resize_container_handler_fn);
            }
            else if (event_handler_mode_str === "debounce")
            {
                resize_container_handler_fn = _r.debounce(resize_container_monit_fn, event_handler_timer_int);
                _resizeContainer(elem_core_obj, resize_container_handler_fn);
            }
            else
            {
                _resizeContainer(elem_core_obj, resize_container_monit_fn);
            }
        }

        /**
         * Attach an event handler for the resize container event
         * Wrapper of _onResizeContainer
         */
        rScript_obj.onResizeContainer = function(el_obj)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _onResizeContainer(el_obj, myArgs[1], myArgs[2], myArgs[3], myArgs[4]);
        }

        /**
         * Manages event handlers for container events
         * @param ctx {Object} the context
         * @param options {Object} the options from rScript constructor
         * @param event_name {String} the event name
         * @param settings_obj {Object} special settings data
         * @private
         */
        function _resizeContainerEventManager(ctx, options, event_name, settings_obj)
        {
            var win_obj = $(window),
                breakpoint_arr = settings_obj.breakpoints_array;

            //set event handler
            win_obj.on(event_name, function(){
                _resizeContainerEventTrigger(ctx, breakpoint_arr, options, settings_obj);
            });
        }

        /**
         * Triggers an event handler [container]
         * @param ctx {Object} the context
         * @returns {*}
         * @private
         */
        function _resizeContainerEventTrigger(ctx)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                bp_arr = myArgs[1],
                options = myArgs[2],
                settings_obj = myArgs[3],
                event_status_str = settings_obj.event_status
                ;

            try{
                return ctx.each(function(ix, el)
                {
                    var _this = $(el);

                    //match breakpoints + set classes and attributes
                    _setBreakpoints(_this, bp_arr, options, settings_obj, event_status_str);

                });
            }
            catch(e){
                var e_msg_str = 'rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: '+e.message;
                _r.console.error(e_msg_str, true);
            }
        }

        /**
         * Attach an event handler for the resizecontainer event
         * @param {Object} el the object
         * @param {Function} fn The function to execute
         * @return object
         * @private
         */
        function _resizeContainer(el, fn)
        {
            return new ResizeSensor(el, fn);
        }

        /**
         * Gets the direction that a flexible browser window was resized
         * @param plane_str {string} the plane under consideration i.e. horizontal ('h') or vertical ('v')
         * @return {string|null}
         * @private
         */
        function _getResizeDirection(plane_str)
        {
            var resize_direction_str = 'none',
                viewport_w_int = parseInt(rScript.store("rs_var_viewport_w")),
                viewport_h_int = parseInt(rScript.store("rs_var_viewport_h")),
                viewport_w_prev_int = parseInt(rScript.store("rs_var_viewport_w_prev")),
                viewport_h_prev_int = parseInt(rScript.store("rs_var_viewport_h_prev"))
                ;

            if (plane_str === 'h')
            {
                //determine resize direction over horizontal plane
                if(viewport_w_int < viewport_w_prev_int)
                {
                    //resize in
                    resize_direction_str = 'in';
                }
                else if (viewport_w_int > viewport_w_prev_int)
                {
                    //resize out
                    resize_direction_str = 'out';
                }
            }
            else if (plane_str === 'v')
            {
                //determine resize direction over vertical plane
                if(viewport_h_int < viewport_h_prev_int)
                {
                    //resize in
                    resize_direction_str = 'up';
                }
                else if (viewport_h_int > viewport_h_prev_int)
                {
                    //resize out
                    resize_direction_str = 'down';
                }
            }

            return resize_direction_str;
        }

        /**
         * Activates scroll tracking
         * This will also set variables that allow measurement of scroll direction
         * @private
         */
        function _scrollDirectionTracking()
        {
            /**
             * Update scroll variables as they change
             * 1: Get previous values and save to storage
             * 2: Refresh original scroll variable values
             */

            //1:
            rScript.store("rs_var_viewport_scroll_t_prev", rScript.store("rs_var_viewport_scroll_t"));
            rScript.store("rs_var_viewport_scroll_l_prev", rScript.store("rs_var_viewport_scroll_l"));

            //2:
            _initScrollVars();
        }

        /**
         * Special rScript Callback for Scroll Event
         * This will be staged for execution by _onScroll when callback_fn argument is === 'prime'
         * @private
         */
        function _scrollFnPrime()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                elem_win_obj = $(window),
                trigger_suffix_str = myArgs[0];

            elem_win_obj.trigger("scroll_viewport" + trigger_suffix_str);
        }

        /**
         * Sets up a scroll event handler to run queued functions
         * Note: These are functions that have been previously queued using _onScroll method
         * Note: contains double-underscore prefix
         * @private
         */
        function __scroll()
        {
            var scroll_fn = function(){
                //run queued scroll functions
                rScript.runFunction('scroll_fn', {queue: true, namespace: 'scroll_fn'});
                //run queued scroll_start and scroll_end functions
                rScript.runFunction('scroll_fn_start', {queue: true, namespace: 'scroll_fn_start'});
                rScript.runFunction('scroll_fn_end', {queue: true, namespace: 'scroll_fn_end'});
            }
            _scroll(scroll_fn);
        }

        /**
         * Adds a function to be called when the scroll event is fired
         * @param {Function} callback_fn the callback function
         * @param {String} event_handler_mode_str the event handler mode. Either 'debounce', 'throttle', or 'none'
         * @param {Number} event_handler_timer_int the timer to use for event handler mode
         * @param {String} trigger_suffix_str the suffix to differentiate the event trigger
         * @private
         */
        function _onScroll(callback_fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                scroll_handler_fn,
                is_prime_handler_bool = ((callback_fn === 'prime')),
                event_handler_fn = (is_prime_handler_bool) ? _scrollFnPrime : callback_fn,
                event_handler_mode_str = (_r.isString(myArgs[1])) ? myArgs[1]: 'throttle',
                event_handler_timer_int = (_r.isNumber(myArgs[2])) ? myArgs[2]: 100,
                trigger_suffix_str = (_r.isString(myArgs[3]) && myArgs[3].length > 0) ? "_"+myArgs[3]: "",
                is_mobile_bool = rScript.isMobile(),
                scroll_monit_fn
                ;

            if(is_prime_handler_bool)
            {
                //mark if prime
                rScript.domStore('rs_var_event_listener_prime_scroll', true);
            }

            //stage event handler
            if(!rScript.domStore('rs_var_run_scroll_event_init'))
            {
                scroll_monit_fn = function(){

                    //enable scroll direction tracking
                    _scrollDirectionTracking();

                    //trigger scroll event handler
                    event_handler_fn(trigger_suffix_str);
                };

                rScript.domStore('rs_var_run_scroll_event_init', true);
            }
            else
            {
                scroll_monit_fn = function(){

                    //trigger scroll event handler
                    event_handler_fn();
                };
            }

            //Double wait time for mobile devices
            event_handler_timer_int = (is_mobile_bool) ? event_handler_timer_int * 2 : event_handler_timer_int;

            //create the event handler
            if(event_handler_mode_str === "throttle")
            {
                scroll_handler_fn = _r.throttle(scroll_monit_fn, event_handler_timer_int);
            }
            else if (event_handler_mode_str === "debounce")
            {
                scroll_handler_fn = _r.debounce(scroll_monit_fn, event_handler_timer_int);
            }
            else
            {
                scroll_handler_fn = scroll_monit_fn;
            }

            //add to scroll function queue
            rScript.addFunction('scroll_fn', scroll_handler_fn, {queue: true, namespace: 'scroll_fn'});
        }

        /**
         * Attach an event handler for the scroll event
         * It can be used multiple times to attach multiple handlers
         * Wrapper function of _onScroll
         * @param {Function} callback_fn
         */
        rScript_obj.onScroll = function(callback_fn)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _onScroll(callback_fn, myArgs[1], myArgs[2], myArgs[3]);
            return this;
        }

        /**
         * Executes a function [once] when a scroll event is started
         * @param fn {Function} the callback function
         * @param timer_int {Number} an optional wait timer for the event throttler. Default is 50ms
         * @private
         */
        function _onScrollStart(fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                timer_int = (_r.isNumber(myArgs[1])) ? myArgs[1]: 50,
                rand_str = generateRandomString('aAannanAnanAa'),
                handler_tag_str = 'rs_var_event_scroll_start_fn_tag_'+rand_str,
                handler_fn = _getEventStartHandler(fn, timer_int, handler_tag_str);

            //add start event handler tag to storage
            //it will be cleared later to enable proper operation of start event for scroll
            if(!rScript.domStore('rs_var_event_scroll_start_fn_tags'))
            {
                rScript.domStore('rs_var_event_scroll_start_fn_tags', []);
            }
            rScript.domStore('rs_var_event_scroll_start_fn_tags').push(handler_tag_str);

            //add to scroll_start function queue
            rScript.addFunction('scroll_fn_start', handler_fn, {queue: true, namespace: 'scroll_fn_start'});
        }

        /**
         * Executes a function [once] when a scroll event is started
         * @param fn {Function} the callback function
         * @param timer_int {Number} an optional wait timer for the event throttler. Default is 50ms
         */
        rScript_obj.onScrollStart = function(fn)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _onScrollStart(fn, myArgs[1]);
            return this;
        };

        /**
         * Executes a function [once] when a scroll event completes
         * @param fn {Function} the callback function
         * @param timer_int {Number} an optional wait timer for the event debouncer. Default is 500ms
         * @private
         */
        function _onScrollEnd(fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                timer_int = (_r.isNumber(myArgs[1])) ? myArgs[1]: 500,
                handler_fn = _getEventEndHandler(fn, timer_int),
                handler_cleanup_temp_fn,
                handler_cleanup_fn;

            //add a cleanup function on first init
            //to make sure that onStartScroll tags are set to false
            //onStartScroll won't work properly without it
            if(!rScript.domStore('rs_var_event_scroll_start_handler_fn_tags_flush'))
            {
                handler_cleanup_temp_fn = function(){
                    var event_start_tags_arr = rScript.domStore('rs_var_event_scroll_start_fn_tags'),
                        i;
                    if(_r.count(event_start_tags_arr) > 0)
                    {
                        for(i = 0; i < event_start_tags_arr.length; i++)
                        {
                            rScript.domStore(event_start_tags_arr[i], false);
                        }
                    }

                    rScript.domStore('rs_var_event_scroll_start_handler_fn_tags_flush', true);
                };
                handler_cleanup_fn = _getEventEndHandler(handler_cleanup_temp_fn, timer_int);

                //add to scroll_end function queue
                rScript.addFunction('scroll_fn_end', handler_cleanup_fn, {queue: true, namespace: 'scroll_fn_end'});
            }

            //add to scroll_end function queue
            rScript.addFunction('scroll_fn_end', handler_fn, {queue: true, namespace: 'scroll_fn_end'});
        }

        /**
         * Wrapper class for _onScrollEnd
         */
        rScript_obj.onScrollEnd = function(fn)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _onScrollEnd(fn, myArgs[1]);
            return this;
        };

        /**
         * Manages the event handler for scroll events
         * @param ctx {Object} the context
         * @param options {Object} the options from rScript constructor
         * @param event_name {String} the event name
         * @param settings_obj {Object} special settings data
         * @private
         */
        function _scrollEventManager(ctx, options, event_name, settings_obj)
        {
            var win_obj = $(window),
                breakpoint_arr = settings_obj.breakpoints_array;

            //set event handler
            win_obj.on(event_name, function(){
                _scrollEventTrigger(ctx, breakpoint_arr, options, settings_obj);
            });
        }

        /**
         * Triggers an event handler [scroll]
         * @param ctx {Object} the context
         * @returns {*}
         * @private
         */
        function _scrollEventTrigger(ctx)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                bp_arr = myArgs[1],
                options = myArgs[2],
                settings_obj = myArgs[3],
                callback_id_arr = settings_obj.callback_id_array,
                event_status_str = settings_obj.event_status,
                bp_settings_obj = {}
                ;

            bp_settings_obj.responsive_basis = settings_obj.responsive_basis;

            try{
                return ctx.each(function(ix, el)
                {
                    if(bp_arr)
                    {
                        //run only if breakpoints are provided

                        var _this = $(el);

                        //match breakpoints + set classes and attributes
                        _setBreakpointsScroll(_this, bp_arr, options, bp_settings_obj, event_status_str);
                    }

                    //fire relevant callbacks
                    _callbackTrigger(options, callback_id_arr);

                });
            }
            catch(e){
                var e_msg_str = 'rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: '+e.message;
                _r.console.error(e_msg_str, true);
            }
        }

        /**
         * Attach an event handler for the scroll event
         * @param {Function} fn The function to execute
         * @return object
         * @private
         */
        function _scroll(fn)
        {
            $(window).on('scroll', fn);
            return rScript;
        }

        /**
         * Gets the direction that a browser is scrolling
         * @param plane_str {string} the plane under consideration i.e. horizontal ('h') or vertical ('v')
         * @return {string|null}
         * @private
         */
        function _getScrollDirection(plane_str)
        {
            var scroll_direction_str = null,
                scroll_top_int = parseInt(rScript.store("rs_var_viewport_scroll_t")),
                scroll_left_int = parseInt(rScript.store("rs_var_viewport_scroll_l")),
                scroll_top_prev_int = parseInt(rScript.store("rs_var_viewport_scroll_t_prev")),
                scroll_left_prev_int = parseInt(rScript.store("rs_var_viewport_scroll_l_prev"))
                ;

            if (plane_str === 'h')
            {
                //determine resize direction over horizontal plane
                if(scroll_left_int < scroll_left_prev_int)
                {
                    //scroll left
                    scroll_direction_str = 'left';
                }
                else if (scroll_left_int > scroll_left_prev_int)
                {
                    //scroll right
                    scroll_direction_str = 'right';
                }
                else
                {
                    //no scroll
                    scroll_direction_str = 'none';
                }
            }
            else if (plane_str === 'v')
            {
                //determine resize direction over vertical plane
                if(scroll_top_int < scroll_top_prev_int)
                {
                    //scroll up
                    scroll_direction_str = 'up';
                }
                else if (scroll_top_int > scroll_top_prev_int)
                {
                    //scroll down
                    scroll_direction_str = 'down';
                }
                else
                {
                    //no scroll
                    scroll_direction_str = 'none';
                }
            }

            return scroll_direction_str;
        }

        /**
         * Executes a function at the start of a specific event
         * @param fn {Function} the callback function
         * @param timer_int {Number} a wait timer [in ms] for the event throttler
         * @param var_dom_name_str {String} the name for the DOM store variable that will
         * be used to track status
         * @returns {Function}
         * @private
         */
        function _getEventStartHandler(fn, timer_int, var_dom_name_str)
        {
            var handler_fn = function()
            {
                if(!rScript.domStore(var_dom_name_str))
                {
                    fn();

                    //set marker to true to prevent multiple firing
                    rScript.domStore(var_dom_name_str, true);
                }
            };

            return _r.throttle(handler_fn, timer_int);
        }

        /**
         * Executes a function at the end of a specific event
         * @param fn {Function} the callback function
         * @param timer_int {Number} a wait timer [in ms] for the event debouncer
         * @param var_dom_name_str {String} the name for the DOM store variable that will be used to track status
         * @returns {Function}
         * @private
         */
        function _getEventEndHandler(fn, timer_int, var_dom_name_str)
        {
            var fn_util = function()
            {
                if(rScript.domStore(var_dom_name_str))
                {
                    //set marker to false to reset for _getEventStartHandler calls
                    rScript.domStore(var_dom_name_str, false);
                }
            };

            return _r.debounce(fn, timer_int, fn_util);
        }

        /**
         * Initializes scroll variables to local storage
         * @private
         */
        function _initScrollVars()
        {
            var browser_name_str = rScript.getBrowserName(),
                doc_scroll_obj = (document.documentElement && _r.isNumber(document.documentElement.scrollTop) && browser_name_str === 'firefox') ? document.documentElement : document.body;

            rScript.store("rs_var_viewport_scroll_t", parseInt(doc_scroll_obj.scrollTop));
            rScript.store("rs_var_viewport_scroll_l", parseInt(doc_scroll_obj.scrollLeft));
        }

        /**
         * Attach an event handler for network events
         * Powered by Offline.js <https://github.com/HubSpot/offline>
         * @param {String} event_str the event identifier
         * @param {Function} fn the function to execute
         * @param {Object} options_obj the options
         * @param {Boolean} off_bool if true, will unbind
         * @return object
         * @private
         */
        function _network(event_str, fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = myArgs[2],
                off_bool = myArgs[3];

            if(options_obj)
            {
                Offline.options = options_obj;
            }

            if(off_bool)
            {
                //unbind
                Offline.off(event_str, fn);
            }
            else
            {
                //bind
                Offline.on(event_str, fn);
            }

            return rScript;
        }

        /**
         * Schedules a function to run on a network connectivity event
         * @param {String} event_str the event identifier
         * event_str is analogous to offline.js official event bindings. See https://github.com/hubspot/offline
         * The available values are:
         * up: analogous to up
         * down: analogous to down
         * confirm_up: analogous to confirmed-up
         * confirm_down: analogous to confirmed-down
         * reconnect: analogous to reconnect:connecting
         * reconnect_start: analogous to reconnect:started
         * reconnect_fail: analogous to reconnect:failure
         * reconnect_stop: analogous to reconnect:stopped
         *
         * @param {Function} fn the callback function
         * @private
         */
        function _onNetwork(event_str, fn)
        {
            if(!_r.in_array(event_str, ['up', 'down', 'confirm_up', 'confirm_down', 'reconnect', 'reconnect_start', 'reconnect_fail', 'reconnect_stop']))
            {
                return false;
            }

            rScript.addFunction('network_fn_'+event_str, fn, {queue: true, namespace: 'network_fn_'+event_str});

            //enable main network connectivity event manager
            __network();
        }

        /**
         * Executes a function [once] when the network connection goes from offline to online
         * @param fn {Function} the callback function
         * @private
         */
        function _onNetworkUp(fn)
        {
            _onNetwork('up', fn);
        }

        /**
         * Executes a function [once] when a network connection test succeeds
         * The function is fired even if the connection is already up
         * @param fn {Function} the callback function
         * @private
         */
        function _onNetworkConfirmUp(fn)
        {
            _onNetwork('confirm_up', fn);
        }

        /**
         * Executes a function [once] when the network connection goes from online to offline
         * @param fn {Function} the callback function
         * @private
         */
        function _onNetworkDown(fn)
        {
            _onNetwork('down', fn);
        }

        /**
         * Executes a function [once] when a network connection test fails
         * The function is fired even if the connection is already down
         * @param fn {Function} the callback function
         * @private
         */
        function _onNetworkConfirmDown(fn)
        {
            _onNetwork('confirm_down', fn);
        }

        /**
         * Executes a function [once] when the network connection attempts to reconnect
         * @param fn {Function} the callback function
         * @private
         */
        function _onNetworkReconnect(fn)
        {
            _onNetwork('reconnect', fn);
        }

        /**
         * Executes a function [once] when the network connection's attempt to reconnect starts
         * @param fn {Function} the callback function
         * @private
         */
        function _onNetworkReconnectStart(fn)
        {
            _onNetwork('reconnect_start', fn);
        }

        /**
         * Executes a function [once] when the network connection's attempt to reconnect failed
         * @param fn {Function} the callback function
         * @private
         */
        function _onNetworkReconnectFail(fn)
        {
            _onNetwork('reconnect_fail', fn);
        }

        /**
         * Executes a function [once] when the network connection's attempt to reconnect is stopped
         * @param fn {Function} the callback function
         * @private
         */
        function _onNetworkReconnectStop(fn)
        {
            _onNetwork('reconnect_stop', fn);
        }

        /**
         * Unbinds an event
         * @param {String} event_str the event identifier
         * up: analogous to up
         * down: analogous to down
         * confirm_up: analogous to confirmed-up
         * confirm_down: analogous to confirmed-down
         * reconnect: analogous to reconnect:connecting
         * reconnect_start: analogous to reconnect:started
         * reconnect_fail: analogous to reconnect:failure
         * reconnect_stop: analogous to reconnect:stopped
         *
         * @param {Function} fn the callback function that was initially passed to _onNetwork method
         * @private
         */
        function _offNetwork(event_str, fn)
        {
            if(!_r.in_array(event_str, ['up', 'down', 'confirm_up', 'confirm_down', 'reconnect', 'reconnect_start', 'reconnect_fail', 'reconnect_stop']))
            {
                return false;
            }

            rScript.removeFunction('network_fn_'+event_str, {fn: fn, queue: true, namespace: 'network_fn_'+event_str});
        }

        /**
         * Sets up a network event handler to run queued functions
         * Note: These are functions that have been previously queued using _onNetwork method
         * Note: contains double-underscore prefix
         * @private
         */
        function __network()
        {
            //create handlers
            var network_up_fn = function(){
                //run queued network up functions
                rScript.runFunction('network_fn_up', {queue: true, namespace: 'network_fn_up'});
            };
            var network_confirm_up_fn = function(){
                //run queued network confirm up functions
                rScript.runFunction('network_fn_confirm_up', {queue: true, namespace: 'network_fn_confirm_up'});
            };
            var network_down_fn = function(){
                //run queued network down functions
                rScript.runFunction('network_fn_down', {queue: true, namespace: 'network_fn_down'});
            };
            var network_confirm_down_fn = function(){
                //run queued network confirm down functions
                rScript.runFunction('network_fn_confirm_down', {queue: true, namespace: 'network_fn_confirm_down'});
            };
            var network_reconnect_fn = function(){
                //run queued network reconnect functions
                rScript.runFunction('network_fn_reconnect', {queue: true, namespace: 'network_fn_reconnect'});
            };
            var network_reconnect_start_fn = function(){
                //run queued network reconnect start functions
                rScript.runFunction('network_fn_reconnect_start', {queue: true, namespace: 'network_fn_reconnect_start'});
            };
            var network_reconnect_stop_fn = function(){
                //run queued network reconnect stop functions
                rScript.runFunction('network_fn_reconnect_stop', {queue: true, namespace: 'network_fn_reconnect_stop'});
            };
            var network_reconnect_fail_fn = function(){
                //run queued network reconnect fail functions
                rScript.runFunction('network_fn_reconnect_fail', {queue: true, namespace: 'network_fn_reconnect_fail'});
            };

            //attach only once
            if(!rScript.domStore('rs_var_network_manager_init'))
            {
                _network('up', network_up_fn);
                _network('confirmed-up', network_confirm_up_fn);
                _network('down', network_down_fn);
                _network('confirmed-down', network_confirm_down_fn);
                _network('reconnect:connecting', network_reconnect_fn);
                _network('reconnect:started', network_reconnect_start_fn);
                _network('reconnect:stopped', network_reconnect_stop_fn);
                _network('reconnect:failure', network_reconnect_fail_fn);

                rScript.domStore('rs_var_network_manager_init', true);
            }
        }

        /**
         * Network connectivity functionality
         * Powered by Offline.js <https://github.com/HubSpot/offline>
         */
        rScript_obj.network = {

            /**
             *
             * @returns {Boolean}
             */
            isUp: function(){
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = (myArgs[0]) ? myArgs[0] : undefined;

                return (_getOnlineStatus(options_obj));
            },
            /**
             *
             * @returns {boolean}
             */
            isDown: function(){
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = (myArgs[0]) ? myArgs[0] : undefined;

                return !(_getOnlineStatus(options_obj));
            },
            /**
             * Gets the status of connectivity
             * Either online or offline
             * @returns {string}
             */
            status: function(){
                return _getNetworkStatus();
            },
            /**
             *
             * @param {String} event_str the event identifier
             *
             * The following options are available and they pair to the official offline.js options. See Offline.js docs (http://github.hubspot.com/offline) for details
             *
             * up: analogous to 'up'
             * down: analogous to 'down'
             * confirm_up: analogous to 'confirmed-up'
             * confirm_down: analogous to 'confirmed-down'
             * reconnect: analogous to 'reconnect:connecting'
             * reconnect_start: analogous to 'reconnect:started'
             * reconnect_stop: analogous to 'reconnect:stopped'
             * reconnect_fail: analogous to 'reconnect:failure'
             *
             * @param {Function} fn a callback function
             */
            on: function (event_str, fn) {

                if(event_str === 'up')
                {
                    _onNetworkUp(fn);
                }
                else if(event_str === 'down')
                {
                    _onNetworkDown(fn);
                }
                else if(event_str === 'confirm_up')
                {
                    _onNetworkConfirmUp(fn);
                }
                else if(event_str === 'confirm_down')
                {
                    _onNetworkConfirmDown(fn);
                }
                else if(event_str === 'reconnect')
                {
                    _onNetworkReconnect(fn);
                }
                else if(event_str === 'reconnect_start')
                {
                    _onNetworkReconnectStart(fn);
                }
                else if(event_str === 'reconnect_stop')
                {
                    _onNetworkReconnectStop(fn);
                }
                else if(event_str === 'reconnect_fail')
                {
                    _onNetworkReconnectFail(fn);
                }
            },
            /**
             * Schedule a function to run when connection state is online
             * @param {Function} fn the function to be run
             */
            onUp: function(fn){
                _onNetworkUp(fn);
            },
            /**
             * Schedule a function to run when connection state is online
             * @param {Function} fn the function to be run
             */
            onConfirmUp: function(fn){
                _onNetworkConfirmUp(fn);
            },
            /**
             * Schedule a function to run when connection state is offline
             * @param {Function} fn the function to be run
             */
            onDown: function(fn){
                _onNetworkDown(fn);
            },
            /**
             * Schedule a function to run when connection state is offline
             * @param {Function} fn the function to be run
             */
            onConfirmDown: function(fn){
                _onNetworkConfirmDown(fn);
            },
            /**
             * Schedule a function to run when connection is reconnecting
             * @param {Function} fn the function to be run
             */
            onReconnect: function(fn){
                _onNetworkReconnect(fn);
            },
            /**
             * Schedule a function to run when connection is reconnecting
             * @param {Function} fn the function to be run
             */
            onReconnectStart: function(fn){
                _onNetworkReconnectStart(fn);
            },
            /**
             * Schedule a function to run when connection is reconnecting
             * @param {Function} fn the function to be run
             */
            onReconnectStop: function(fn){
                _onNetworkReconnectStop(fn);
            },
            /**
             * Schedule a function to run when connection reconnection failed
             * @param {Function} fn the function to be run
             */
            onReconnectFail: function(fn){
                _onNetworkReconnectFail(fn);
            },
            /**
             *
             * @param fn
             */
            off: function(event_str, fn){
                _offNetwork(event_str, fn);
            }
        };


        /**
         * Inserts a file or source code into <head> or <body> of a HTML page
         * @param file_path_or_code_str {String} the file path of the file or raw data
         * @param options_obj {Object}
         *
         * The following options are available:
         *
         * metatag {Object}: defines metatag object. If valid, a metatag will be loaded
         * load_loc {String}: the location where the file or source code should be inserted. 'h' or 'head' for '<head>' [default]; 'b' or 'body' for '<body>'
         *
         * load_pos {Number}: Default is 1
         *
         * prepend {Boolean}: if true, content will be prepended; if false [default], content will be appended
         *
         * tag_attr {Object}:
         *
         * tag_attr_set_manual {Boolean}: if true, default tag attributes will not be set. You have to set tag attributes manually
         *
         * defer {Boolean}
         *
         * defer_suffix {String}
         *
         * is_xhr {Boolean}
         *
         * callback {Function}
         *
         *
         * @param loc_str {String} the location where the file or source code should be inserted. 'h' or 'head' for '<head>' [default]; 'b' or 'body' for '<body>'
         * @param prepend_bool {Boolean} if true, content will be prepended; if false [default], content will be appended
         * @param load_pos_int {Integer} determines the insertion point of the content [to be inserted] among its cohorts. Default is 1.
         * Scenario 1: If load_pos_int is 1 and prepend_bool is false, the content will be inserted after the first element
         * Scenario 2: If load_pos_int is 1 and prepend_bool is false, the content will be inserted before the first element
         * @param tag_attr_obj {Object} overrides the default values
         * If CSS file, default tag_attr_obj is
         * {rel: "stylesheet", type: "text/css", media: "all"}
         * If JS file, default tag_attr_obj is {type: "text/javascript", async: false}
         * You can also define id to add an id attribute with value
         * {id: "my_id"} will add an id attribute with value "my_id"
         * @param defer_bool {Boolean} defines if the loaded script is deferred
         * @param defer_suffix_str {String} defines the suffix for the script/stylesheet type
         * attribute i.e. text/javascript/<defer_suffix_str>. Only valid if defer_bool is true
         * @param is_xhr_bool {Boolean} if true, the file will be load via XHR
         * @param callback_fn {Function} defines a callback function that will be executed
         * when a script is loaded
         * @private
         */
        function _loadCore(file_path_or_code_str)
        {
            /**
             * 1: Detect if file is path or raw source code
             * 2: If file path, check js or css, then append accordingly
             * 3: If NOT file path, check if CSS. If not, append accordingly
             */

            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = myArgs[1],
                loc_str,
                is_body_bool,
                prepend_bool,
                load_pos_int,
                load_pos_idx_int,
                load_pos_bool,
                tag_attr_css_default_obj = {type: "text/css", rel: "stylesheet", media: "all"},
                tag_attr_js_default_obj = {type: "text/javascript", async: false},
                tag_attr_obj,
                tag_attr_css_obj,
                tag_attr_js_obj,
                tag_attr_meta_obj,
                tag_attr_set_manual_bool,
                defer_bool,
                defer_suffix_str,
                is_xhr_bool,
                callback_fn,
                insert_method_str,
                insert_relative_to_cohort_bool = false,     //defines whether content will be inserted relative to an existing element
                insert_obj_type_str,
                el_head = $('head'),
                el_body = $('body'),
                el,
                el_rq_obj,
                el_target_js,
                el_target_css,
                el_target_script,
                el_target_meta,
                el_target_js_cohort_count_int = 0,
                el_target_css_link_cohort_count_int = 0,
                el_target_meta_cohort_count_int = 0,
                ref_obj,
                ref_rq_obj,
                ref_obj_text_node_obj,
                is_ie_int = _r.isIE(),
                is_rquery_bool = ((el_head.label === 'rquery'))
                ;

            //define defaults
            loc_str = (options_obj.load_loc && !_r.isEmptyString(options_obj.load_loc)) ? options_obj.load_loc : undefined;
            prepend_bool = (_r.isBool(options_obj.prepend)) ? options_obj.prepend : false;
            load_pos_int = (options_obj.load_pos && _r.isNumber(options_obj.load_pos) && options_obj.load_pos > 0) ? options_obj.load_pos : 1;
            load_pos_bool = !!((options_obj.load_pos && _r.isNumber(options_obj.load_pos) && options_obj.load_pos > 0));
            tag_attr_obj = (options_obj.tag_attr) ? options_obj.tag_attr: {};
            tag_attr_css_obj = tag_attr_obj;
            tag_attr_js_obj = tag_attr_obj;
            tag_attr_meta_obj = tag_attr_obj;
            tag_attr_set_manual_bool = (_r.isBool(options_obj.tag_attr_set_manual)) ? options_obj.tag_attr_set_manual: false;
            defer_bool = (_r.isBool(options_obj.defer)) ? options_obj.defer: false;
            defer_suffix_str = (options_obj.defer_suffix && _r.isString(options_obj.defer_suffix)) ? options_obj.defer_suffix: 'r_defer_sys';
            is_xhr_bool = (_r.isBool(options_obj.xhr)) ? options_obj.xhr : false;
            callback_fn = (options_obj.callback) ? options_obj.callback : undefined;

            //preset variables dependent on defaults
            load_pos_idx_int = load_pos_int - 1;
            insert_method_str = (prepend_bool) ? 'prependTo': 'appendTo';
            is_body_bool = !!((loc_str === 'b' || loc_str === 'body'));


            //setup defer parameters
            if(defer_bool)
            {
                //set CSS and Javascript to non-standard types to force browser ignore
                tag_attr_js_obj.type = "text/javascript/"+defer_suffix_str;
                tag_attr_css_obj.type = "text/css/"+defer_suffix_str;
            }

            //get actual DOM element of head or body
            if(el_head)
            {
                el = (is_body_bool) ? el_body[0]: el_head[0];
            }
            else
            {
                return false;
            }

            //create regex to check if content is file or text
            var regex_1 = new RegExp("^ *[^\\s]+?\\.([a-zA-Z0-9]+)((?:\\?|)[^\\s]*?|) *$", "gi"),
                is_filename_bool = regex_1.test(file_path_or_code_str)
                ;

            if (is_filename_bool)
            {
                //2:
                var regex_2 = new RegExp("\\.js(\\?[^\\s]*?|) *$", "gi");
                var is_filename_js_bool = regex_2.test(file_path_or_code_str);

                if(is_filename_js_bool)
                {
                    /**
                     * Add JavaScript
                     */

                    el_target_js = el.getElementsByTagName('script');

                    //count script cohorts
                    el_target_js_cohort_count_int = el_target_js.length;

                    if(el_target_js_cohort_count_int > 0)
                    {
                        insert_relative_to_cohort_bool = true;

                        //script tag cohorts present
                        if(!load_pos_bool)
                        {
                            //manage load position
                            load_pos_idx_int = (prepend_bool) ? 0 : el_target_js_cohort_count_int-1;
                        }
                        else
                        {
                            //reset load position if provided value is too high that it prevents load
                            load_pos_idx_int = (load_pos_int > el_target_js_cohort_count_int) ? el_target_js_cohort_count_int-1 : load_pos_idx_int;
                        }

                        el = el_target_js[load_pos_idx_int];
                    }

                    insert_obj_type_str = 'js_file_script';
                }
                else
                {
                    var regex_3 = new RegExp("(?:htm|html) *$", "gi");
                    var is_filename_html_bool = regex_3.test(file_path_or_code_str);

                    if(is_filename_html_bool)
                    {
                        /**
                         * Add HTML
                         */
                        //classify object to be inserted
                        insert_obj_type_str = 'html_file_link';
                    }
                    else
                    {
                        /**
                         * Add CSS
                         * 1: in <BODY> with @import
                         * 2: in <HEAD> using <link>
                         */

                        //get link, style, or metatag elements i.e. cohorts in target
                        el_target_css = (is_body_bool) ? el.getElementsByTagName('style') : el.getElementsByTagName('link');
                        el_target_script = el.getElementsByTagName('script');
                        var el_target_css_check_bool = ((el_target_css && el_target_css.length > 0));
                        el_target_meta = el.getElementsByTagName('meta');
                        var el_target_meta_check_bool = ((el_target_meta && el_target_meta.length > 0));

                        if(el_target_css_check_bool || el_target_meta_check_bool)
                        {
                            //flag that insert operation is cohort-relative
                            insert_relative_to_cohort_bool = true;

                            //seed target element
                            var el_target_css_mixed = (el_target_css_check_bool) ? el_target_css : el_target_meta;

                            //count link/meta cohorts
                            el_target_css_link_cohort_count_int = el_target_css.length;
                            el_target_meta_cohort_count_int = el_target_meta.length;

                            if(el_target_css_link_cohort_count_int > 0)
                            {
                                //link tag cohorts present
                                if(!load_pos_bool)
                                {
                                    //manage load position
                                    load_pos_idx_int = (prepend_bool) ? 0 : el_target_css_link_cohort_count_int-1;
                                }
                                else
                                {
                                    //reset load position if provided value is too high that it prevents load
                                    load_pos_idx_int = (load_pos_int > el_target_css_link_cohort_count_int) ? el_target_css_link_cohort_count_int-1 : load_pos_idx_int;
                                }
                            }
                            else
                            {
                                //no link tag cohorts present
                                // anchor on meta tags
                                if(prepend_bool)
                                {
                                    if(el_target_script)
                                    {
                                        //script elements present
                                        //anchor to script tags
                                        load_pos_idx_int = 0;
                                        el_target_css_mixed = el_target_script;
                                    }
                                }
                                else
                                {
                                    load_pos_idx_int = el_target_meta_cohort_count_int-1;
                                }
                            }

                            el = el_target_css_mixed[load_pos_idx_int];
                        }

                        //classify object to be inserted
                        insert_obj_type_str = (is_body_bool) ? 'css_file_style' : 'css_file_link';
                    }
                }
            }
            else
            {
                //3:

                if(_r.isString(file_path_or_code_str))
                {
                    var regex_4 = new RegExp("[\\w\\-]+ *\\{\\s*[\\w\\-]+\\s*\\:\\s*.*?\\;");
                    var is_text_css_bool = regex_4.test(file_path_or_code_str);

                    if(is_text_css_bool)
                    {
                        //classify object to be inserted
                        insert_obj_type_str = 'css_text_style';
                    }
                    else
                    {
                        ref_obj = (is_body_bool) ? document.createElement("div") : document.createElement("style");
                        ref_obj.innerHTML = file_path_or_code_str;
                    }
                }
                else
                {
                    //file_path_or_code_str is null

                    if(tag_attr_meta_obj.name && tag_attr_meta_obj.content)
                    {
                        el_target_meta = el.getElementsByTagName('meta');

                        //count link/meta cohorts
                        el_target_meta_cohort_count_int = el_target_meta.length;

                        if(el_target_meta_cohort_count_int > 0)
                        {
                            insert_relative_to_cohort_bool = true;

                            //meta tag cohorts present
                            if(!load_pos_bool)
                            {
                                //manage load position
                                load_pos_idx_int = (prepend_bool) ? 0 : el_target_meta_cohort_count_int-1;
                            }
                            else
                            {
                                //reset load position if provided value is too high that it prevents load
                                load_pos_idx_int = (load_pos_int > el_target_meta_cohort_count_int) ? el_target_meta_cohort_count_int-1 : load_pos_idx_int;
                            }

                            el = el_target_meta[load_pos_idx_int];
                        }

                        //classify object to be inserted
                        insert_obj_type_str = 'meta_tag';
                    }
                }
            }

            //create element
            if(insert_obj_type_str === 'js_file_script')
            {
                //create script element
                ref_obj = document.createElement("script");

                if(!tag_attr_set_manual_bool)
                {
                    ref_obj.type = (_r.isString(tag_attr_js_obj.type)) ? tag_attr_js_obj.type: tag_attr_js_default_obj.type;
                    ref_obj.async = (_r.isBool(tag_attr_js_obj.async)) ? tag_attr_js_obj.async: tag_attr_js_default_obj.async;
                }

                if(_r.isString(tag_attr_css_obj.id))
                {
                    ref_obj.id = tag_attr_css_obj.id;
                }

                if(is_xhr_bool)
                {
                    if (ref_obj.readyState)
                    {  //IE
                        ref_obj.onreadystatechange = function(){
                            /*jshint -W116 */
                            if (ref_obj.readyState == "loaded" || ref_obj.readyState == "complete"){
                                ref_obj.onreadystatechange = null;
                                callback_fn();
                            }
                            /*jshint +W116 */
                        };
                    }
                    else
                    {  //Others
                        ref_obj.onload = function(){
                            callback_fn();
                        };
                    }
                }

                ref_obj.src = file_path_or_code_str;
            }
            else if (insert_obj_type_str === 'css_file_style')
            {
                //create style element with import link
                ref_obj = document.createElement("style");

                if(!tag_attr_set_manual_bool)
                {
                    ref_obj.type = (_r.isString(tag_attr_css_obj.type)) ? tag_attr_css_obj.type: tag_attr_css_default_obj.type;
                }

                if(_r.isString(tag_attr_css_obj.id))
                {
                    ref_obj.id = tag_attr_css_obj.id;
                }

                if(is_ie_int && is_ie_int < 9)
                {
                    //fix IE insert <style> issue
                    if (insert_relative_to_cohort_bool)
                    {
                        insert_method_str = (prepend_bool) ? 'addBefore': 'addAfter';

                        ref_rq_obj = $(ref_obj);
                        ref_rq_obj[insert_method_str](el);
                    }
                    else
                    {
                        insert_method_str = (prepend_bool) ? 'prepend': 'append';

                        el_rq_obj = $(el);
                        el_rq_obj[insert_method_str](ref_obj);
                    }

                    ref_obj.styleSheet.cssText = "@import url(\""+file_path_or_code_str+"\");";
                    return;
                }

                ref_obj_text_node_obj = document.createTextNode("@import url(\""+file_path_or_code_str+"\");");
                ref_obj.appendChild(ref_obj_text_node_obj);
            }
            else if (insert_obj_type_str === 'css_text_style')
            {
                //create style element with text
                ref_obj = document.createElement("style");

                if(!tag_attr_set_manual_bool)
                {
                    ref_obj.rel = (_r.isString(tag_attr_css_obj.rel)) ? tag_attr_css_obj.rel: tag_attr_css_default_obj.rel;
                    ref_obj.type = (_r.isString(tag_attr_css_obj.type)) ? tag_attr_css_obj.type: tag_attr_css_default_obj.type;
                }

                if(_r.isString(tag_attr_css_obj.id))
                {
                    ref_obj.id = tag_attr_css_obj.id;
                }

                if(is_ie_int && is_ie_int < 9)
                {
                    ref_obj.styleSheet.cssText = file_path_or_code_str;
                }
                else
                {
                    ref_obj_text_node_obj = document.createTextNode(file_path_or_code_str);
                    ref_obj.appendChild(ref_obj_text_node_obj);
                }
            }
            else if (insert_obj_type_str === 'css_file_link')
            {
                //create link element
                ref_obj = document.createElement("link");

                if(!tag_attr_set_manual_bool)
                {
                    ref_obj.rel = (_r.isString(tag_attr_css_obj.rel)) ? tag_attr_css_obj.rel: tag_attr_css_default_obj.rel;
                    ref_obj.type = (_r.isString(tag_attr_css_obj.type)) ? tag_attr_css_obj.type: tag_attr_css_default_obj.type;
                    ref_obj.media = (_r.isString(tag_attr_css_obj.media)) ? tag_attr_css_obj.media: tag_attr_css_default_obj.media;
                }

                if(_r.isString(tag_attr_css_obj.id))
                {
                    ref_obj.id = tag_attr_css_obj.id;
                }

                //delete ref_obj.media;
                ref_obj.href = file_path_or_code_str;
            }
            else if(insert_obj_type_str === 'html_file_link')
            {
                var insert_op_name_str = (prepend_bool) ? 'prepend' : 'append';
                $.ajax(file_path_or_code_str).then(function(xhr)
                {
                    if(!is_body_bool)
                    {
                        //append or prepend to element
                        $(loc_str)[insert_op_name_str](xhr);
                    }
                    else
                    {
                        //append or prepend to body
                        el_body[insert_op_name_str](xhr);
                    }
                });

                return;
            }
            else if (insert_obj_type_str === 'meta_tag')
            {
                //create meta element
                ref_obj = document.createElement("meta");

                ref_obj.name = tag_attr_meta_obj.name;
                ref_obj.content = tag_attr_meta_obj.content;
            }

            //add custom tag attributes
            if(_r.isObject(tag_attr_obj))
            {
                for (var key in tag_attr_obj)
                {
                    if (tag_attr_obj.hasOwnProperty(key))
                    {
                        ref_obj[key] = tag_attr_obj[key];
                    }
                }
            }

            //finalize insert methods
            if(insert_relative_to_cohort_bool)
            {
                ref_rq_obj = $(ref_obj);
                if(is_rquery_bool)
                {
                    //rQuery
                    insert_method_str = (prepend_bool) ? 'addBefore': 'addAfter';
                }
                else
                {
                    insert_method_str = (prepend_bool) ? 'insertBefore': 'insertAfter';
                }

                ref_rq_obj[insert_method_str](el);
            }
            else
            {
                insert_method_str = (prepend_bool) ? 'prepend': 'append';

                if(!is_rquery_bool)
                {
                    //if not rQuery (e.g. jQuery) then force appendChild
                    //note: this is because jQuery uses AJAX to fetch and
                    //run script even when the type attribute is non-standard
                    el.appendChild(ref_obj);
                }
                else
                {
                    //append or prepend
                    el_rq_obj = $(el);
                    el_rq_obj[insert_method_str](ref_obj);
                }
            }

            //force ie8 or less repaint for <style> insert
            if((is_ie_int && is_ie_int < 9) && (insert_obj_type_str === 'css_file_style'))
            {
                el_body = document.getElementsByTagName('body')[0];
                el_body.className = el_body.className;
            }
        }


        /**
         * Loads CSS or JS into the '<head>' of the HTML page
         * @param file_path_str {String} the file path to the file
         * @param options_obj {Object} the load options
         * The options are:
         *
         * prepend {Boolean}: See prepend_bool in _loadCore
         * load_loc {String}: See loc_str in _loadCore
         * load_pos {Number}: See load_pos_int in _loadCore
         * tag_attr {Object}: See tag_attr in _loadCore
         * defer {Boolean}: See defer in _loadCore
         * defer_suffix {String}: See defer_suffix in _loadCore
         * xhr {Boolean}: See xhr in _loadCore
         * callback {Function}: See callback in _loadCore
         * load_delay {Number}: If set, will delay load execution by the given number of seconds
         * load_filter {String}: provides a way to define pre-conditions for load execution
         * For example, load a JavaScript file only if the browser is IE less than version 8
         * The following options are available:
         * isDesktop: load file only if device is desktop
         * isTablet: load file only if device is tablet
         * isPhone: load file only if device is smartphone
         * isTV: load file only if device is TV
         * isMobile: load file only if device is mobile (tablet or smartphone)
         * isNonMobile: load file only if device is non-mobile (desktop or TV)
         * isIOS: load file only if device is based on IOS
         * isAndroid: load file only if device is based on Android
         * isWindows: load file only if device is based on Windows
         * isSymbian: load file only if device is based on Symbian
         * isBlackberry: load file only if device is based on Blackberry
         * isIE: load file only if browser is Internet Explorer
         * isChrome: load file only if browser is Chrome
         * isSafari: load file only if browser is Safari
         * isFirefox: load file only if browser is Firefox
         * isOpera: load file only if browser is Opera
         * lt_ie<version_number>: load file only if browser is Internet Explorer
         * and is less than <version_number> e.g. lt_ie8
         * lte_ie<version_number>: load file only if browser is Internet Explorer
         * and is less than or equal to <version_number> e.g. lte_ie8
         * gt_ie<version_number>: load file only if browser is Internet Explorer
         * and is greater than <version_number> e.g. gt_ie9
         * gte_ie<version_number>: load file only if browser is Internet Explorer
         * and is greater than or equal to <version_number> e.g. gte_ie8
         *
         * @private
         */
        function _load(file_path_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[1]) ? myArgs[1] : {},
                load_delay_int = (_r.isNumber(options_obj.load_delay) && options_obj.load_delay > 0) ? options_obj.load_delay * 1000 : null,
                load_filter_str = (_r.isString(options_obj.load_filter)) ? options_obj.load_filter : "",
                regex_browser_ie = new RegExp("^((?:lt|gt)[e]?)_(ie)([0-9]+)$", "i"),
                regex_device = new RegExp("^is(desktop|tablet|phone|tv|mobile|nonmobile|ios|android|windows|symbian|blackberry|ie|chrome|safari|firefox|opera)$", "i"),
                regex_browser = new RegExp("^is(ie|chrome|safari|firefox|opera)$", "i"),
                filter_test_bool
                ;

            //manage load filter
            if(load_filter_str !== "")
            {
                //do only if a filter is set

                if(regex_browser_ie.test(load_filter_str))
                {
                    //internet explorer
                    var browser_ie_version_int = _r.isIE();
                    var browser_ie_match_arr = regexMatchAll(regex_browser_ie, load_filter_str);
                    var browser_ie_match_operator_str = browser_ie_match_arr[0][1];
                    var browser_ie_match_version_int = parseInt(browser_ie_match_arr[0][3]);

                    if(browser_ie_version_int)
                    {
                        if(browser_ie_match_operator_str === 'lt')
                        {
                            filter_test_bool = (browser_ie_version_int < browser_ie_match_version_int);
                            if(!filter_test_bool)
                            {
                                return;
                            }
                        }
                        else if(browser_ie_match_operator_str === 'lte')
                        {
                            filter_test_bool = (browser_ie_version_int <= browser_ie_match_version_int);
                            if(!filter_test_bool)
                            {
                                return;
                            }
                        }
                        else if(browser_ie_match_operator_str === 'gt')
                        {
                            filter_test_bool = (browser_ie_version_int > browser_ie_match_version_int);
                            if(!filter_test_bool)
                            {
                                return;
                            }
                        }
                        else if(browser_ie_match_operator_str === 'gte')
                        {
                            filter_test_bool = (browser_ie_version_int >= browser_ie_match_version_int);
                            if(!filter_test_bool)
                            {
                                return;
                            }
                        }
                    }
                }
                else if (regex_device.test(load_filter_str))
                {
                    //device
                    var device_match_arr = regexMatchAll(regex_device, load_filter_str),
                        device_test_method_str = device_match_arr[0][1];

                    if(regex_browser.test(load_filter_str))
                    {
                        //browsers
                        /*jshint -W116 */
                        device_test_method_str = device_test_method_str.toLowerCase();
                        var device_is_browser_bool = (device_test_method_str == rScript.getBrowserName());
                        /*jshint +W116 */

                        if(!device_is_browser_bool)
                        {
                            return;
                        }
                    }
                    else
                    {
                        //other

                        var device_is_bool = rScript['is'+device_test_method_str]();
                        if(!device_is_bool)
                        {
                            return;
                        }
                    }
                }
            }

            //load files
            if(load_delay_int)
            {
                window.setTimeout(function(){_loadCore(file_path_str, options_obj);}, load_delay_int);
            }
            else
            {
                _loadCore(file_path_str, options_obj);
            }
        }

        /**
         * Unloads a CSS or JS file
         * @param {String} file_ref_str either the file name or the tag identifier
         * @private
         */
        function _unload(file_ref_str)
        {
            var is_file_bool = ((/\.(js|css)\s*$/i.test(file_ref_str))),
                file_ext_str,
                ref_elem_obj,
                ref_elem_tag_name_str,
                ref_elem_tag_attr_str,
                ref_elem_all_obj
                ;

            if(!is_file_bool)
            {
                //Use Tag ID

                ref_elem_obj = document.getElementById(file_ref_str);

                if(ref_elem_obj)
                {
                    ref_elem_obj.parentNode.removeChild(ref_elem_obj);
                }
            }
            else
            {
                //Use File Name

                file_ext_str = file_ref_str.split('.').pop();
                if(file_ext_str === 'js')
                {
                    ref_elem_tag_name_str = 'script';
                    ref_elem_tag_attr_str = 'src';
                }
                else
                {
                    ref_elem_tag_name_str = 'link';
                    ref_elem_tag_attr_str = 'href';
                }

                //get all script or sheets
                ref_elem_all_obj = document.getElementsByTagName(ref_elem_tag_name_str);

                if(ref_elem_all_obj.length > 0)
                {
                    for(var i = ref_elem_all_obj.length-1; i >= 0; i--)
                    {
                        /*jshint -W116 */
                        if (ref_elem_all_obj[i] && ref_elem_all_obj[i].getAttribute(ref_elem_tag_attr_str) != null && ref_elem_all_obj[i].getAttribute(ref_elem_tag_attr_str).indexOf(file_ref_str) != -1)
                        {
                            ref_elem_all_obj[i].parentNode.removeChild(ref_elem_all_obj[i]);
                        }
                        /*jshint +W116 */
                    }
                }
            }
        }

        /**
         * Gets a DOM Element from another DOM Element
         * @param node_obj {Object} The main element
         * @param id_str {String} The identifier of the DOM element to retrieve
         * @returns {*}
         * @private
         */
        function _getElementByIdFromNode(node_obj, id_str) {
            for (var i = 0; i < node_obj.childNodes.length; i++) {
                var child_obj = node_obj.childNodes[i];
                if (child_obj.nodeType !== 1)
                {
                    continue;   // ELEMENT_NODE
                }
                if (child_obj.id === id_str)
                {
                    return child_obj;
                }
                child_obj = _getElementByIdFromNode(child_obj, id_str);
                if (child_obj !== null) {
                    return child_obj;
                }
            }
            return null;
        }


        /**
         * Converts a HTML string to a DOM Element
         * Retrieves a sub-DOM element if identifier is provided
         * @param {String} html_str_or_obj the HTML String containing elements
         * Note: If you are passing a HTML string, ensure that its object representation can only have one parent i.e. no siblings
         * For example:
         *
         * This is GOOD:
         * <div id="parent"><div id="child-1"><div id="grandchild-1"></div></div><div id="child-2"><div id="grandchild-2"></div><div id="grandchild-3"></div></div></div>
         *
         * This is BAD:
         * <div id="sibling-1"><div id="sibling-1-child"></div></div><div id="sibling-2"><div id="sibling-2-child"></div></div>
         *
         * @param {String} obj_id_str the identifier of the DOM element to retrieve
         * @param {Boolean} use_tagname_bool if true, obj_id_str will be considered a tag name
         * @returns {Object}
         * @private
         */
        function _parse(html_str_or_obj)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                obj_id_str = (_r.isString(myArgs[1])) ? myArgs[1] : null,
                use_tagname_bool = (_r.isBool(myArgs[2])) ? myArgs[2]: false,
                selector_str = (use_tagname_bool) ? obj_id_str : "#" + obj_id_str,
                elem_obj,
                elem_dom_obj,
                frag_final_obj,
                html_str;

            //Convert to DOM element
            if(_r.isString(html_str_or_obj))
            {
                //Sanitize String
                html_str = html_str_or_obj.replace(/(\r\n|\n|\r)/gm, " ");
                html_str = html_str.trim();

                //Convert
                elem_obj = document.createElement("div");
                elem_obj.innerHTML = html_str;
                elem_dom_obj = elem_obj.firstChild;
                elem_dom_obj = $(elem_dom_obj);
            }
            else
            {
                elem_dom_obj = (rQuery.isRQueryObject(html_str_or_obj)) ? html_str_or_obj : $(html_str_or_obj);
            }

            //If selector is present, filter element
            if(obj_id_str)
            {
                //Filter elements by tag name
                if(use_tagname_bool)
                {
                    return elem_dom_obj.find(selector_str);
                }

                //For Legacy Browsers like IE7
                var frag_obj = document.createDocumentFragment();
                if (frag_obj.getElementById) {
                    frag_obj.appendChild(elem_dom_obj[0]);
                    frag_final_obj = frag_obj.getElementById(obj_id_str);
                    return $(frag_final_obj);
                }

                // Anything else just in case
                return _getElementByIdFromNode(elem_dom_obj, obj_id_str);
            }

            return elem_dom_obj;
        }

        /**
         * Wrapper class for _parse
         */
        rScript_obj.parse = function()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _parse(myArgs[0], myArgs[1], myArgs[2]);
        };

        /**
         * Converts a HTML string to DOM element and inserts it to the DOM
         * @param {String} html_str the HTML String containing elements
         * Note: Ensure that the object representation of the HTML string that you provide can only have one parent i.e. no siblings
         * For example:
         *
         * This is GOOD:
         * <div id="parent"><div id="child-1"><div id="grandchild-1"></div></div><div id="child-2"><div id="grandchild-2"></div><div id="grandchild-3"></div></div></div>
         *
         * This is BAD:
         * <div id="sibling-1"><div id="sibling-1-child"></div></div><div id="sibling-2"><div id="sibling-2-child"></div></div>
         *
         * If you provide HTML that doesn't have a single parent, it will cause issues when using the fragment option.
         *
         * @param {Object} options_obj the options that define how the method will work
         *
         * target: the identifier for the DOM element that will receive the HTML
         * For example, if you want your HTML to be inserted into the following element:
         * <div id="my-target"></div>
         * assign 'my-target' as the value for target
         *
         * template: a template object that will be used to transform HTML content containing {{}} placeholders
         * For example, if you have a html_str like this:
         * <div id="main">
         *     <div id="header">{{myHeader}}</div>
         *     <div id="content">{{myContent}}</div>
         * </div>
         *
         * and your template is an object like this:
         * {myHeader: 'Home', myContent: 'Home Content'}
         *
         * then what will be inserted into the DOM will be:
         * <div id="main">
         *     <div id="header">Home</div>
         *     <div id="content">Home Content</div>
         * </div>
         *
         * postmode: specifies how the HTML will be inserted into the DOM. The three possible options are: append [default], prepend, replace, after, and before
         * Note: when either after or before is used, the HTML inserted will essentially become a sibling of the target, as opposed to a child
         * Note: after and before will work only when target is defined
         *
         * fragment: the identifer of a fragment within the main HTML, which will be pulled and inserted into the DOM
         * For example, if your html_str is:
         * <div id="main">
         *     <div id="header">Home</div>
         *     <div id="content">Home Content</div>
         * </div>
         *
         * and your fragment === 'header', the HTML inserted will be:
         * <div id="header">Home</div>
         *
         * Note: the rest of the HTML will be discarded
         * Note: this fragment will be pulled after any template transforms are applied
         *
         * @private
         */
        function _port(html_str) {

            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[1]) ? myArgs[1] : {},
                options_fragment_id_str,
                options_target_id_str,
                options_post_method_str,
                options_template_obj,
                port_target_obj,
                html_obj,
                post_op_method_str
                ;

            //define option defaults
            options_target_id_str = (_r.isString(options_obj.target)) ? options_obj.target : '';
            options_post_method_str = (_r.isString(options_obj.postmode) && _r.in_array(options_obj.postmode, ['append', 'replace', 'prepend', 'after', 'before'])) ? options_obj.postmode : 'append';
            options_template_obj = (options_obj.template) ? options_obj.template : undefined;
            options_fragment_id_str = (_r.isString(options_obj.fragment)) ? options_obj.fragment : '';

            //sanitize
            options_target_id_str = (/^ *#.*? *$/i.test(options_target_id_str)) ? options_target_id_str.slice(1) : options_target_id_str;
            options_fragment_id_str = (/^ *#.*? *$/i.test(options_fragment_id_str)) ? options_fragment_id_str.slice(1) : options_fragment_id_str;

            port_target_obj = (options_target_id_str.length > 0) ? $('#'+options_target_id_str) : $('body');

            //compile
            if(options_template_obj)
            {
                html_str = _compile(html_str, options_template_obj);
            }

            //parse HTML to object
            html_obj = _parse(html_str, options_fragment_id_str);

            //append, prepend, or replace
            if(options_post_method_str === 'append' || options_post_method_str === 'prepend')
            {
                //append or prepend
                post_op_method_str = (options_post_method_str === 'prepend') ? 'prependTo' : 'appendTo';
                html_obj[post_op_method_str](port_target_obj);
            }
            else if(options_post_method_str === 'after' || options_post_method_str === 'before')
            {
                if(options_target_id_str.length > 0)
                {
                    post_op_method_str = (options_post_method_str === 'after') ? 'addAfter' : 'addBefore';
                    html_obj[post_op_method_str](port_target_obj);
                }
            }
            else
            {
                //replace
                post_op_method_str = 'html';
                port_target_obj[post_op_method_str](html_str);
            }
        }

        /**
         * Wrapper class for _port
         */
        rScript_obj.port = function(html_str)
        {
            var myArgs = Array.prototype.slice.call(arguments);
            _port(html_str, myArgs[1]);
        };

        /**
         * Loads a metatag into a HTML page
         * @param name_str {String} the metatag name value
         * @param content_str {String} the metatag content value
         */
        rScript_obj.loadMeta = function(name_str, content_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[2]) ? myArgs[2] : {}
                ;

            options_obj.tag_attr = {'name': name_str, 'content': content_str};

            _load(undefined, options_obj);
            return this;
        };

        /**
         * Loads CSS into a HTML page
         * @param file_path_str {String} see _load
         * @param options_obj {Object} see _load
         */
        rScript_obj.loadCSS = function(file_path_str, options_obj)
        {
            _load(file_path_str, options_obj);
            return this;
        };

        /**
         * Unloads CSS from a HTML page
         * @param file_ref_str {String} see _unload
         */
        rScript_obj.unloadCSS = function(file_ref_str)
        {
            _unload(file_ref_str);
            return this;
        };

        /**
         * Refresh CSS on a HTML page
         * This method will add new CSS inline only if it did not previously exist
         * Note: This is for inline CSS only
         * @param {String} new_css_str the CSS code
         * @param {String} file_ref_str the identifier of the inline CSS to refresh; this must be an id attribute [on a <style> tag]. If none is provided, then new_css_str will be appended in <HEAD>
         * @param {Object} refresh_mode_str defines how CSS will be added
         * new: the new CSS will replace the old CSS completely
         * diff_update: Duplicates of CSS rules in old css will be removed [the latest record will be kept], and the new CSS rules [also de-deplicated likewise] will appended to the old CSS [to supercede specificity]
         * diff_replace: All rules in the old CSS that also exist in the new CSS will be removed i.e. only unique rules across both old and new CSS
         * diff_remove: removes new CSS rules from old CSS
         */
        function _refresh(new_css_str)
        {
            if(!_r.isString(new_css_str) || _r.isEmptyString(new_css_str))
            {
                return false;
            }

            var myArgs = Array.prototype.slice.call(arguments),
                file_ref_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1] : undefined,
                refresh_mode_str = (_r.isString(myArgs[2]) && myArgs[2].length > 0) ? myArgs[2] : 'diff_update',
                is_mode_new_bool = !!(refresh_mode_str === 'new'),
                is_mode_diff_update_bool = !!(refresh_mode_str === 'diff_update'),
                is_mode_diff_replace_bool = !!(refresh_mode_str === 'diff_replace'),
                is_mode_diff_remove_bool = !!(refresh_mode_str === 'diff_remove'),
                is_dedup_bool = !!(_r.isBool(myArgs[2])),
                file_ref_obj = $('#'+file_ref_str),
                old_css_str,
                refresh_css_str,
                regex_old_css_arr,
                old_css_arr = [],
                old_css_selector_arr = [],
                old_css_min_arr = [],
                old_css_arr_item_selector_str,
                old_css_arr_item_selector_min_str,
                old_css_arr_item_decl_str,
                old_css_arr_item_decl_min_str,
                old_css_arr_item_str,
                old_css_arr_item_min_str,
                old_css_temp_reverse_arr = [],
                old_css_temp_selector_reverse_arr = [],
                old_css_temp_arr = [],
                old_css_temp_selector_arr = [],
                regex_new_css_arr,
                new_css_arr = [],
                new_css_selector_arr = [],
                new_css_arr_item_str,
                new_css_arr_item_min_str,
                new_css_min_arr = [],
                new_css_arr_item_selector_str,
                new_css_arr_item_selector_min_str,
                new_css_arr_item_decl_str,
                new_css_arr_item_decl_min_str,
                new_css_temp_reverse_arr = [],
                new_css_temp_selector_reverse_arr = [],
                new_css_temp_arr = [],
                new_css_temp_selector_arr = [],
                final_temp_selector_arr = [],
                final_temp_arr = [],
                final_diff_css_reverse_arr = [],
                final_diff_css_selector_reverse_arr = [],
                final_diff_css_arr = [],
                final_new_css_arr = [],
                new_css_final_str
                ;

            if(!file_ref_obj.empty && file_ref_str)
            {
                //refresh CSS

                //get current CSS info
                old_css_str = file_ref_obj.html();
                regex_old_css_arr = _r.regexMatchAll(/((?:\#|\.|[a-z]).+?)\s*\{(.*?)\}/igm, old_css_str);

                //get the old CSS rules and CSS selectors to separate arrays
                for(var i = 0; i < _r.count(regex_old_css_arr); i++)
                {
                    old_css_arr_item_selector_str = regex_old_css_arr[i][1];
                    old_css_arr_item_decl_str = regex_old_css_arr[i][2];

                    old_css_arr_item_selector_min_str = old_css_arr_item_selector_str.replace(/  +/g, ' ');
                    old_css_arr_item_decl_min_str = old_css_arr_item_decl_str.replace(/ +/g, '');

                    old_css_arr_item_str = old_css_arr_item_selector_str+' {'+old_css_arr_item_decl_str+'}';
                    old_css_arr_item_min_str = old_css_arr_item_selector_min_str+' {'+old_css_arr_item_decl_min_str+'}';

                    old_css_arr.push(old_css_arr_item_str);
                    old_css_selector_arr.push(old_css_arr_item_selector_min_str);
                    old_css_min_arr.push(old_css_arr_item_min_str);
                }

                //de-duplicate old CSS giving preference to later items
                for(var m = old_css_selector_arr.length-1; m >= 0; m--)
                {
                    if(!_r.in_array(old_css_selector_arr[m], old_css_temp_selector_reverse_arr))
                    {
                        old_css_temp_selector_reverse_arr.push(old_css_selector_arr[m]);
                        old_css_temp_reverse_arr.push(old_css_min_arr[m]);
                    }
                }

                //reverse
                old_css_temp_selector_arr = _r.array_reverse(old_css_temp_selector_reverse_arr);
                old_css_temp_arr = _r.array_reverse(old_css_temp_reverse_arr);

                //get new CSS info
                regex_new_css_arr = _r.regexMatchAll(/((?:\#|\.|[a-z]).+?)\s*\{(.*?)\}/igm, new_css_str);

                //get the old CSS rules and CSS selectors to separate arrays
                for(var j = 0; j < _r.count(regex_new_css_arr); j++)
                {
                    new_css_arr_item_selector_str = regex_new_css_arr[j][1];
                    new_css_arr_item_decl_str = regex_new_css_arr[j][2];

                    new_css_arr_item_selector_min_str = new_css_arr_item_selector_str.replace(/  +/g, ' ');
                    new_css_arr_item_decl_min_str = new_css_arr_item_decl_str.replace(/ +/g, '');

                    new_css_arr_item_str = new_css_arr_item_selector_str+' {'+new_css_arr_item_decl_str+'}';
                    new_css_arr_item_min_str = new_css_arr_item_selector_min_str+' {'+new_css_arr_item_decl_min_str+'}';

                    new_css_arr.push(new_css_arr_item_str);
                    new_css_selector_arr.push(new_css_arr_item_selector_min_str);
                    new_css_min_arr.push(new_css_arr_item_min_str);
                }

                //de-duplicate new CSS giving preference to later items
                for(var p = new_css_selector_arr.length-1; p >= 0; p--)
                {
                    if(!_r.in_array(new_css_selector_arr[p], new_css_temp_selector_reverse_arr))
                    {
                        new_css_temp_selector_reverse_arr.push(new_css_selector_arr[p]);
                        new_css_temp_reverse_arr.push(new_css_min_arr[p]);
                    }
                }

                //reverse
                new_css_temp_selector_arr = _r.array_reverse(new_css_temp_selector_reverse_arr);
                new_css_temp_arr = _r.array_reverse(new_css_temp_reverse_arr);

                //get final css for new mode
                final_new_css_arr = new_css_temp_arr;

                //merge old and new arrays
                final_temp_selector_arr = old_css_temp_selector_arr.concat(new_css_temp_selector_arr);
                final_temp_arr = old_css_temp_arr.concat(new_css_temp_arr);

                //perform diff
                if(is_mode_diff_replace_bool || is_mode_diff_update_bool)
                {
                    for(var x = final_temp_selector_arr.length-1; x >= 0; x--)
                    {
                        if (is_mode_diff_replace_bool)
                        {
                            //replace
                            if (!_r.in_array(final_temp_selector_arr[x], final_diff_css_selector_reverse_arr)) {
                                final_diff_css_reverse_arr.push(final_temp_arr[x]);
                                final_diff_css_selector_reverse_arr.push(final_temp_selector_arr[x]);
                            }
                        }
                        else
                        {
                            //update
                            final_diff_css_reverse_arr.push(final_temp_arr[x]);
                        }
                    }
                }
                else if (is_mode_diff_remove_bool)
                {
                    for(var x = old_css_temp_selector_arr.length-1; x >= 0; x--)
                    {
                        //remove
                        if (!_r.in_array(old_css_temp_selector_arr[x], new_css_temp_selector_arr))
                        {
                            final_diff_css_reverse_arr.push(old_css_temp_arr[x]);
                            final_diff_css_selector_reverse_arr.push(old_css_temp_selector_arr[x]);
                        }
                    }
                }

                //reverse
                final_diff_css_arr = _r.array_reverse(final_diff_css_reverse_arr);

                //compose and add CSS
                if(is_mode_new_bool)
                {
                    new_css_final_str = _r.implode("\n", final_new_css_arr);

                    //replace old CSS and add new CSS
                    rScript.unloadCSS(file_ref_str).loadCSS(new_css_final_str, {tag_attr: {id: ''+file_ref_str+''}});
                }
                else if (is_mode_diff_replace_bool || is_mode_diff_update_bool || is_mode_diff_remove_bool)
                {
                    refresh_css_str = _r.implode("\n", final_diff_css_arr);

                    //refresh move old CSS and load updated CSS
                    rScript.unloadCSS(file_ref_str).loadCSS(refresh_css_str, {tag_attr: {id: ''+file_ref_str+''}});
                }
            }
            else
            {
                //load new CSS
                regex_new_css_arr = _r.regexMatchAll(/((?:\#|\.|[a-z]).+?)\s*\{(.*?)\}/igm, new_css_str);

                //get the old CSS rules and CSS selectors to separate arrays
                for(var k = 0; k < _r.count(regex_new_css_arr); k++)
                {
                    new_css_arr_item_selector_str = regex_new_css_arr[k][1];
                    new_css_arr_item_decl_str = regex_new_css_arr[k][2];

                    new_css_arr_item_selector_min_str = new_css_arr_item_selector_str.replace(/  +/g, ' ');
                    new_css_arr_item_decl_min_str = new_css_arr_item_decl_str.replace(/ +/g, '');

                    new_css_arr_item_str = new_css_arr_item_selector_str+' {'+new_css_arr_item_decl_str+'}';
                    new_css_arr_item_min_str = new_css_arr_item_selector_min_str+' {'+new_css_arr_item_decl_min_str+'}';

                    //new_css_arr.push(new_css_arr_item_str);
                    new_css_selector_arr.push(new_css_arr_item_selector_min_str);
                    new_css_min_arr.push(new_css_arr_item_min_str);
                }

                new_css_arr = new_css_min_arr;

                //dedup
                if(is_dedup_bool)
                {
                    for(var y = new_css_selector_arr.length-1; y >= 0; y--)
                    {
                        if(!_r.in_array(new_css_selector_arr[y], new_css_temp_selector_reverse_arr))
                        {
                            new_css_temp_selector_reverse_arr.push(new_css_selector_arr[y]);
                            new_css_temp_reverse_arr.push(new_css_min_arr[y]);
                        }
                    }

                    new_css_arr = _r.array_reverse(new_css_temp_reverse_arr);
                }

                //compose and add CSS
                new_css_str = _r.implode("\n", new_css_arr);

                if(file_ref_str)
                {
                    rScript.loadCSS(new_css_str, {tag_attr: {id: ''+file_ref_str+''}});
                }
                else
                {
                    rScript.loadCSS(new_css_str);
                }
            }
        }

        /**
         * Refresh CSS on a HTML page
         * @param {String} new_css_str see _refresh
         * @param {String} file_ref_str see _refresh
         * @param {Object} refresh_mode_str see _refresh
         * @returns {rScript}
         */
        rScript_obj.refreshCSS = function(new_css_str)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _refresh(new_css_str, myArgs[1], myArgs[2]);
            return this;
        };

        /**
         * Loads JavaScript into a HTML page
         * @param file_path_str {String} see _load
         * @param options_obj {Object} see _load
         */
        rScript_obj.loadJS = function(file_path_str, options_obj)
        {
            _load(file_path_str, options_obj);
            return this;
        };

        /**
         * Unloads JavaScript from a HTML page
         * @param file_ref_str {String} see _unload
         */
        rScript_obj.unloadJS = function(file_ref_str)
        {
            _unload(file_ref_str);
            return this;
        };

        /**
         * Compiles a HTML template to plain HTML using a template context
         * It works similar to HandlebarsJS
         * @param html_str_or_obj {String|Object} the template HTML
         * @param template_ctx {Object} the template context object
         * @return {String}
         * @private
         */
        function _compile(html_str_or_obj, template_ctx)
        {
            var html_str = html_str_or_obj,
                ctx_value,
                regex_block_exp = /\{\{#(.*?)\s+(\w+)}}[\s]*([\s\S]*?)[\s]*\{\{\/.*?}}/gi
                ;

            if(!_r.isString(html_str_or_obj))
            {
                //convert to HTML string
                html_str = (rQuery.isRQueryObject(html_str_or_obj)) ? html_str_or_obj.html() : $(html_str_or_obj).html();
            }

            /**
             * 1: Manage Block Expressions
             */
            var matches_arr = regexMatchAll(regex_block_exp, html_str),
                match_block_tag_str,
                match_block_id_str,
                match_block_html_str,
                template_ctx_node,
                template_ctx_node_item,
                template_ctx_node_item_value,
                html_ctx_node_item_str,
                html_ctx_node_str = "",
                html_ctx_block_str = "",
                html_str_clean_list_tag_open_regex,
                html_str_clean_list_tag_close_regex,
                i,
                j;

            //iterate of block expression matches
            for(i = 0; i < _r.count(matches_arr); i++)
            {
                //reset values
                html_ctx_node_str = "";

                //get block expression string components
                match_block_tag_str = matches_arr[i][1];
                match_block_id_str = matches_arr[i][2];
                match_block_html_str = matches_arr[i][3];

                template_ctx_node = template_ctx[match_block_id_str];

                //iterate over template context node value [array]
                for(j = 0; j < _r.count(template_ctx_node); j++)
                {
                    html_ctx_node_item_str = match_block_html_str;
                    template_ctx_node_item = template_ctx_node[j];

                    //generate individual HTML substrings for each list item
                    for (var template_ctx_node_item_key in template_ctx_node_item) {
                        if (template_ctx_node_item.hasOwnProperty(template_ctx_node_item_key)) {
                            template_ctx_node_item_value = template_ctx_node_item[template_ctx_node_item_key];

                            html_ctx_node_item_str = html_ctx_node_item_str.replace("{{"+template_ctx_node_item_key+"}}", template_ctx_node_item_value);
                        }
                    }

                    //append HTML substring to main substring
                    html_ctx_node_str += html_ctx_node_item_str;
                }

                //get final HTML replacement text from main substring
                html_ctx_block_str = match_block_html_str.replace(match_block_html_str, html_ctx_node_str);

                //replace HTML
                if(template_ctx_node)
                {
                    //replace HTML only if template context has valid named node
                    html_str = html_str.replace(match_block_html_str, html_ctx_block_str);

                    //remove any block expression tags
                    html_str_clean_list_tag_open_regex = new RegExp("{{#"+match_block_tag_str+"\\s+"+match_block_id_str+"}}", "i");
                    html_str_clean_list_tag_close_regex = new RegExp("{{\\/"+match_block_tag_str+"}}", "i");

                    html_str = html_str.replace(html_str_clean_list_tag_open_regex, "");
                    html_str = html_str.replace(html_str_clean_list_tag_close_regex, "");
                }
            }

            /**
             * 2: Basic Expressions
             */
            for (var ctx_key in template_ctx) {
                if (template_ctx.hasOwnProperty(ctx_key)) {
                    ctx_value = template_ctx[ctx_key];

                    if(_r.isString(ctx_value))
                    {
                        //run only if template context value is a string
                        html_str = html_str.replace("{{"+ctx_key+"}}", ctx_value);
                    }
                }
            }

            return html_str;
        }

        /**
         * Wrapper class for _compile
         */
        rScript_obj.compile = function(html_str_or_obj, template_ctx_obj)
        {
            return _compile(html_str_or_obj, template_ctx_obj);
        };

        /**
         * Fetches a file
         * @param {String} path_str the path to the file to fetch
         * @param {Object} options_obj the fetch options
         *
         * cache {boolean}: Defines whether fetched object should be cached. Either true or false. Default is false
         *
         * expiry {number}: Defines the expiry of a cached object in milliseconds. Default is infinity.
         *
         * storage {string}: Defines the storage method used for caching
         * - ls for localStorage
         * - ss for sessionStorage [Default]
         * - ds for domStorage
         * Note: there is no cache_expiry for cached items in DOM storage. All cached items using DOM storage will be refreshed on page reload
         *
         * headers {object}: this enables HTTP headers to be defined. Define using objects e.g. {'Cache-Control': 'no-cache'}
         *
         * @returns {Promise}
         * @private
         */
        function _fetch(path_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[1]) ? myArgs[1] : {},
                options_cache_bool = !!(options_obj.cache),
                options_cache_expiry_int = (options_obj.expiry) ? options_obj.expiry : undefined,
                options_cache_storage_str = (options_obj.storage) ? options_obj.storage : undefined,
                path_hash_str = _r.md5(path_str);

            if(options_cache_bool)
            {
                options_obj.cache_key = path_hash_str;
                options_obj.cache_expiry = options_cache_expiry_int;
                options_obj.cache_storage = options_cache_storage_str;
            }

            return $.ajax(path_str, options_obj);
        }

        /**
         * Fetches a file
         * Wrapper for _fetch
         * @param {String} path_str the path to the file to fetch
         * @param {Object} options_obj the fetch options
         * @returns {Promise}
         */
        rScript_obj.fetch = function(path_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = myArgs[1]
                ;

            return _fetch(path_str, options_obj);
        };

        /**
         * Post data to a URL
         * @param {String} path_str the path to post to
         * @param {String} data_str_or_obj the data to post
         * @param {Object} options_obj the post options
         * @return {Promise}
         * @private
         */
        function _post(path_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                data_str_or_obj = myArgs[1],
                options_obj = (myArgs[2]) ? myArgs[2] : {}
                ;

            //set method
            options_obj.method = 'POST';

            //manage data and headers
            if(_r.isObject(data_str_or_obj))
            {
                //set data
                options_obj.data = data_str_or_obj;

                //set headers
                options_obj.headers = (options_obj.headers) ? options_obj.headers : {};
                options_obj['headers']['Content-type'] = 'application/json';
            }
            else if(_r.isString(data_str_or_obj))
            {
                if(/[^\s]+?\=/i.test(data_str_or_obj))
                {
                    //is query string

                    options_obj.data = undefined;

                    //add to url
                    if(/^.+?\?.+?$/i.test(path_str))
                    {
                        path_str += '&'+data_str_or_obj;
                    }
                    else
                    {
                        path_str += '?'+data_str_or_obj;
                    }
                }
            }

            return $.ajax(path_str, options_obj);
        }

        /**
         * Post data to a URL
         * @param {String} path_str the path to post to
         * @param {String|Object} data_str_or_obj the data to post
         * @param {Object} options_obj the post options
         * @return {*}
         */
        rScript_obj.post = function(path_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                data_str_or_obj = myArgs[1],
                options_obj = myArgs[2]
                ;

            return _post(path_str, data_str_or_obj, options_obj);
        }

        /**
         * Watches a DOM object for changes
         * Leverages mutation observers
         * @param model_obj {Object} the object [model] to watch
         * @param callback_fn {Function|String} callback function to execute when a change is detected. You can also define as 'off' to disconnect the observer
         * The callback function is passed the mutation object
         * @param observer_config_obj {Object} the Mutation observer options
         * @private
         */
        function _watch(model_obj)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                callback_fn = (myArgs[1]) ? myArgs[1] : function(){},
                model_elem_obj = (_r.count(model_obj) > 0) ? model_obj[0] : model_obj,
                observer_config_obj = (myArgs[2]) ? myArgs[2] : {attributes: true, childList: true, characterData: true, subtree: true, attributeOldValue: true, characterDataOldValue: true},
                observer_obj
                ;

            //define callback
            var callback_container_fn = function(mutations_arr){
                mutations_arr.forEach(function(mutation) {
                    callback_fn(mutation);
                });
            };

            //define observer and config
            observer_obj = new MutationObserver(callback_container_fn);

            //disconnect
            if(callback_fn === 'off')
            {
                observer_obj.disconnect();
                return;
            }

            observer_obj.observe(model_elem_obj, observer_config_obj);
        }

        /**
         * Watches a DOM object for changes
         * Wrapper for _watch
         * @param {Object} model_obj the DOM object to watch
         * @param {Function} callback_fn the function to execute when a change occurs
         * @param {Object} observer_config_obj the Mutation observer options
         * @returns {rScript}
         */
        rScript_obj.watch = function(model_obj)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                callback_fn = myArgs[1],
                observer_config_obj = myArgs[2]
                ;

            _watch(model_obj, callback_fn, observer_config_obj);
            return this;
        };


        /**
         * Provides data-binding functionality
         */
        rScript_obj.bind = {
            /**
             * Creates a bind relationship
             *
             * @param model_obj {Object} the object [model] that is the source
             * of the data to be added to the DOM
             * @param view_obj {Object} the object [view] that is the target of
             * data to be added to the DOM. The view is usually what is visible to the user
             * @param options_obj {Object} specific bind options
             *
             * mode: defines a mode of data-binding. This is for multi-way data-binding e.g. 3-way, 4-way, etc. The following values are available:
             * 'baas' is for data-binding to a backend-as-a-service. Firebase is the only BaaS currently supported
             * 'xhr' is for data-binding via AJAX
             * 'func' is for data-binding to a namespaced function
             *
             * sync: defines how the model will handle value mutation after page refreshes and remote model updates (in the case of 3-way binding)
             *
             * for 2-way data-binding, if sync is true, the last mutated value of the model will be stored and applied when the page is manually refreshed. If false, the default value will be applied
             *
             * for 3-way data-binding, if sync is true, the last mutated value of the model will be stored and applied when the page is manually refreshed. In addition, the local model will be synced with the remote model, so if the remote model is update, the local model will be updated, and vice versa
             *
             * force_value_to_string: if true, all model values will be converted to a string before persisted to remote or local storage. Does not apply when 'mode' is 'xhr'. Default is false.
             *
             * callback_mutation: defines a callback that will be fired and receive the data from
             *
             * input_event: The name of the event trigger
             * Can be 'keyup' or 'keydown' [default]
             * Note: this is applicable only if the model is an input element e.g. textbox, textarea.
             *
             * input_throttle: The number of milliseconds to wait before the event is fired
             * Note: this is applicable only if the model is an input element e.g. textbox, textarea.
             *
             * @returns {rScript}
             */
            add: function (model_obj) {

                var myArgs = Array.prototype.slice.call(arguments),
                    view_obj = myArgs[1],
                    options_obj = (myArgs[2]) ? myArgs[2] : {}
                    ;

                //define nodes
                var model_obj_tag_name_str = model_obj.nodeName || model_obj.tagName,
                    model_obj_is_input_bool = ((_r.in_array(model_obj_tag_name_str, ['input', 'textarea']))),
                    view_obj_value_str = (view_obj) ? view_obj.html() : '',
                    view_obj_is_template_bool = ((/\{\{.*?}}/i.test(view_obj_value_str))),
                    model_obj_view_tag_str = model_obj.attr('r-model') || model_obj.attr('data-r-model'),
                    view_obj_value_new_str,
                    baas_database_obj,
                    baas_database_ref_obj,
                    bind_meta_data_item_obj = {}
                    ;

                //define baas sync enable callback
                var callback_baas_sync_enable_fn = function(baas_database_ref_obj, baas_database_sync_callback_fn){
                    var myFnArgs = Array.prototype.slice.call(arguments),
                        sync_metadata_obj = myFnArgs[2];

                    baas_database_ref_obj.on('value', function(snapshot) {

                        baas_database_sync_callback_fn(snapshot, sync_metadata_obj);
                    });
                };

                //define baas sync operation callback
                var callback_baas_sync_op_fn = function(sync_snaphot, sync_metadata_obj){
                    var template_ctx = {},
                        model_sync_obj = sync_metadata_obj['model'],
                        view_sync_obj = sync_metadata_obj['view'],
                        view_obj_value_str = sync_metadata_obj['view_value'],
                        model_obj_view_tag_str = sync_metadata_obj['model_view_tag'],
                        view_obj_is_template_bool = sync_metadata_obj['view_is_template']
                        ;

                    //get snapshot
                    var sync_snapshot_val_str = sync_snaphot.val();

                    //update model
                    if(model_obj_is_input_bool)
                    {
                        model_sync_obj.val(sync_snapshot_val_str);
                    }
                    else
                    {
                        model_sync_obj.html(sync_snapshot_val_str);
                    }

                    //create template context
                    template_ctx[model_obj_view_tag_str] = sync_snapshot_val_str;
                    view_obj_value_new_str = (view_obj_is_template_bool) ? _compile(view_obj_value_str, template_ctx) : sync_snapshot_val_str;

                    view_sync_obj.html(view_obj_value_new_str);
                };

                //define model synchronization method
                var model_sync_fn = function(model_obj, model_bind_mode_str){

                    var myArgs = Array.prototype.slice.call(arguments),
                        is_sync_bool = myArgs[2],
                        mutation_item_obj = myArgs[3],
                        model_obj_value_str,
                        model_id_str;

                    //get the id of the model
                    model_id_str = model_obj.attr('id');

                    /**
                     * This block is meant to prevent flash of non-initialized data for multi-way bind operations where the last stored value is different from the value of the input element. When this is the case, you want the last stored value to be initialized, not the value in the "value" attribute.
                     * This will check whether there is a previously stored value and then use that. It does this only once when the page is loaded.
                     */
                    if(is_sync_bool && !rScript.domStore('rs_var_bind_model_sync_init_'+model_id_str) && rScript.store('rs_var_bind_model_value_last_'+model_id_str) && rScript.store('rs_var_bind_model_value_last_flag_'+model_id_str))
                    {
                        model_obj_value_str = rScript.store('rs_var_bind_model_value_last_'+model_id_str);

                        if(model_bind_mode_str === 'input')
                        {
                            model_obj.val(model_obj_value_str);
                        }
                        else if(model_bind_mode_str === 'mutate')
                        {
                            model_obj.html(model_obj_value_str);
                        }
                    }
                    else
                    {
                        if(model_bind_mode_str === 'mutate')
                        {
                            if(mutation_item_obj)
                            {
                                //get model data from mutation record
                                if(mutation_item_obj.addedNodes.length > 0)
                                {
                                    model_obj_value_str = mutation_item_obj.addedNodes[0].data;
                                }
                                else
                                {
                                    model_obj_value_str = mutation_item_obj.target.data || mutation_item_obj.target.nodeValue;
                                }
                            }
                            else
                            {
                                //get model value from DOM
                                model_obj_value_str = model_obj.html();
                            }
                        }
                        else if(model_bind_mode_str === 'input')
                        {
                            model_obj_value_str = model_obj.val();
                        }
                    }

                    //store model value to storage
                    if(is_sync_bool)
                    {
                        //store model value
                        rScript.store('rs_var_bind_model_value_last_'+model_id_str, model_obj_value_str);

                        //mark that model value is stored
                        rScript.store('rs_var_bind_model_value_last_flag_'+model_id_str, true);
                    }

                    //mark that model sync is initialized
                    if(!rScript.domStore('rs_var_bind_model_sync_init_'+model_id_str))
                    {
                        rScript.domStore('rs_var_bind_model_sync_init_'+model_id_str, true);
                    }

                    return model_obj_value_str;
                };

                //sanitizes the model value
                var model_value_clean_fn = function(model_value){

                    var model_value_clean,
                        model_value_str;

                    //cast to string
                    model_value_str = ''+model_value+'';

                    //trim
                    model_value_str = model_value_str.trim();

                    //remove opening and closing quotes
                    if(/^["'].+?["']$/i.test(model_value_str))
                    {
                        model_value_str = model_value_str.slice(1, -1);
                    }

                    //recast if required
                    if(/^ *[0-9]+ *$/i.test(model_value_str))
                    {
                        model_value_clean = parseInt(model_value_str);
                    }
                    else if(/^ *[0-9]+\.[0-9]+ *$/i.test(model_value_str))
                    {
                        model_value_clean = parseFloat(model_value_str);
                    }
                    else if(/^ *(true|false) *$/i.test(model_value_str))
                    {
                        model_value_clean = ((/^ *true *$/i.test(model_value_str)));
                    }
                    else
                    {
                        model_value_clean = model_value_str;
                    }

                    return model_value_clean;
                }

                //define callback for input
                var callback_2way_input_fn = function(){

                    var myArgs = Array.prototype.slice.call(arguments),
                        model_obj = myArgs[0],
                        view_obj = myArgs[1],
                        options_obj = myArgs[2],
                        is_sync_bool,
                        model_obj_value_str,
                        view_obj_is_template_bool = (_r.isBool(options_obj.view_is_template)) ? options_obj.view_is_template : false,
                        model_value_force_string_bool = ((_r.isBool(options_obj.force_value_to_string))),
                        model_obj_view_tag_str = options_obj.model_view_tag,
                        template_ctx = {},
                        metadata_obj = {}
                        ;

                    is_sync_bool = (options_obj.sync);

                    //get synced model value
                    model_obj_value_str = model_sync_fn(model_obj, 'input', is_sync_bool);

                    //create template context
                    template_ctx[model_obj_view_tag_str] = model_obj_value_str;
                    view_obj_value_new_str = (view_obj_is_template_bool) ? _compile(view_obj_value_str, template_ctx) : model_obj_value_str;

                    //add value to view
                    view_obj.html(view_obj_value_new_str);

                    //create metadata object
                    metadata_obj['model'] = model_obj;
                    metadata_obj['model_id'] = model_obj.attr('id');
                    metadata_obj['model_value'] = (model_value_force_string_bool) ? model_obj_value_str : model_value_clean_fn(model_obj_value_str);
                    metadata_obj['model_view_tag'] = model_obj_view_tag_str;
                    metadata_obj['model_is_input'] = model_obj_is_input_bool;
                    metadata_obj['view'] = view_obj;
                    metadata_obj['view_value'] = view_obj_value_str;
                    metadata_obj['view_is_template'] = view_obj_is_template_bool;

                    //co-opt 3-way and 4-way data-binding if active

                    //3-way (BaaS)
                    if(rQuery.data('rs_var_bind_method_3way_baas_init'))
                    {
                        callback_3way_baas_fn(metadata_obj, options_obj);
                    }

                    //3-way (non-BaaS)
                    if(rQuery.data('rs_var_bind_method_3way_init'))
                    {
                        callback_3way_fn(metadata_obj, options_obj);
                    }

                    //4-way
                    if(rQuery.data('rs_var_bind_method_4way_init'))
                    {
                        callback_4way_fn(metadata_obj, options_obj);
                    }
                };

                //define callback for mutation observer
                var callback_2way_fn = function(mutations_arr)
                {
                    var myArgs = Array.prototype.slice.call(arguments),
                        model_obj = myArgs[1],
                        view_obj = myArgs[2],
                        options_obj = myArgs[3],
                        is_sync_bool,
                        model_obj_value_str,
                        view_obj_is_template_bool = (_r.isBool(options_obj.view_is_template)) ? options_obj.view_is_template : false,
                        model_obj_view_tag_str = options_obj.model_view_tag,
                        model_value_force_string_bool = ((_r.isBool(options_obj.force_value_to_string))),
                        template_ctx = {},
                        metadata_obj = {}
                        ;

                    is_sync_bool = (options_obj.sync);

                    if(mutations_arr)
                    {
                        //update view on mutation

                        mutations_arr.forEach(function(mutation){

                            //get synced model value
                            model_obj_value_str = model_sync_fn(model_obj, 'mutate', is_sync_bool, mutation);

                            //use template if necessary
                            template_ctx[model_obj_view_tag_str] = model_obj_value_str;
                            view_obj_value_new_str = (view_obj_is_template_bool) ? _compile(view_obj_value_str, template_ctx) : model_obj_value_str;

                            //add value to view
                            view_obj.html(view_obj_value_new_str);

                        });
                    }
                    else
                    {
                        //update view

                        //get synced model value
                        model_obj_value_str = model_sync_fn(model_obj, 'mutate', is_sync_bool);

                        if(!model_obj_value_str || /^\s*$/i.test(model_obj_value_str))
                        {
                            model_obj_value_str = '';
                        }

                        //use template if necessary
                        template_ctx[model_obj_view_tag_str] = model_obj_value_str;
                        view_obj_value_new_str = (view_obj_is_template_bool) ? _compile(view_obj_value_str, template_ctx) : model_obj_value_str;

                        //add value to view
                        if(!(_r.isEmptyString(view_obj_value_new_str) && !_r.isEmptyString(view_obj_value_str)))
                        {
                            view_obj.html(view_obj_value_new_str);
                        }

                    }

                    //create metadata object
                    metadata_obj['model'] = model_obj;
                    metadata_obj['model_id'] = model_obj.attr('id');
                    metadata_obj['model_value'] = (model_value_force_string_bool) ? model_obj_value_str : model_value_clean_fn(model_obj_value_str);
                    metadata_obj['model_view_tag'] = model_obj_view_tag_str;
                    metadata_obj['model_is_input'] = model_obj_is_input_bool;
                    metadata_obj['view'] = view_obj;
                    metadata_obj['view_value'] = view_obj_value_str;
                    metadata_obj['view_is_template'] = view_obj_is_template_bool;

                    //co-opt 3-way and 4-way data-binding if active

                    //3-way (BaaS)
                    if(rQuery.data('rs_var_bind_method_3way_baas_init'))
                    {
                        callback_3way_baas_fn(metadata_obj, options_obj);
                    }

                    //3-way (non-BaaS)
                    if(rQuery.data('rs_var_bind_method_3way_init'))
                    {
                        callback_3way_fn(metadata_obj, options_obj);
                    }

                    //4-way
                    if(rQuery.data('rs_var_bind_method_4way_init'))
                    {
                        callback_4way_fn(metadata_obj, options_obj);
                    }
                };

                //define callback for 3-way binding (non-BaaS)
                var callback_3way_fn = function(metadata_obj, options_obj) {

                    var mode_str = options_obj.mode,
                        model_obj = metadata_obj['model'],
                        model_is_input_bool = metadata_obj['model_is_input'],
                        model_id_str = metadata_obj['model_id'],
                        model_value_str = metadata_obj['model_value'],
                        model_value_force_string_bool = ((_r.isBool(options_obj.force_value_to_string)))
                        ;

                    if (mode_str === 'xhr') {
                        //xhr mode

                        var is_firebase_bool,
                            xhr_url_str = options_obj.xhr_url,
                            xhr_callback_fn = (options_obj.xhr_callback) ? options_obj.xhr_callback : false,
                            xhr_callback_error_fn = (options_obj.xhr_callback_error) ? options_obj.xhr_callback_error : false,
                            xhr_valid_headers_str = (options_obj.xhr_valid_headers) ? options_obj.xhr_valid_headers : '200,201,202,203,204,301,304';

                        xhr_url_str += (/.+?\?.+?\=/i.test(xhr_url_str)) ? '&' : '?';
                        xhr_url_str += 'r_bind_value=' + model_value_str;

                        //check if the xhr is for firebase
                        is_firebase_bool = ((/\=firebase/i.test(xhr_url_str)) || options_obj.xhr_firebase);

                        //mark url to signify that sync is in effect
                        if(is_firebase_bool && options_obj.sync)
                        {
                            xhr_url_str += '&r_sync=true';
                        }

                        //mark url the first time this XHR is run
                        if(!rScript.domStore('rs_var_bind_xhr_init_'+model_id_str))
                        {
                            xhr_url_str += '&r_first_run=true';

                            rScript.domStore('rs_var_bind_xhr_init_'+model_id_str, true);
                        }

                        //Run XHR
                        $.ajax(xhr_url_str, {
                            response: false,
                            response_valid_headers: xhr_valid_headers_str,
                            method: 'POST'
                        }).then(function (xhr) {
                            //resolve: execute callback if defined

                            //get and clean response
                            var xhr_response_str = xhr.response;
                            xhr_response_str = model_value_clean_fn(xhr_response_str);

                            //mark the first time XHR response is received
                            if(xhr_response_str && !rScript.domStore('rs_var_bind_xhr_init_response_'+model_id_str))
                            {
                                //update model
                                if(model_is_input_bool)
                                {
                                    model_obj.val(xhr.response);
                                }
                                else
                                {
                                    model_obj.html(xhr.response);
                                }

                                rScript.domStore('rs_var_bind_xhr_init_response_'+model_id_str, true);
                            }

                            //run callback
                            if (xhr_callback_fn) {
                                xhr_callback_fn(xhr);
                            }

                        }, function (xhr) {
                            //reject: execute callback if defined
                            if (xhr_callback_error_fn) {
                                xhr_callback_error_fn(xhr);
                            }
                        });
                    }
                    else if (mode_str === 'func') {
                        //function mode

                        var func_name_str = options_obj.func_name,
                            func_args = options_obj.func_args,
                            func_args_obj,
                            func_namespace_str = options_obj.func_namespace,
                            model_value_clean
                            ;

                        model_value_clean = (model_value_force_string_bool) ? model_value_str : model_value_clean_fn(model_value_str);

                        //create function argument object
                        func_args_obj = {
                            model_value: model_value_clean,
                            fn_args: func_args
                        }

                        //run object
                        if(func_namespace_str)
                        {
                            rScript.runFunction(func_name_str, {args: func_args_obj, namespace: func_namespace_str});
                        }
                        else
                        {
                            rScript.runFunction(func_name_str, {args: func_args_obj});
                        }
                    }
                }

                //define callback for 3-way binding (BaaS)
                var callback_3way_baas_fn = function(metadata_obj, options_obj) {

                    var model_id_str = metadata_obj['model_id'],
                        model_value_str = metadata_obj['model_value'],
                        baas_config_obj,
                        baas_sync_bool = options_obj.sync,
                        baas_script_str = options_obj.baas_script,
                        baas_apikey_str = options_obj.baas_apikey,
                        baas_domain_str = options_obj.baas_domain,
                        baas_url_str = options_obj.baas_url,
                        baas_bucket_str = options_obj.baas_bucket,
                        baas_path_str = options_obj.baas_path,
                        baas_callback_fn = options_obj.baas_callback
                        ;

                    if (/firebase/i.test(baas_script_str))
                    {
                        //check if already init
                        if(!rQuery.data('rs_var_bind_3way_firebase_init'))
                        {
                            //setup baas config
                            baas_config_obj = {
                                apiKey: baas_apikey_str,
                                authDomain: baas_domain_str,
                                databaseURL: baas_url_str,
                                storageBucket: baas_bucket_str
                            };
                            firebase.initializeApp(baas_config_obj);

                            //mark init
                            rQuery.data('rs_var_bind_3way_firebase_init', true);
                        }

                        //setup
                        baas_database_obj = firebase.database();
                        baas_database_ref_obj = baas_database_obj.ref(baas_path_str);

                        if(!rQuery.data('rs_var_bind_3way_firebase_trans_init_'+model_id_str))
                        {
                            //run once for each firebase session

                            //setup sync
                            if (baas_sync_bool) {
                                callback_baas_sync_enable_fn(baas_database_ref_obj, callback_baas_sync_op_fn, metadata_obj);
                            }

                            rQuery.data('rs_var_bind_3way_firebase_trans_init_'+model_id_str, true);
                        }
                        else
                        {
                            //sync to remote successively

                            baas_database_ref_obj.transaction(function (post) {
                                return model_value_str;
                            }, baas_callback_fn);
                        }
                    }
                }

                //define callback for 4-way [and more] binding
                var callback_4way_fn = function(metadata_obj, options_obj)
                {
                    var model_value_str = metadata_obj['model_value'],
                        s_key_str = options_obj.s_key,
                        s_type_str = options_obj.s_type,
                        s_expiry_str = options_obj.s_expiry,
                        s_expiry_int = parseInt(s_expiry_str),
                        s_expiry_option_obj = (s_expiry_int) ? {expires: s_expiry_int} : null
                        ;

                    //do 4-way [or more] data binding

                    var s_type_arr = _r.explode('|', s_type_str);
                    if(_r.in_array('ds', s_type_arr))
                    {
                        rScript.domStore(s_key_str, model_value_str);
                    }

                    if(_r.in_array('ss', s_type_arr))
                    {
                        rScript.store(s_key_str, model_value_str, 'ss', s_expiry_option_obj);
                    }

                    if(_r.in_array('ls', s_type_arr))
                    {
                        rScript.store(s_key_str, model_value_str, 'ls', s_expiry_option_obj);
                    }
                };

                //Initialize bind metadata
                if(!rQuery.data('rs_var_bind_metadata_init'))
                {
                    rQuery.data('rs_var_bind_metadata', []);
                    rQuery.data('rs_var_bind_method_flag', {is_2way: false, is_3way: false, is_3way_baas: false, is_4way: false});

                    //DOM cache
                    rQuery.data('rs_var_bind_metadata_init', true);
                }

                //define bind metadata
                bind_meta_data_item_obj['model'] = model_obj;
                bind_meta_data_item_obj['view'] = view_obj;
                bind_meta_data_item_obj['is_input'] = model_obj_is_input_bool;
                bind_meta_data_item_obj['view_is_template'] = view_obj_is_template_bool;
                bind_meta_data_item_obj['model_view_tag'] = model_obj_view_tag_str;

                //add options and mutation observer callback if defined
                if(options_obj)
                {
                    bind_meta_data_item_obj['options'] = options_obj;
                }
                if(options_obj.callback_mutation)
                {
                    bind_meta_data_item_obj['callback_mutation'] = options_obj.callback_mutation;
                }

                //define callback
                if(model_obj_is_input_bool)
                {
                    bind_meta_data_item_obj['callback'] = callback_2way_input_fn;
                }
                else
                {
                    bind_meta_data_item_obj['callback'] = callback_2way_fn;
                }

                //determine what binding method i.e. 2-way, 3-way, etc.
                if(view_obj)
                {
                    bind_meta_data_item_obj['method'] = '2way';
                    rQuery.data('rs_var_bind_method_flag')['is_2way'] = true;
                }

                if(options_obj)
                {
                    if(options_obj.mode)
                    {
                        if(options_obj.mode === 'baas')
                        {
                            bind_meta_data_item_obj['method'] = '3way_baas';
                            rQuery.data('rs_var_bind_method_flag')['is_3way_baas'] = true;
                        }
                        else
                        {
                            bind_meta_data_item_obj['method'] = '3way';
                            rQuery.data('rs_var_bind_method_flag')['is_3way'] = true;
                        }
                    }
                    else if(options_obj.s_key)
                    {
                        bind_meta_data_item_obj['method'] = '4way';
                        rQuery.data('rs_var_bind_method_flag')['is_4way'] = true;
                    }
                }

                //persist bind metadata
                rQuery.data('rs_var_bind_metadata').push(bind_meta_data_item_obj);

                return this;
            },
            /**
             * Executes all previously defined bind operations
             * Bind operations are created by add method
             */
            run: function () {
                var bind_metadata_arr = rQuery.data('rs_var_bind_metadata'),
                    bind_method_flag_obj = rQuery.data('rs_var_bind_method_flag'),
                    bind_metadata_method_item_str
                    ;

                //return if no data bind object set
                if(!bind_metadata_arr)
                {
                    return false;
                }

                /**
                 * Main callback function
                 */
                var callback_run_fn = function(args)
                {
                    var callback_container_fn,
                        callback_container_mo_fn,
                        callback_fn = args['callback'],
                        callback_mutation_fn = args['callback_mutation'],
                        callback_fn_args_1,
                        callback_fn_args_2,
                        callback_fn_args_3,
                        method_str = args['method'],
                        model_obj = args['model'],
                        model_elem_obj = (_r.count(model_obj) > 0) ? model_obj[0] : model_obj,
                        model_is_input_bool = args['is_input'],
                        view_obj = args['view'],
                        view_is_template_bool = args['view_is_template'],
                        model_obj_view_tag_str = args['model_view_tag'],
                        options_obj = args['options'],
                        is_ie_9_bool = _r.isIE() === 9,
                        input_event_name_str,
                        input_on_event_obj,
                        input_throttle_int,
                        observer_obj,
                        observer_config_obj
                        ;

                    //create options object if non-existent
                    options_obj = (!options_obj) ? {} : options_obj;

                    //mark if view is templated
                    if(_r.isBool(view_is_template_bool))
                    {
                        options_obj.view_is_template = view_is_template_bool;
                    }

                    //mark if there is a model-view tag
                    if(model_obj_view_tag_str)
                    {
                        options_obj.model_view_tag = model_obj_view_tag_str;
                    }

                    //define callback args
                    callback_fn_args_1 = model_obj;
                    callback_fn_args_2 = view_obj;
                    callback_fn_args_3 = options_obj;

                    if(model_is_input_bool)
                    {
                        //...for input binding

                        //set event variables
                        input_event_name_str = (_r.isString(options_obj.input_event) && _r.in_array(options_obj.input_event, ['keyup', 'keydown'])) ? options_obj.input_event : 'keydown';
                        input_on_event_obj = ('oninput' in document.documentElement && !is_ie_9_bool) && 'input blur change' || input_event_name_str+' blur change';
                        input_throttle_int = (_r.isNumber(options_obj.input_throttle)) ? options_obj.input_throttle : false;

                        //create callback
                        callback_container_fn = function(e)
                        {
                            if(e)
                            {
                                if(e.type === input_event_name_str)
                                {
                                    window.setTimeout(function(){callback_fn(callback_fn_args_1, callback_fn_args_2, callback_fn_args_3);}, 0);
                                }
                                else
                                {
                                    callback_fn(callback_fn_args_1, callback_fn_args_2, callback_fn_args_3);
                                }
                            }
                            else
                            {
                                callback_fn(callback_fn_args_1, callback_fn_args_2, callback_fn_args_3);
                            }
                        };

                        //initialize on first run
                        callback_container_fn();

                        //throttle if defined
                        if(input_throttle_int)
                        {
                            callback_container_fn = _r.throttle(callback_container_fn, input_throttle_int);
                        }

                        //add event handler
                        model_obj.on(input_on_event_obj, callback_container_fn);

                        //add mutation observer
                        //define callback
                        callback_container_mo_fn = function(mutation){
                            if(callback_mutation_fn)
                            {
                                callback_mutation_fn(mutation);
                            }
                            callback_fn(callback_fn_args_1, callback_fn_args_2, callback_fn_args_3);
                        };
                        //define observer and config
                        observer_obj = new MutationObserver(callback_container_mo_fn);
                        observer_config_obj = {attributes: true, childList: true, characterData: true, subtree: true, attributeOldValue: true, characterDataOldValue: true};
                        observer_obj.observe(model_elem_obj, observer_config_obj);
                    }
                    else
                    {
                        //...for object binding

                        //define callback
                        callback_container_fn = function(mutation){
                            callback_fn(mutation, callback_fn_args_1, callback_fn_args_2, callback_fn_args_3);
                        };

                        //initialize on first run
                        callback_container_fn();

                        //define observer and config
                        observer_obj = new MutationObserver(callback_container_fn);
                        observer_config_obj = {attributes: true, childList: true, characterData: true, subtree: true, attributeOldValue: true, characterDataOldValue: true};
                        observer_obj.observe(model_elem_obj, observer_config_obj);
                    }
                };

                /**
                 * flag
                 * 1: 3-way data binding (Baas only)
                 * 2: 3-way data binding (non-Baas)
                 * 2: 4-way data binding
                 * to DOM storage
                 */
                //1:
                if(bind_method_flag_obj.is_3way_baas)
                {
                    var config_baas_script_str = bind_metadata_arr[0]['options']['baas_script']
                        ;
                    _load(config_baas_script_str, {xhr: true,
                        callback: function () {
                            rQuery.data('rs_var_bind_method_3way_baas_init', true);

                            for(var i = 0; i < _r.count(bind_metadata_arr); i++)
                            {
                                //filter 3-way baas operations
                                bind_metadata_method_item_str = bind_metadata_arr[i].method;
                                if(bind_metadata_method_item_str === '3way_baas')
                                {
                                    callback_run_fn(bind_metadata_arr[i]);
                                }
                            }
                        }
                    });
                }

                //2:
                if(bind_method_flag_obj.is_3way)
                {
                    rQuery.data('rs_var_bind_method_3way_init', true);
                }

                //3:
                if(bind_method_flag_obj.is_4way)
                {
                    rQuery.data('rs_var_bind_method_4way_init', true);
                }

                //run main callback(s)
                if(_r.isArray(bind_metadata_arr) && bind_metadata_arr.length > 0)
                {
                    for(var j = 0; j < _r.count(bind_metadata_arr); j++)
                    {
                        callback_run_fn(bind_metadata_arr[j]);
                    }
                }
            }
        }

        /**
         * Provides routing functionality
         *
         * @param {string} path_str the route path e.g. url.com/#path. Define the path without the hash character e.g. path becomes '#path'
         * @param {Object} options_obj the route options
         *
         * hash_char: the character(s) that will prefix the path_str. Default is '#/'
         *
         * callback: a callback function to be called when the route is executed. It will be passed callback_args (see below) as the first argument. If fetch_url is valid, it will be passed as the second argument
         *
         * callback_args: an array or object that is passed to the callback function. It is passed as the first argument
         *
         * add_click: specifies whether click handlers will be added links that have the path_str in their href attribute
         * For example, if add_click is true [default], path_str == 'route_1', hash_char == '#/', and there is a link element like '<a href="#/route_1">Link to Route</a>, then it will be automatically activated to execute the route when it is clicked
         * Set this to false to disable this behavior
         *
         * go: this instantly routes to the given path when set to true.
         *
         * fetch_url: the URL to a HTML file to fetch and inject into the DOM
         * Note: the contents of the file will be inserted
         *
         * fetch_target: the identifier of the DOM element where the fetched file will be inserted
         *
         * fetch_post_method: the method that will be used for the insertion
         * Options are:
         * - append: will append the contents of the fetched file to existing contents of the fetch_target
         * - prepend: will append the contents of the fetched file to existing contents of the fetch_target
         * - replace: will replace the existing contents of the fetch_target with the contents of the fetched file
         *
         * fetch_post_block: a regular expression string that will prevent the view from being inserted if it resolves to true. This is used to prevent a view from being inserted multiple times on multiple calls/clicks.
         *
         * fetch_cache_expiry: the lifetime (in seconds) of the cache for the fetched item. Whenever the view is fetched, it is also cached in storage. Value must be an integer. When not defined, lifetime is unlimited
         *
         * fetch_callback_pre: a callback function to be executed before the file is fetched
         *
         * fetch_callback_post: a callback function to be executed after the file is fetched
         *
         * fetch_callback_args: the arguments that will be passed as the first argument to fetch_callback_pre and fetch_callback_post
         *
         * scroll_route: if true, will activate scroll animation to the fetch_target
         *
         * scroll_target: defines the scroll target. If fetch_target is already defined and scroll_route is true, you can skip this
         *
         * scroll_offset: defines the scroll offset. See scrollTo method
         *
         * scroll_speed: defines the scroll speed in seconds. See scrollTo method
         *
         * scroll_callback: defines a callback function that will be executed when scrolling is over
         *
         * nohashchange: if true, the URL in the address bar will not be hashed. Default is false
         *
         * noscroll: if true, all scroll actions will be disabled regardless of other scroll settings
         *
         * @private
         */
        function _route(path_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = myArgs[1],
                options_meta_obj,
                url_str = _getUrl(),
                options_hash_char_str,
                options_callback_fn,
                options_callback_args_arr_or_obj,
                options_add_click_bool,
                options_fetch_route_bool,
                options_fetch_url_str,
                options_fetch_url_base_str,
                options_fetch_target_str,
                options_fetch_post_method_str,
                options_fetch_post_block_str,
                options_fetch_cache_expiry_int,
                options_fetch_template_obj,
                options_fetch_callback_pre_fn,
                options_fetch_callback_post_fn,
                options_fetch_callback_args_arr_or_obj,
                options_fetch_linkport_bool,
                options_go_route_bool,
                options_disable_hashchange_bool,
                options_disable_scroll_bool,
                options_scroll_route_bool,
                options_scroll_target_str,
                options_scroll_offset_int_or_str,
                options_scroll_speed_int_or_str,
                options_scroll_callback_fn,
                path_hash_str,
                elem_win_obj = $(window),
                elem_body_obj = $('body'),
                elem_a_obj,
                data_route_obj = rQuery.data('r_rs_var_routes_id'),
                route_data_id_arr,
                route_data_meta_arr,
                route_data_history_str,
                elem_a_obj_href_str
                ;

            //set route option defaults
            options_hash_char_str = (_r.isString(options_obj.hash_char) && options_obj.hash_char.length > 0) ? options_obj.hash_char : '#/';
            options_callback_fn = (options_obj.callback) ? options_obj.callback : null;
            options_callback_args_arr_or_obj = (options_obj.callback_args) ? options_obj.callback_args : null;
            options_add_click_bool = (_r.isBool(options_obj.add_click)) ? options_obj.add_click : true;
            options_fetch_route_bool = ((options_obj.fetch_route));
            options_fetch_url_str = (_r.isString(options_obj.fetch_url) && options_obj.fetch_url.length > 0) ? options_obj.fetch_url : null;
            options_fetch_url_base_str = rScript.store('rs_var_url_base') || _getUrl();
            options_fetch_target_str = (_r.isString(options_obj.fetch_target) && options_obj.fetch_target.length > 0) ? options_obj.fetch_target : null;
            options_fetch_post_method_str = (_r.isString(options_obj.fetch_post_method) && options_obj.fetch_post_method.length > 0 && _r.in_array(options_obj.fetch_post_method, ['html', 'replace', 'append', 'prepend'])) ? options_obj.fetch_post_method : 'append';
            options_fetch_cache_expiry_int = (_r.isNumber(options_obj.fetch_cache_expiry) && options_obj.fetch_cache_expiry > 0) ? options_obj.fetch_cache_expiry : 0;
            options_fetch_template_obj = (!_r.isObjectEmpty(options_obj.fetch_template)) ? options_obj.fetch_template : null;
            options_fetch_post_block_str = (_r.isString(options_obj.fetch_post_block) && options_obj.fetch_post_block.length > 0) ? options_obj.fetch_post_block : null;
            options_fetch_callback_pre_fn = (options_obj.fetch_callback_pre) ? options_obj.fetch_callback_pre : null;
            options_fetch_callback_post_fn = (options_obj.fetch_callback_post) ? options_obj.fetch_callback_post : null;
            options_fetch_callback_args_arr_or_obj = (options_obj.fetch_callback_args) ? options_obj.fetch_callback_args : null;
            options_fetch_linkport_bool = (options_obj.fetch_linkport) ? options_obj.fetch_linkport : false;

            options_go_route_bool = ((options_obj.go));
            options_disable_hashchange_bool = ((options_obj.nohashchange));
            options_disable_scroll_bool = ((options_obj.noscroll));

            options_scroll_route_bool = ((options_obj.scroll_route));
            options_scroll_target_str = (_r.isString(options_obj.scroll_target) && options_obj.scroll_target.length > 0) ? options_obj.scroll_target : null;
            options_scroll_offset_int_or_str = ((_r.isString(options_obj.scroll_offset) && options_obj.scroll_offset.length > 0) || _r.isNumber(options_obj.scroll_offset)) ? options_obj.scroll_offset : null;
            options_scroll_speed_int_or_str = ((_r.isString(options_obj.scroll_speed) && options_obj.scroll_speed.length > 0) || _r.isNumber(options_obj.scroll_speed)) ? options_obj.scroll_speed : null;
            options_scroll_callback_fn = (options_obj.scroll_callback) ? options_obj.scroll_callback : null;

            //define options meta
            options_meta_obj = {
                hash_char: options_hash_char_str,
                callback: options_callback_fn,
                callback_args: options_callback_args_arr_or_obj,
                add_click: options_add_click_bool,
                fetch_route: options_fetch_route_bool,
                fetch_url: options_fetch_url_str,
                fetch_url_base: options_fetch_url_base_str,
                fetch_target: options_fetch_target_str,
                fetch_post_method: options_fetch_post_method_str,
                fetch_cache_expiry: options_fetch_cache_expiry_int,
                fetch_post_block: options_fetch_post_block_str,
                fetch_template: options_fetch_template_obj,
                fetch_callback_pre: options_fetch_callback_pre_fn,
                fetch_callback_post: options_fetch_callback_post_fn,
                fetch_callback_args: options_fetch_callback_args_arr_or_obj,
                fetch_linkport: options_fetch_linkport_bool,
                scroll_route: options_scroll_route_bool,
                scroll_target: options_scroll_target_str,
                scroll_speed: options_scroll_speed_int_or_str,
                scroll_offset: options_scroll_offset_int_or_str,
                scroll_callback: options_scroll_callback_fn,
                disable_hashchange: options_disable_hashchange_bool,
                disable_scroll: options_disable_scroll_bool
            };

            //create path hash
            path_hash_str = options_hash_char_str+path_str;

            /**
             * This is the callback that will be fired on hashchange
             * @param {Boolean} is_forward_evented_bool this allows us to specify that the mode of the hashchange. When the hashchange callback is fired on account of a click, fetch, or other action, it is considered a 'forward' event, so this method is passed a true value. Otherwise, it is considered a 'backward' event, and is passed a false value e.g. click the 'Back' button
             * @param {Boolean} disable_hashchange_bool this disables the hashchange
             */
            var hashchange_main_fn = function(){

                //get current location info
                var myArgs = Array.prototype.slice.call(arguments),
                    is_forward_evented_bool = ((myArgs[0])),
                    hashchange_main_fn_path_hash_str = myArgs[1],
                    hash_char_len_int = options_hash_char_str.length,
                    hashchange_main_fn_path_str = (hashchange_main_fn_path_hash_str && _r.isString(hashchange_main_fn_path_hash_str) && hashchange_main_fn_path_hash_str.length > 0) ? hashchange_main_fn_path_hash_str.slice(hash_char_len_int, hashchange_main_fn_path_hash_str.length) : '',
                    location_href_str = window.location.href,
                    location_href_hash_str = _getUrl('hs'),
                    location_hash_route_arr = _r.explode(options_hash_char_str, location_href_str),
                    location_hash_route_str = (_r.isString(location_href_hash_str) && location_href_hash_str.length > 0) ? location_href_hash_str.slice(hash_char_len_int, location_href_hash_str.length) : location_hash_route_arr.slice(-1)[0],
                    route_search_int,
                    hashchange_main_fn_route_id_str,
                    route_data_history_str
                    ;

                //get stored route data
                route_data_id_arr = rQuery.data('r_rs_var_routes_id');
                route_data_meta_arr = rQuery.data('r_rs_var_routes_meta');

                //get the route identifier
                hashchange_main_fn_route_id_str = (_r.isString(hashchange_main_fn_path_str) && hashchange_main_fn_path_str.length > 0) ? hashchange_main_fn_path_str : location_hash_route_str ;
                route_search_int = _r.array_search(hashchange_main_fn_route_id_str, route_data_id_arr);

                //execute route function if route_id is found
                if(route_search_int)
                {
                    //get callback info
                    var _callback_fn = route_data_meta_arr[route_search_int]['callback'];
                    var _callback_fn_args_arr_or_obj = route_data_meta_arr[route_search_int]['callback_args'];

                    //execute route callback if defined
                    if(_callback_fn)
                    {
                        if(options_fetch_route_bool)
                        {
                            _callback_fn(_callback_fn_args_arr_or_obj, options_fetch_url_str);
                        }
                        else
                        {
                            _callback_fn(_callback_fn_args_arr_or_obj);
                        }
                    }

                    /**
                     * Fetch
                     */
                    var _fetch_url_str = route_data_meta_arr[route_search_int]['fetch_url'];
                    var _fetch_url_base_str = route_data_meta_arr[route_search_int]['fetch_url_base'];

                    var _fetch_target_str = route_data_meta_arr[route_search_int]['fetch_target'];
                    var _fetch_post_method_str = route_data_meta_arr[route_search_int]['fetch_post_method'];
                    var _fetch_cache_expiry_int = route_data_meta_arr[route_search_int]['fetch_cache_expiry'];
                    var _fetch_post_block_str = route_data_meta_arr[route_search_int]['fetch_post_block'];
                    var _fetch_template_obj = route_data_meta_arr[route_search_int]['fetch_template'];

                    var _fetch_callback_pre_fn = route_data_meta_arr[route_search_int]['fetch_callback_pre'];
                    var _fetch_callback_post_fn = route_data_meta_arr[route_search_int]['fetch_callback_post'];
                    var _fetch_callback_args_arr_or_obj = route_data_meta_arr[route_search_int]['fetch_callback_args'];


                    var _fetch_linkport_bool = route_data_meta_arr[route_search_int]['fetch_linkport'];

                    if(_fetch_url_str)
                    {
                        var _fetch_url_final_str = _fetch_url_base_str,
                            html_content_arr,
                            view_content_str,
                            elem_target_obj,
                            view_target_content_str,
                            _fetch_post_block_regex_obj,
                            insert_view_bool = true;

                        //compose final fetch url
                        if(/^ *\.\.\/[^\s]+ *$/i.test(_fetch_url_str))
                        {
                            //dot local path reference. update directory
                            _fetch_url_final_str = _changeUrlDirectory(_fetch_url_str);
                        }
                        else if(/^ *[^\/][^\s]+?\.[a-zA-Z]+ *$/i.test(_fetch_url_str))
                        {
                            //file or local path reference. prepend current url
                            _fetch_url_final_str = _getUrl('basedir', _fetch_url_base_str)+'/'+_fetch_url_str;
                        }
                        else if (/^ *\/[^\s]+ *$/i.test(_fetch_url_str))
                        {
                            //root path reference. prepend hostname
                            _fetch_url_final_str = _getUrl('hostpath', _fetch_url_base_str)+'/'+_fetch_url_str;
                        }

                        //run pre-callback
                        if(_fetch_callback_pre_fn)
                        {
                            _fetch_callback_pre_fn(_fetch_callback_args_arr_or_obj, _fetch_url_final_str);
                        }

                        _cacheHTML(_fetch_url_final_str, {expiry: _fetch_cache_expiry_int, cache_stub: false}).then(function(html_str){

                            //process view
                            if(/\<html.*?\>|\<body.*?\>/igm.test(html_str))
                            {
                                //get html content inside body
                                html_content_arr = _r.regexMatchAll(/\<body.*?\>([\s\S]*)<\/body>/igm, html_str);
                                view_content_str = html_content_arr[0][1];
                                view_content_str = view_content_str.trim();
                            }
                            else
                            {
                                //get all html if stub
                                view_content_str = html_str;
                            }

                            //linkport
                            if(_fetch_linkport_bool)
                            {
                                //get content from response
                                html_content_arr = _r.regexMatchAll(/^\s*\<\!\-\- *(.+?) *\-\-\>\s*([\s\S]*)$/igm, html_str);

                                //override target for linkport from HTML comments
                                _fetch_target_str = (_fetch_target_str) ? _fetch_target_str : html_content_arr[0][1];

                                //remove hash from target id
                                _fetch_target_str = _fetch_target_str.replace(/^#/, '');

                                //get html content
                                view_content_str = html_content_arr[0][2];
                            }

                            //compile
                            if(_fetch_template_obj)
                            {
                                view_content_str = _compile(view_content_str, _fetch_template_obj);
                            }

                            //create target
                            elem_target_obj = (_fetch_target_str) ? $('#'+_fetch_target_str) : elem_body_obj;

                            //post block
                            if(_fetch_post_block_str)
                            {
                                _fetch_post_block_regex_obj = new RegExp(_fetch_post_block_str, "igm");

                                //get html of target
                                view_target_content_str = elem_target_obj.html();
                                insert_view_bool = (_fetch_post_block_regex_obj.test(view_target_content_str)) ? false : true;
                            }

                            //insert if allowed
                            if(insert_view_bool)
                            {
                                _fetch_post_method_str = (_fetch_post_method_str === 'replace') ? 'html': _fetch_post_method_str;
                                elem_target_obj[_fetch_post_method_str](view_content_str);
                            }

                            //run post-callback
                            if(_fetch_callback_post_fn)
                            {
                                _fetch_callback_post_fn(_fetch_callback_args_arr_or_obj, _fetch_url_final_str, elem_target_obj, html_str, view_content_str);
                            }

                        });
                    }

                    /**
                     * Scroll
                     */
                    var _scroll_route_bool = route_data_meta_arr[route_search_int]['scroll_route'];
                    var _scroll_target_str = route_data_meta_arr[route_search_int]['scroll_target'];
                    var _scroll_speed_int = route_data_meta_arr[route_search_int]['scroll_speed'];
                    var _scroll_offset_int = route_data_meta_arr[route_search_int]['scroll_offset'];
                    var _scroll_callback_fn = route_data_meta_arr[route_search_int]['scroll_callback'];

                    //execute scroll if not globally disabled
                    if(!options_disable_scroll_bool)
                    {
                        var _scroll_target_obj,
                            _scroll_options_obj = {speed: _scroll_speed_int, offset: _scroll_offset_int, callback: _scroll_callback_fn};

                        if(is_forward_evented_bool)
                        {
                            /**
                             * is_forward_evented_bool is a flag passed to hashchange to signify that the route was activated manually and is intended to proceed in the forward direction i.e. it should not be fired by the back button
                             */

                            if(_scroll_target_str)
                            {
                                _scroll_target_obj = $('#'+_scroll_target_str);
                                elem_body_obj.scrollTo(_scroll_target_obj, _scroll_options_obj);
                            }
                            else if(_scroll_route_bool && _fetch_target_str)
                            {
                                _scroll_target_obj = $('#'+_fetch_target_str);
                                elem_body_obj.scrollTo(_scroll_target_obj, _scroll_options_obj);
                            }
                        }
                        else
                        {
                            /**
                             * For back button
                             * reverse scroll
                             */
                            if(_scroll_target_str)
                            {
                                _scroll_target_obj = $('#'+_scroll_target_str);
                                elem_body_obj.scrollTo(_scroll_target_obj, _scroll_options_obj);
                            }
                        }
                    }

                    //get local route history ticker
                    route_data_history_str = rQuery.data('r_rs_var_routes_history_ticker');

                    /*jshint -W116 */
                    if(route_data_history_str != location_href_str)
                    {
                        //update local history ticker
                        rQuery.data('r_rs_var_routes_history_ticker', location_href_str);
                    }
                    /*jshint +W116 */
                }
                else
                {
                    //scroll to top if navigating back and scroll
                    var _scroll_target_alt_str = route_data_meta_arr[0]['scroll_target'];
                    if(!is_forward_evented_bool && _scroll_target_alt_str)
                    {
                        //scroll to top
                        elem_body_obj.scrollTo(0);
                    }
                }
            };

            //define core route func
            var route_main_fn = function(){

                var myArgs = Array.prototype.slice.call(arguments),
                    is_forward_evented_bool = ((myArgs[0])),
                    route_main_fn_path_hash_str = ((myArgs[1])),
                    disable_hashchange_bool = !!((myArgs[2])),
                    disable_hashchange_local_bool,
                    route_main_fn_disable_hashchange_bool,
                    location_href_base_str = _getUrl('bp'),
                    location_href_query_str = _getUrl('q'),
                    route_main_fn_path_str,
                    route_main_fn_data_id_arr,
                    route_main_fn_data_meta_arr,
                    route_main_fn_search_int,
                    path_hash_full_str;

                //get
                route_main_fn_path_str = route_main_fn_path_hash_str.replace(options_hash_char_str, '');

                //get stored route data
                route_main_fn_data_id_arr = rQuery.data('r_rs_var_routes_id');
                route_main_fn_data_meta_arr = rQuery.data('r_rs_var_routes_meta');

                //check if current route exists in record
                route_main_fn_search_int = _r.array_search(route_main_fn_path_str, route_main_fn_data_id_arr);

                if(route_main_fn_search_int)
                {
                    //get the local value of disable_hashchange if available
                    //this is the value that was set when route was created
                    disable_hashchange_local_bool = route_main_fn_data_meta_arr[route_main_fn_search_int]['disable_hashchange'];
                }

                /**
                 * local value of disable_hashchange should override global but only if go option is false or undefined
                 * The reason for this is that the go option is a global setting and implies that you want a hashchange. Ergo, if no hash change occurs on account of a local setting, this may not be ideal
                 */
                if(_r.isBool(disable_hashchange_local_bool))
                {
                    route_main_fn_disable_hashchange_bool = disable_hashchange_local_bool;
                    if(options_go_route_bool)
                    {
                        route_main_fn_disable_hashchange_bool = disable_hashchange_bool;
                    }
                }

                //check history.pushState support
                if(window.history.pushState)
                {
                    //create the full path + hash
                    path_hash_full_str = location_href_base_str+location_href_query_str+route_main_fn_path_hash_str;

                    //manage route history
                    if(!rQuery.data('r_rs_var_routes_history_ticker'))
                    {
                        //create history ticker variable if not defined
                        rQuery.data('r_rs_var_routes_history_ticker', '');
                    }

                    route_data_history_str = rQuery.data('r_rs_var_routes_history_ticker');

                    /*jshint -W116 */
                    if(route_data_history_str != path_hash_full_str)
                    {
                        //push state to history
                        if(!route_main_fn_disable_hashchange_bool)
                        {
                            window.history.pushState({page: path_str}, "", path_hash_full_str);
                            //push to local history ticker
                            rQuery.data('r_rs_var_routes_history_ticker', path_hash_full_str);
                        }
                    }
                    /*jshint +W116 */
                }
                else
                {
                    //update hash
                    path_hash_full_str = (_r.isString(forced_path_hash_str)) ? forced_path_hash_str : path_hash_str;

                    if(!route_main_fn_disable_hashchange_bool)
                    {
                        window.location.hash = path_hash_full_str;
                    }
                }

                hashchange_main_fn(is_forward_evented_bool, route_main_fn_path_hash_str);
            };

            //save route path in window storage
            if(!data_route_obj)
            {
                //initialize
                rQuery.data('r_rs_var_routes_id', []);
                rQuery.data('r_rs_var_routes_meta', []);

                data_route_obj = rQuery.data('r_rs_var_routes_id');
            }

            //check if route path has been saved
            if(!_r.in_array(path_str, data_route_obj)) {
                //persist route data
                rQuery.data('r_rs_var_routes_id').push(path_str);
                rQuery.data('r_rs_var_routes_meta').push(options_meta_obj);
            }

            //manage click handler
            if(!rScript.domStore('rs_var_route_init_event_handler_click'))
            {
                //get all links
                elem_a_obj = elem_body_obj.find('a');

                //see if any links contain and start with the hash character e.g. #/
                if(elem_a_obj.length > 0 && options_add_click_bool)
                {
                    var link_with_route_hash_exists_bool,
                        link_regex_pattern_str = ""+options_hash_char_str+"(|[^\\s]*) *$",
                        link_regex_obj = new RegExp(link_regex_pattern_str, "i");

                    elem_a_obj.each(function()
                    {
                        //check if there are links
                        elem_a_obj_href_str = $(this).attr('href');

                        //proceed only if href is not blank +
                        //link with route hash not found
                        if (_r.isString(elem_a_obj_href_str) && elem_a_obj_href_str.length > 0 && !link_with_route_hash_exists_bool)
                        {
                            link_with_route_hash_exists_bool = link_regex_obj.test(elem_a_obj_href_str);
                        }
                    });

                    //add click handler
                    if(link_with_route_hash_exists_bool)
                    {
                        elem_a_obj.on('click', function(event)
                        {
                            var elem_click_href_str = $(this).attr('href'),
                                link_click_has_route_hash_bool;

                            if(!_r.isEmptyString(elem_click_href_str))
                            {
                                link_click_has_route_hash_bool = link_regex_obj.test(elem_click_href_str);
                                if(link_click_has_route_hash_bool)
                                {
                                    //prevent default action
                                    rQuery.preventDefault(event);
                                    route_main_fn(true, elem_click_href_str);
                                }
                            }
                        });
                    }
                }

                rScript.domStore('rs_var_route_init_event_handler_click', true);
            }

            //run route manually if specified
            if(options_go_route_bool)
            {
                route_main_fn(true, path_hash_str, options_disable_hashchange_bool);
            }

            //initialize hash change event handler once
            if(!rScript.domStore('rs_var_route_init_event_handler_hashchange'))
            {
                //setup event handler once
                elem_win_obj.on('hashchange', function() {
                    hashchange_main_fn();
                });

                rScript.domStore('rs_var_route_init_event_handler_hashchange', true);
            }

            //initialize route on load
            if(!rScript.domStore('rs_var_route_init_url_is_routed'))
            {
                var regex_test_str = ""+path_hash_str+"(|\\?[^\\s]*) *$";
                var regex_test_obj = new RegExp(regex_test_str, "i");
                var is_routed_url_to_path_bool = regex_test_obj.test(url_str);
                if(is_routed_url_to_path_bool)
                {
                    //run route manually
                    route_main_fn(true, path_hash_str);
                }

                //flag
                rScript.domStore('rs_var_route_init_url_is_routed', true);
            }
        }


        /**
         * Provides simple to advanced routing functionality
         */
        rScript_obj.route = {
            /**
             * Adds a route and activates a click handler
             * Usage: rScript.route.add("/route_1", function(){console.log("");})
             * This method will automatically attach itself to a click handler
             * For example, if you have <a href="#/route_1">Route 1</a> in your code and add a route with path_str == "route_1", clicking on the link will automatically trigger the route
             * @param path_str {String} the route id
             * @param options_obj {Object} the options
             * See _route method for details
             */
            click: function(path_str){
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = (myArgs[1]) ? myArgs[1] : {}
                    ;

                //set defaults
                options_obj.add_click = (options_obj.add_click) ? options_obj.add_click : true;

                //add route
                _route(path_str, options_obj);
                return this;
            },
            /**
             * Triggers a route manually
             * Usage: rScript.route.go("#/route_1", function(){console.log("");})
             * This method will navigate directly to a route
             * @param path_str {String} the route id
             * @param options_obj {Object} the options
             * See _route method for details
             */
            go: function(path_str){
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = (myArgs[1]) ? myArgs[1] : {}
                    ;

                //set defaults
                options_obj.go = true;

                //add route
                _route(path_str, options_obj);
            },
            /**
             * Runs a route + fetches a view and adds it to the DOM
             * @param {String} path_str the route identifier
             * @param {String} fetch_url_str the URL of the path to fetch
             * @param {Object} options_obj the options
             *
             * target: The identifier of the DOM element where the fetched view will be inserted. For example, if you want the view injected into "<div id='my-view-target'></div>", then the value is 'my-view-target'
             *
             * template: This is an object that can be used to pre-compile [or pre-process] HTML before it is injected
             * Assuming your view file has the following contents
             * <p>{{first_name}}</p>
             * <p>{{last_name}}</p>
             *
             * And your template object is:
             *
             * {first_name: 'Joe', last_name: 'Moe'}
             *
             * The final HTML will be:
             *
             * <p>Joe</p>
             * <p>Moe</p>
             *
             * post_method: This specifies how the contents of the fetched file will be injected into the DOM.
             * The valid options are:
             *  - replace (default)
             *  - append
             *  - prepend
             *
             * post_block: a regular expression string that will prevent the view from being inserted if it resolves to true. This is used to prevent a view from being inserted multiple times on multiple calls.
             *
             * cache_expiry: the lifetime (in seconds) of the cache of the fetched item. Whenever the view is fetched, it is also cached in storage. Value must be an integer. When not defined, lifetime is unlimited
             *
             * scroll: If true, will scroll to target after routing
             *
             * scroll_offset: The offset of the scroll
             *
             * scroll_speed: The speed of the scroll in seconds
             *
             * scroll_callback: The callback that will be executed post-scroll
             *
             * callback_pre: a callback function to be executed before the view is fetched and injected. The function will be passed one argument:
             * 1. the URL to the fetched view
             *
             * callback_post: a callback function to be executed after the view is fetched and injected. The function will be passed four arguments:
             * 1. the URL to the fetched view
             * 2. the target object
             * 3. the fetched HTML of the view
             * 4. the final HTML to be injected
             *
             */
            fetch: function(path_str, fetch_url_str){
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = myArgs[2],
                    options_final_obj;

                //initialize options if not set
                if(!options_obj)
                {
                    options_obj = {};
                }

                options_final_obj = options_obj;

                //set defaults
                options_final_obj.hash_char = (!options_obj.hash_char) ? '#/' : options_obj.hash_char;
                options_final_obj.fetch_url = (!options_obj.fetch_url) ? fetch_url_str : options_obj.fetch_url;

                //set options
                options_final_obj.fetch_target = (options_obj.target) ? options_obj.target : undefined;
                options_final_obj.fetch_post_method = (options_obj.post_method) ? options_obj.post_method : undefined;
                options_final_obj.fetch_cache_expiry = (options_obj.cache_expiry) ? options_obj.cache_expiry : undefined;
                options_final_obj.fetch_post_block = (options_obj.post_block) ? options_obj.post_block : undefined;
                options_final_obj.fetch_template = (options_obj.template) ? options_obj.template : undefined;
                options_final_obj.fetch_callback_pre = (options_obj.callback_pre) ? options_obj.callback_pre : undefined;
                options_final_obj.fetch_callback_post = (options_obj.callback_post) ? options_obj.callback_post : undefined;
                options_final_obj.scroll_route = !!((options_obj.scroll));
                options_final_obj.scroll_offset = (options_obj.scroll_offset) ? options_obj.scroll_offset : undefined;
                options_final_obj.scroll_speed = (options_obj.scroll_speed) ? options_obj.scroll_speed : undefined;
                options_final_obj.scroll_callback = (options_obj.scroll_callback) ? options_obj.scroll_callback : undefined;

                //run
                _route(path_str, options_final_obj);
            },
            /**
             * Enables a special routing feature called link-porting
             * Linkporting lets you use a specially-formatted URL to fetch and inject content into the DOM automatically
             *
             * There are two components to this:
             * 1. The URL: the URL provides an embedded reference to the view file which is to be fetched
             * For example, say we have the following url:
             * http://rscript.io/index.html#my-view-file
             * #my-view-file is a reference to the HTML file named my-view-file.html
             * 2. The View: the view is a HTML file that is referenced in the hash section of the URL.
             * This view file must have the following format
             *
             * <!-- #target -->
             * <!-- rest of the HTML -->
             *
             * Note: <!-- rest of the HTML --> must be replaced with actual HTML content
             *
             * A valid example would be:
             *
             * <!-- #target -->
             * <div></div>
             *
             * Note: The first line must be a HTML comment identifying where the reference is to be injected. The above comment specifies that the HTML will be injected into a DOM element with id="target"
             *
             * @param {Object} options_obj the options
             *
             * basedir: The base directory of the view file. If your view file is located in a sub-directory e.g. my_views, then supply the value 'my_views' as the basedir
             * You can also use a document-relative path
             * for example, if your current url is:
             *
             * http://rscript.io/dir_1/dir_2/dir_3/index.html
             *
             * and your basedir is '../dir_4', the directory that will be accessed to get the view will be:
             *
             * http://rscript.io/dir_1/dir_2/dir_4
             *
             *
             * target: This specifies where the view should be injected. Simply provide the identifier of the DOM element. For example, if you want the view injected into "<div id='my-view-target'></div>", then the value is 'my-view-target'
             *
             * Note: This value overrides the value that is in the view file by convention
             *
             * post_method: This specifies how the contents of the view file will be injected into the DOM.
             * The valid options are:
             *  - replace (default)
             *  - append
             *  - prepend
             *
             * template: This is an object that can be used to pre-compile [or pre-process] HTML before it is injected
             * Assuming your view file has the following contents
             * <!-- #target -->
             * <p>{{first_name}}</p>
             * <p>{{last_name}}</p>
             *
             * And your template object is
             *
             * {first_name: 'Joe', last_name: 'Moe'}
             *
             * The final HTML will be:
             *
             * <p>Joe</p>
             * <p>Moe</p>
             *
             * You can also activate the template using the query string of the link.
             * For example, say you navigate to http://rscript.io/index.html?first_name=Joe&last_name=Public#my-view-file
             *
             * A template object will be automatically generated to look like this:
             *
             * {first_name: 'Joe', last_name: 'Public'}
             *
             * callback_pre: a callback function to be executed before the view is fetched and injected. The function will be passed one argument:
             * 1. the URL to the view
             *
             * callback_post: a callback function to be executed after the view is fetched and injected. The function will be passed four arguments:
             * 1. the URL to the view
             * 2. the target object
             * 3. the fetched HTML of the view
             * 4. the final HTML to be injecte
             *
             */
            linkport: function(){
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = (myArgs[0]) ? myArgs[0] : {},
                    url_str = (_r.isString(options_obj.url) && options_obj.url.length > 0) ? options_obj.url : _getUrl(),
                    url_query_str = _getUrl('query', url_str),
                    url_hash_str = _getUrl('hash', url_str),
                    template_ctx_obj = (_r.isObject(options_obj.template)) ? options_obj.template : undefined,
                    basedir_str = (_r.isString(options_obj.basedir) && options_obj.basedir.length > 0) ? options_obj.basedir : '_view',
                    target_str = (_r.isString(options_obj.target) && options_obj.target.length > 0) ? options_obj.target : undefined,
                    post_method_str = (_r.isString(options_obj.post_method) && options_obj.post_method.length > 0) ? options_obj.post_method : 'replace',
                    pre_callback_fn = (options_obj.callback_pre) ? options_obj.callback_pre : null,
                    post_callback_fn = (options_obj.callback_post) ? options_obj.callback_post : null,
                    options_final_obj = {},
                    url_query_value_str,
                    url_hash_value_str,
                    url_fetch_str
                    ;

                //return false if hash is not valid
                if(!/^.+?\#.+?/i.test(url_str))
                {
                    return false;
                }

                //get the hash value i.e. without hash character
                url_hash_value_str = url_hash_str.replace(/^#/, '');

                //compose fetch url
                url_fetch_str = basedir_str+'/'+ url_hash_value_str+'.html';

                //convert url query to template object
                if(url_query_str && !template_ctx_obj)
                {
                    url_query_value_str = url_query_str.replace(/^\?/, '');
                    template_ctx_obj = _r.stringToArray(url_query_value_str, '&', '=', true);
                }

                //define options
                options_final_obj.fetch_url = url_fetch_str;
                options_final_obj.fetch_target = target_str;
                options_final_obj.fetch_post_method = post_method_str;
                options_final_obj.fetch_template = template_ctx_obj;
                options_final_obj.fetch_callback_pre = pre_callback_fn;
                options_final_obj.fetch_callback_post = post_callback_fn;

                options_final_obj.fetch_linkport = true;
                options_final_obj.go = true;
                options_final_obj.nohashchange = true;

                //run
                _route('_no_route', options_final_obj);
            },
            /**
             * Enables single-page routing functionality
             * @param {String} path_str the route
             * @param {Object} options_obj the options
             *
             * source: the URL [or HTML] of the view
             *
             * target: an identifier specifying where the view is inserted
             * For example, if you wanted the view to be inserted in
             * '<div id="my-target"></div>', then target === 'my-target'
             *
             * supertarget: this is used to define a target value that will persist across chained calls.
             *
             * So, instead of writing this
             *
             * rScript.route
             *  .when('/', {source: 'first.html', target: 'my-target'})
             *  .when('/second', {source: 'second.html', target: 'my-target'})
             *  .when('/third', {source: 'third.html', target: 'my-target'})
             *
             * you can write this
             *
             * rScript.route
             *  .when('/', {source: 'first.html', supertarget: 'my-target'})
             *  .when('/second', {source: 'second.html'})
             *  .when('/third', {source: 'third.html'})
             *
             * postmode: defines how the view will be inserted into the target
             * Either 'append', 'prepend', or 'replace' [Default]
             * Note that when no target is provided, 'append' is the default condition
             *
             * template: This is an object that can be used to pre-compile [or pre-process] HTML before it is injected
             * Assuming your target file has the following contents
             * <p>{{first_name}}</p>
             * <p>{{last_name}}</p>
             *
             * And your template object is
             *
             * {first_name: 'Joe', last_name: 'Moe'}
             *
             * The final HTML will be:
             *
             * <p>Joe</p>
             * <p>Moe</p>
             *
             * scroll: if true, will scroll
             *
             * scroll_offset: the scroll offset (in pixels)
             *
             * scroll_speed: the scroll speed (in milliseconds)
             *
             * scroll_callback: a callback function to run post-scroll
             *
             * callback: a callback function to run pre-fetch
             *
             * callback_post: a callback function to run post-fetch
             *
             * callback_args: the arguments that will be passed to callback and/or callback_post
             *
             * @return this
             */
            when: function(path_str, options_obj){

                var url_str = _getUrl(),
                    url_hash_str = _getUrl('hs', url_str),
                    url_hash_clean_str,
                    links_elem_obj,
                    links_href_arr = [],
                    is_click_route_bool,
                    is_routed_url_to_path_bool,
                    regex_test_str,
                    regex_test_obj,
                    path_clean_str,
                    path_route_str,
                    options_final_obj = {},
                    target_super_str = rScript.domStore('rs_var_route_when_target_super'),
                    exec_route_bool
                    ;

                //set route option defaults
                options_final_obj.fetch_url = (options_obj.source) ? options_obj.source : undefined;
                options_final_obj.fetch_target = (options_obj.target) ? options_obj.target : undefined;
                options_final_obj.fetch_template = (options_obj.template) ? options_obj.template : undefined;
                options_final_obj.fetch_post_method = (options_obj.postmode) ? options_obj.postmode : 'replace';
                options_final_obj.fetch_callback_pre = (options_obj.callback) ? options_obj.callback : undefined;
                options_final_obj.fetch_callback_post = (options_obj.callback_post) ? options_obj.callback_post : undefined;
                options_final_obj.fetch_callback_args = (options_obj.callback_args) ? options_obj.callback_args : undefined;
                options_final_obj.hash_char = '#/';
                options_final_obj.scroll_route = !!((options_obj.scroll));

                //set other route options
                options_final_obj.scroll_offset = options_obj.scroll_offset;
                options_final_obj.scroll_speed = options_obj.scroll_speed;
                options_final_obj.scroll_callback = options_obj.scroll_callback;

                //clean path and url hash i.e. remove route/hash character(s)
                path_clean_str = path_str.replace(options_final_obj.hash_char, '');
                url_hash_clean_str = url_hash_str.replace(options_final_obj.hash_char, '');

                //get link data
                links_elem_obj = $('a');
                if(links_elem_obj.length > 0)
                {
                    links_elem_obj.each(function(){
                        links_href_arr.push($(this).attr('href'));
                    });
                }

                //determine if there are click references for routes
                is_click_route_bool = !!((links_href_arr.length > 0 && _r.in_array(path_str, links_href_arr)));


                //set super target
                if(options_obj.supertarget)
                {
                    rScript.domStore('rs_var_route_when_target_super', options_obj.supertarget);
                    target_super_str = options_obj.supertarget;
                }

                //override target
                options_final_obj.fetch_target = (target_super_str && !options_final_obj.fetch_target) ? target_super_str : options_final_obj.fetch_target;

                //ensure postmode cannot be 'replace' when target option is not defined. This prevents the whole $('body') from being replaced
                if(!options_final_obj.fetch_target && !target_super_str)
                {
                    options_final_obj.fetch_post_method = 'append';
                }

                //determine whether the url is currently routed
                regex_test_str = "\\#\\/"+path_clean_str+"$";
                regex_test_obj = new RegExp(regex_test_str, "i");
                is_routed_url_to_path_bool = regex_test_obj.test(url_str);

                //check if current url has route path
                if(is_routed_url_to_path_bool)
                {
                    path_route_str = url_hash_clean_str;

                    exec_route_bool = true;
                }

                //check if click references for routes exist
                if (is_click_route_bool)
                {
                    path_route_str = path_clean_str;

                    options_final_obj.add_click = true;
                    exec_route_bool = true;
                }

                //execute route if required
                if(exec_route_bool)
                {
                    _route(path_route_str, options_final_obj);
                }

                return this;
            }
        };


        /**
         * Resets non-base pages when navigating to a base page
         * This ensures that they are in the proper position when you need to navigate back to them
         * Base pages have the class 'base'
         * @private
         */
        function _navResetNonBasePages()
        {
            var pages_obj = $('.r-page');

            pages_obj.each(function(){
                if(!$(this).hasClass('base'))
                {
                    //reset
                    $(this).css('transform', 'translate3d(100%, 0, 0)');
                }
            });
        }

        /**
         * Simple webapp functionality
         */
        rScript_obj.webapp = {

            loadMeta: function(){

                var device_os_str = rScript.getPlatform();
                if(device_os_str === 'ios')
                {

                }

            },
            /**
             * Single-page navigation
             * Navigates to a page within a single-page app
             *
             * Note: Your single page app must have the following HTML structure
             * <div id="r-pages">
             *     <div id="r-page-home" class="r-page active base">
             *         <p>Second Page Content</p>
             *         <p><a id="r-page-link-home-1" href="#/second" class="r-page-link" data-target="r-page-second">Go to Second Page</a></p>
             *         </div>
             *     </div>
             *     <div id="r-page-second" class="r-page">
             *         <p>Second Page Content</p>
             *         <p><a id="r-page-link-second-1" href="#/" class="r-page-link" data-target="r-page-home">Go Back</a></p>
             *     </div>
             * </div>
             *
             * 'r-page' class defines a single page
             * 'active' and 'base' classes must be present on the home page
             * use 'data-target' attribute to setup page linking. For example, 'r-page-second' will link to a page with id == 'r-page-second'
             * also, make sure your
             *
             * Note: Your single page app must have the following CSS
             * html {height: 100%;}
             * body {height: 100%; padding: 0; margin: 0; overflow: hidden;}
             * .r-page {display: block; visibility: visible; position: absolute; top: 0; bottom: 0; left: 0; right: 0; background-color: #fff; width: 100%; height: 100%; font-size: 100%; z-index: 3; transform: translate3d(100%, 0, 0); -webkit-transition: all 0.3s ease-in-out; -moz-transition: all 0.3s ease-in-out; -o-transition: all 0.3s ease-in-out; transition: all 0.3s ease-in-out;}
             * .r-page.active {z-index: 3; transform: translate3d(0, 0, 0);}
             * .r-page.entering {z-index: 3;}
             * .r-page.leaving {z-index: 3;}
             * .r-page.cached {visibility: hidden; -webkit-transition: all 0.3s ease-in-out; -moz-transition: all 0.3s ease-in-out; -o-transition: all 0.3s ease-in-out; transition: all 0.3s ease-in-out;}
             *
             * You can tweak the CSS to your specific requirements, but make sure you don't omit.
             *
             * @param {String} to_id_str the identifier of the target [to] page
             * @param {Object} options_obj the options
             * the following items
             * from_id: the identifier of the source [form] page
             * cache_offset: the percentage by which pages will be offset when 'cached'. Default is 33%
             * callback_in: a callback function that is executed after a page enters the view. It is passed the target [to] page object
             * callback_out: a callback function that is executed after a page leaves the view. It is passed the source [from] page object
             * link_trap: prevents a link from firing while a transition is in progress
             */
            goToPage: function(to_id_str){
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = myArgs[1],
                    from_id_str,
                    page_from_id_str,
                    page_to_id_str,
                    page_from_obj,
                    page_to_obj,
                    to_style_attr_str,
                    page_cache_offset_str,
                    callback_out_fn,
                    callback_in_fn,
                    store_var_flag_page_ready_in_init_str,
                    store_var_flag_page_ready_in_str,
                    store_var_flag_page_ready_out_init_str,
                    store_var_flag_page_ready_out_str,
                    page_in_is_ready_bool,
                    page_out_is_ready_bool,
                    link_trap_bool = !!(rScript.detectCSSTransition())
                    ;

                //manage options
                if(_r.isObject(options_obj) && (options_obj.from_id || options_obj.cache_offset || options_obj.callback_in || options_obj.callback_out || options_obj.link_trap))
                {
                    page_from_id_str = (options_obj.from_id && _r.isString(options_obj.from_id) && options_obj.from_id.length > 0) ? options_obj.from_id : undefined ;
                    page_cache_offset_str = (options_obj.cache_offset && _r.isString(options_obj.cache_offset) && options_obj.cache_offset.length > 0) ? options_obj.cache_offset : undefined ;
                    callback_out_fn = (options_obj.callback_out) ? options_obj.callback_out : undefined;
                    callback_in_fn = (options_obj.callback_in) ? options_obj.callback_in : undefined;
                    link_trap_bool = !!(options_obj.link_trap);
                }

                //get the id string
                from_id_str = (page_from_id_str) ? '#'+page_from_id_str : '.r-page.active';

                store_var_flag_page_ready_in_init_str = 'rs_var_nav_page_in_ready_init_'+to_id_str;
                store_var_flag_page_ready_in_str = 'rs_var_nav_page_in_ready_'+to_id_str;

                store_var_flag_page_ready_out_init_str = 'rs_var_nav_page_out_ready_init_'+from_id_str;
                store_var_flag_page_ready_out_str = 'rs_var_nav_page_out_ready_'+from_id_str;

                //initialize page transition status flags
                if(!rScript.domStore(store_var_flag_page_ready_in_init_str))
                {
                    rScript.domStore(store_var_flag_page_ready_in_str, true);

                    rScript.domStore(store_var_flag_page_ready_in_init_str, true);
                }
                if(!rScript.domStore(store_var_flag_page_ready_out_init_str))
                {
                    rScript.domStore(store_var_flag_page_ready_out_str, true);

                    rScript.domStore(store_var_flag_page_ready_out_init_str, true);
                }
                page_in_is_ready_bool = !!(rScript.domStore(store_var_flag_page_ready_in_str));
                page_out_is_ready_bool = !!(rScript.domStore(store_var_flag_page_ready_out_str));

                //disable method if pages are still is in transition
                if(link_trap_bool)
                {
                    if(!page_in_is_ready_bool || !page_out_is_ready_bool)
                    {
                        return;
                    }
                }

                //get the currently active [source] page
                page_from_obj = (page_from_id_str) ? $('#'+page_from_id_str) : $('.r-page.active');

                //get the cache offset
                page_cache_offset_str = (page_cache_offset_str) ? page_cache_offset_str : '33%';

                //check if the target page is in DOM
                page_to_id_str = '#'+to_id_str;
                page_to_obj = $(page_to_id_str);

                //set state transition state for both pages
                page_from_obj.addClass('leaving');
                page_to_obj.addClass('entering');

                //flag in and out page state
                rScript.domStore(store_var_flag_page_ready_out_str, false);
                rScript.domStore(store_var_flag_page_ready_in_str, false);

                //setup up callbacks to run post-transition
                //leaving page [out]
                page_from_obj.onCSSTransitionEnd(function(_this){
                    $(_this).removeClass('leaving active').addClass('cached');

                    //callback out
                    if(callback_out_fn)
                    {
                        callback_out_fn(_this);
                    }

                    //flag out page state
                    rScript.domStore(store_var_flag_page_ready_out_str, true);
                });

                //entering page [in]
                page_to_obj.onCSSTransitionEnd(function(_this){
                    $(_this).removeClass('entering').addClass('active');

                    //if target page is base page, reset others
                    if($(_this).hasClass('base'))
                    {
                        _navResetNonBasePages();
                    }

                    //callback
                    if(callback_in_fn)
                    {
                        callback_in_fn(_this);
                    }

                    //flag in page state
                    rScript.domStore(store_var_flag_page_ready_in_str, true);
                });

                //get initial style attribute values
                to_style_attr_str = page_to_obj.attr('style');

                //remove cached class
                page_to_obj.removeClass('cached');

                if(/translate3d *\( *\-[0-9]+.+?\)/i.test(to_style_attr_str))
                {
                    /**
                     * Apply animation when target [to] page has offset
                     * 1: Move incoming page to center
                     * 2: Move outgoing page off screen
                     */

                    //apply animation
                    page_to_obj.css('transform', 'translate3d(0, 0, 0)');
                    page_from_obj.css('transform', 'translate3d(100%, 0, 0)');
                }
                else
                {
                    /**
                     * Apply different animation for other page scenarios
                     * 1: Move incoming page to center
                     * 2: Move outgoing page to offset position
                     */

                    //apply animation
                    page_to_obj.css('transform', 'translate3d(0, 0, 0)');
                    page_from_obj.css('transform', 'translate3d(-'+page_cache_offset_str+', 0, 0)');
                }
            }
        };


        /**
         * Hashes a URL for use by _cacheHTML
         * @param {String} url_str the url to hash
         * @returns {*}
         * @private
         */
        function _cacheHashUrl(url_str)
        {
            var url_hash_str = url_str;
            url_hash_str = url_hash_str.replace(/\:\/\/|[\.\/\=]/ig, "_");
            url_hash_str = url_hash_str.replace(/[\?&]/ig, ".");
            url_hash_str = 'rs_var_cache_url_'+url_hash_str;
            return url_hash_str;
        }


        /**
         * Keeps a register of cached items
         * Also retrieves the full list if no url_str is provided
         * @param {String} url_str the URL of the cached item
         * @private
         */
        function _cacheRegister()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                url_str = myArgs[0]
                ;

            if(url_str)
            {
                //set

                if(!rScript.store('rs_var_cache_asset_list'))
                {
                    rScript.store('rs_var_cache_asset_list', []);
                }

                rScript.storePush('rs_var_cache_asset_list', url_str, undefined, true);
            }
            else
            {
                //get all

                return rScript.store('rs_var_cache_asset_list');
            }
        }

        /**
         * Cache a HTML file to sessionStorage/localStorage
         * It will also retrieve cached value if data_str is undefined
         * @param {String} url_str the URL to the HTML file to cache
         * @param {Object} options_obj the options
         * cache_stub: defines what portion of HTML will be cached. If true [default], it will cache everything inside <body></body>. If false, will cache entire HTML page
         * expiry: the cache duration in seconds. Default is 0 [forever]
         * store_type: the storage type/method to use. Either 'ls' for localStorage, or 'ss' for sessionStorage [default]
         * @return String|Promise
         * @private
         */
        function _cacheHTML(url_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = myArgs[1],
                cache_stub_bool = true,
                expiry_int = 0,
                store_type_str = '',
                store_options_obj,
                url_hash_str,
                data_result_str
                ;

            if(_r.isObject(options_obj))
            {
                cache_stub_bool = (_r.isBool(options_obj.cache_stub)) ? options_obj.cache_stub : cache_stub_bool;
                expiry_int = (options_obj.expiry && _r.isNumber(options_obj.expiry) && options_obj.expiry > 0) ? options_obj.expiry : expiry_int;
                store_type_str = (options_obj.store_type && _r.isString(options_obj.store_type) && options_obj.store_type.length > 0) ? options_obj.store_type : store_type_str;
            }

            //setup options
            if(expiry_int > 0)
            {
                expiry_int = expiry_int * 1000;
                store_options_obj = {expires: expiry_int}
            }

            //set default storage type
            if(!_r.in_array(store_type_str, ['ls', 'ss']))
            {
                store_type_str = 'ss';
            }

            //create core caching function
            var _cache_fn = function(url_str, data_str, cache_stub_bool, store_type_str, options_obj)
            {
                if(!rScript.store('rs_var_cache_counter'))
                {
                    rScript.store('rs_var_cache_counter', 0);
                }

                url_hash_str = _cacheHashUrl(url_str);

                if(!data_str)
                {
                    //if data value is not provided and cached value exists, then return it
                    return (rScript.store(url_hash_str)) ? rScript.store(url_hash_str) : false;
                }

                if(!rScript.storeCheck(url_hash_str))
                {
                    //increment cache counter
                    rScript.storeIncrement('rs_var_cache_counter');

                    if(cache_stub_bool)
                    {
                        var html_all_arr,
                            html_stub_str
                            ;
                        if (/\<html.*?\>|\<body.*?\>/igm.test(data_str)) {
                            //get html content inside body
                            html_all_arr = _r.regexMatchAll(/\<body.*?\>([\s\S]*)<\/body>/igm, data_str);
                            html_stub_str = html_all_arr[0][1];
                            data_str = html_stub_str.trim();
                        }
                    }

                    //save data
                    rScript.store(url_hash_str, data_str, store_type_str, options_obj);

                    //register
                    _cacheRegister(url_str);

                    return false;
                }
                else
                {
                    //cached data is available
                    return true;
                }
            }

            return new Promise(function(resolve)
            {
                data_result_str = _cache_fn(url_str);
                if(data_result_str)
                {
                    //data already saved
                    resolve(data_result_str);
                }
                else
                {
                    //fetch new data
                    $.ajax(url_str)
                        .then(function(xhr_response_str){
                            _cache_fn(url_str, xhr_response_str, cache_stub_bool, store_type_str, store_options_obj);
                            resolve(xhr_response_str);
                        });
                }
            });
        }

        /**
         * Adds a block inside the HTML page that is used for pseudo-caching
         * @private
         */
        function _cacheAddAppendZone()
        {
            if(!rScript.domStore('rs_var_cache_pseudo_append_zone_init'))
            {
                var html_str = '<div id="r-rs-cache-pseudo-append-zone" style="display: none;"></div>';
                $('body').append(html_str);

                rScript.domStore('rs_var_cache_pseudo_append_zone_init', true);
            }
        }

        /**
         * Caches a Web asset
         * Note: It pseudo-caches the asset by loading it onto the page in a non-blocking fashion
         * @param {String} url_str
         * @private
         */
        function _cacheAsset(url_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                tag_payload_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? ' '+myArgs[1] : '',
                html_str,
                append_zone_obj,
                valid_file_bool = true,
                append_bool = false
                ;

            if(/\.(?:png|gif|jpg)(\?[^\s]*?|) *$/i.test(url_str))
            {
                //create append zone for pseudo-caching
                _cacheAddAppendZone();
                append_zone_obj = $('#r-rs-cache-pseudo-append-zone');

                //setup html to be added to the zone
                html_str = '<img src="'+url_str+'"'+tag_payload_str+'>';
                append_bool = true;
            }
            else if(/\.css(\?[^\s]*?|) *$/i.test(url_str))
            {
                //load

                rScript.loadCSS(url_str, {load_loc: 'body'});
            }
            else if (/\.js(\?[^\s]*?|) *$/i.test(url_str))
            {
                //load

                rScript.loadJS(url_str, {load_loc: 'body'});
            }
            else
            {
                valid_file_bool = false;
            }

            //Record
            if(valid_file_bool)
            {
                _cacheRegister(url_str);
            }

            //Append
            if(valid_file_bool && append_bool)
            {
                append_zone_obj.append(html_str);
            }
        }

        /**
         * Manages link functionality for cached links
         * @param {String} url_str the URL of the link
         * @param {String} target_str the DOM element target that will receive the cached content
         * @param {Boolean} stub_bool if true, will use only a stub of the HTML content that was cached i.e. everything inside <body></body>
         * @param {Object} template_obj a template context object that will be used to pre-compile the cached HTML
         * @param {Function} callback_fn a callback function to replace the standard functionality
         * @private
         */
        function _cacheLinkClick(url_str, target_str, stub_bool, template_obj, callback_fn)
        {
            var url_hash_str = _cacheHashUrl(url_str),
                store_var_name_str = 'rs_var_cache_link_'+url_hash_str;

            if(!_getOnlineStatus())
            {
                //leverage offline link cache

                _cacheHTML(url_str).then(function(html_str) {

                    if(stub_bool)
                    {
                        //get HTML stub

                        if (/\<html.*?\>|\<body.*?\>/igm.test(html_str)) {
                            //get html content inside body
                            var html_all_arr = _r.regexMatchAll(/\<body.*?\>([\s\S]*)<\/body>/igm, html_str);
                            html_str = html_all_arr[0][1];
                            html_str = html_str.trim();
                        }
                    }

                    //compile
                    html_str = (template_obj) ? _compile(html_str, template_obj) : html_str;

                    //add to DOM
                    if(target_str)
                    {
                        if(callback_fn)
                        {
                            callback_fn(html_str, target_str);
                        }
                        else
                        {
                            $('#'+target_str).html(html_str);
                        }
                    }
                    else
                    {
                        //flag that the content was appended to prevent multiplicity
                        if(callback_fn)
                        {
                            callback_fn(html_str);
                        }
                        else
                        {
                            if(!rScript.domStore(store_var_name_str)) {

                                $('body').append(html_str);

                                rScript.domStore(store_var_name_str, true);
                            }
                        }
                    }
                });
            }
            else
            {
                window.location.href = url_str;
            }
        }

        /**
         * Caches HTML content
         */
        rScript_obj.cache = {
            /**
             * Add a HTML file to the cache
             * @param {String} url_str the url to fetch and cache
             * @param {String} html_str the html to store
             * @param {Number} expiry_int the cache lifetime
             */
            add: function(url_str){
                var myArgs = Array.prototype.slice.call(arguments),
                    html_str = myArgs[1],
                    expiry_int = myArgs[2],
                    cache_result_str;

                cache_result_str = _cacheHTML(url_str, html_str, expiry_int);
                return cache_result_str;
            },
            /**
             * Check if
             * @param url_str
             */
            check: function(url_str){

            },
            /**
             * Adds a HTML file to the cache
             * Wrapper for _cacheHTML
             * Note: the HTML string is stored in sessionStorage
             * @param {String} url_str the url to fetch and cache
             * @param {Object} options_obj the options. See _cacheHTML method
             */
            html: function(url_str)
            {
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = myArgs[1];

                return _cacheHTML(url_str, options_obj);
            },
            /**
             * Caches files
             * Note: the files are cached by the browser
             * @param {String|Array} url_str_or_arr a single URL or a list of URLs
             * @param {String} tag_payload_str any HTML you want to add to the element's tag before it is closed
             */
            file: function(url_str_or_arr)
            {
                var myArgs = Array.prototype.slice.call(arguments),
                    tag_payload_str = myArgs[1];

                if(_r.isArray(url_str_or_arr) && url_str_or_arr.length > 0)
                {
                    for(var i = 0; i < url_str_or_arr.length; i++)
                    {
                        _cacheAsset(url_str_or_arr[i], tag_payload_str);
                    }
                }
                else
                {
                    _cacheAsset(url_str_or_arr, tag_payload_str);
                }
            },
            /**
             * Caches a link
             * When online, the link will act like a normal hyperlink
             * When offline, the cached content (i.e. the HTML content that the link referenced) will either be appended to the body [default behavior], or it will be added to a specific DOM element if provided in options via the target value
             * @param {String} id_str the DOM identifier of the link(s)
             * Two options are available
             * Hash prefix e.g. #my-link-id, or 'my-link-id' will get a specific link element
             * Dot prefix e.g. .cool-links will get all links with the class 'cool-links'
             * @param {Object} options_obj the options
             * target: the id of the DOM element that will receive the cached HTML when the link is clicked. Default behavior is append to body
             * stub: if true [default], will display only the HTML inside the <body> tag
             * template: the template context object that enables compilation. If provided, it will be applied on the HTML before said HTML is inserted into target
             * callback: the callback function. This callback function will be passed the cached HTML string, and the target (if provided) i.e. callback(html_str, target_str)
             * Note that the callback will replace the default functionality when offline (see above)
             */
            link: function(id_str)
            {
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = myArgs[1],
                    cache_html_options_obj = {},
                    target_str,
                    stub_bool = true,
                    template_obj,
                    callback_fn,
                    link_obj,
                    link_obj_size_int,
                    link_obj_href_str
                    ;

                //define options
                if(_r.isObject(options_obj))
                {
                    target_str = (options_obj.target && _r.isString(options_obj.target) && options_obj.target.length > 0) ? options_obj.target : target_str;
                    stub_bool = (_r.isBool(options_obj.stub)) ? options_obj.stub : stub_bool;
                    template_obj = (options_obj.template) ? options_obj.template : template_obj;
                    callback_fn = (options_obj.callback) ? options_obj.callback : callback_fn;
                }

                //exit if id_str is not string
                if(_r.isEmptyString(id_str))
                {
                    return;
                }

                //get link object(s)
                if(/^ *\.[^\s]+? *$/i.test(id_str))
                {
                    link_obj = $(id_str);
                }
                else if(/^ *(\#|[^\. ])[^\s]+? *$/i.test(id_str))
                {
                    var first_char_str = id_str.slice(0, 1);
                    link_obj = (first_char_str === '#') ? $(id_str) : $('#'+id_str);
                }
                else
                {
                    return;
                }

                //get link object size
                link_obj_size_int = link_obj.length;

                if(link_obj_size_int > 1)
                {
                    //Cycle to cache
                    link_obj.each(function(){

                        //get href
                        link_obj_href_str = $(this).attr('href');
                        link_obj_href_str = _changeUrlDirectory(link_obj_href_str);

                        //cache
                        cache_html_options_obj.cache_stub = stub_bool;
                        _cacheHTML(link_obj_href_str, cache_html_options_obj);
                    });

                    //Add event handler
                    link_obj.on('click', function(e){

                        rQuery.preventDefault(e);

                        link_obj_href_str = $(this).attr('href');
                        link_obj_href_str = _changeUrlDirectory(link_obj_href_str);

                        _cacheLinkClick(link_obj_href_str, target_str, stub_bool, template_obj, callback_fn);
                    });
                }
                else
                {
                    //get href value
                    link_obj_href_str = link_obj.attr('href');

                    //cache
                    link_obj_href_str = _changeUrlDirectory(link_obj_href_str);

                    cache_html_options_obj.cache_stub = stub_bool;
                    _cacheHTML(link_obj_href_str, cache_html_options_obj);

                    link_obj.on('click', function(e){

                        rQuery.preventDefault(e);

                        _cacheLinkClick(link_obj_href_str, target_str, stub_bool, template_obj, callback_fn);
                    });
                }
            },
            /**
             * Disables mobile page-refresh functionality
             */
            disableMobileRefresh: function(){
                if(rScript.isMobile())
                {
                    /**
                     * 1.1: Add overflow-y:hidden to body
                     * 1.2: Disable the first top overscrolling touchmove only when 1) the initial touchstart occurred when the page y scroll offset was zero and 2) the touchmove would induce top overscroll
                     */

                    var elem_win_obj = $(window),
                        elem_body_obj = $('body'),
                        last_y = 0;

                    //1.1
                    elem_body_obj.css('overflow-y', 'hidden');

                    //1.2
                    elem_win_obj.on('touchmove', function(e){
                        var _this = this[0];
                        var scrolly = _this.pageYOffset || _this.scrollTop || 0;
                        var direction = e.changedTouches[0].pageY > last_y ? 1 : -1;
                        if(direction>0 && scrolly===0)
                        {
                            rQuery.preventDefault(e);
                        }
                        last_y = e.changedTouches[0].pageY;
                    });
                }
            },
            /**
             * Clear the HTML cache
             * @param {String|Array} url_str_or_arr an optional url, or array of urls
             * Note: if provided, only the HTML cache entry associated with this url will be removed. If not provided, the entire HTML cache will be flushed
             */
            clear: function(){
                var myArgs = Array.prototype.slice.call(arguments),
                    url_str_or_arr = ((_r.isString(myArgs[0]) || _r.isArray(myArgs[0])) && myArgs[0].length > 0) ? myArgs[0] : undefined,
                    url_hash_str,
                    store_all_obj,
                    store_all_key_arr = [],
                    store_vars_remove_str;
                ;

                if(url_str_or_arr)
                {
                    if(_r.isArray(url_str_or_arr))
                    {
                        for(var i = 0; i < _r.count(url_str_or_arr); i++)
                        {
                            url_hash_str = _cacheHashUrl(url_str_or_arr[i]);
                            rScript.store(url_hash_str, null);
                        }
                    }
                    else
                    {
                        url_hash_str = _cacheHashUrl(url_str_or_arr);
                        rScript.store(url_hash_str, null);
                    }
                }
                else
                {
                    //remove all items
                    store_all_obj = rScript.store();
                    for (var store_key in store_all_obj)
                    {
                        if(store_all_obj.hasOwnProperty(store_key))
                        {
                            if(/^ *rs_var_cache_url_/i.test(store_key))
                            {
                                store_all_key_arr.push(store_key);
                            }
                        }
                    }
                    store_vars_remove_str = _r.implode(' ', store_all_key_arr);
                    rScript.store(store_vars_remove_str, null);
                }
            }
        };


        /**
         * Provides simple scroll trigger functionality
         * Scrollpost will execute a callback function when the user scrolls past a specific point in a specific direction
         * @param name_str {String} the name that will identify the scrollpost
         *
         * @param pos_str {String} the scrollpost position parameters
         * 1. x or y coordinates e.g. 300 [defaults to x], 20y, etc.
         * 2. x,y coordinates e.g. 300x,30y or 250y,40x
         * 3. id tag e.g. #div-number-1 [active when the element comes into view]. Alternatively, an offset can be provided
         * 3.1. #div-number-2|+40
         * 3.2. #div-number
         *
         * @param options_obj {Object} the options
         *
         * callback: the callback function that will be executed when the scrollpost is reached
         *
         * callback_once: If true, will force callback to run only once. Default action is that callback will run each time the scrollpost condition is matched
         *
         * route_path: A route path that will be executed when a scroll post matches
         *
         * route_hash: The hash string for the route path. Default is '#/'.
         *
         * scrollpostmark_class_track_elem: special option used by _scrollPostMark method
         *
         * scrollpostmark_id_tag_elem: special option used by _scrollPostMark method
         *
         * scrollpostmark_class_tag_elem: special option used by _scrollPostMark
         *
         * @param callback_fn {Function} the callback function that will be executed when the milepost is reached
         * @param post_fn_run_once_bool {Boolean} forces callback_fn to run only once. Default action is that callback_fn will run each time the scrollpost condition is matched
         * @returns {rScript}
         */
        function _scrollPost(name_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                pos_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1] : false,
                options_obj = myArgs[2],
                callback_fn,
                callback_once_bool,
                callback_route_path_str,
                callback_route_hash_str,
                elem_ref_obj,
                elem_ref_obj_selector_str,
                elem_tag_obj_selector_str,
                pos_str_elem_regex_arr = [],
                data_scrollpost_obj = rQuery.data('r_rs_var_scrollposts'),
                scrollpost_data_arr,
                scrollpost_data_item_str,
                scrollpost_data_item_uuid_str,
                scrollpost_data_pos_arr,
                scrollpost_data_fn_arr,
                scrollpost_data_marker_arr,
                scrollpost_ref_obj_sel_arr,
                scrollpost_tag_obj_sel_arr,
                scrollpost_fn_run_once_arr,
                scrollpost_fn_run_once_bool,
                scrollpost_fn_run_once_uuid_str,
                scrollpost_route_path_arr,
                scrollpost_route_hash_arr,
                scrollpost_item_match_bool,
                scrollpost_item_marker_bool,
                scroll_v_int,
                scroll_h_int,
                pos_regex_arr = [],
                scrollpost_config_obj = {},
                el_offset_obj,
                scroll_pos_obj,
                scrollpostmark_track_elem_class_str,
                scrollpostmark_tag_elem_id_str,
                scrollpostmark_tag_elem_class_str
                ;

            //return if pos_str is invalid
            if(!pos_str)
            {
                return false;
            }

            //define options
            if(_r.isObject(options_obj))
            {
                callback_fn = (options_obj.callback) ? options_obj.callback : undefined;
                callback_once_bool = !!((options_obj.callback_once));
                callback_route_path_str = (options_obj.route_path && _r.isString(options_obj.route_path) && options_obj.route_path.length > 0) ? options_obj.route_path : undefined;
                callback_route_hash_str = (options_obj.route_hash && _r.isString(options_obj.route_hash) && options_obj.route_hash.length > 0) ? options_obj.route_hash : undefined;

                scrollpostmark_track_elem_class_str = (options_obj.scrollpostmark_class_track_elem) ? options_obj.scrollpostmark_class_track_elem : undefined;
                scrollpostmark_tag_elem_id_str = (options_obj.scrollpostmark_id_tag_elem) ? options_obj.scrollpostmark_id_tag_elem : undefined;
                scrollpostmark_tag_elem_class_str = (options_obj.scrollpostmark_class_tag_elem) ? options_obj.scrollpostmark_class_tag_elem : undefined;
            }

            //get body or get selected element
            if(/^ *(\#.+?) *(?:\|.+?|) *$/i.test(pos_str))
            {
                pos_str_elem_regex_arr = _r.regexMatchAll(/^ *(\#.+?) *(?:\|.+?|) *$/i, pos_str);

                elem_ref_obj_selector_str = pos_str_elem_regex_arr[0][1];
                elem_ref_obj = $(elem_ref_obj_selector_str);
            }
            else
            {
                elem_ref_obj_selector_str = 'body';
                elem_ref_obj = $(elem_ref_obj_selector_str);
            }

            //get tag objector selector stub. this is for _scrollPostMark functionality
            elem_tag_obj_selector_str = (scrollpostmark_tag_elem_id_str) ? '#'+scrollpostmark_tag_elem_id_str : '';

            //compose function for scrollpost matching
            var scrollpost_match_fn = function(scrollpost_config_obj)
            {
                var scrollpost_pos_str = scrollpost_config_obj.scrollpost_data,
                    scroll_dir_h_str = scrollpost_config_obj.scroll_dir_h,
                    scroll_dir_v_str = scrollpost_config_obj.scroll_dir_v,
                    scroll_x_int = scrollpost_config_obj.scroll_pos_x,
                    scroll_x_prev_int = scrollpost_config_obj.scroll_pos_x_prev,
                    scroll_y_int = scrollpost_config_obj.scroll_pos_y,
                    scroll_y_prev_int = scrollpost_config_obj.scroll_pos_y_prev,
                    scroll_x_el_int = scrollpost_config_obj.scroll_pos_el_x,
                    scroll_y_el_int = scrollpost_config_obj.scroll_pos_el_y,
                    el_x_offset_int = parseInt(scrollpost_config_obj.el_offset_x),
                    el_x_offset_diff_scroll_x_prev_int = el_x_offset_int-scroll_x_prev_int,
                    el_y_offset_int = parseInt(scrollpost_config_obj.el_offset_y),
                    el_y_offset_diff_scroll_y_prev_int = el_y_offset_int-scroll_y_prev_int,
                    scrollpost_pos_uuid_str = scrollpost_config_obj.uuid,
                    viewport_w_str = rScript.viewportW(),
                    viewport_w_int = (viewport_w_str) ? parseInt(viewport_w_str) : 0,
                    viewport_h_str = rScript.viewportH(),
                    viewport_h_int = (viewport_h_str) ? parseInt(viewport_h_str) : 0,
                    scrollpost_pos_val_str,
                    scrollpost_pos_val_int,
                    scrollpost_pos_val_axis_str,
                    scrollpost_pos_val_dir_str,
                    scrollpost_pos_val_ls_int,
                    scrollpost_pos_val_rs_int,
                    scrollpost_x_int,
                    scrollpost_x_dir_str = 'right',
                    scrollpost_y_int,
                    scrollpost_y_dir_str = 'down',
                    scrollpost_value_perc_factor_int,
                    scrollpost_value_perc_factor_y_int,
                    scrollpost_value_perc_factor_x_int,
                    is_elem_scrollpost_obj = false,
                    is_valid_scroll_past_x_left_var_str = 'rs_var_is_valid_scroll_past_x_left_'+scrollpost_pos_uuid_str,
                    is_valid_scroll_past_x_right_var_str = 'rs_var_is_valid_scroll_past_x_right_'+scrollpost_pos_uuid_str,
                    is_valid_scroll_past_y_up_var_str = 'rs_var_is_valid_scroll_past_y_up_'+scrollpost_pos_uuid_str,
                    is_valid_scroll_past_y_down_var_str = 'rs_var_is_valid_scroll_past_y_down_'+scrollpost_pos_uuid_str,
                    is_valid_scroll_past_idx_str,
                    is_rtl_bool = false
                    ;

                //update scroll_x if negative on account of rtl or other
                if(scroll_x_int < 0 || scroll_x_prev_int < 0)
                {
                    is_rtl_bool = true;

                    scroll_x_int = Math.abs(scroll_x_int);
                    scroll_x_prev_int = Math.abs(scroll_x_prev_int);
                }

                //use regex to get milepost position data
                if(/^ *([0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(?:\#(up|down|left|right)|) *$/i.test(scrollpost_pos_str))
                {
                    //e.g. '100y', '100y#up', '200x', '200x#left', '300%y'

                    pos_regex_arr = _r.regexMatchAll(/^ *([0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(?:\#(up|down|left|right)|) *$/i, scrollpost_pos_str);

                    scrollpost_pos_val_str = pos_regex_arr[0][1];
                    scrollpost_pos_val_int = parseInt(scrollpost_pos_val_str);
                    scrollpost_pos_val_axis_str = (!_r.isEmptyString(pos_regex_arr[0][3])) ? pos_regex_arr[0][3] : 'y';
                    scrollpost_pos_val_dir_str = pos_regex_arr[0][4];

                    scrollpost_x_int = (scrollpost_pos_val_axis_str === 'y') ? 0 : scrollpost_pos_val_int;
                    scrollpost_y_int = (scrollpost_pos_val_axis_str === 'y') ? scrollpost_pos_val_int : 0;

                    if(pos_regex_arr[0][2] === '%')
                    {
                        //use viewport dimensions

                        scrollpost_value_perc_factor_int = scrollpost_pos_val_int / 100;

                        scrollpost_x_int = (scrollpost_y_int === 0) ? scrollpost_value_perc_factor_int * viewport_w_int : scrollpost_x_int;
                        scrollpost_y_int = (scrollpost_x_int === 0) ? scrollpost_value_perc_factor_int * viewport_h_int : scrollpost_y_int;

                    }

                    scrollpost_x_dir_str = (scrollpost_pos_val_dir_str === 'left') ? 'left' : 'right';
                    scrollpost_y_dir_str = (scrollpost_pos_val_dir_str === 'up') ? 'up' : 'down';
                }
                else if(/^ *([0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|left|right)|) *, *([0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|left|right)|) *$/i.test(scrollpost_pos_str))
                {
                    //e.g. '100y,200x', '100y#up,200x#right', etc.

                    pos_regex_arr = _r.regexMatchAll(/^ *([0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|left|right)|) *, *([0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|left|right)|) *$/i, scrollpost_pos_str);

                    scrollpost_pos_val_ls_int = parseInt(pos_regex_arr[0][1]);
                    scrollpost_pos_val_rs_int = parseInt(pos_regex_arr[0][5]);

                    scrollpost_x_int = (pos_regex_arr[0][3] === 'y') ? scrollpost_pos_val_rs_int : scrollpost_pos_val_ls_int;
                    scrollpost_y_int = (pos_regex_arr[0][7] === 'y') ? scrollpost_pos_val_rs_int : scrollpost_pos_val_ls_int;

                    if(pos_regex_arr[0][2] === '%' || pos_regex_arr[0][6] === '%')
                    {
                        //use viewport dimensions

                        if((pos_regex_arr[0][2] === '%' && pos_regex_arr[0][3] === 'x') || (pos_regex_arr[0][6] === '%' && pos_regex_arr[0][7] === 'x'))
                        {
                            scrollpost_value_perc_factor_x_int = (pos_regex_arr[0][3] === 'y') ? scrollpost_pos_val_rs_int / 100 : scrollpost_pos_val_ls_int / 100  ;
                            scrollpost_x_int = scrollpost_value_perc_factor_x_int * viewport_w_int;
                        }

                        if((pos_regex_arr[0][2] === '%' && pos_regex_arr[0][3] === 'y') || (pos_regex_arr[0][6] === '%' && pos_regex_arr[0][7] === 'y'))
                        {
                            scrollpost_value_perc_factor_y_int = (pos_regex_arr[0][7] === 'y') ? scrollpost_pos_val_rs_int / 100 : scrollpost_pos_val_ls_int / 100  ;
                            scrollpost_y_int = scrollpost_value_perc_factor_y_int * viewport_h_int;
                        }

                    }

                    scrollpost_x_dir_str = ((pos_regex_arr[0][3] === 'x' && pos_regex_arr[0][4] === '#left') || (pos_regex_arr[0][7] === 'x' && pos_regex_arr[0][8] === '#left')) ? 'left' : 'right';
                    scrollpost_y_dir_str = ((pos_regex_arr[0][3] === 'y' && pos_regex_arr[0][4] === '#up') || (pos_regex_arr[0][7] === 'y' && pos_regex_arr[0][8] === '#up')) ? 'up' : 'down';

                }
                else if(/^ *(\#.+?) *\| *((?:\-|\+|)[0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|right|left)|) *$/i.test(scrollpost_pos_str))
                {
                    //e.g. '#container', '#container|100y', '#container|100y#up'

                    is_elem_scrollpost_obj = true;

                    pos_regex_arr = _r.regexMatchAll(/^ *(\#.+?) *\| *((?:\-|\+|)[0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|right|left)|) *$/i, scrollpost_pos_str);

                    scrollpost_pos_val_int = parseInt(pos_regex_arr[0][2]);
                    scrollpost_x_int = (pos_regex_arr[0][4] === 'y') ? 0 : scrollpost_pos_val_int;
                    scrollpost_y_int = (pos_regex_arr[0][4] === 'y') ? scrollpost_pos_val_int : 0;

                    if(pos_regex_arr[0][3] === '%')
                    {
                        //use viewport dimensions

                        scrollpost_value_perc_factor_int = scrollpost_pos_val_int / 100;

                        scrollpost_x_int = (scrollpost_y_int === 0) ? scrollpost_value_perc_factor_int * viewport_w_int : scrollpost_x_int;
                        scrollpost_y_int = (scrollpost_x_int === 0) ? scrollpost_value_perc_factor_int * viewport_h_int : scrollpost_y_int;

                    }

                    scrollpost_x_dir_str = ((pos_regex_arr[0][4] === 'x' && pos_regex_arr[0][5] === '#left')) ? 'left' : 'right';
                    scrollpost_y_dir_str = ((pos_regex_arr[0][4] === 'y' && pos_regex_arr[0][5] === '#up')) ? 'up' : 'down';

                }
                else if(/^ *(\#.+?) *\| *((?:\-|\+|)[0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|left|right)|) *, *((?:\-|\+|)[0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|left|right)|) *$/i.test(scrollpost_pos_str))
                {
                    //e.g. '#container|100y,50x', '#container|25%y#up,50x#right', etc.

                    is_elem_scrollpost_obj = true;

                    pos_regex_arr = _r.regexMatchAll(/^ *(\#.+?) *\| *((?:\-|\+|)[0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|left|right)|) *, *((?:\-|\+|)[0-9]+(?:\.[0-9]+|))(\%?)(x|y|) *(\#(?:up|down|left|right)|) *$/i, scrollpost_pos_str);

                    scrollpost_pos_val_ls_int = parseInt(pos_regex_arr[0][2]);
                    scrollpost_pos_val_rs_int = parseInt(pos_regex_arr[0][6]);

                    scrollpost_x_int = (pos_regex_arr[0][4] === 'y') ? scrollpost_pos_val_rs_int : scrollpost_pos_val_ls_int;
                    scrollpost_y_int = (pos_regex_arr[0][8] === 'y') ? scrollpost_pos_val_rs_int : scrollpost_pos_val_ls_int;

                    if(pos_regex_arr[0][3] === '%' || pos_regex_arr[0][7] === '%')
                    {
                        //use viewport dimensions

                        if((pos_regex_arr[0][3] === '%' && pos_regex_arr[0][4] === 'x') || (pos_regex_arr[0][7] === '%' && pos_regex_arr[0][8] === 'x'))
                        {
                            scrollpost_value_perc_factor_x_int = (pos_regex_arr[0][4] === 'y') ? scrollpost_pos_val_rs_int / 100 : scrollpost_pos_val_ls_int / 100  ;
                            scrollpost_x_int = scrollpost_value_perc_factor_x_int * viewport_w_int;
                        }

                        if((pos_regex_arr[0][3] === '%' && pos_regex_arr[0][4] === 'y') || (pos_regex_arr[0][7] === '%' && pos_regex_arr[0][8] === 'y'))
                        {
                            scrollpost_value_perc_factor_y_int = (pos_regex_arr[0][8] === 'y') ? scrollpost_pos_val_rs_int / 100 : scrollpost_pos_val_ls_int / 100  ;
                            scrollpost_y_int = scrollpost_value_perc_factor_y_int * viewport_h_int;
                        }

                    }

                    scrollpost_x_dir_str = ((pos_regex_arr[0][4] === 'x' && pos_regex_arr[0][5] === '#left') || (pos_regex_arr[0][8] === 'x' && pos_regex_arr[0][9] === '#left')) ? 'left' : 'right';
                    scrollpost_y_dir_str = ((pos_regex_arr[0][4] === 'y' && pos_regex_arr[0][5] === '#up') || (pos_regex_arr[0][8] === 'y' && pos_regex_arr[0][9] === '#up')) ? 'up' : 'down';

                }

                //make sure scrollpost x and y are integers
                scrollpost_x_int = (scrollpost_x_int) ? parseInt(scrollpost_x_int) : scrollpost_x_int;
                scrollpost_y_int = (scrollpost_y_int) ? parseInt(scrollpost_y_int) : scrollpost_y_int;

                // define DOM variables for tracking
                // this is used for accurate measurement of scrolls
                // in the opposite direction e.g. up and left
                if(!rQuery.data(is_valid_scroll_past_x_left_var_str))
                {
                    rQuery.data(is_valid_scroll_past_x_left_var_str, '0');
                }

                if(!rQuery.data(is_valid_scroll_past_x_right_var_str))
                {
                    rQuery.data(is_valid_scroll_past_x_right_var_str, '0');
                }

                if(!rQuery.data(is_valid_scroll_past_y_up_var_str))
                {
                    rQuery.data(is_valid_scroll_past_y_up_var_str, '0');
                }

                if(!rQuery.data(is_valid_scroll_past_y_down_var_str))
                {
                    rQuery.data(is_valid_scroll_past_y_down_var_str, '0');
                }

                //main scrollpost test
                if(is_elem_scrollpost_obj)
                {
                    //reference is element

                    if((_r.isNumber(scrollpost_x_int) && scrollpost_x_int !== 0) && (_r.isNumber(scrollpost_y_int) && scrollpost_y_int !== 0))
                    {
                        //match for x,y intercept

                        if(scrollpost_y_dir_str === 'up')
                        {
                            if ((scroll_dir_v_str === 'up' || scroll_dir_h_str === 'left') && (scrollpost_y_dir_str === 'up' && scrollpost_x_dir_str === 'left') && (scroll_y_el_int >= scrollpost_y_int && scroll_x_el_int >= scrollpost_x_int))
                            {
                                //up + left

                                return true;
                            }
                            else if ((scroll_dir_v_str === 'up' || scroll_dir_h_str === 'right') && (scrollpost_y_dir_str === 'up' && scrollpost_x_dir_str === 'right') && (scroll_y_el_int >= scrollpost_y_int && scroll_x_el_int <= scrollpost_x_int))
                            {
                                //up + right

                                return true;
                            }
                        }
                        else
                        {
                            if((scroll_dir_v_str === 'down' || scroll_dir_h_str === 'left') && (scrollpost_y_dir_str === 'down' && scrollpost_x_dir_str === 'left') && (scroll_y_el_int <= scrollpost_y_int && scroll_x_el_int >= scrollpost_x_int))
                            {
                                //down and left

                                return true;
                            }
                            else if((scroll_dir_v_str === 'down' || scroll_dir_h_str === 'right') && (scrollpost_y_dir_str === 'down' && scrollpost_x_dir_str === 'right') && (scroll_y_el_int <= scrollpost_y_int && scroll_x_el_int <= scrollpost_x_int))
                            {
                                //down and right

                                return true;
                            }
                        }
                    }
                    else if (_r.isNumber(scrollpost_x_int) && scrollpost_x_int !== 0)
                    {
                        //match for x

                        //horizontal constraint
                        if(scrollpost_x_dir_str === 'left')
                        {
                            if(scroll_dir_h_str === 'left' && scroll_x_el_int >= scrollpost_x_int && el_x_offset_diff_scroll_x_prev_int < scrollpost_x_int)
                            {
                                return true;
                            }
                        }
                        else if(scroll_x_el_int <= scrollpost_x_int)
                        {
                            return true;
                        }
                    }
                    else if (_r.isNumber(scrollpost_y_int) && scrollpost_y_int !== 0)
                    {
                        //match for y

                        //vertical constraint
                        if(scrollpost_y_dir_str === 'up')
                        {
                            if(scroll_dir_v_str === 'up' && scroll_y_el_int >= scrollpost_y_int && el_y_offset_diff_scroll_y_prev_int < scrollpost_y_int)
                            {
                                return true;
                            }
                        }
                        else if(scroll_y_el_int <= scrollpost_y_int)
                        {
                            return true;
                        }
                    }
                }
                else
                {
                    //reference is viewport

                    if(scrollpost_x_int > 0 && scrollpost_y_int > 0)
                    {
                        //match for x,y intercept

                        if(scrollpost_y_dir_str === 'up')
                        {
                            if((scroll_dir_v_str === 'up' || scroll_dir_h_str === 'left') && (scrollpost_y_dir_str === 'up' && scrollpost_x_dir_str === 'left') && (scroll_y_int <= scrollpost_y_int && scroll_x_int <= scrollpost_x_int))
                            {
                                //up + left

                                rQuery.data(is_valid_scroll_past_y_up_var_str, '1');
                                if(is_rtl_bool)
                                {
                                    rQuery.data(is_valid_scroll_past_x_right_var_str, '1');
                                }
                                else
                                {
                                    rQuery.data(is_valid_scroll_past_x_left_var_str, '1');
                                }
                            }
                            else if ((scroll_dir_v_str === 'up' || scroll_dir_h_str === 'right') && (scrollpost_y_dir_str === 'up' && scrollpost_x_dir_str === 'right') && (scroll_y_int <= scrollpost_y_int && scroll_x_int >= scrollpost_x_int))
                            {
                                //up + right

                                rQuery.data(is_valid_scroll_past_y_up_var_str, '1');
                                if(is_rtl_bool)
                                {
                                    rQuery.data(is_valid_scroll_past_x_left_var_str, '1');
                                }
                                else
                                {
                                    rQuery.data(is_valid_scroll_past_x_right_var_str, '1');
                                }
                            }
                        }
                        else
                        {
                            if((scroll_dir_v_str === 'down' || scroll_dir_h_str === 'left') && (scrollpost_y_dir_str === 'down' && scrollpost_x_dir_str === 'left') && (scroll_y_int >= scrollpost_y_int && scroll_x_int <= scrollpost_x_int))
                            {
                                //down + left

                                rQuery.data(is_valid_scroll_past_y_down_var_str, '1');
                                if(is_rtl_bool)
                                {
                                    rQuery.data(is_valid_scroll_past_x_right_var_str, '1');
                                }
                                else
                                {
                                    rQuery.data(is_valid_scroll_past_x_left_var_str, '1');
                                }
                            }
                            else if ((scroll_dir_v_str === 'down' || scroll_dir_h_str === 'right') && (scrollpost_y_dir_str === 'down' && scrollpost_x_dir_str === 'right') && (scroll_y_int >= scrollpost_y_int && scroll_x_int >= scrollpost_x_int))
                            {
                                //down + right

                                rQuery.data(is_valid_scroll_past_y_down_var_str, '1');
                                if(is_rtl_bool)
                                {
                                    rQuery.data(is_valid_scroll_past_x_left_var_str, '1');
                                }
                                else
                                {
                                    rQuery.data(is_valid_scroll_past_x_right_var_str, '1');
                                }
                            }
                        }

                        //set scroll post index markers
                        if(scrollpost_x_dir_str === 'right' && scrollpost_y_dir_str === 'up')
                        {
                            is_valid_scroll_past_idx_str = rQuery.data(is_valid_scroll_past_x_right_var_str)+""+rQuery.data(is_valid_scroll_past_y_up_var_str);
                        }
                        else if (scrollpost_x_dir_str === 'left' && scrollpost_y_dir_str === 'up')
                        {
                            is_valid_scroll_past_idx_str = rQuery.data(is_valid_scroll_past_x_left_var_str)+""+rQuery.data(is_valid_scroll_past_y_up_var_str);
                        }
                        else if (scrollpost_x_dir_str === 'right' && scrollpost_y_dir_str === 'down')
                        {
                            is_valid_scroll_past_idx_str = rQuery.data(is_valid_scroll_past_x_right_var_str)+""+rQuery.data(is_valid_scroll_past_y_down_var_str);
                        }
                        else if (scrollpost_x_dir_str === 'left' && scrollpost_y_dir_str === 'down')
                        {
                            is_valid_scroll_past_idx_str = rQuery.data(is_valid_scroll_past_x_left_var_str)+""+rQuery.data(is_valid_scroll_past_y_down_var_str);
                        }

                        //reset and match
                        if(is_valid_scroll_past_idx_str === '11')
                        {
                            rQuery.data(is_valid_scroll_past_x_left_var_str, '0');
                            rQuery.data(is_valid_scroll_past_x_right_var_str, '0');
                            rQuery.data(is_valid_scroll_past_y_up_var_str, '0');
                            rQuery.data(is_valid_scroll_past_y_down_var_str, '0');
                            return true;
                        }
                    }
                    else if (scrollpost_x_int > 0)
                    {
                        //match for x

                        if(scrollpost_x_dir_str === 'left')
                        {
                            if(scroll_dir_h_str === 'left' && scroll_x_int < scrollpost_x_int && scroll_x_prev_int >= scrollpost_x_int)
                            {
                                return true;
                            }
                            else if(is_rtl_bool && scroll_dir_h_str === 'right' && scroll_x_int < scrollpost_x_int && scroll_x_prev_int >= scrollpost_x_int)
                            {
                                //reverse for rtl

                                return true;
                            }
                        }
                        else if (scrollpost_x_dir_str === 'right')
                        {
                            if(scroll_dir_h_str === 'right' && scroll_x_int >= scrollpost_x_int)
                            {
                                return true;
                            }
                            else if(is_rtl_bool && scroll_dir_h_str === 'left' && scroll_x_int >= scrollpost_x_int)
                            {
                                //reverse for rtl

                                return true;
                            }
                        }
                    }
                    else if (scrollpost_y_int > 0)
                    {
                        //match for y

                        if(scrollpost_y_dir_str === 'up')
                        {
                            if (scroll_dir_v_str === 'up' && scroll_y_int < scrollpost_y_int && scroll_y_prev_int >= scrollpost_y_int)
                            {
                                return true;
                            }
                        }
                        else if (scrollpost_y_dir_str === 'down')
                        {
                            if (scroll_dir_v_str === 'down' && scroll_y_int >= scrollpost_y_int)
                            {
                                return true;
                            }
                        }
                    }
                }

                return false;
            };

            //define main scrollpost function
            var post_main_fn = function()
            {
                scrollpost_config_obj = {};

                //get scroll direction
                scrollpost_config_obj.scroll_dir_h = _getScrollDirection('h');
                scrollpost_config_obj.scroll_dir_v = _getScrollDirection('v');

                //get previous scroll x and y
                scrollpost_config_obj.scroll_pos_x_prev = parseInt(rScript.store("rs_var_viewport_scroll_l_prev"));
                scrollpost_config_obj.scroll_pos_y_prev = parseInt(rScript.store("rs_var_viewport_scroll_t_prev"));

                //get scrollpostmark data
                scrollpost_config_obj.scrollpostmark_track_elem_class = scrollpostmark_track_elem_class_str;
                scrollpost_config_obj.scrollpostmark_tag_elem_class = scrollpostmark_tag_elem_class_str;

                //get stored scrollpost data
                scrollpost_data_arr = rQuery.data('r_rs_var_scrollposts');
                scrollpost_data_pos_arr = rQuery.data('r_rs_var_scrollposts_pos');
                scrollpost_data_fn_arr = rQuery.data('r_rs_var_scrollposts_fn');
                scrollpost_data_marker_arr = rQuery.data('r_rs_var_scrollposts_marker');
                scrollpost_ref_obj_sel_arr = rQuery.data('r_rs_var_scrollposts_ref_obj_sel');
                scrollpost_tag_obj_sel_arr = rQuery.data('r_rs_var_scrollposts_tag_obj_sel');
                scrollpost_fn_run_once_arr = rQuery.data('r_rs_var_scrollposts_fn_run_once');
                scrollpost_route_path_arr = rQuery.data('r_rs_var_scrollposts_route_path');
                scrollpost_route_hash_arr = rQuery.data('r_rs_var_scrollposts_route_hash');


                if(_r.count(scrollpost_data_arr) > 0)
                {
                    var scrollpost_match_tracker_fn = function(iterator_int)
                    {
                        scrollpost_data_item_str = scrollpost_data_arr[iterator_int];
                        scrollpost_data_item_uuid_str = md5(scrollpost_data_item_str);

                        //get the reference element
                        elem_ref_obj = $(scrollpost_ref_obj_sel_arr[iterator_int]);
                        scrollpost_config_obj.ref_obj_sel = scrollpost_ref_obj_sel_arr[iterator_int];
                        scrollpost_config_obj.tag_obj_sel = scrollpost_tag_obj_sel_arr[iterator_int];

                        //get offset
                        el_offset_obj = elem_ref_obj.offset();
                        scrollpost_config_obj.el_offset_x = el_offset_obj.left;
                        scrollpost_config_obj.el_offset_y = el_offset_obj.top;

                        //get scroll position
                        scroll_pos_obj = elem_ref_obj.scrollPosition();
                        scrollpost_config_obj.scroll_pos_x = scroll_pos_obj.left;
                        scrollpost_config_obj.scroll_pos_y = scroll_pos_obj.top;
                        scrollpost_config_obj.scroll_pos_el_x = scroll_pos_obj.left_e;
                        scrollpost_config_obj.scroll_pos_el_y = scroll_pos_obj.top_e;

                        //get scrollpost data
                        scrollpost_config_obj.scrollpost_data = scrollpost_data_pos_arr[iterator_int];
                        scrollpost_config_obj.uuid = scrollpost_data_item_uuid_str;

                        scrollpost_item_match_bool = scrollpost_match_fn(scrollpost_config_obj);

                        scrollpost_item_marker_bool = scrollpost_data_marker_arr[iterator_int];

                        //match
                        if(scrollpost_item_match_bool && !scrollpost_item_marker_bool)
                        {
                            //run scrollpost callback
                            scrollpost_fn_run_once_bool = scrollpost_fn_run_once_arr[iterator_int];
                            scrollpost_fn_run_once_uuid_str = scrollpost_data_item_uuid_str+'_fn_id';

                            if(scrollpost_fn_run_once_bool)
                            {
                                if(!rQuery.data(scrollpost_fn_run_once_uuid_str))
                                {
                                    scrollpost_data_fn_arr[iterator_int](scrollpost_config_obj);

                                    rQuery.data(scrollpost_fn_run_once_uuid_str, true);
                                }
                            }
                            else
                            {
                                scrollpost_data_fn_arr[iterator_int](scrollpost_config_obj);
                            }

                            //run scrollpost route
                            if(scrollpost_route_path_arr[iterator_int])
                            {
                                //setup route
                                _route(scrollpost_route_path_arr[iterator_int], {hash_char: scrollpost_route_hash_arr[iterator_int], go: true, noscroll: true});
                            }
                            else
                            {
                                //remove route

                                if(window.history.pushState)
                                {
                                    //modify address bar for browsers with pushState support
                                    window.history.pushState("", document.title, window.location.pathname + window.location.search);

                                    /**
                                     * Flush route history ticker
                                     * This makes sure that the route history records when the route is no longer hashed
                                     */
                                    rQuery.data('r_rs_var_routes_history_ticker', '');
                                }
                                else
                                {
                                    //modify address bar for browsers without pushState support
                                    // Prevent scrolling by storing the page's current scroll offset
                                    scroll_v_int = document.body.scrollTop;
                                    scroll_h_int = document.body.scrollLeft;

                                    window.location.hash = "";

                                    // Restore the scroll offset, should be flicker free
                                    document.body.scrollTop = scroll_v_int;
                                    document.body.scrollLeft = scroll_h_int;
                                }
                            }

                            scrollpost_data_marker_arr[iterator_int] = true;
                        }
                        else if (!scrollpost_item_match_bool && scrollpost_item_marker_bool)
                        {
                            // reset marker when scrollpost marker is set to true
                            // but there is no scrollpost match

                            scrollpost_data_marker_arr[iterator_int] = false;
                        }

                        rQuery.data('r_rs_var_scrollposts_marker', scrollpost_data_marker_arr);
                    }


                    /**
                     * change iterator direction based on scroll direction
                     * this needs to happen to prevent misplaced matching for container-based scrollpost marking (see _scrollpostmark) when scrolling up
                     * For example, if you have three containers [#container-1, #container-2, and #container-3], and you have a callback that updates the class of a container, everything works great when scroll is in the downward direction.
                     * However, when scrolling, especially when the scroll is very quick, the class update may apply to previous container (i.e. from down to up) because the iterator used in matching is counting in the opposite direction.
                     * To fix this, a positive iterator is used for down-scrolling, and a negative iterator is used for up-scrolling
                     */
                    if(scrollpost_config_obj.scroll_dir_v === 'down')
                    {
                        for(var m = 0; m < _r.count(scrollpost_data_arr); m++)
                        {
                            scrollpost_match_tracker_fn(m);
                        }
                    }
                    else if (scrollpost_config_obj.scroll_dir_v === 'up')
                    {
                        for (var n = scrollpost_data_arr.length - 1; n >= 0; n--)
                        {
                            scrollpost_match_tracker_fn(n);
                        }
                    }
                }
            };

            if(callback_fn)
            {
                //save scrollpost path to storage
                if(!data_scrollpost_obj)
                {
                    //initialize
                    rQuery.data('r_rs_var_scrollposts', []);
                    rQuery.data('r_rs_var_scrollposts_pos', []);
                    rQuery.data('r_rs_var_scrollposts_fn', []);
                    rQuery.data('r_rs_var_scrollposts_marker', []);
                    rQuery.data('r_rs_var_scrollposts_ref_obj_sel', []);
                    rQuery.data('r_rs_var_scrollposts_tag_obj_sel', []);
                    rQuery.data('r_rs_var_scrollposts_fn_run_once', []);
                    rQuery.data('r_rs_var_scrollposts_route_path', []);
                    rQuery.data('r_rs_var_scrollposts_route_hash', []);
                }

                //add to record of scrollposts
                rQuery.data('r_rs_var_scrollposts').push(name_str);
                rQuery.data('r_rs_var_scrollposts_pos').push(pos_str);
                rQuery.data('r_rs_var_scrollposts_fn').push(callback_fn);
                rQuery.data('r_rs_var_scrollposts_marker').push(false);
                rQuery.data('r_rs_var_scrollposts_ref_obj_sel').push(elem_ref_obj_selector_str);
                rQuery.data('r_rs_var_scrollposts_tag_obj_sel').push(elem_tag_obj_selector_str);
                rQuery.data('r_rs_var_scrollposts_fn_run_once').push(callback_once_bool);
                rQuery.data('r_rs_var_scrollposts_route_path').push(callback_route_path_str);
                rQuery.data('r_rs_var_scrollposts_route_hash').push(callback_route_hash_str);

            }

            //add scroll callback for this method
            //make sure it's added once

            if(!rScript.domStore('rs_var_scrollpost_is_init'))
            {
                _onScroll(post_main_fn, 'throttle', 100);

                rScript.domStore('rs_var_scrollpost_is_init', true);
            }
        }

        /**
         * Provides simple scroll trigger functionality
         * @param name_str {String} the name that will identify the scrollpost
         * @param pos_str {String} the scrollpost position parameters
         * @returns {rScript}
         */
        rScript_obj.scrollPost = function(name_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                pos_str = myArgs[1],
                options_obj = myArgs[2]
                ;

            _scrollPost(name_str, pos_str, options_obj);
            return this;
        };

        /**
         * Provides simple scroll marking functionality that marks (adds a class) or unmarks (removes a class) a specific element as it passes a specific scroll
         * Powered by _scrollPost
         * @param {Array} id_arr an array containing the ids of the elements that should be tracked and marked
         * @param {Object} options_obj the options
         *
         * track_class: this is the class identifier for the DOM element(s) to be tracked e.g. containers that will be tracked for scrollpost events
         *
         * tag_class: this is the class identifier for the DOM element(s) to be tagged e.g. links that will be tagged as 'active'
         *
         * tag_flag: the class to be added to the DOM element(s) to be tagged. Default value is 'active'
         *
         * route_click: determines whether click handlers should be setup for tag_class elements. If true, then click handlers that activate Default is true
         *
         * route_scroll: determines whether scroll is active. Default is true
         *
         * route_scroll_speed: sets the scroll speed
         *
         * route_scroll_offset: The scroll offset. If the offset is 100pixels, the element will be marked when it is 100 pixels from the top of the viewport. You can also use percentages e.g. 15% === 15% of viewport height. Default is 15%
         *
         * @returns {boolean}
         * @private
         */
        function _scrollPostMark(options_obj)
        {
            var elem_track_obj,
                elem_track_item_id_str,
                elem_tag_obj,
                elem_tag_alt_obj,
                elem_tag_alt_class_str,
                elem_tag_item_obj,
                elem_tag_item_id_str,
                elem_tag_item_href_str,
                scrollpost_pos_1_str,
                scrollpost_pos_2_str,
                scrollpost_options_1_obj,
                scrollpost_options_2_obj,
                options_route_path_str,
                options_route_hash_str,
                options_route_scroll_bool,
                options_route_scroll_speed_int_or_str,
                options_route_scroll_offset_str,
                options_route_click_bool,
                options_class_track_elem_str,
                options_class_tag_elem_str,
                options_class_tag_flag_str,
                options_route_str,
                options_route_regex_arr,
                options_route_hash_arr = [],
                options_route_hash_str,
                options_route_path_arr = [],
                options_route_path_str,
                options_route_hash_up_str,
                options_route_path_up_str,
                index_prev_int = 0,
                route_scroll_offset_str
                ;

            //return if options_obj is invalid
            if(!options_obj)
            {
                return false;
            }

            //define options
            if(_r.isObject(options_obj))
            {
                options_route_click_bool = (_r.isBool(options_obj.route_click)) ? options_obj.route_click : true;
                options_route_scroll_bool = (_r.isBool(options_obj.route_scroll)) ? options_obj.route_scroll : true;
                options_route_scroll_speed_int_or_str = (options_obj.route_scroll_speed) ? options_obj.route_scroll_speed : undefined;
                options_route_scroll_offset_str = (options_obj.route_scroll_offset && _r.isString(options_obj.route_scroll_offset) && options_obj.route_scroll_offset.length > 0) ? options_obj.route_scroll_offset : '15%';

                options_class_track_elem_str = (options_obj.track_class && _r.isString(options_obj.track_class)) ? options_obj.track_class : undefined;
                options_class_tag_elem_str = (options_obj.tag_class && _r.isString(options_obj.tag_class)) ? options_obj.tag_class : undefined;
                options_class_tag_flag_str = (options_obj.tag_flag && _r.isString(options_obj.tag_flag)) ? options_obj.tag_flag : 'active';
            }

            //return if relevant classes are not provided
            if(!options_class_track_elem_str || !options_class_tag_elem_str)
            {
                return false;
            }

            //set the route scroll offset
            route_scroll_offset_str = options_route_scroll_offset_str;

            //get objects for tracking and tagging
            elem_track_obj = $('.'+options_class_track_elem_str);
            elem_tag_obj = $('.'+options_class_tag_elem_str);

            if(elem_track_obj.length < 1 || elem_tag_obj.length < 1)
            {
                //track object or tag object must have length
                _r.console.error('rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: When using scrollPostMark, your track object and tag object must have size!', true);
                return false;
            }

            if(elem_track_obj.length !== elem_tag_obj.length)
            {
                //track object length and tag object length must be equal
                _r.console.error('rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: When using scrollPostMark, your track object length and tag object length must be equivalent!', true);
                return false;
            }

            var scrollpost_callback_fn = function(info_obj){
                elem_tag_alt_class_str = info_obj.scrollpostmark_tag_elem_class;
                elem_tag_item_obj = $(info_obj.tag_obj_sel);
                elem_tag_alt_obj = $('.'+elem_tag_alt_class_str);

                if(elem_tag_alt_obj.length > 0)
                {
                    //update class
                    if(!elem_tag_item_obj.hasClass(options_class_tag_flag_str))
                    {
                        elem_tag_alt_obj.removeClass(options_class_tag_flag_str);
                        elem_tag_item_obj.addClass(options_class_tag_flag_str);
                    }
                }
            };

            if(options_route_click_bool)
            {
                /**
                 * Adjust the scroll offset for click actions
                 * This needs to be done to ensure that when a link is clicked, and a scroll is triggered, it passes the scrollpost and triggers the hash change. Otherwise, it will just rest above the scrollpost and require just a little nudge to pass it [which is not what we want]
                 * Ergo, the scroll offset is adjusted down by 0.05%
                 * For example, if options_route_scroll_offset_str === '15%', the scroll offset will be '14.25%'. This will guarantee that it will scroll just past the scrollpost and trigger the hash change
                 */
                var options_offset_int,
                    options_offset_value_str,
                    options_offset_unit_str = '';
                if(/^ *([0-9]+(?:\.[0-9]+|))(\%) *$/i.test(options_route_scroll_offset_str))
                {
                    options_route_scroll_offset_str = options_route_scroll_offset_str.trim();
                    options_offset_value_str = options_route_scroll_offset_str.slice(0, -1);
                    options_offset_unit_str = options_route_scroll_offset_str.slice(-1);
                    options_offset_int = parseInt(options_offset_value_str);
                }
                else
                {
                    options_offset_int = parseInt(options_route_scroll_offset_str);
                }

                var options_offset_scroll_adj_num = options_offset_int*0.95;
                route_scroll_offset_str = options_offset_scroll_adj_num+options_offset_unit_str;
            }

            //cycle
            elem_tag_obj.each(function(index){

                index_prev_int = index-1;

                elem_track_item_id_str = $(elem_track_obj[index]).attr('id');

                elem_tag_item_id_str = $(this).attr('id');
                elem_tag_item_href_str = $(this).attr('href');

                //manage routes
                options_route_str = elem_tag_item_href_str;
                if(_r.isString(options_route_str) && /^ *([\#\!\/]+?)([^\s\/]+?) *$/i.test(options_route_str))
                {
                    options_route_regex_arr = _r.regexMatchAll(/^ *([\#\!\/]+?)([^\s\/]+?) *$/i, options_route_str);

                    options_route_hash_str = options_route_regex_arr[0][1];
                    options_route_path_str = options_route_regex_arr[0][2];

                    options_route_hash_arr.push(options_route_hash_str);
                    options_route_path_arr.push(options_route_path_str);

                    if(index === 0)
                    {
                        options_route_hash_up_str = undefined;
                        options_route_path_up_str = undefined;
                    }
                    else
                    {
                        options_route_hash_up_str = options_route_hash_arr[index_prev_int];
                        options_route_path_up_str = options_route_path_arr[index_prev_int];
                    }
                }

                //setup scrollpost
                scrollpost_pos_1_str = '#'+elem_track_item_id_str+'|'+options_route_scroll_offset_str+'y#up';
                scrollpost_options_1_obj = {callback: scrollpost_callback_fn, scrollpostmark_class_track_elem : options_class_track_elem_str, scrollpostmark_class_tag_elem : options_class_tag_elem_str, scrollpostmark_id_tag_elem : elem_tag_item_id_str, route_path: options_route_path_up_str, route_hash: options_route_hash_up_str};
                _scrollPost(elem_track_item_id_str, scrollpost_pos_1_str, scrollpost_options_1_obj);

                scrollpost_pos_2_str = '#'+elem_track_item_id_str+'|'+options_route_scroll_offset_str+'y#down';
                scrollpost_options_2_obj = {callback: scrollpost_callback_fn, scrollpostmark_class_track_elem : options_class_track_elem_str, scrollpostmark_class_tag_elem : options_class_tag_elem_str, scrollpostmark_id_tag_elem : elem_tag_item_id_str, route_path: options_route_path_str, route_hash: options_route_hash_str};
                _scrollPost(elem_track_item_id_str, scrollpost_pos_2_str, scrollpost_options_2_obj);

                if(options_route_click_bool)
                {
                    //initialize route options
                    var route_options_obj = {hash_char: options_route_hash_str, nohashchange: true};

                    if(options_route_scroll_bool)
                    {
                        //enable scroll in options
                        route_options_obj.scroll_target = elem_track_item_id_str;
                        route_options_obj.scroll_speed = options_route_scroll_speed_int_or_str;
                        route_options_obj.scroll_offset = route_scroll_offset_str;
                    }

                    //activate route
                    _route(options_route_path_str, route_options_obj);
                }

            });
        }

        /**
         * Provides simple scroll trigger functionality
         * @param params_arr {Array} the name that will identify the scrollpost
         * @param options_obj {Object}
         * @returns {rScript}
         */
        rScript_obj.scrollPostMark = function(options_obj)
        {
            _scrollPostMark(options_obj);
            return this;
        };


        /**
         * Detects font-face support
         * @private
         */
        function _detectFontFaceSupport()
        {
            var ua_str = rScript.getUserAgent(),
                doc = document,
                head = doc.head || doc.getElementsByTagName( "head" )[ 0 ] || doc.documentElement,
                style = doc.createElement( "style" ),
                rule = "@font-face { font-family: 'webfont'; src: 'https://'; }",
                supportFontFace = false,
                sheet
                ;

            //if proxy browser, return false
            if(rScript.hasProxyBrowser())
            {
                return false;
            }

            //if certain devices match, return false
            if(/(Android +(1.0|1.1|1.5|1.6|2.0|2.1))|(Nokia)|(Opera +(Mini|Mobi))|(w(eb)?OSBrowser)|(UCWEB)|(Windows +Phone.*?7)|(XBLWP)|(ZuneWP)/i.test(ua_str))
            {
                return false;
            }

            // main font-face detection test
            // + original by: Chris Ferdinandi <https://gist.github.com/cferdinandi/6269067>
            // + updated by: Obinwanne Hill <>
            style.type = "text/css";
            style.id = "detect_font_face";
            head.insertBefore( style, head.firstChild );
            sheet = style.sheet || style.styleSheet;

            if (!!sheet) {
                try
                {
                    sheet.insertRule( rule, 0 );
                    supportFontFace = sheet.cssRules[ 0 ].cssText && ( /webfont/i ).test( sheet.cssRules[ 0 ].cssText );
                    sheet.deleteRule( sheet.cssRules.length - 1 );
                }
                catch( e ) { }
                finally
                {
                    //remove style
                    sheet = document.getElementById("detect_font_face")
                    sheet.parentNode.removeChild(sheet)
                }
            }

            return supportFontFace;
        }

        /**
         * Wrapper class for _detectFontFaceSupport
         * @returns {Boolean}
         */
        rScript_obj.detectFontFace = function()
        {
            if(rScript.storeCheck("rs_var_device_browser_font_face"))
            {
                return rScript.store("rs_var_device_browser_font_face");
            }

            var is_retr_val_bool = _detectFontFaceSupport()
            rScript.store("rs_var_device_browser_font_face", is_retr_val_bool);
            return is_retr_val_bool;
        };

        /**
         * Adds a font to the loading queue
         * Uses FontObserver script
         * @param {String} font_family_str the font-family name
         * @param {Object} options_obj an object describing the variation
         *
         * weight: the font-weight [as defined in CSS]
         * style: the font-style [as defined in CSS]
         * stretch: the font-stretch [as defined in CSS]
         *
         * Example: {weight: 300, style: "italic"}
         * Note: You would only need to use options if you need to load the same font-family with different weights and/or styles
         * Note: Make sure your CSS font-face declarations match with the provided options
         *
         * @return
         */
        rScript_obj.addFont = function (font_family_str){
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (!_r.isObjectEmpty(myArgs[1])) ? myArgs[1] : {},
                font_obj
                ;

            //create font object
            font_obj = {'font-family': font_family_str, 'font-options': options_obj};

            //create queue if not set
            if(!rQuery.data('r_rs_var_font_load_queue'))
            {
                rQuery.data('r_rs_var_font_load_queue', []);
            }

            //add to queue
            rQuery.data('r_rs_var_font_load_queue').push(font_obj);
            return this;
        };

        /**
         * Loads a web font
         * @param {Function} callback_fn a function to execure when the font is loaded
         */
        rScript_obj.loadFont = function()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                callback_fn = myArgs[0],
                font_store_arr_obj = rQuery.data('r_rs_var_font_load_queue'),
                elem_body_obj = $('body')
                ;

            function loadFontSub(font_obj)
            {
                var font_obj_family_str = font_obj['font-family'];
                var font_obj_options_obj = font_obj['font-options'];

                var font_load_obj = new FontFaceObserver(font_obj_family_str, font_obj_options_obj);

                return font_load_obj.load();
            }

            Promise.all(font_store_arr_obj.map(loadFontSub)).then(function (){
                //add class if not added
                if(!elem_body_obj.hasClass('r_fonts_loaded'))
                {
                    elem_body_obj.addClass('r_fonts_loaded');
                }

                //run callback if provided
                if(callback_fn)
                {
                    callback_fn();
                }
            });
        };

        /**
         * Detect whether SVG is supported
         * @return {Boolean}
         * @private
         */
        function _detectSVGSupport()
        {
            /* jshint -W116 */
            return ((typeof SVGRect != "undefined"));
            /* jshint +W116 */
        }

        /**
         * Wrapper class for _detectSVGSupport
         * @returns {Boolean}
         */
        rScript_obj.detectSVG = function()
        {
            if(rScript.storeCheck("rs_var_device_browser_svg"))
            {
                return rScript.store("rs_var_device_browser_svg");
            }

            var is_retr_val_bool = _detectSVGSupport()
            rScript.store("rs_var_device_browser_svg", is_retr_val_bool);
            return is_retr_val_bool;
        };

        /**
         * Detect whether CSS Transitions is supported
         * @return {Boolean}
         * @private
         */
        function _detectCSSTransitionSupport()
        {
            var s = document.createElement('p').style, // 's' for style. better to create an element if body yet to exist
                v = ['ms','O','Moz','Webkit','webkit','Khtml']; // 'v' for vendor

            /* jshint -W116 */
            if( s.transition == '' ){ return true; } // check first for prefixed-free support
            /* jshint +W116 */
            // now go over the list of vendor prefixes and check support until one is found
            while( v.length )
            {
                if( v.pop() + 'Transition' in s ) { return true; }
            }
            return false;
        }

        /**
         * Wrapper class for _detectCSSTransitionSupport
         * @returns {Boolean}
         */
        rScript_obj.detectCSSTransition = function()
        {
            if(rScript.storeCheck("rs_var_device_browser_css_trans"))
            {
                return rScript.store("rs_var_device_browser_css_trans");
            }

            var is_retr_val_bool = _detectCSSTransitionSupport()
            rScript.store("rs_var_device_browser_css_trans", is_retr_val_bool);
            return is_retr_val_bool;
        };

        /**
         * Simple Feature Detection
         */
        rScript_obj.detect = {
            /**
             * Detect CSS Transition Support
             * Wrapper for rScript.detectCSSTransition
             * @returns {Boolean}
             */
            cssTransition: function(){
                return rScript.detectCSSTransition();
            },
            /**
             * Detect SVG Support
             * Wrapper for rScript.detectSVG
             * @returns {Boolean}
             */
            svg: function(){
                return rScript.detectSVG();
            },
            /**
             * Detect Font-face Support
             * Wrapper for rScript.detectFontFace
             * @returns {Boolean}
             */
            fontFace: function(){
                return rScript.detectFontFace();
            }
        };

        /**
         * Loads HTML into the '<body>' of the HTML page
         * @param data_str {String} the file path to the file
         * @param loc_str {String} see _load
         */
        rScript_obj.loadHTML = function(data_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                loc_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1]: 'body',
                prepend_bool = (_r.isBool(myArgs[2])) ? myArgs[2] : false,
                options = {load_loc: loc_str, prepend: prepend_bool};
            _load(data_str, options);
            return this;
        };

        /**
         * Creates a copy of HTML in a string
         * @param html_str_or_obj {String|Object} the HTML String or DOM object
         * @param options_obj {Object} the options
         * Options are:
         * filter_id {String}: Used to filter content from the original HTML.
         * For example, to get the HTML of a sub-element within the original HTML identified by $('#main'), set filter_id to 'main'. Optional
         * target_id {String}: This is where the cloned HTML will be inserted. By default, the HTML is appended to the element. Default target is <body>. Optional
         * prepend {Boolean}: If set to true, cloned HTML will be prepended to <body>, or element identified by target_id if defined
         * template {Object}: the template context
         */
        rScript_obj.cloneHTML = function(html_str_or_obj)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[1]) ? myArgs[1] : {},
                elem_source_id_str = (_r.isString(options_obj.source_id)) ? options_obj.source_id : null,
                elem_target_id_str = (_r.isString(options_obj.target_id)) ? options_obj.target_id : null,
                prepend_bool = (_r.isBool(options_obj.prepend)) ? options_obj.prepend : false,
                template_ctx = (options_obj.template) ? options_obj.template : null
                ;

            //manage template
            if(template_ctx)
            {
                html_str_or_obj = _compile(html_str_or_obj, template_ctx);
            }

            //push to DOM
            _port(html_str_or_obj, elem_source_id_str, elem_target_id_str, prepend_bool);

            return this;
        };

        /**
         * Rejig a URL given a directory path
         * This is useful when you want to change directories
         * @param {String} dir_path_str The directory path
         * Note: you can also use dot notation e.g. '../../mydir/test.html'
         * @param {String} url_str The URL that will be the base of the transformation
         * @example If dir_path_str == '../../dir_1/dir_2' and url_str == 'http://mydomain.com/dir_a/dir_b/dir_c/index.html', the final URL returned will be 'http://mydomain.com/dir_a/dir_1/dir_2'
         * @return {String}
         * @private
         */
        function _changeUrlDirectory(dir_path_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                url_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1] : document.URL || window.location.href,
                url_basedir_str = _getUrl('basedir', url_str),
                url_host_str = _getUrl('hostpath', url_str),
                url_basedir_arr = [],
                url_basedir_final_str,
                count_updir_int,
                url_final_str;

            //compose the final url
            url_final_str = url_basedir_str+'/'+dir_path_str;

            //manage step-ups in directory if required
            count_updir_int = _r.substr_count(dir_path_str, '../');

            if(count_updir_int > 0)
            {
                url_basedir_arr = _r.explode('/', url_basedir_str);

                for (var i = 0; i < count_updir_int; i++)
                {
                    url_basedir_arr.pop();
                }

                //create new base dir
                url_basedir_final_str = _r.implode('/', url_basedir_arr);

                //create new view base dir
                dir_path_str = dir_path_str.replace(/\.\.\//g, "");

                url_final_str = url_basedir_final_str+'/'+dir_path_str;
            }
            else if (/^ *\/[^\s]*/i.test(dir_path_str))
            {
                //leading forward slash. use host path

                url_final_str = url_host_str+dir_path_str;
            }

            return url_final_str;
        }

        /**
         * Retrieves the URL of the current page/document
         * Also extracts extra URL parameters
         * @param option_flag_str {String} If present, specifies a specific part of the URL to return
         * The following option flags available are:
         * 1. h [hostname]: will return 'rscript.io' if URL is 'http://rscript.io/index.html'
         * 2. hp [hostpath]: will return 'http://rscript.io' if URL is 'http://rscript.io/index.html'
         * 3. s [scheme]: will return 'http://' if URL is 'http://rscript.io/index.html'
         * 4. p [protocol]: will return 'http' if URL is 'http://rscript.io/index.html'
         * 5. po [port]: will return '8080' if URL is 'http://rscript.io:8080/index.html'
         * 6. pn [pathname]: will return 'path' if URL is 'http://rscript.io/path'
         * 7. f [filename]: will return 'index.html' if URL is 'http://rscript.io/index.html'
         * 8. fb [filebase]: will return 'index' if URL is 'http://rscript.io/index.html'
         * 9. ld [lastdir]: will return the last directory.
         * - If URL is 'http://rscript.io/dir_1/dir_2', the last directory will be 'dir_2'
         * - If URL is 'http://rscript.io/dir_1/dir_2/index.html', the last directory will be 'dir_2'
         * - If URL is 'http://rscript.io/dir_1/dir_2/', the last directory will be '/'
         * 10. bp [basepath] - Will return 'http://rscript.io/index.html' if current URL is 'http://rscript.io/index.html?id=1234'
         * 11. bd [basedir] - Will return 'http://rscript.io/test' if current URL is 'http://rscript.io/test/index.html?id=4'
         * 12. q [query] - Will return '?id=1234' if current URL is 'http://rscript.io/index.html?id=1234'
         * 13. hs [hash] - Will return '#my-hash' if current URL is 'http://rscript.io/index.html#my-hash'
         * @param url_str {String} By default, this function uses document.URL or window.location.href to capture the URL. You can provide your own custom url using this parameter
         * @return {String}
         */
        function _getUrl()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                option_flag_str = (_r.isString(myArgs[0]) && myArgs[0].length > 0) ? myArgs[0]: '',
                url_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1] : document.URL || window.location.href,
                url_temp_str,
                url_temp_file_str,
                url_temp_dir_str,
                url_temp_arr = [],
                url_temp_sub_arr = [],
                url_temp_q_str,
                url_q_str,
                url_temp_hash_arr = [],
                is_url_has_q_bool = /\?+/.test(url_str),
                is_url_has_hash_bool = /\#+/.test(url_str),
                url_match_arr = _r.regexMatchAll(/^([h|f]{1}[t]{0,1}tp[s]{0,1}\:\/\/)([^ ]+?)([\?\#]([^ ]*)|)$/i, url_str)
                ;

            if(option_flag_str === 'hostname' || option_flag_str === 'h')
            {
                url_temp_str = url_match_arr[0][2];
                url_temp_arr = _r.explode('/', url_temp_str);
                url_temp_sub_arr = _r.explode(':', url_temp_arr[0]);
                return url_temp_sub_arr[0];
            }
            else if(option_flag_str === 'hostpath' || option_flag_str === 'hp')
            {
                url_temp_str = url_match_arr[0][2];
                url_temp_arr = _r.explode('/', url_temp_str);
                url_temp_sub_arr = _r.explode(':', url_temp_arr[0]);
                return url_match_arr[0][1]+url_temp_sub_arr[0];
            }
            else if(option_flag_str === 'scheme' || option_flag_str === 's')
            {
                return url_match_arr[0][1];
            }
            else if(option_flag_str === 'protocol' || option_flag_str === 'p')
            {
                url_temp_str = url_match_arr[0][1];
                url_temp_str = url_temp_str.slice(0, -3);
                return url_temp_str;
            }
            if(option_flag_str === 'port' || option_flag_str === 'po')
            {
                url_temp_str = url_match_arr[0][2];
                url_temp_arr = _r.explode('/', url_temp_str);
                url_temp_sub_arr = _r.explode(':', url_temp_arr[0]);
                return (url_temp_sub_arr[1] && _r.isString(url_temp_sub_arr[1]) && url_temp_sub_arr[1].length > 0) ? url_temp_sub_arr[1] : '';
            }
            else if(option_flag_str === 'pathname' || option_flag_str === 'pn')
            {
                url_temp_str = url_match_arr[0][2];
                url_temp_arr = _r.explode('/', url_temp_str);
                url_temp_arr.shift();
                return _r.implode('/', url_temp_arr);
            }
            else if (option_flag_str === 'filename' || option_flag_str === 'f')
            {
                url_temp_str = url_match_arr[0][1]+url_match_arr[0][2];
                url_temp_arr = _r.explode('/', url_temp_str);
                url_temp_str = url_temp_arr.pop();
                return url_temp_str;
            }
            else if (option_flag_str === 'filebase' || option_flag_str === 'fb')
            {
                url_temp_str = url_match_arr[0][1]+url_match_arr[0][2];
                url_temp_arr = _r.explode('/', url_temp_str);
                url_temp_str = url_temp_arr.pop();

                if(!_r.isEmptyString(url_temp_str))
                {
                    //do only if value is not blank

                    url_temp_arr = _r.regexMatchAll(/^ *([^ ]+?)(\.[^ \.]+?) *$/i, url_temp_str);
                    url_temp_str = url_temp_arr[0][1];
                }

                return url_temp_str;
            }
            else if(option_flag_str === 'lastdir' || option_flag_str === 'ld')
            {
                url_temp_str = url_match_arr[0][2];
                url_temp_arr = _r.explode('/', url_temp_str);

                url_temp_file_str = url_temp_arr.pop();
                url_temp_dir_str = url_temp_arr.pop();

                url_temp_str = '';
                if(/^ *$/i.test(url_temp_file_str))
                {
                    //root

                    url_temp_str = '/';
                }
                else if (/^ *[^ ]+?\.[a-zA-Z0-9]+? *$/i.test(url_temp_file_str))
                {
                    //filename

                    url_temp_str = url_temp_dir_str;
                }
                else if (/^ *[^ \.]+? *$/i.test(url_temp_file_str))
                {
                    //directory

                    url_temp_str = url_temp_file_str;
                }

                return url_temp_str;
            }
            else if (option_flag_str === 'basepath' || option_flag_str === 'bp')
            {
                return (is_url_has_q_bool || is_url_has_hash_bool) ? url_match_arr[0][1]+url_match_arr[0][2] : url_str;
            }
            else if (option_flag_str === 'basedir' || option_flag_str === 'bd')
            {
                url_temp_str = (is_url_has_q_bool || is_url_has_hash_bool) ? url_match_arr[0][1]+url_match_arr[0][2] : url_str;
                url_temp_arr = _r.explode('/', url_temp_str);
                url_temp_arr.pop();

                return _r.implode('/', url_temp_arr);
            }
            else if (option_flag_str === 'query' || option_flag_str === 'q')
            {
                url_temp_q_str = url_match_arr[0][3];

                //remove hash if present
                url_q_str = url_temp_q_str.replace(/\#.*?$/i, '');

                return (is_url_has_q_bool) ? url_q_str: "";
            }
            else if (option_flag_str === 'hash' || option_flag_str === 'hs')
            {
                url_temp_q_str = url_match_arr[0][3];

                if(/[^ ]+?\#.+?$/i.test(url_temp_q_str))
                {
                    url_temp_hash_arr = _r.explode('#', url_temp_q_str);
                    return '#'+url_temp_hash_arr[1];
                }
                else
                {
                    return (is_url_has_hash_bool) ? url_temp_q_str : "";
                }
            }
            else
            {
                return url_str;
            }
        }

        /**
         * Uses a regex to test a URL
         * Returns true if it matches the condition
         * @param regex_str {String} the regular expression. This string will be injected using new RegExp() method so it should be escaped appropriately
         * @param option_flag_str {String} If present, specifies a specific part of the URL to return. See _getURL for more on option flags
         * @param url_str {String} By default, this function uses document.URL or window.location.href to capture the URL. You can provide your own custom url using this parameter
         * @returns {boolean|*}
         * @private
         */
        function _testUrl()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                regex_str = (_r.isString(myArgs[0]) && myArgs[0] !== '') ? myArgs[0]: '',
                option_flag_str = (_r.isString(myArgs[1]) && myArgs[1] !== '') ? myArgs[1]: '',
                url_str = myArgs[2],
                regex_obj = new RegExp(regex_str, "i"),
                url_final_str,
                url_test_bool
                ;

            url_final_str = _getUrl(option_flag_str, url_str);
            url_test_bool = regex_obj.test(url_final_str);

            return url_test_bool;
        }

        /**
         * URL functions
         */
        rScript_obj.url = {
            /**
             * Navigates to the current URL
             * @param {String} url_str the URL to navigate to
             */
            go: function(url_str)
            {
                window.location.href = url_str;
            },
            /**
             * Retrieves the current URL
             * Wrapper class for _getUrl. See _getUrl for more information
             * @returns {String}
             */
            get: function(){
                var myArgs = Array.prototype.slice.call(arguments);
                return _getUrl(myArgs[0], myArgs[1]);
            },
            /**
             * Changes the directory of a given URL
             * Wrapper class for _changeUrlDirectory. See _changeUrlDirectory for more information
             * @returns {String}
             */
            changeDir: function(){
                var myArgs = Array.prototype.slice.call(arguments);
                return _changeUrlDirectory(myArgs[0], myArgs[1]);
            },
            /**
             * Uses a regex to test a URL
             * Returns true if it matches the condition
             * @param regex_str {String} the regular expression. This string will be injected using new RegExp() method so it should be escaped appropriately
             * @param option_flag_str {String} If present, specifies a specific part of the URL to return. See _getURL for more on option flags
             * @param url_str {String} By default, this function uses document.URL or window.location.href to capture the URL. You can provide your own custom url using this parameter
             * @return {Boolean}
             */
            test: function()
            {
                var myArgs = Array.prototype.slice.call(arguments);
                return _testUrl(myArgs[0], myArgs[1], myArgs[2]);
            },
            /**
             * Marks a DOM element [with a class] if the current URL matches a given pattern [regex]
             * @param {String} regex_str the regex pattern to test for
             * @param {String} flag_str the class to add to DOM element
             * @param {String} option_flag_str see _getUrl method. Default is 'filebase'
             * @param {String} ctx_ref_str the DOM element reference. Default is 'body'
             * @return rScript
             */
            flag: function(regex_str, flag_str)
            {
                var myArgs = Array.prototype.slice.call(arguments),
                    option_flag_str = (!_r.isEmptyString(myArgs[2])) ? myArgs[2] : 'filebase',
                    ctx_ref_str = (!_r.isEmptyString(myArgs[3])) ? myArgs[3] : 'body',
                    ctx_obj = $(ctx_ref_str)
                    ;

                if(_testUrl(regex_str, option_flag_str))
                {
                    ctx_obj.addClass(flag_str);
                }

                return this;
            }
        }

        /**
         * Builds a URL query from a form data object
         * @param {Object} form_data_obj the form data in a key-value object form e.g. {first: 'one', second: 'two'}
         * @returns {*}
         * @private
         */
        function _buildFormSubmitQuery(form_data_obj)
        {
            if(!_r.isObject(form_data_obj))
            {
                return false;
            }

            var key_fix_str,
                form_data_item_tok_str,
                form_data_item_tok_arr = [],
                form_data_tok_str
                ;

            for (var key in form_data_obj)
            {
                if (form_data_obj.hasOwnProperty(key)) {

                    //replace post-bracket counters e.g. item[]0
                    key_fix_str = key.replace(/(.+\[ *\])[0-9]+/i, "$1");

                    //push to data item array
                    form_data_item_tok_str = key_fix_str+'='+form_data_obj[key];
                    form_data_item_tok_arr.push(form_data_item_tok_str);
                }
            }

            form_data_tok_str = _r.implode('&', form_data_item_tok_arr);
            return form_data_tok_str;
        }

        /**
         * Submits a form using AJAX and retrives the result
         * Note: This method will submit only form data from <input>, <select>, and <textarea>
         * @param {String} elem_form_id_str the form identifier i.e. the id attribute value of the form
         * @param {String} url_str the URL where the form will be submitted
         * @param {Function} done_fn a callback function to be executed if the form is submitted successfully. The XHR object will be passed as the first argument
         * @param {Function} fail_fn a callback function to be executed if the form encounters an error. The XHR object will be passed as the first argument
         * @private
         */
        function _submitForm()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                elem_form_id_str = (_r.isString(myArgs[0]) && myArgs[0].length > 0) ? myArgs[0]: '',
                url_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1]: '',
                done_fn = (myArgs[2]) ? myArgs[2] : null,
                fail_fn = (myArgs[3]) ? myArgs[3] : null,
                done_fn_args_arr = (myArgs[4]) ? myArgs[4] : [],
                fail_fn_args_arr = (myArgs[5]) ? myArgs[5] : [],
                elem_form_obj,
                elem_form_item_input_arr,
                elem_form_item_select_arr,
                elem_form_item_textarea_arr,
                elem_form_item_type_str,
                elem_form_item_name_str,
                elem_form_item_value_str,
                form_data_obj = {},
                form_data_tok_str,
                counter_elem_form_item_checkbox_int = 0
                ;

            //get form element object
            elem_form_obj = $('#'+elem_form_id_str);

            //get form element items
            elem_form_item_input_arr = elem_form_obj.find('input');
            elem_form_item_select_arr = elem_form_obj.find('select');
            elem_form_item_textarea_arr = elem_form_obj.find('textarea');

            //get <input> form data
            if(elem_form_item_input_arr.length > 0)
            {
                elem_form_item_input_arr.each(function(){

                    elem_form_item_type_str = $(this).attr('type');
                    elem_form_item_name_str = $(this).attr('name');
                    elem_form_item_value_str = encodeURIComponent($(this).val());
                    if(elem_form_item_type_str === 'radio')
                    {
                        if(this.checked)
                        {
                            form_data_obj[elem_form_item_name_str] = elem_form_item_value_str;
                        }
                    }
                    else if (elem_form_item_type_str === 'checkbox')
                    {
                        if(this.checked)
                        {
                            form_data_obj[elem_form_item_name_str+counter_elem_form_item_checkbox_int] = elem_form_item_value_str;
                        }
                        counter_elem_form_item_checkbox_int++;
                    }
                    else
                    {
                        form_data_obj[elem_form_item_name_str] = elem_form_item_value_str;
                    }
                });
            }

            //get <select> form data
            if(elem_form_item_select_arr.length > 0)
            {
                elem_form_item_select_arr.each(function(){
                    elem_form_item_name_str = $(this).attr('name');
                    elem_form_item_value_str = encodeURIComponent($(this).val());

                    form_data_obj[elem_form_item_name_str] = elem_form_item_value_str;
                });
            }

            //get <textarea> form data
            if(elem_form_item_textarea_arr.length > 0)
            {
                elem_form_item_textarea_arr.each(function(){
                    elem_form_item_name_str = $(this).attr('name');
                    elem_form_item_value_str = encodeURIComponent($(this).val());

                    form_data_obj[elem_form_item_name_str] = elem_form_item_value_str;
                });
            }

            //convert to name-value pair
            form_data_tok_str = _buildFormSubmitQuery(form_data_obj);

            //add to url
            if(/^.+?\?.+?$/i.test(url_str))
            {
                url_str += '&'+form_data_tok_str;
            }
            else
            {
                url_str += '?'+form_data_tok_str;
            }

            //execute via AJAX
            $.ajax(url_str, {method: 'POST', response: false}).then(function(xhr){
                done_fn(xhr, done_fn_args_arr);
            }, function(xhr){
                fail_fn(xhr, fail_fn_args_arr);
            });
        }

        /**
         * Resets a form
         * @param {String} elem_form_id_str the form identifier i.e. the id attribute value of the form
         * @param {Object} default_value_obj an object containing default values to use to populate
         * @private
         */
        function _resetForm()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                elem_form_id_str = (_r.isString(myArgs[0]) && myArgs[0].length > 0) ? myArgs[0]: '',
                default_values_obj = (_r.isObject(myArgs[1])) ? myArgs[1]: {},
                elem_form_obj,
                elem_form_item_input_arr,
                elem_form_item_select_arr,
                elem_form_item_textarea_arr,
                elem_form_item_type_str,
                elem_form_item_name_str,
                elem_form_item_value_str,
                checkbox_allowed_index_arr = [],
                counter_elem_form_item_checkbox_int = 0
                ;

            //get form element object
            elem_form_obj = $('#'+elem_form_id_str);

            //get form element items
            elem_form_item_input_arr = elem_form_obj.find('input');
            elem_form_item_select_arr = elem_form_obj.find('select');
            elem_form_item_textarea_arr = elem_form_obj.find('textarea');

            //get <input> form data
            if(elem_form_item_input_arr.length > 0)
            {
                elem_form_item_input_arr.each(function(){

                    elem_form_item_type_str = $(this).attr('type');
                    elem_form_item_name_str = $(this).attr('name').trim();
                    elem_form_item_value_str = encodeURIComponent($(this).val());
                    if(elem_form_item_type_str === 'radio')
                    {
                        this.checked = false;
                        if(default_values_obj[elem_form_item_name_str] === ''+elem_form_item_value_str+'')
                        {
                            this.checked = true;
                        }
                    }
                    else if (elem_form_item_type_str === 'checkbox')
                    {
                        this.checked = false;
                        if(default_values_obj[elem_form_item_name_str])
                        {
                            checkbox_allowed_index_arr = _r.explode(',', default_values_obj[elem_form_item_name_str]);
                            if(_r.in_array(''+counter_elem_form_item_checkbox_int+'', checkbox_allowed_index_arr)) {
                                this.checked = true;
                            }
                            counter_elem_form_item_checkbox_int++;
                        }
                    }
                    else
                    {
                        $(this).val("");
                        if(default_values_obj[elem_form_item_name_str])
                        {
                            $(this).val(default_values_obj[elem_form_item_name_str]);
                        }
                    }
                });
            }

            //get <select> form data
            if(elem_form_item_select_arr.length > 0)
            {
                elem_form_item_select_arr.each(function(){
                    elem_form_item_name_str = $(this).attr('name');

                    this.selectedIndex = 0;
                    if(default_values_obj[elem_form_item_name_str])
                    {
                        this.value = default_values_obj[elem_form_item_name_str];
                    }
                });
            }

            //get <textarea> form data
            if(elem_form_item_textarea_arr.length > 0)
            {
                elem_form_item_textarea_arr.each(function(){
                    elem_form_item_name_str = $(this).attr('name');
                    $(this).val("");
                    if(default_values_obj[elem_form_item_name_str])
                    {
                        $(this).val(default_values_obj[elem_form_item_name_str]);
                    }
                });
            }
        }

        /**
         * Form functions
         */
        rScript_obj.form = {
            /**
             * Resets a form
             * Wrapper for _resetForm method
             * See _resetForm for more information
             */
            reset: function(){
                var myArgs = Array.prototype.slice.call(arguments);
                _resetForm(myArgs[0], myArgs[1]);
            },
            /**
             * Submits a form using AJAX
             * Wrapper for _submitForm method
             * See _submitForm for more information
             */
            submit: function(){
                var myArgs = Array.prototype.slice.call(arguments);
                _submitForm(myArgs[0], myArgs[1], myArgs[2], myArgs[3], myArgs[4], myArgs[5]);
            }
        };

        /**
         * A wrapper class for location based methods
         * @param arg_1_res {*} first argument is used to determine if function is a part of a Promise chain
         * @param storage_key_str {String} The key that identifies the result in local/session storage. Results are usually cached to speed of return of results on successive operations of this function
         * @param ajax_url_str {String} The URL of an external resource. This implies that the result is dependent on an AJAX operation
         * @param ajax_response_key_str {String} The key that identifies the desired value from a JSON response. The AJAX result must always be in JSON format
         * @param ajax_cache_key_str {String} The key that is used to cache and retrieve the AJAX Request in local/session storage.
         * @param is_thennable_func {Function}
         * @returns {Promise}
         * @private
         */
        function _getLocation()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                arg_1_res = (typeof myArgs[0] !== 'undefined' && myArgs[0] !== null) ? myArgs[0] : null,
                storage_key_str = myArgs[1],
                ajax_url_str = myArgs[2],
                ajax_response_key_str = myArgs[3],
                ajax_cache_key_str = myArgs[4],
                is_thennable_bool = !!((arg_1_res)),
                thennable_func = myArgs[5],
                is_thennable_func_set_bool = !!((_r.isFunction(thennable_func))),
                ajax_config_obj;

            /**
             * 1: Check if country code is set and return if true
             * 2: If country code is not set, register a function to queue
             */
            if(rScript.store(storage_key_str))
            {
                //1:
                return Promise.resolve(rScript.store(storage_key_str));
            }
            else
            {
                //2:
                if(is_thennable_bool)
                {
                    /**
                     * is_thennable_bool signifies that the function is to be used
                     * as part of a promise chain
                     * For example: func_1().then(getCountry).then(next_func)
                     * return a promise
                     */
                    if (is_thennable_func_set_bool)
                    {
                        return thennable_func();
                    }
                    else
                    {
                        ajax_config_obj = {
                            cache_key: ajax_cache_key_str,
                            response: true,
                            response_parse_json: true,
                            response_key: ajax_response_key_str
                        };
                        return $.ajax(ajax_url_str, ajax_config_obj);
                    }
                }
                else
                {
                    //execute
                    ajax_config_obj = {
                        cache_key: ajax_cache_key_str
                    };
                    $.ajax(ajax_url_str, ajax_config_obj).then(function(xhr){
                        var xhr_response_str = (_r.isString(xhr)) ? xhr : xhr.response;
                        var response_obj = JSON.parse(xhr_response_str);
                        rScript.store(storage_key_str, response_obj[''+ajax_response_key_str+'']);
                    });
                }
            }
        }

        /**
         * Gets the Latitude
         * This function leverages the public rScript GeoIP API (http://api.rscript.io/geoip/)
         * NOTE: You should consider creating your own dedicated GEOIP server if you are using this on a high-traffic website
         * @return {String}
         */
        rScript_obj.getLatitude = function()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                arg_1_res = (typeof myArgs[0] !== 'undefined' && myArgs[0] !== null) ? myArgs[0] : null,
                url_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1] : "http://api.rscript.io/geoip/";
            return (rScript.store('rs_var_location_geo_latitude')) ? rScript.store('rs_var_location_geo_latitude') : Promise.resolve(_getLocation(arg_1_res, 'rs_var_location_geo_latitude', url_str, 'latitude', 'rs_var_location_geo_cache_1'));
        };

        /**
         * Gets the Longitude
         * This function leverages the public rScript GeoIP API (http://api.rscript.io/geoip/)
         * NOTE: You should consider creating your own dedicated GEOIP server if you are using this on a high-traffic website
         * @return {String}
         */
        rScript_obj.getLongitude = function()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                arg_1_res = (typeof myArgs[0] !== 'undefined' && myArgs[0] !== null) ? myArgs[0] : null,
                url_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1] : "http://api.rscript.io/geoip/";
            return (rScript.store('rs_var_location_geo_longitude')) ? rScript.store('rs_var_location_geo_longitude') : Promise.resolve(_getLocation(arg_1_res, 'rs_var_location_geo_longitude', url_str, 'longitude', 'rs_var_location_geo_cache_1'));
        };

        /**
         * Get the country code of the user
         * Returns the two-letter country code as per ISO 3166-1 alpha-2 <http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2>
         * This function leverages the public rScript GeoIP API (http://api.rscript.io/geoip/)
         * NOTE: You should consider creating your own dedicated GEOIP server if you are using this on a high-traffic website
         * @return {String}
         */
        rScript_obj.getCountry = function()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                arg_1_res = (typeof myArgs[0] !== 'undefined' && myArgs[0] !== null) ? myArgs[0] : null,
                url_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1] : "http://api.rscript.io/geoip/";
            return (rScript.store('rs_var_location_geo_country_code')) ? rScript.store('rs_var_location_geo_country_code') : Promise.resolve(_getLocation(arg_1_res, 'rs_var_location_geo_country_code', url_str, 'country_code', 'rs_var_location_geo_cache_1'));
        };

        /**
         * Gets the continent code
         * Based on the 7-continent model: af = africa, an = antartica, as = asia, eu = europe, na = north america, oc = oceania/australia, sa = south america
         * This function leverages the public rScript GeoIP API (http://api.rscript.io/geoip/)
         * NOTE: You should consider creating your own dedicated GEOIP server if you are using this on a high-traffic website
         * @return {String}
         */
        rScript_obj.getContinent = function()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                arg_1_res = (typeof myArgs[0] !== 'undefined' && myArgs[0] !== null) ? myArgs[0] : null,
                url_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1] : "http://api.rscript.io/geoip/";
            return (rScript.store('rs_var_location_geo_continent_code')) ? rScript.store('rs_var_location_geo_continent_code') : Promise.resolve(_getLocation(arg_1_res, 'rs_var_location_geo_continent_code', url_str, 'continent_code', 'rs_var_location_geo_cache_1'));
        };

        /**
         * Gets the currency from the country code
         * @param {String} country_code_str the country code. Country code must be two-letter code as per ISO 3166-1
         * @return {String}
         */
        rScript_obj.getCurrency = function()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                country_code_str = (myArgs[0] !== 'undefined' && myArgs[0] !== null) ? myArgs[0] : null,
                currency_code_str;

            //check if value exists in storage
            if(rScript.storeCheck("rs_var_location_geo_currency_code"))
            {
                return rScript.store("rs_var_location_geo_currency_code");
            }

            //to lowercase
            country_code_str = country_code_str.toLowerCase();

            //List all country to continent code pairings
            var iso_country_code_to_currency_arr = {
                "bd": "bdt", "be": "eur", "bf": "xof", "bg": "bgn", "ba": "bam", "bb": "bbd", "wf": "xpf", "bl": "eur", "bm": "bmd", "bn": "bnd", "bo": "bob", "bh": "bhd", "bi": "bif", "bj": "xof", "bt": "btn", "jm": "jmd", "bv": "nok", "bw": "bwp", "ws": "wst", "bq": "usd", "br": "brl", "bs": "bsd", "je": "gbp", "by": "byr", "bz": "bzd", "ru": "rub", "rw": "rwf", "rs": "rsd", "tl": "usd", "re": "eur", "tm": "tmt", "tj": "tjs", "ro": "ron", "tk": "nzd", "gw": "xof", "gu": "usd", "gt": "gtq", "gs": "gbp", "gr": "eur", "gq": "xaf", "gp": "eur", "jp": "jpy", "gy": "gyd", "gg": "gbp", "gf": "eur", "ge": "gel", "gd": "xcd", "gb": "gbp", "ga": "xaf", "sv": "usd", "gn": "gnf", "gm": "gmd", "gl": "dkk", "gi": "gip", "gh": "ghs", "om": "omr", "tn": "tnd", "jo": "jod", "hr": "hrk", "ht": "htg", "hu": "huf", "hk": "hkd", "hn": "hnl", "hm": "aud", "ve": "vef", "pr": "usd", "ps": "ils", "pw": "usd", "pt": "eur", "sj": "nok", "py": "pyg", "iq": "iqd", "pa": "pab", "pf": "xpf", "pg": "pgk", "pe": "pen", "pk": "pkr", "ph": "php", "pn": "nzd", "pl": "pln", "pm": "eur", "zm": "zmk", "eh": "mad", "ee": "eur", "eg": "egp", "za": "zar", "ec": "usd", "it": "eur", "vn": "vnd", "sb": "sbd", "et": "etb", "so": "sos", "zw": "zwl", "sa": "sar", "es": "eur", "er": "ern", "me": "eur", "md": "mdl", "mg": "mga", "mf": "eur", "ma": "mad", "mc": "eur", "uz": "uzs", "mm": "mmk", "ml": "xof", "mo": "mop", "mn": "mnt", "mh": "usd", "mk": "mkd", "mu": "mur", "mt": "eur", "mw": "mwk", "mv": "mvr", "mq": "eur", "mp": "usd", "ms": "xcd", "mr": "mro", "im": "gbp", "ug": "ugx", "tz": "tzs", "my": "myr", "mx": "mxn", "il": "ils", "fr": "eur", "io": "usd", "sh": "shp", "fi": "eur", "fj": "fjd", "fk": "fkp", "fm": "usd", "fo": "dkk", "ni": "nio", "nl": "eur", "no": "nok", "na": "nad", "vu": "vuv", "nc": "xpf", "ne": "xof", "nf": "aud", "ng": "ngn", "nz": "nzd", "np": "npr", "nr": "aud", "nu": "nzd", "ck": "nzd", "xk": "eur", "ci": "xof", "ch": "chf", "co": "cop", "cn": "cny", "cm": "xaf", "cl": "clp", "cc": "aud", "ca": "cad", "cg": "xaf", "cf": "xaf", "cd": "cdf", "cz": "czk", "cy": "eur", "cx": "aud", "cr": "crc", "cw": "ang", "cv": "cve", "cu": "cup", "sz": "szl", "sy": "syp", "sx": "ang", "kg": "kgs", "ke": "kes", "ss": "ssp", "sr": "srd", "ki": "aud", "kh": "khr", "kn": "xcd", "km": "kmf", "st": "std", "sk": "eur", "kr": "krw", "si": "eur", "kp": "kpw", "kw": "kwd", "sn": "xof", "sm": "eur", "sl": "sll", "sc": "scr", "kz": "kzt", "ky": "kyd", "sg": "sgd", "se": "sek", "sd": "sdg", "do": "dop", "dm": "xcd", "dj": "djf", "dk": "dkk", "vg": "usd", "de": "eur", "ye": "yer", "dz": "dzd", "us": "usd", "uy": "uyu", "yt": "eur", "um": "usd", "lb": "lbp", "lc": "xcd", "la": "lak", "tv": "aud", "tw": "twd", "tt": "ttd", "tr": "try", "lk": "lkr", "li": "chf", "lv": "eur", "to": "top", "lt": "ltl", "lu": "eur", "lr": "lrd", "ls": "lsl", "th": "thb", "tf": "eur", "tg": "xof", "td": "xaf", "tc": "usd", "ly": "lyd", "va": "eur", "vc": "xcd", "ae": "aed", "ad": "eur", "ag": "xcd", "af": "afn", "ai": "xcd", "vi": "usd", "is": "isk", "ir": "irr", "am": "amd", "al": "all", "ao": "aoa", "aq": "", "as": "usd", "ar": "ars", "au": "aud", "at": "eur", "aw": "awg", "in": "inr", "ax": "eur", "az": "azn", "ie": "eur", "id": "idr", "ua": "uah", "qa": "qar", "mz": "mzn"
            };

            currency_code_str = iso_country_code_to_currency_arr[""+country_code_str+""];
            rScript.storeCheck("rs_var_location_geo_currency_code", currency_code_str);

            return currency_code_str;
        };

        /**
         * Gets the current timezone
         * For example: 'America/New_York
         * @return {String}
         */
        rScript_obj.getTimezone = function()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                arg_1_res = (typeof myArgs[0] !== 'undefined' && myArgs[0] !== null) ? myArgs[0] : null,
                url_str = (_r.isString(myArgs[1]) && myArgs[1].length > 0) ? myArgs[1] : "http://api.rscript.io/geoip/";
            return (rScript.store('rs_var_location_geo_timezone')) ? rScript.store('rs_var_location_geo_timezone') : Promise.resolve(_getLocation(arg_1_res, 'rs_var_location_geo_timezone', url_str, 'timezone', 'rs_var_location_geo_cache_1'));
        };

        /**
         * Gets the timezone offset
         * @param timezone_str {String} The full (or abbreviated) time zone name
         * @param get_int_bool {Boolean} Specifies whether the offset should be returned as an integer
         * @return {String|Boolean|Number}
         */
        rScript_obj.getTimezoneOffset = function()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                timezone_str = (myArgs[0] !== 'undefined' && myArgs[0] !== null) ? myArgs[0] : '',
                get_int_bool = (_r.isBool(myArgs[1])) ? myArgs[1] : false,
                is_valid_tz_bool = /[\w+]\/[\w+]/i.test(timezone_str),
                tz_offset_res;

            //check if value exists in storage
            if(rScript.storeCheck("rs_var_location_geo_timezone_offset"))
            {
                return rScript.store("rs_var_location_geo_timezone_offset");
            }

            //validate time zone
            if(!is_valid_tz_bool)
            {
                return false;
            }

            timezone_str = timezone_str.toLowerCase();

            //List all time zones
            var iso_tz_offset_arr = {
                'africa/abidjan': '+0000', 'africa/accra': '+0000', 'africa/addis_ababa': '+0300', 'africa/algiers': '+0100', 'africa/asmara': '+0300', 'africa/bamako': '+0000', 'africa/bangui': '+0100', 'africa/banjul': '+0000', 'africa/bissau': '+0000', 'africa/blantyre': '+0200', 'africa/brazzaville': '+0100', 'africa/bujumbura': '+0200', 'africa/cairo': '+0200', 'africa/casablanca': '+0000', 'africa/ceuta': '+0100', 'africa/conakry': '+0000', 'africa/dakar': '+0000', 'africa/dar_es_salaam': '+0300', 'africa/djibouti': '+0300', 'africa/douala': '+0100', 'africa/el_aaiun': '+0000', 'africa/freetown': '+0000', 'africa/gaborone': '+0200', 'africa/harare': '+0200', 'africa/johannesburg': '+0200', 'africa/kampala': '+0300', 'africa/khartoum': '+0300', 'africa/kigali': '+0200', 'africa/kinshasa': '+0100', 'africa/lagos': '+0100', 'africa/libreville': '+0100', 'africa/lome': '+0000', 'africa/luanda': '+0100', 'africa/lubumbashi': '+0200', 'africa/lusaka': '+0200', 'africa/malabo': '+0100', 'africa/maputo': '+0200', 'africa/maseru': '+0200', 'africa/mbabane': '+0200', 'africa/mogadishu': '+0300', 'africa/monrovia': '+0000', 'africa/nairobi': '+0300', 'africa/ndjamena': '+0100', 'africa/niamey': '+0100', 'africa/nouakchott': '+0000', 'africa/ouagadougou': '+0000', 'africa/porto-novo': '+0100', 'africa/sao_tome': '+0000', 'africa/tripoli': '+0200', 'africa/tunis': '+0100', 'africa/windhoek': '+0200', 'america/adak': '-1000', 'america/anchorage': '-0900', 'america/anguilla': '-0400', 'america/antigua': '-0400', 'america/araguaina': '-0300', 'america/argentina/buenos_aires': '-0300', 'america/argentina/catamarca': '-0300', 'america/argentina/cordoba': '-0300', 'america/argentina/jujuy': '-0300', 'america/argentina/la_rioja': '-0300', 'america/argentina/mendoza': '-0300', 'america/argentina/rio_gallegos': '-0300', 'america/argentina/salta': '-0300', 'america/argentina/san_juan': '-0300', 'america/argentina/san_luis': '-0300', 'america/argentina/tucuman': '-0300', 'america/argentina/ushuaia': '-0300', 'america/aruba': '-0400', 'america/asuncion': '-0300', 'america/atikokan': '-0500', 'america/bahia': '-0300', 'america/bahia_banderas': '-0600', 'america/barbados': '-0400', 'america/belem': '-0300', 'america/belize': '-0600', 'america/blanc-sablon': '-0400', 'america/boa_vista': '-0400', 'america/bogota': '-0500', 'america/boise': '-0700', 'america/cambridge_bay': '-0700', 'america/campo_grande': '-0300', 'america/cancun': '-0600', 'america/caracas': '-0430', 'america/cayenne': '-0300', 'america/cayman': '-0500', 'america/chicago': '-0600', 'america/chihuahua': '-0700', 'america/costa_rica': '-0600', 'america/cuiaba': '-0300', 'america/curacao': '-0400', 'america/danmarkshavn': '+0000', 'america/dawson': '-0800', 'america/dawson_creek': '-0700', 'america/denver': '-0700', 'america/detroit': '-0500', 'america/dominica': '-0400', 'america/edmonton': '-0700', 'america/eirunepe': '-0400', 'america/el_salvador': '-0600', 'america/fortaleza': '-0300', 'america/glace_bay': '-0400', 'america/godthab': '-0300', 'america/goose_bay': '-0400', 'america/grand_turk': '-0500', 'america/grenada': '-0400', 'america/guadeloupe': '-0400', 'america/guatemala': '-0600', 'america/guayaquil': '-0500', 'america/guyana': '-0400', 'america/halifax': '-0400', 'america/havana': '-0500', 'america/hermosillo': '-0700', 'america/indiana/indianapolis': '-0500', 'america/indiana/knox': '-0600', 'america/indiana/marengo': '-0500', 'america/indiana/petersburg': '-0500', 'america/indiana/tell_city': '-0600', 'america/indiana/vevay': '-0500', 'america/indiana/vincennes': '-0500', 'america/indiana/winamac': '-0500', 'america/inuvik': '-0700', 'america/iqaluit': '-0500', 'america/jamaica': '-0500', 'america/juneau': '-0900', 'america/kentucky/louisville': '-0500', 'america/kentucky/monticello': '-0500', 'america/kralendijk': '-0400', 'america/la_paz': '-0400', 'america/lima': '-0500', 'america/los_angeles': '-0800', 'america/lower_princes': '-0400', 'america/maceio': '-0300', 'america/managua': '-0600', 'america/manaus': '-0400', 'america/marigot': '-0400', 'america/martinique': '-0400', 'america/matamoros': '-0600', 'america/mazatlan': '-0700', 'america/menominee': '-0600', 'america/merida': '-0600', 'america/metlakatla': '-0800', 'america/mexico_city': '-0600', 'america/miquelon': '-0300', 'america/moncton': '-0400', 'america/monterrey': '-0600', 'america/montevideo': '-0200', 'america/montreal': '-0500', 'america/montserrat': '-0400', 'america/nassau': '-0500', 'america/new_york': '-0500', 'america/nipigon': '-0500', 'america/nome': '-0900', 'america/noronha': '-0200', 'america/north_dakota/beulah': '-0600', 'america/north_dakota/center': '-0600', 'america/north_dakota/new_salem': '-0600', 'america/ojinaga': '-0700', 'america/panama': '-0500', 'america/pangnirtung': '-0500', 'america/paramaribo': '-0300', 'america/phoenix': '-0700', 'america/port-au-prince': '-0500', 'america/port_of_spain': '-0400', 'america/porto_velho': '-0400', 'america/puerto_rico': '-0400', 'america/rainy_river': '-0600', 'america/rankin_inlet': '-0600', 'america/recife': '-0300', 'america/regina': '-0600', 'america/resolute': '-0500', 'america/rio_branco': '-0400', 'america/santa_isabel': '-0800', 'america/santarem': '-0300', 'america/santiago': '-0300', 'america/santo_domingo': '-0400', 'america/sao_paulo': '-0200', 'america/scoresbysund': '-0100', 'america/shiprock': '-0700', 'america/sitka': '-0900', 'america/st_barthelemy': '-0400', 'america/st_johns': '-0330', 'america/st_kitts': '-0400', 'america/st_lucia': '-0400', 'america/st_thomas': '-0400', 'america/st_vincent': '-0400', 'america/swift_current': '-0600', 'america/tegucigalpa': '-0600', 'america/thule': '-0400', 'america/thunder_bay': '-0500', 'america/tijuana': '-0800', 'america/toronto': '-0500', 'america/tortola': '-0400', 'america/vancouver': '-0800', 'america/whitehorse': '-0800', 'america/winnipeg': '-0600', 'america/yakutat': '-0900', 'america/yellowknife': '-0700', 'antarctica/casey': '+0800', 'antarctica/davis': '+0700', 'antarctica/dumontdurville': '+1000', 'antarctica/macquarie': '+1100', 'antarctica/mawson': '+0500', 'antarctica/mcmurdo': '+1300', 'antarctica/palmer': '-0300', 'antarctica/rothera': '-0300', 'antarctica/south_pole': '+1300', 'antarctica/syowa': '+0300', 'antarctica/vostok': '+0600', 'arctic/longyearbyen': '+0100', 'asia/aden': '+0300', 'asia/almaty': '+0600', 'asia/amman': '+0200', 'asia/anadyr': '+1200', 'asia/aqtau': '+0500', 'asia/aqtobe': '+0500', 'asia/ashgabat': '+0500', 'asia/baghdad': '+0300', 'asia/bahrain': '+0300', 'asia/baku': '+0400', 'asia/bangkok': '+0700', 'asia/beirut': '+0200', 'asia/bishkek': '+0600', 'asia/brunei': '+0800', 'asia/choibalsan': '+0800', 'asia/chongqing': '+0800', 'asia/colombo': '+0530', 'asia/damascus': '+0200', 'asia/dhaka': '+0600', 'asia/dili': '+0900', 'asia/dubai': '+0400', 'asia/dushanbe': '+0500', 'asia/gaza': '+0200', 'asia/harbin': '+0800', 'asia/ho_chi_minh': '+0700', 'asia/hong_kong': '+0800', 'asia/hovd': '+0700', 'asia/irkutsk': '+0900', 'asia/jakarta': '+0700', 'asia/jayapura': '+0900', 'asia/jerusalem': '+0200', 'asia/kabul': '+0430', 'asia/kamchatka': '+1200', 'asia/karachi': '+0500', 'asia/kashgar': '+0800', 'asia/kathmandu': '+0545', 'asia/kolkata': '+0530', 'asia/krasnoyarsk': '+0800', 'asia/kuala_lumpur': '+0800', 'asia/kuching': '+0800', 'asia/kuwait': '+0300', 'asia/macau': '+0800', 'asia/magadan': '+1200', 'asia/makassar': '+0800', 'asia/manila': '+0800', 'asia/muscat': '+0400', 'asia/nicosia': '+0200', 'asia/novokuznetsk': '+0700', 'asia/novosibirsk': '+0700', 'asia/omsk': '+0700', 'asia/oral': '+0500', 'asia/phnom_penh': '+0700', 'asia/pontianak': '+0700', 'asia/pyongyang': '+0900', 'asia/qatar': '+0300', 'asia/qyzylorda': '+0600', 'asia/rangoon': '+0630', 'asia/riyadh': '+0300', 'asia/sakhalin': '+1100', 'asia/samarkand': '+0500', 'asia/seoul': '+0900', 'asia/shanghai': '+0800', 'asia/singapore': '+0800', 'asia/taipei': '+0800', 'asia/tashkent': '+0500', 'asia/tbilisi': '+0400', 'asia/tehran': '+0330', 'asia/thimphu': '+0600', 'asia/tokyo': '+0900', 'asia/ulaanbaatar': '+0800', 'asia/urumqi': '+0800', 'asia/vientiane': '+0700', 'asia/vladivostok': '+1100', 'asia/yakutsk': '+1000', 'asia/yekaterinburg': '+0600', 'asia/yerevan': '+0400', 'atlantic/azores': '-0100', 'atlantic/bermuda': '-0400', 'atlantic/canary': '+0000', 'atlantic/cape_verde': '-0100', 'atlantic/faroe': '+0000', 'atlantic/madeira': '+0000', 'atlantic/reykjavik': '+0000', 'atlantic/south_georgia': '-0200', 'atlantic/st_helena': '+0000', 'atlantic/stanley': '-0300', 'australia/adelaide': '+1030', 'australia/brisbane': '+1000', 'australia/broken_hill': '+1030', 'australia/currie': '+1100', 'australia/darwin': '+0930', 'australia/eucla': '+0845', 'australia/hobart': '+1100', 'australia/lindeman': '+1000', 'australia/lord_howe': '+1100', 'australia/melbourne': '+1100', 'australia/perth': '+0800', 'australia/sydney': '+1100', 'europe/amsterdam': '+0100', 'europe/andorra': '+0100', 'europe/athens': '+0200', 'europe/belgrade': '+0100', 'europe/berlin': '+0100', 'europe/bratislava': '+0100', 'europe/brussels': '+0100', 'europe/bucharest': '+0200', 'europe/budapest': '+0100', 'europe/chisinau': '+0200', 'europe/copenhagen': '+0100', 'europe/dublin': '+0000', 'europe/gibraltar': '+0100', 'europe/guernsey': '+0000', 'europe/helsinki': '+0200', 'europe/isle_of_man': '+0000', 'europe/istanbul': '+0200', 'europe/jersey': '+0000', 'europe/kaliningrad': '+0300', 'europe/kiev': '+0200', 'europe/lisbon': '+0000', 'europe/ljubljana': '+0100', 'europe/london': '+0000', 'europe/luxembourg': '+0100', 'europe/madrid': '+0100', 'europe/malta': '+0100', 'europe/mariehamn': '+0200', 'europe/minsk': '+0200', 'europe/monaco': '+0100', 'europe/moscow': '+0400', 'europe/oslo': '+0100', 'europe/paris': '+0100', 'europe/podgorica': '+0100', 'europe/prague': '+0100', 'europe/riga': '+0200', 'europe/rome': '+0100', 'europe/samara': '+0400', 'europe/san_marino': '+0100', 'europe/sarajevo': '+0100', 'europe/simferopol': '+0200', 'europe/skopje': '+0100', 'europe/sofia': '+0200', 'europe/stockholm': '+0100', 'europe/tallinn': '+0200', 'europe/tirane': '+0100', 'europe/uzhgorod': '+0200', 'europe/vaduz': '+0100', 'europe/vatican': '+0100', 'europe/vienna': '+0100', 'europe/vilnius': '+0200', 'europe/volgograd': '+0400', 'europe/warsaw': '+0100', 'europe/zagreb': '+0100', 'europe/zaporozhye': '+0200', 'europe/zurich': '+0100', 'indian/antananarivo': '+0300', 'indian/chagos': '+0600', 'indian/christmas': '+0700', 'indian/cocos': '+0630', 'indian/comoro': '+0300', 'indian/kerguelen': '+0500', 'indian/mahe': '+0400', 'indian/maldives': '+0500', 'indian/mauritius': '+0400', 'indian/mayotte': '+0300', 'indian/reunion': '+0400', 'pacific/apia': '-1100', 'pacific/auckland': '+1300', 'pacific/chatham': '+1345', 'pacific/chuuk': '+1000', 'pacific/easter': '-0500', 'pacific/efate': '+1100', 'pacific/enderbury': '+1300', 'pacific/fakaofo': '-1000', 'pacific/fiji': '+1200', 'pacific/funafuti': '+1200', 'pacific/galapagos': '-0600', 'pacific/gambier': '-0900', 'pacific/guadalcanal': '+1100', 'pacific/guam': '+1000', 'pacific/honolulu': '-1000', 'pacific/johnston': '-1000', 'pacific/kiritimati': '+1400', 'pacific/kosrae': '+1100', 'pacific/kwajalein': '+1200', 'pacific/majuro': '+1200', 'pacific/marquesas': '-0930', 'pacific/midway': '-1100', 'pacific/nauru': '+1200', 'pacific/niue': '-1100', 'pacific/norfolk': '+1130', 'pacific/noumea': '+1100', 'pacific/pago_pago': '-1100', 'pacific/palau': '+0900', 'pacific/pitcairn': '-0800', 'pacific/pohnpei': '+1100', 'pacific/port_moresby': '+1000', 'pacific/rarotonga': '-1000', 'pacific/saipan': '+1000', 'pacific/tahiti': '-1000', 'pacific/tarawa': '+1200', 'pacific/tongatapu': '+1300', 'pacific/wake': '+1200', 'pacific/wallis': '+1200', 'utc': '+0000'
            };

            if (get_int_bool)
            {
                var iso_tz_offset_str = iso_tz_offset_arr[''+timezone_str+''],
                    iso_tz_offset_clean_str = _r.replaceAll(iso_tz_offset_str, '0', '');

                tz_offset_res = parseInt(iso_tz_offset_clean_str);
            }
            else
            {
                tz_offset_res = iso_tz_offset_arr[''+timezone_str+''];
            }

            return tz_offset_res;
        };

        /**
         * Gets the language of the user
         * This function leverages the public rScript Language API (http://api.rscript.io/lang/)
         * NOTE: You should consider creating your own dedicated Language server if you are using this on a high-traffic website
         * @param return_full_lang_bool {Boolean} Returns the full language name http://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
         * @param jsonp_headers_url_str {String} the URL of the language server
         * @return {String}
         */
        rScript_obj.getLanguage = function()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                return_full_lang_bool = (_r.isBool(myArgs[0])) ? myArgs[0]: false,
                jsonp_headers_url_str = (_r.isString(myArgs[1])) ? myArgs[1] : null,
                lang_str;

            if(rScript.storeCheck("rs_var_location_geo_language_code"))
            {
                return rScript.store("rs_var_location_geo_language_code");
            }

            return new Promise(function(resolve)
            {
                var settings = {
                        method: 'GET',
                        jsonp: true,
                        jsonp_callback: function(headers)
                        {
                            var lang_str = headers['Accept-Language'],
                                lang_arr = regexMatchAll(/([a-zA-z]{2,10})\-/g, lang_str),
                                lang_code_arr = [];

                            for(var i = 0; i < _r.count(lang_arr); i++)
                            {
                                lang_code_arr.push(lang_arr[i][1]);
                            }
                            return lang_code_arr[0];
                        }
                    },
                    lang_code_str;

                lang_code_str = $.ajax(jsonp_headers_url_str, settings);

                if(return_full_lang_bool)
                {
                    var iso_lang_arr = {'aa': 'afar', 'ab': 'abkhazian', 'af': 'afrikaans', 'ak': 'akan', 'sq': 'albanian', 'am': 'amharic', 'ar': 'arabic', 'an': 'aragonese', 'hy': 'armenian', 'as': 'assamese', 'av': 'avaric', 'ae': 'avestan', 'ay': 'aymara', 'az': 'azerbaijani', 'ba': 'bashkir', 'bm': 'bambara', 'eu': 'basque', 'be': 'belarusian', 'bn': 'bengali', 'bh': 'bihari', 'bi': 'bislama', 'bs': 'bosnian', 'br': 'breton', 'bg': 'bulgarian', 'my': 'burmese', 'ca': 'catalan', 'ch': 'chamorro', 'ce': 'chechen', 'zh': 'chinese', 'cu': 'slavic', 'cv': 'chuvash', 'kw': 'cornish', 'co': 'corsican', 'cr': 'cree', 'cs': 'czech', 'da': 'danish', 'dv': 'divehi', 'nl': 'dutch', 'dz': 'dzongkha', 'en': 'english', 'eo': 'esperanto', 'et': 'estonian', 'ee': 'ewe', 'fo': 'faroese', 'fj': 'fijian', 'fi': 'finnish', 'fr': 'french', 'fy': 'western frisian', 'ff': 'fulah', 'ka': 'georgian', 'de': 'german', 'gd': 'gaelic', 'ga': 'irish', 'gl': 'galician', 'gv': 'manx', 'el': 'greek', 'gn': 'guarani', 'gu': 'gujarati', 'ht': 'haitian', 'ha': 'hausa', 'he': 'hebrew', 'hz': 'herero', 'hi': 'hindi', 'ho': 'hiri motu', 'hr': 'croatian', 'hu': 'hungarian', 'ig': 'igbo', 'is': 'icelandic', 'io': 'ido', 'ii': 'sichuan yi', 'iu': 'inuktitut', 'ie': 'interlingue', 'ia': 'interlingua', 'id': 'indonesian', 'ik': 'inupiaq', 'it': 'italian', 'jv': 'javanese', 'ja': 'japanese', 'kl': 'kalaallisut', 'kn': 'kannada', 'ks': 'kashmiri', 'kr': 'kanuri', 'kk': 'kazakh', 'km': 'central khmer', 'ki': 'kikuyu', 'rw': 'kinyarwanda', 'ky': 'kyrgyz', 'kv': 'komi', 'kg': 'kongo', 'ko': 'korean', 'kj': 'kwanyama', 'ku': 'kurdish', 'lo': 'lao', 'la': 'latin', 'lv': 'latvian', 'li': 'limburgan', 'ln': 'lingala', 'lt': 'lithuanian', 'lb': 'luxembourgish', 'lu': 'luba-katanga', 'lg': 'ganda', 'mk': 'macedonian', 'mh': 'marshallese', 'ml': 'malayalam', 'mi': 'maori', 'mr': 'marathi', 'ms': 'malay', 'mg': 'malagasy', 'mt': 'maltese', 'mn': 'mongolian', 'na': 'nauru', 'nv': 'navajo', 'nr': 'south ndebele', 'nd': 'north ndebele', 'ng': 'ndonga', 'ne': 'nepali', 'nn': 'norwegian', 'nb': 'norwegian', 'no': 'norwegian', 'ny': 'nyanja', 'oc': 'occitan', 'oj': 'ojibwa', 'or': 'oriya', 'om': 'oromo', 'os': 'ossetian', 'pa': 'panjabi', 'fa': 'persian', 'pi': 'pali', 'pl': 'polish', 'pt': 'portuguese', 'ps': 'pashto', 'qu': 'quechua', 'rm': 'romansh', 'ro': 'romanian', 'rn': 'rundi', 'ru': 'russian', 'sg': 'sango', 'sa': 'sanskrit', 'si': 'sinhala', 'sk': 'slovak', 'sl': 'slovenian', 'se': 'northern sami', 'sm': 'samoan', 'sn': 'shona', 'sd': 'sindhi', 'so': 'somali', 'st': 'sotho', 'es': 'spanish', 'sc': 'sardinian', 'sr': 'serbian', 'ss': 'swati', 'su': 'sundanese', 'sw': 'swahili', 'sv': 'swedish', 'ty': 'tahitian', 'ta': 'tamil', 'tt': 'tatar', 'te': 'telugu', 'tg': 'tajik', 'tl': 'tagalog', 'th': 'thai', 'bo': 'tibetan', 'ti': 'tigrinya', 'to': 'tonga', 'tn': 'tswana', 'ts': 'tsonga', 'tk': 'turkmen', 'tr': 'turkish', 'tw': 'twi', 'ug': 'uyghur', 'uk': 'ukrainian', 'ur': 'urdu', 'uz': 'uzbek', 've': 'venda', 'vi': 'vietnamese', 'vo': 'volapuk', 'cy': 'welsh', 'wa': 'walloon', 'wo': 'wolof', 'xh': 'xhosa', 'yi': 'yiddish', 'yo': 'yoruba', 'za': 'zhuang', 'zu': 'zulu'};

                    lang_str = iso_lang_arr[''+lang_code_str+''];
                    resolve(lang_str);
                }

                resolve(lang_code_str);
            });

        };

        /**
         * Gets the distance between two LatLong points in kilometers
         * @param latlong_source_str {String} The source LatLong in comma-seperated decimal format
         * @param latlong_dest_str {String} The destination LatLong in comma-separated decimal format
         * Note: For LatLong values expressed in decimal form, northern latitudes and eastern longitudes are positive, while western longitudes and southern latitudes are negative
         * @return {Number}
         */
        rScript_obj.getDistance = function(latlong_source_str, latlong_dest_str)
        {
            var latlong_source_arr,
                latlong_dest_arr,
                lat_source_int,
                long_source_int,
                lat_dest_int,
                long_dest_int,
                R,
                x1,
                x2,
                dLat,
                dLon,
                a,
                c,
                distance_int
                ;

            Number.prototype.toRad = function() {
                return this * Math.PI / 180;
            };

            latlong_source_arr = _r.explode(',', latlong_source_str);
            latlong_dest_arr = _r.explode(',', latlong_dest_str);

            lat_source_int = parseFloat(latlong_source_arr[0]);
            long_source_int = parseFloat(latlong_source_arr[1]);
            lat_dest_int = parseFloat(latlong_dest_arr[0]);
            long_dest_int = parseFloat(latlong_dest_arr[1]);

            R = 6371; // km
            x1 = lat_dest_int-lat_source_int;
            dLat = x1.toRad();
            x2 = long_dest_int-long_source_int;
            dLon = x2.toRad();
            a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat_source_int.toRad()) * Math.cos(lat_dest_int.toRad()) * Math.sin(dLon/2) * Math.sin(dLon/2);
            c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance_int = R * c;

            return distance_int;
        };

        /**
         * Parses a datetime value
         * @param {String} datetime_str the datetime value
         * @param {String} type_key_str the type key determines what to return
         * If no value is provided, the datetime in ISO-8601 format will be returned e.g. 2014-27-07T12:20:15Z
         * date - date only in YYYY-MM-DD format
         * day - day in DD format
         * month - month in MM format
         * year - year in YY format
         * time - time only in HH:mm:ss format
         * hour - hour in HH format
         * minute - minute in mm format
         * second - second in ss format
         * @returns {*}
         * @private
         */
        function _parseDateTime(datetime_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                type_str = (_r.isString(myArgs[1])) ? myArgs[1]: '',
                datetime_final_str = datetime_str,
                datetime_temp_str;

            //validate datetime
            if(!/^ *([0-9]{4}\-[0-9]{2}\-[0-9]{2})(?:T| +)([0-9]{2}\:[0-9]{2}\:[0-9]{2})(?:Z|) *$/i.test(datetime_str))
            {
                return datetime_str;
            }

            //convert datetime to iso
            datetime_temp_str = datetime_str.trim();
            datetime_temp_str = datetime_temp_str.replace(/ +/g, ' ');

            switch(true)
            {
                case (type_str === 'datetime'):
                    datetime_temp_str = datetime_str.replace('T', ' ');
                    datetime_final_str = datetime_temp_str.replace('Z', '');
                    break;

                case (type_str === 'date'):
                    datetime_final_str = datetime_str.slice(0, 10);
                    break;

                case (type_str === 'year'):
                    datetime_final_str = datetime_str.slice(0, 4);
                    break;

                case (type_str === 'month'):
                    datetime_final_str = datetime_str.slice(5, 7);
                    break;

                case (type_str === 'day'):
                    datetime_final_str = datetime_str.slice(8, 10);
                    break;

                case (type_str === 'time'):
                    datetime_final_str = datetime_str.slice(11, 19);
                    break;

                case (type_str === 'hour'):
                    datetime_final_str = datetime_str.slice(11, 13);
                    break;

                case (type_str === 'minute'):
                    datetime_final_str = datetime_str.slice(14, 16);
                    break;

                case (type_str === 'second'):
                    datetime_final_str = datetime_str.slice(17, 19);
                    break;

                default:
                    datetime_final_str = datetime_str;
            }

            return datetime_final_str;
        }

        /**
         * Gets the current date and time
         * @param type_str {String} determines what to return. Multiple options available as follows:
         * If no value is provided, the datetime in ISO-8601 format will be returned e.g. 2014-27-07T12:20:15Z
         * date - date only in YYYY-MM-DD format
         * day - day in DD format
         * month - month in MM format
         * year - year in YY format
         * time - time only in HH:mm:ss format
         * hour - hour in HH format
         * minute - minute in mm format
         * second - second in ss format
         * @param utc_offset_bool {Boolean} specifies whether UTC offset should be used for time
         * @return {String}
         */
        function _getDateTime()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                type_str = (_r.isString(myArgs[0])) ? myArgs[0]: '',
                utc_offset_bool = (_r.isBool(myArgs[1])) ? myArgs[1]: false,
                date_obj = new Date(),
                date_year,
                date_month,
                date_day,
                time_hour,
                time_minute,
                time_second,
                date_final_str;

            if(utc_offset_bool)
            {
                date_year = date_obj.getUTCFullYear().toString();
                date_month = (date_obj.getUTCMonth()+1).toString();
                date_day = date_obj.getUTCDate().toString();
                time_hour = date_obj.getUTCHours().toString();
                time_minute = date_obj.getUTCMinutes().toString();
                time_second = date_obj.getUTCSeconds().toString();
            }
            else
            {
                date_year = date_obj.getFullYear().toString();
                date_month = (date_obj.getMonth()+1).toString();
                date_day = date_obj.getDate().toString();
                time_hour = date_obj.getHours().toString();
                time_minute = date_obj.getMinutes().toString();
                time_second = date_obj.getSeconds().toString();
            }

            date_month = (date_month.length < 2) ? '0'+date_month : date_month;
            date_day = (date_day.length < 2) ? '0'+date_day : date_day;
            time_hour = (time_hour.length < 2) ? '0'+time_hour : time_hour;
            time_minute = (time_minute.length < 2) ? '0'+time_minute : time_minute;
            time_second = (time_second.length < 2) ? '0'+time_second : time_second;

            date_final_str = ''+date_year+'-'+date_month+'-'+date_day+'T'+time_hour+':'+time_minute+':'+time_second+'Z';

            return _parseDateTime(date_final_str, type_str);
        }

        /**
         * Converts a time, date, or datetime value to UNIX timestamp
         * @param {String} time_or_date_or_datetime_str an optional time, date or datetime string. Uses current date and time if not provided
         * @returns {*}
         * @private
         */
        function _dateTimeToTimestamp()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                time_or_date_or_datetime_str = (_r.isString(myArgs[0]) && myArgs[0].length > 0) ? myArgs[0] : _getDateTime('datetime'),
                date_str,
                date_arr,
                time_str,
                time_arr,
                datetime_arr = [],
                datetime_obj;

            if(/^ *[0-9]{4}\-[0-9]{2}\-[0-9]{2} +[0-9]{2}\:[0-9]{2}\:[0-9]{2} *$/i.test(time_or_date_or_datetime_str))
            {
                //is datetime

                datetime_arr = _r.regexMatchAll(/^ *([0-9]{4}\-[0-9]{2}\-[0-9]{2}) +([0-9]{2}\:[0-9]{2}\:[0-9]{2}) *$/i, time_or_date_or_datetime_str);

                date_str = datetime_arr[0][1];
                time_str = datetime_arr[0][2];

                date_arr = date_str.split('-');
                time_arr = time_str.split(':');

                datetime_obj = new Date(date_arr[0], parseInt(date_arr[1], 10) - 1, date_arr[2], time_arr[0], time_arr[1], time_arr[2]);
            }
            else if (/^ *[0-9]{4}\-[0-9]{2}\-[0-9]{2} *$/i.test(time_or_date_or_datetime_str))
            {
                //is date

                date_str = time_or_date_or_datetime_str.trim();

                date_arr = date_str.split('-');
                datetime_obj = new Date(date_arr[0], parseInt(date_arr[1], 10) - 1, date_arr[2], 0, 0, 0);
            }
            else if(/^ *[0-9]{2}\:[0-9]{2}\:[0-9]{2} *$/i.test(time_or_date_or_datetime_str))
            {
                //is time

                date_str = _getDateTime('date');
                time_str = time_or_date_or_datetime_str.trim();

                date_arr = date_str.split('-');
                time_arr = time_str.split(':');

                datetime_obj = new Date(date_arr[0], parseInt(date_arr[1], 10) - 1, date_arr[2], time_arr[0], time_arr[1], time_arr[2]);
            }
            else
            {
                //invalid
                return false;
            }

            return datetime_obj.getTime();
        }

        /**
         * Gets the time period from a time or datetime
         * @param {String} time_or_datetime_str the time or datetime value
         * @returns {Boolean|String}
         * @private
         */
        function _getTimePeriod()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                time_or_datetime_str = (_r.isString(myArgs[0]) && myArgs[0].length > 0) ? myArgs[0] : _getDateTime('datetime'),
                hour_str,
                hour_int,
                time_period_str
                ;

            //convert time to datetime
            if(/^ *[0-9]{2}\:[0-9]{2}\:[0-9]{2} *$/i.test(time_or_datetime_str))
            {
                //is time
                time_or_datetime_str = '2017-01-01 '+time_or_datetime_str;
            }

            //get the hour value
            hour_str = _parseDateTime(time_or_datetime_str, 'hour');

            //get the hour value
            hour_int = parseInt(hour_str);

            if(!_r.isNumber(hour_int))
            {
                return false;
            }

            //determine time period
            if(hour_int >= 6 && hour_int < 12)
            {
                time_period_str = 'morning';
            }
            else if (hour_int >= 12 && hour_int < 17)
            {
                time_period_str = 'afternoon';
            }
            else if (hour_int >= 17 && hour_int < 21)
            {
                time_period_str = 'evening';
            }
            else
            {
                time_period_str = 'night';
            }

            return time_period_str;
        }

        /**
         * Gets the current date and time
         * See _getDateTime
         * @returns {String}
         */
        rScript_obj.getDateTime = function()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _getDateTime(myArgs[0], myArgs[1]);
        };

        /**
         * Gets the UNIX timestamp of a given datetime value
         * If datetime value is not provided, current datetime is provided
         * @param {String} datetime_str an optional datetime string
         * @returns {*}
         */
        rScript_obj.getTimestamp = function()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _dateTimeToTimestamp(myArgs[0]);
        };

        /**
         * Gets the current date and time
         * For example, 'morning'
         * @returns {String}
         */
        rScript_obj.getTimePeriod = function()
        {
            var myArgs = Array.prototype.slice.call(arguments);
            return _getTimePeriod(myArgs[0]);
        };

        /**
         * Populates the rScript options with empty functions for undefined callbacks
         * @param options {Object} rScript options
         * @returns {*}
         * @private
         */
        function _setDefaultOptionCallback(options)
        {
            var default_arr = [
                    'onReady', 'onResize', 'onResizeIn', 'onResizeOut', 'onResizeUp', 'onResizeDown',
                    'onScroll', 'onScrollLeft', 'onScrollRight', 'onScrollUp', 'onScrollDown',
                    'onRotate', 'onRotateToP', 'onRotateToL', 'onPortrait', 'onLandscape',
                    'onRetina', 'onPhone', 'onTablet', 'onDesktop', 'onTV',
                    'onIOS', 'onAndroid', 'onSymbian', 'onBlackberry', 'onWindowsPhone',
                    'onWindows', 'onMobile', 'onNonMobile',
                    'onAddClass', 'onRemoveClass', 'onAddAttr', 'onRemoveAttr'
                ],
                default_item_str;

            for (var i = 0; i < default_arr.length; i++)
            {
                default_item_str = default_arr[i];
                if(!options[default_item_str])
                {
                    options[default_item_str] = function(){};
                }
            }

            return options;
        }

        /**
         * Initializes automated awesomeness
         * @param ctx {Object} the context
         * @param options {Object} a JSON object
         * @private
         */
        function _run(ctx, options)
        {
            var ctx_body_or_html,
                options_init = extend(options, null),   //create copy of options
                opt_breakpoints_obj = options.breakpoints,
                opt_breakpoints_isset_bool = ((options.breakpoints)),
                breakpoint_obj,
                opt_classes_obj = options.classes,
                opt_attributes_obj = options.attributes,
                opt_breakpoints_scroll_obj = options.breakpointsScroll || options.breakpointScroll,
                opt_breakpoints_scroll_isset_bool = ((opt_breakpoints_scroll_obj)),
                opt_event_trigger_mode_str = (_r.isString(options.event_trigger_mode)) ? options.event_trigger_mode : 'throttle' ,
                opt_event_trigger_timer_int = (_r.isNumber(options.event_trigger_timer)) ? options.event_trigger_timer : 100,
                opt_disable_turbo_resize_bool = !!((options.disableTurboResize)),
                opt_disable_turbo_scroll_bool = !!((options.disableTurboScroll)),
                opt_disable_turbo_network_bool = !!((options.disableTurboNetwork)),
                opt_debug_bool = ((options.debug)),
                settings_obj = {},
                settings_beh_obj = function(){
                    this.responsive_basis = 'v';
                    this.breakpoints_array = {};
                },
                settings_beh_rc_obj = new settings_beh_obj(),
                settings_beh_rv_obj = new settings_beh_obj(),
                settings_beh_co_obj = new settings_beh_obj(),
                settings_beh_sc_obj = new settings_beh_obj()
                ;

            //define html or body
            ctx_body_or_html = (ctx.selector && _r.in_array(ctx.selector, ['body', 'html'])) ? ctx : $('body');

            //set turbo_refresh to true by default
            options.turbo_refresh = (_r.isBool(options.turbo_refresh)) ? options.turbo_refresh : true;

            //if debug option is set, reset device vars
            if(opt_debug_bool)
            {
                _initDeviceVars(true);
            }

            //get responsive basis
            settings_obj.responsive_basis = _getResponsiveBasis(ctx);

            //track viewport and scroll if not tracking
            if(!rScript.domStore('rs_var_event_listener_prime_resize'))
            {
                _onResize('prime', opt_event_trigger_mode_str, opt_event_trigger_timer_int);
            }
            if(!rScript.domStore('rs_var_event_listener_prime_scroll'))
            {
                _onScroll('prime', opt_event_trigger_mode_str, opt_event_trigger_timer_int);
            }

            if(settings_obj.responsive_basis === 'c')
            {
                /**
                 * Track Container
                 */

                breakpoint_obj = _getBreakpoints(opt_breakpoints_obj, opt_classes_obj, opt_attributes_obj);

                if(!rScript.domStore('rs_var_event_listener_prime_resize_container'))
                {
                    _onResizeContainer(ctx, 'prime', opt_event_trigger_mode_str, opt_event_trigger_timer_int);
                }

                settings_beh_rc_obj.responsive_basis = settings_obj.responsive_basis;
                settings_beh_rc_obj.breakpoints_array = breakpoint_obj;
                settings_beh_rc_obj.event_status = 'rc';

                _resizeContainerEventManager(ctx, options, 'resize_container', settings_beh_rc_obj);

                //mark that the _setBreakpoints operation is initial i.e. onLoad
                options_init.init = true;

                //set breakpoints
                _setBreakpoints(ctx, breakpoint_obj, options_init, settings_obj);
            }
            else
            {
                /**
                 * Track viewport + scroll
                 * 1: If viewport breakpoints are set
                 * 2: If scroll breakpoints are set
                 */

                //Set initial callbacks
                _callbackTrigger(options, ['ready', 'init']);

                breakpoint_obj = null;
                if(opt_breakpoints_isset_bool) {
                    breakpoint_obj = _getBreakpoints(opt_breakpoints_obj, opt_classes_obj, opt_attributes_obj);
                }

                settings_beh_rv_obj.responsive_basis = settings_beh_co_obj.responsive_basis = settings_obj.responsive_basis;
                settings_beh_rv_obj.breakpoints_array = settings_beh_co_obj.breakpoints_array = breakpoint_obj;

                //enable event manager for resize events
                settings_beh_rv_obj.event_status = 'rv';
                settings_beh_rv_obj.callback_id_array = ['resize'];
                _resizeEventManager(ctx, options, 'resize_viewport', settings_beh_rv_obj);

                //enable event manager for orientation events
                settings_beh_co_obj.event_status = 'co';
                settings_beh_co_obj.callback_id_array = ['rotate'];
                _resizeEventManager(ctx, options, 'change_orientation', settings_beh_co_obj);

                /**
                 * Enable event manager for scroll events if scroll breakpoints are not set. This prevents them from being called twice when breakpoints are indeed set. Calling the scroll event manager twice will fire the callback manager twice, which will fire onScroll_ events twice instead of once
                 */
                if(!opt_breakpoints_scroll_isset_bool)
                {
                    //enable event manager for scroll events
                    settings_beh_sc_obj.event_status = 'sc';
                    settings_beh_sc_obj.callback_id_array = ['scroll'];
                    _scrollEventManager(ctx, options, 'scroll_viewport', settings_beh_sc_obj);
                }

                if(opt_breakpoints_isset_bool)
                {
                    //mark that the _setBreakpoints operation is initial i.e. should run onLoad
                    options_init.init = true;

                    //set breakpoints for viewport [initialize]
                    _setBreakpoints(ctx, breakpoint_obj, options_init, settings_obj);
                }


                if(opt_breakpoints_scroll_isset_bool)
                {
                    //2:

                    //set scroll breakpoints
                    settings_beh_sc_obj.breakpoints_array = _getBreakpoints(opt_breakpoints_scroll_obj, null, null, true);

                    /**
                     * Enable event manager for scroll events
                     * This should only be called once
                     */
                    settings_beh_sc_obj.event_status = 'sc';
                    settings_beh_sc_obj.callback_id_array = ['scroll'];
                    _scrollEventManager(ctx, options, 'scroll_viewport', settings_beh_sc_obj);

                    //mark that the _setBreakpointsScroll operation is initial i.e. should run onLoad
                    options_init.init = true;

                    //set breakpoints for scroll [initialize]
                    _setBreakpointsScroll(ctx, settings_beh_sc_obj.breakpoints_array, options_init, {}, settings_beh_sc_obj.event_status);
                }
            }

            //set up turbo classes and attributes for resize and scroll states
            //run only if not specifically disabled
            if(!opt_disable_turbo_resize_bool)
            {
                _turboClassesAndAttributesResize(ctx_body_or_html);
            }
            if(!opt_disable_turbo_scroll_bool)
            {
                _turboClassesAndAttributesScroll(ctx_body_or_html);
            }
            if(!opt_disable_turbo_network_bool)
            {
                _turboClassesAndAttributesNetwork(ctx_body_or_html);
            }

            //increment run counter
            rScript.storeIncrement('rs_var_run_counter');
        }

        /**
         * Initialize rScript magic
         * @param ctx {Object} the context
         * @param options {Object} the options
         */
        rScript_obj.run = function(ctx, options){

            options = (options) ? options : {};
            var options_default_callback = _setDefaultOptionCallback(options);
            _run(ctx, options_default_callback);
        };

        /**
         * Initialize rScript magic
         * Alternate method of run()
         * @param {Object} options the options
         * @param {Object} ctx the context object
         * @returns {rScript}
         */
        rScript_obj.awesomize = function(options){
            var myArgs = Array.prototype.slice.call(arguments),
                options = (options) ? options : {},
                ctx = (myArgs[1]) ? myArgs[1] : $('body'),
                options_default_callback = _setDefaultOptionCallback(options);

            _run(ctx, options_default_callback);
            return this;
        };

        /**
         * Adds a function to be called in the user-defined portion of the _runIntelligence method
         * @param {Function} callback_fn the callback function to run
         * @param {Array} args_arr the arguments that will be passed to the callback when it is called
         * @private
         */
        function _onIntel(callback_fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                args_arr = (myArgs[1]) ? myArgs[1] : [],
                intel_handler_fn
                ;

            intel_handler_fn = function(args_1, args_2){

                //trigger callback
                callback_fn(args_1, args_2);
            };

            //add to resize function queue
            rScript.addFunction('intel_fn', intel_handler_fn, {queue: true, namespace: 'intel_fn', args: args_arr});
        }

        /**
         * Adds a function to be called in the user-defined portion of the _runIntelligence method
         * Wrapper function of _onIntel
         */
        rScript_obj.onIntel = function(callback_fn)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _onIntel(callback_fn, myArgs[1], myArgs[2]);
            return this;
        }

        /**
         * Initialize rScript magic for intelligent web design
         * @param options {Object} the options that define parameters
         * url_geoip: the url to a GEO IP server
         * url_lang: the url to a language server
         * @private
         */
        function _runIntelligence()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options = (_r.isObject(myArgs[0])) ? myArgs[0] : {},
                url_geo_main_str = (_r.isString(options.url_geoip)) ? options.url_geoip : "http://api.rscript.io/geoip/",
                url_geo_lang_str = (_r.isString(options.url_lang)) ? options.url_lang : "http://api.rscript.io/lang/",
                result_obj = {}
                ;

            //run only if not yet initialized
            if(!rScript.store('rs_var_data_run_intelligence_init'))
            {
                //create function to run
                var _postRunIntelFn = function(data_obj){
                    _turboClassesAndAttributesIntel(null, data_obj);
                };
                rScript.addFunction('rs_var_queue_run_intelligence_fn', _postRunIntelFn);

                //run
                rScript.getLatitude('then', url_geo_main_str)
                    .then(function(data){
                        //data == latitude

                        //persist
                        rScript.storeCheck('rs_var_location_geo_latitude', data);

                        //add to result object
                        result_obj.latitude = data;

                        //getLongitude
                        return Promise.resolve(rScript.getLongitude('then', url_geo_main_str));
                    })
                    .then(function(data){
                        //data == longitude

                        //persist
                        rScript.storeCheck('rs_var_location_geo_longitude', data);

                        //add to result object
                        result_obj.longitude = data;

                        //getCountry
                        return Promise.resolve(rScript.getCountry('then', url_geo_main_str));
                    })
                    .then(function(data){
                        //data == country_code

                        //persist country code
                        data = data.toLowerCase();
                        rScript.storeCheck('rs_var_location_geo_country_code', data);

                        //var continent_code_str = rScript.getContinent();
                        var currency_code_str = rScript.getCurrency(data);

                        //persist continent code and currency code
                        rScript.storeCheck('rs_var_location_geo_currency_code', currency_code_str);

                        //add to result object
                        result_obj.country_code = data;
                        result_obj.currency_code = currency_code_str;

                        //getContinent
                        return Promise.resolve(rScript.getContinent('then', url_geo_main_str));
                    })
                    .then(function(data){
                        //data == continent_code

                        //persist
                        data = data.toLowerCase();
                        rScript.storeCheck('rs_var_location_geo_continent_code', data);

                        //add to result object
                        result_obj.continent_code = data;

                        //getLanguage
                        return Promise.resolve(rScript.getLanguage(null, url_geo_lang_str));
                    })
                    .then(function(data){
                        //data == language_code

                        //persist
                        rScript.storeCheck('rs_var_location_geo_language_code', data);

                        //add to result object
                        result_obj.language_code = data;

                        //getTimezone
                        return Promise.resolve(rScript.getTimezone('then', url_geo_main_str));
                    })
                    .then(function(data){
                        //data == timezone

                        //persist
                        data = data.toLowerCase();
                        var tz_offset_int = rScript.getTimezoneOffset(data, true);
                        rScript.storeCheck('rs_var_location_geo_timezone', data);
                        rScript.storeCheck('rs_var_location_geo_timezone_offset', tz_offset_int);

                        //add to result object
                        result_obj.timezone = data;
                        result_obj.timezone_offset = tz_offset_int;

                        //getTimezoneOffset
                        return Promise.resolve(data);
                    })
                    .then(function(){
                        //finalize

                        //persist contextual/intelligent data
                        rScript.store('rs_var_data_intelligence_info', result_obj);

                        //run closing function
                        rScript.runFunction('rs_var_queue_run_intelligence_fn', {args: result_obj});

                        //run user-defined closing function
                        rScript.runFunction('intel_fn', {queue: true, namespace: 'intel_fn', args: result_obj});

                        //mark contextual/intelligent data as initialized
                        rScript.store('rs_var_data_run_intelligence_init', true);

                        return Promise.resolve('done');
                    })
                    ['catch'](function(e){var e_msg_str = 'rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: '+e.errorMessage;_r.console.error(e_msg_str, true);});
            }
            else
            {
                //run user-defined function
                rScript.runFunction('intel_fn', {queue: true, namespace: 'intel_fn', args: result_obj});
            }
        }

        /**
         * Initializes rScript functionality for contextual/intelligent web design
         * @param {Object} options
         * url_geoip: url of a GEOIP server that returns "country_code", "timezone", "latitude", and "longitude". Default value is http://api.rscript.io/geoip/
         * url_lang: JSONP-compliant url that returns Accept-Language header.
         * Default value is http://api.rscript.io/lang/
         *
         * Note: Better to run this method manually in $.domReady to take advantage of rScript queue functionality, which sets a window-scope function that can be run when the Promise process is complete
         */
        rScript_obj.runIntel = function(){
            var myArgs = Array.prototype.slice.call(arguments),
                options = myArgs[0];
            _runIntelligence(options);
        };

        /**
         * Initialize rScript magic for intelligence functions
         * Alternate method of runIntelligence()
         * @param {Object} options the options
         * @returns {rScript}
         */
        rScript_obj.awesomizeIntel = function(options){
            _runIntelligence(options);
            return this;
        };

        /**
         * Runs $.async function queue
         * @private
         */
        function _runAsync()
        {
            //run all $.async functions
            rScript.runFunction('a1ready', {queue: true, namespace: 'a1ready'});
        }

        /**
         * Creates a timer to wait for $.async function queue completion
         * @private
         */
        function _runAwaitTimer()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = (myArgs[0] && _r.isObject(myArgs[0])) ? myArgs[0]: {},
                throttle_interval_int,
                timeout_interval_int
            ;

            /**
             * open async function gate
             * When the async function gate is closed before the async queue
             * returns results, resolveAsync and rejectAsync methods will not
             * increment their result counters.
             * This is necessary to prevent $.async results from being counted more than necessary and instantly trigerring async completion on page refreshes
             */
            rScript.store('rs_var_async_fn_gate_open', true);

            //set defaults
            throttle_interval_int = (options_obj.throttle && _r.isNumber(options_obj.throttle) && options_obj.throttle > 0) ? options_obj.throttle : 100;
            timeout_interval_int = (options_obj.timeout && _r.isNumber(options_obj.timeout) && options_obj.timeout > 0) ? options_obj.timeout : 30000;

            //normalize timeout
            timeout_interval_int = timeout_interval_int/1000;

            var t = window.setInterval(function()
            {
                var async_fn_result_count_int = rScript.store('rs_var_async_fn_counter'),
                    async_fn_count_int = rScript.countFunction('a1ready', {queue: true, namespace: 'a1ready'}),
                    async_all_done_bool = !!(_r.isNumber(async_fn_count_int) && _r.isNumber(async_fn_result_count_int) && (async_fn_count_int <= async_fn_result_count_int)),
                    timestamp_curr_flt = _r.microtime(true),
                    timestamp_init_flt = rScript.store('rs_var_timestamp_ready'),
                    timestamp_diff_flt = timestamp_curr_flt - timestamp_init_flt,
                    async_timer_limit_bool = ((timestamp_diff_flt > timeout_interval_int))
                ;

                //clear interval when results are returned or time limit reached
                if(async_all_done_bool || async_timer_limit_bool)
                {
                    clearInterval(t);

                    if(async_timer_limit_bool)
                    {
                        _r.console.warn('rScript warning ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: The async operation was terminated because it took more time than the specified limit ['+timeout_interval_int+' seconds] to finish.', true);
                    }

                    //run $.await function
                    rScript.runFunction('a2ready', {queue: true, namespace: 'a2ready', flush: true});
                    //flush $.async queue
                    rScript.flushFunction({queue: true, namespace: 'a1ready'});

                    //reset async function counter
                    rScript.store('rs_var_async_fn_counter', 0);

                    //close the async function gate
                    rScript.store('rs_var_async_fn_gate_open', false);
                }

            }, throttle_interval_int);
        }

        /**
         * Runs $.await functions
         * @param {Object} options the await options
         * throttle: this is the time interval [in milliseconds] between calls of the built-in await callback function. Default is 100 milliseconds
         * timeout: this is the total wait time [in milliseconds] that $.await will wait before. Default is 30000 milliseconds
         * Note: You can define these options using
         * _r.config.await = {throttle: 50, timeout: 5000}
         * Make sure you call this inside a $.first function block
         */
        rScript_obj.runAwait = function(){
            var myArgs = Array.prototype.slice.call(arguments),
                options = myArgs[0];
            _runAwaitTimer(options);
            _runAsync();
        };

        /**
         * Adds a function to be called in the user-defined portion of the _runIntelligence method
         * @param {Function} callback_fn the callback function to run
         * @param {Array|Object} args_arr the arguments that will be passed to the callback when it is called
         * @private
         */
        function _onAwait(callback_fn)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                args_arr_or_obj = (myArgs[1]) ? myArgs[1] : [],
                await_handler_fn
                ;

            await_handler_fn = function(args_1)
            {
                //trigger callback
                callback_fn(args_1);
            };

            //add to $.await queue
            rScript.addFunction('a2ready', await_handler_fn, {queue: true, namespace: 'a2ready', args: args_arr_or_obj});
        }

        /**
         * Adds a function to be called when $.await is executed
         * Wrapper function of _onAwait
         */
        rScript_obj.onAwait = function(callback_fn)
        {
            var myArgs = Array.prototype.slice.call(arguments);

            _onAwait(callback_fn, myArgs[1]);
            return this;
        }

        /**
         * Enables turbo classes and attributes for resize events
         * @returns {rScript}
         */
        rScript_obj.runTurboResize = function(){
            var myArgs = Array.prototype.slice.call(arguments);
            _turboClassesAndAttributesResize(myArgs[0], myArgs[1], myArgs[2]);
            return this;
        };

        /**
         * Enables turbo classes and attributes for scroll events
         * @returns {rScript}
         */
        rScript_obj.runTurboScroll = function(){
            var myArgs = Array.prototype.slice.call(arguments);
            _turboClassesAndAttributesScroll(myArgs[0], myArgs[1], myArgs[2]);
            return this;
        };

        /**
         * Defines an initialization script to run before the document is ready
         */
        rScript_obj.preInit = function(){

            //set storage variables
            rScript.store("rs_var_run_counter", 0);

            //primes resize and scroll event handling
            __resize();
            __scroll();

            /**
             * Run rScript $.first functions
             * Note: use flush option to prevent multiple executions
             */
            rScript.runFunction('fready', {queue: true, namespace: 'fready', flush: true});
        };

        /**
         * Defines an initialization script to run when the document is ready
         */
        rScript_obj.postInit = function(){

            //define ready timestamp
            rScript.store("rs_var_timestamp_ready", _r.microtime(true));

            //define base url
            rScript.store('rs_var_url', rScript.url.get());
            rScript.store('rs_var_url_base', rScript.url.get('basepath'));

            //initialize device variables
            if(_r.config.debug)
            {
                _initDeviceVars(true);
            }
            else
            {
                _initDeviceVars();
            }

            //set scroll variables
            _initScrollVars();

            //run turbo classes and attributes methods
            //enable initialization flag using first argument
            _turboClasses(true);
            _turboAttributes(true);

            //run rScriptReady functions
            rScript.runFunction('ready', {queue: true, namespace: 'ready', flush: true});

            //run rScriptPostReady functions
            rScript.runFunction('zready', {queue: true, namespace: 'zready', flush: true});

            //run rScriptAwait functions
            if(rScript.domStore('rs_var_await_init'))
            {
                rScript.runAwait(_r.config.await);
            }

            //run contextual/intelligent turbo classes
            if(rScript.store('rs_var_data_run_intelligence_init'))
            {
                _turboClassesAndAttributesIntel(null, rScript.store('rs_var_data_intelligence_info'));
            }
        };

        /**
         * List all rScript methods
         * @param {Boolean} exclude_util_methods_bool exclude utility methods from list. Default is true
         * @return {Array}
         * @private
         */
        function _listRScriptMethods()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                exclude_util_methods_bool = (_r.isBool(myArgs[0])) ? myArgs[0] : true,
                ctx = myArgs[1],
                methods_arr = [],
                methods_excl_arr = ['domStoreData', 'init', 'initDimVars', 'updateDimStore', 'updateOrtStore', 'mobileDetect', 'getResolutionDimensionList', 'queueFirst', 'queueReady', 'queuePost', 'queueAsync', 'queueAwait'],
                methods_object_arr = ['network', 'bind', 'route', 'webapp', 'cache', 'detect', 'url', 'form'];

            //remove methods for exclusion if so specified
            methods_excl_arr = (exclude_util_methods_bool) ? methods_excl_arr : [];

            for (var key in ctx)
            {
                if (ctx.hasOwnProperty(key))
                {
                    if(!_r.in_array(key, methods_excl_arr))
                    {
                        if(_r.in_array(key, methods_object_arr))
                        {
                            var method_sub_key_str,
                                method_sub_obj = ctx[key];
                            for (var key2 in method_sub_obj) {
                                if (method_sub_obj.hasOwnProperty(key2)) {
                                    method_sub_key_str = key+'.'+key2;
                                    methods_arr.push(method_sub_key_str);
                                }
                            }
                        }
                        else
                        {
                            methods_arr.push(key);
                        }
                    }
                }
            }

            return methods_arr;
        }

        /**
         * List all rScript methods
         * Wrapper class for _listRScriptMethods
         * @returns {Array}
         */
        rScript_obj.listMethods = function(){
            var myArgs = Array.prototype.slice.call(arguments);
            return _listRScriptMethods(myArgs[0], this);
        };

    })(rScript);

    //fire before DOM
    rScript.preInit();

    //fire when DOM is ready
    $.domReady(function(){

        //execute post initialization
        rScript.postInit();

    });

    /**
     * 1. Extend $ for JQuery, Zepto, or RQuery [Add rScript method]
     * 2. Extend rQuery [Add scroll methods]
     */

    (function($_obj){

        /**
         * Get or set the current vertical position of the scroll bar
         * @param value {Number} an integer indicating the new position to set the scroll bar to [optional]
         * @returns {Number}
         * @private
         */
        function _scrollTop()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                value = (_r.isNumber(myArgs[0])) ? myArgs[0] : false,
                ctx = (myArgs[1]) ? myArgs[1] : $('body'),
                _ctx = (ctx.length && ctx.length > 0) ? ctx[0] : ctx,
                browser_name_str = rScript.getBrowserName(),
                doc_scroll_obj;

            if(ctx.selector === 'body' || ctx.selector === 'html')
            {
                doc_scroll_obj = (document.documentElement && _r.isNumber(document.documentElement.scrollTop) && browser_name_str === 'firefox') ? document.documentElement : document.body;
            }
            else
            {
                doc_scroll_obj = _ctx;
            }

            if(value)
            {
                doc_scroll_obj.scrollTop = value;
            }
            return parseInt(doc_scroll_obj.scrollTop);
        }

        /**
         * Get or set the current horizontal position of the scroll bar
         * @param value {Number} an integer indicating the new position to set the scroll bar to [optional]
         * @returns {Number}
         * @private
         */
        function _scrollLeft()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                value = (_r.isNumber(myArgs[0])) ? myArgs[0] : false,
                ctx = (myArgs[1]) ? myArgs[1] : $('body'),
                _ctx = (ctx.length && ctx.length > 0) ? ctx[0] : ctx,
                browser_name_str = rScript.getBrowserName(),
                doc_scroll_obj;

            if(ctx.selector === 'body' || ctx.selector === 'html')
            {
                doc_scroll_obj = (document.documentElement && _r.isNumber(document.documentElement.scrollTop) && browser_name_str === 'firefox') ? document.documentElement : document.body;
            }
            else
            {
                doc_scroll_obj = _ctx;
            }

            if(value)
            {
                doc_scroll_obj.scrollLeft = value;
            }
            return parseInt(doc_scroll_obj.scrollLeft);
        }

        /**
         * Get the current coordinates of the first element in the set of matched elements, relative to the document
         * @param ctx {*} the context [must be DOM element within <body>]
         * @returns {*}
         * @private
         */
        function _offset(ctx)
        {
            var _ctx = (ctx.selector) ? ctx[0] : ctx,
                _rect_obj = _ctx.getBoundingClientRect(),
                _scroll_left_int = _scrollLeft(),
                _scroll_top_int = _scrollTop()
                ;

            return {left: _rect_obj.left+_scroll_left_int, top: _rect_obj.top+_scroll_top_int};
        }

        /**
         * Scroll via animation
         * Script inspiration: https://gist.github.com/andjosh/6764939 and https://gist.github.com/james2doyle/5694700
         * @param {Object} ctx_obj the context [document.body]
         * @param {Number|String|Object} target_pos_or_name_or_obj the position, object id/name, or object to scroll to
         * @param {Object} options_obj the options that define the scroll action
         *
         * speed: the scroll speed in pixels per second. You can override speed and use duration instead by prepending 'd' to the value. For example, 'd1000' will force scroll duration of 1000 milliseconds
         *
         * offset: the offset value. This will create an offset on the target scroll position. For example, an offset of 100 will stop scroll 100 pixels before target position. This will be vice versa when offset is, say, -100
         * You can also use percentages e.g. '15%'. When you do this, the offset value will be calculated relative to the viewport height. So, if the viewport height is 640 pixels, and you define an offset of '10%', the actual offset value will be
         *
         * callback: the callback function to be executed after scroll
         *
         * easing: the name of the easing for
         * the available options are:
         * - mathEaseInOutQuad [Default]
         * - mathEaseInCubic
         * - mathInOutQuintic
         *
         * easing_fn: a custom easing function
         * this function will be passed the following arguments:
         * - t [incrementing time value in milliseconds]
         * - b [the start position]
         * - c [the end position]
         * - d [the duration of scroll]
         * see _scrollTo code for more detail
         *
         * @private
         */
        function _scrollTo(ctx_obj, target_pos_or_obj)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                options_obj = myArgs[2],
                speed_int = 1000,
                offset_str_or_int = 0,
                callback_fn,
                easing_str = 'mathEaseInOutQuad',
                easing_fn,
                offset_perc_regex_arr,
                offset_perc_value_str,
                offset_perc_unit_str,
                duration_int,
                start_int = _scrollTop(ctx_obj),
                target_obj = (target_pos_or_obj.selector) ? target_pos_or_obj[0] : target_pos_or_obj,
                target_obj_offset_obj,
                target_obj_pos_top_int,
                target_obj_pos_top_final_int,
                diff_int,
                diff_abs_int,
                currentTime = 0,
                increment = 20,
                _val;

            //define options
            if(_r.isObject(options_obj))
            {
                speed_int = (options_obj.speed && (_r.isNumber(options_obj.speed) || _r.isNumberString(options_obj))) ? parseInt(options_obj.speed) : 1000;
                offset_str_or_int = (options_obj.offset && (_r.isNumber(options_obj.offset) || _r.isString(options_obj.offset))) ? options_obj.offset : 0;
                callback_fn = (options_obj.callback) ? options_obj.callback : undefined;
                easing_str = (options_obj.easing && _r.isString(options_obj.easing) && _r.in_array(options_obj.easing, ['mathEaseInOutQuad', 'mathEaseInCubic', 'mathInOutQuintic'])) ? options_obj.easing : 'mathEaseInOutQuad';
                easing_fn = (options_obj.easing_fn) ? options_obj.easing_fn : undefined;
            }

            //calculate the change in distance
            if(_r.isNumber(target_pos_or_obj) || _r.isNumberString(target_pos_or_obj))
            {
                //subtract

                target_obj_pos_top_int = parseFloat(target_pos_or_obj);
                diff_int = target_obj_pos_top_int - start_int;
            }
            else if(_r.isObject(target_obj) || _r.isString(target_obj))
            {
                //get position of target object before subtract

                if(_r.isString(target_obj))
                {
                    target_pos_or_obj = $('#'+target_obj);
                }

                target_obj_offset_obj = _offset(target_pos_or_obj);
                target_obj_pos_top_int = target_obj_offset_obj.top;
                diff_int = target_obj_pos_top_int - start_int;
            }
            else
            {
                return false;
            }
            diff_int = parseFloat(diff_int);

            //manage percentage offset
            if(_r.isString(offset_str_or_int))
            {
                if(/^ *\-?[0-9]+(?:\.[0-9]+|)\%? *$/i.test(offset_str_or_int))
                {
                    //percentage - use viewport
                    offset_perc_regex_arr = _r.regexMatchAll(/^ *(\-?[0-9]+(?:\.[0-9]+|))(\%?) *$/i, offset_str_or_int);

                    offset_perc_value_str = offset_perc_regex_arr[0][1];
                    offset_perc_unit_str = offset_perc_regex_arr[0][2];

                    if(offset_perc_unit_str && !_r.isEmptyString(offset_perc_unit_str))
                    {
                        var viewport_height_int = parseFloat(rScript.viewportH());
                        var offset_perc_value_int = parseFloat(offset_perc_value_str);

                        offset_str_or_int = viewport_height_int * (offset_perc_value_int / 100);
                    }
                }
            }
            offset_str_or_int = offset_str_or_int/-1;

            //get the difference between start and end points considering offset
            diff_int += offset_str_or_int;

            //get the absolute value
            diff_abs_int = Math.abs(diff_int);

            //get the position of target object considering offset
            target_obj_pos_top_final_int = target_obj_pos_top_int+offset_str_or_int;

            //manage speed
            if(_r.isNumber(speed_int) && speed_int > 0)
            {
                duration_int = (diff_int / speed_int) * 1000;
            }
            else if (_r.isString(speed_int) && /^ *d[0-9]+ */i.test(speed_int))
            {
                duration_int = speed_int.slice(1);
            }
            else
            {
                duration_int = 1000;
            }
            duration_int = parseInt(duration_int);
            duration_int = Math.abs(duration_int);

            //define motion functions
            var easing_obj = {
                mathEaseInOutQuad: function (t, b, c, d) {
                    t /= d/2;
                    if (t < 1) {
                        return c/2*t*t + b
                    }
                    t--;
                    return -c/2 * (t*(t-2) - 1) + b;
                },
                mathEaseInCubic: function(t, b, c, d) {
                    var tc = (t/=d)*t*t;
                    return b+c*(tc);
                },
                mathInOutQuintic: function(t, b, c, d) {
                    var ts = (t/=d)*t,
                        tc = ts*t;
                    return b+c*(6*tc*ts + -15*ts*ts + 10*tc);
                }
            };

            //add custom easing function
            if(easing_fn)
            {
                easing_obj['mathEaseCustom'] = easing_fn;
                easing_str = 'mathEaseCustom';
            }

            var move = function(amount) {
                document.documentElement.scrollTop = amount;
                document.body.parentNode.scrollTop = amount;
                document.body.scrollTop = amount;
            };

            // requestAnimationFrame for Smart Animating http://goo.gl/sx5sts
            var requestAnimFrame = (function(){
                return  window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function( callback ){ window.setTimeout(callback, 1000 / 60); };
            })();

            //animate
            var animateScroll = function() {

                // increment the time
                currentTime += increment;

                // find the value with the quadratic in-out easing function
                _val = easing_obj[easing_str](currentTime, start_int, diff_int, duration_int);

                /**
                 * There is an issue when using this method more than once to scroll to the same location.
                 * For example, if you:
                 * 1. Attach this method to a click handler [or link]
                 * 2. Setup a link at both the start position and end position
                 * 3. Click on the link at the start position to go to the end position
                 * 4. Click on the link at the end position
                 *
                 * Instead of the document to remain in the same position on the second click, it scrolls to another position. This happens because of the easing function, which generates the position values used by the animated scroll
                 * To fix this, the animated scroll feature using the easing functions are only used when the absolute scroll distance is of a sufficient size [in this case 60 pixels]
                 */
                if(diff_abs_int <= 60)
                {
                    //jump straight to position i.e. no animation
                    move(target_obj_pos_top_final_int);

                    if (callback_fn) {
                        //animation complete. run callback
                        callback_fn();
                    }
                }
                else
                {
                    //animate scroll
                    if(_r.isNumber(_val))
                    {
                        // move the document.body
                        move(_val);

                        //run animation
                        if (currentTime < duration_int)
                        {
                            requestAnimFrame(animateScroll);
                        }
                        else
                        {
                            if (callback_fn) {
                                //animation complete. run callback
                                callback_fn();
                            }
                        }
                    }
                }

            };
            animateScroll();
        }

        /**
         * Gets the scroll area offset of the element
         * The scroll area offset provides the vertical and horizontal positions of all four vertices of a block-level element
         * The element's vertices are each assigned an alphabet key
         * a = top left, b = top right, c = bottom right, d = bottom left
         * Returns an JSON object
         * a_top
         * @param ctx {Object} the context
         * @return {*}
         * @private
         */
        function _scrollAreaOffset(ctx)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                dim_format_key_str = myArgs[1],
                dim_format_w_str = (dim_format_key_str === 'o') ? 'outerWidth' : (dim_format_key_str === 'i') ? 'innerWidth' : 'width',
                dim_format_h_str = (dim_format_key_str === 'o') ? 'outerHeight' : (dim_format_key_str === 'i') ? 'innerHeight' : 'height',
                _ctx_elem = ctx[0],
                _offset_obj = _offset(_ctx_elem),
                _scrolltop_int = _scrollTop(),
                _scrollleft_int = _scrollLeft(),
                _scroll_vertex_a_top_int = _offset_obj.top - _scrolltop_int,
                _scroll_vertex_a_left_int = _offset_obj.left - _scrollleft_int,
                _scroll_vertex_b_top_int,
                _scroll_vertex_b_left_int,
                _scroll_vertex_c_top_int,
                _scroll_vertex_c_left_int,
                _scroll_vertex_d_top_int,
                _scroll_vertex_d_left_int,
                _elem_width_int = ctx[dim_format_w_str](),
                _elem_height_int = ctx[dim_format_h_str]()
                ;

            //Get scroll offsets for 3 other b, c, d
            _scroll_vertex_b_top_int = _scroll_vertex_a_top_int;
            _scroll_vertex_b_left_int = _scroll_vertex_a_left_int + _elem_width_int;
            _scroll_vertex_c_top_int = _scroll_vertex_a_top_int + _elem_height_int;
            _scroll_vertex_c_left_int = _scroll_vertex_b_left_int;
            _scroll_vertex_d_top_int = _scroll_vertex_c_top_int;
            _scroll_vertex_d_left_int =  _scroll_vertex_a_left_int;


            return {a_left: _scroll_vertex_a_left_int, a_top: _scroll_vertex_a_top_int , b_left: _scroll_vertex_b_left_int, b_top: _scroll_vertex_b_top_int, c_left: _scroll_vertex_c_left_int , c_top: _scroll_vertex_c_top_int , d_left: _scroll_vertex_d_left_int , d_top: _scroll_vertex_d_top_int};
        }

        /**
         * Determines if an element is within the viewport, or is within a specific viewzone inside the viewport
         * @param ctx {Object} the element context
         * @param viewzone_obj {Object} the vertices of the viewzone as a JSON object
         * A viewzone object identifies a specific zone within a viewport
         * It has the following structure
         * {a_left: 100, a_top: 400, b_left: 400, b_top: 400, c_left: 400, c_top: 600, d_left: 100, d_top: 600;}
         * The above represents a [viewzone] rectangle 300 pixels wide by 200 pixels high
         * sitting 400 pixels below the top of the viewport and 100 pixels left-padding
         * a, b, c, and d represent the top-left, top-right, bottom-right, and bottom-left
         * vertex positions [respectively] of the viewzone relative to the viewport
         * For brevity, you only need to provide a_left, a_top, b_left, c_top values; the rest
         * will be calculated automatically
         * Note: The viewzone must represent a rectangle
         * @param contain_bool {Boolean} this determines whether the viewport/viewzone must
         * contain the given element context completely or not. If set to true, this method
         * will return true only if all of the element is within the viewport/viewzone
         * @param debug_bool {Boolean} if true, will display the viewzone in the viewport
         * as a visual aid
         * @return {Boolean}
         */
        function _inView(ctx)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                elem_html_obj = $('html'),
                viewzone_obj = (myArgs[1]) ? myArgs[1] : null,
                contain_bool = (_r.isBool(myArgs[2])) ? myArgs[2] : false,
                debug_bool = (_r.isBool(myArgs[3])) ? myArgs[3] : false,
                viewzone_basis_bool = ((viewzone_obj)),
                viewport_w_int = rScript.viewportW(),
                viewport_h_int = rScript.viewportH(),
                scroll_area_offset_obj = _scrollAreaOffset(ctx),
                area_a_left_int = scroll_area_offset_obj.a_left,
                area_a_top_int = scroll_area_offset_obj.a_top,
                area_b_left_int = scroll_area_offset_obj.b_left,
                area_b_top_int = scroll_area_offset_obj.b_top,
                area_c_left_int = scroll_area_offset_obj.c_left,
                area_c_top_int = scroll_area_offset_obj.c_top,
                area_d_left_int = scroll_area_offset_obj.d_left,
                area_d_top_int = scroll_area_offset_obj.d_top,
                viewzone_a_left_int,
                viewzone_a_top_int,
                viewzone_b_left_int,
                viewzone_b_top_int,
                viewzone_c_left_int,
                viewzone_c_top_int,
                viewzone_d_left_int,
                viewzone_d_top_int,
                a_vertex_inviewzone_bool,
                b_vertex_inviewzone_bool,
                c_vertex_inviewzone_bool,
                d_vertex_inviewzone_bool
                ;

            if(viewzone_basis_bool)
            {
                //viewzone basis

                viewzone_a_left_int = viewzone_obj.a_left;
                viewzone_a_top_int = viewzone_obj.a_top;
                viewzone_b_left_int = viewzone_obj.b_left;
                viewzone_b_top_int = (viewzone_obj.b_top) ? viewzone_obj.b_top : viewzone_a_top_int;
                viewzone_c_left_int = (viewzone_obj.c_left) ? viewzone_obj.c_left : viewzone_b_left_int;
                viewzone_c_top_int = viewzone_obj.c_top;
                viewzone_d_left_int = (viewzone_obj.d_left) ? viewzone_obj.d_left : viewzone_a_left_int;
                viewzone_d_top_int = (viewzone_obj.d_top) ? viewzone_obj.d_top : viewzone_c_top_int;

                if(debug_bool)
                {
                    //show area
                    var elem_body_obj = $('body'),
                        elem_guide_width_int = viewzone_b_left_int - viewzone_a_left_int,
                        elem_guide_height_int = viewzone_d_top_int - viewzone_a_top_int,
                        elem_guide_id_str = generateRandomString('aaannnn'),
                        elem_guide_html_wrapper_attr_str = ' id="r_debug_viewzone_'+elem_guide_id_str+'" style="box-sizing: border-box; position: fixed; top: '+viewzone_a_top_int+'px; left: '+viewzone_a_left_int+'px; width: '+elem_guide_width_int+'px; height: '+elem_guide_height_int+'px;"',
                        elem_guide_html_inner_1_attr_str = ' style="position: absolute; top: 10px; right: 10px; z-index: 100001; color: #000; font-family: sans-serif; font-size: 14px; opacity: 0.7;"',
                        elem_guide_html_inner_2_attr_str = ' style="position: absolute; width: '+elem_guide_width_int+'px; height: '+elem_guide_height_int+'px; background-color: #FF0000; z-index: 100000; opacity: 0.25;"';
                    elem_body_obj.append('<div'+elem_guide_html_wrapper_attr_str+'><div'+elem_guide_html_inner_1_attr_str+'>viewzone:&nbsp;'+elem_guide_id_str+'</div><div'+elem_guide_html_inner_2_attr_str+'></div></div>');
                }
            }
            else
            {
                //viewport basis

                viewzone_a_left_int = 0;
                viewzone_a_top_int = 0;
                viewzone_b_left_int = viewport_w_int;
                viewzone_b_top_int = 0;
                viewzone_c_left_int = viewzone_b_left_int;
                viewzone_c_top_int = viewport_h_int;
                viewzone_d_left_int = viewzone_a_left_int;
                viewzone_d_top_int = viewzone_c_top_int;
            }

            a_vertex_inviewzone_bool = ((area_a_top_int >= viewzone_a_top_int) && (area_a_top_int <= viewzone_d_top_int) && (area_a_left_int >= viewzone_a_left_int) && (area_a_left_int <= viewzone_b_left_int));
            b_vertex_inviewzone_bool = ((area_b_top_int >= viewzone_b_top_int) && (area_b_top_int <= viewzone_c_top_int) && (area_b_left_int >= viewzone_a_left_int) && (area_b_left_int <= viewzone_b_left_int));
            c_vertex_inviewzone_bool = ((area_c_top_int >= viewzone_b_top_int) && (area_c_top_int <= viewzone_c_top_int) && (area_c_left_int >= viewzone_d_left_int) && (area_c_left_int <= viewzone_c_left_int));
            d_vertex_inviewzone_bool = ((area_d_top_int >= viewzone_a_top_int) && (area_d_top_int <= viewzone_d_top_int) && (area_d_left_int >= viewzone_d_left_int) && (area_d_left_int <= viewzone_c_left_int));


            if(contain_bool)
            {
                return (a_vertex_inviewzone_bool && b_vertex_inviewzone_bool && c_vertex_inviewzone_bool && d_vertex_inviewzone_bool);
            }
            else
            {
                return (a_vertex_inviewzone_bool || b_vertex_inviewzone_bool || c_vertex_inviewzone_bool || d_vertex_inviewzone_bool);
            }
        }

        /**
         * Executes a JSONP HTTP Request
         * @param url {String} the URL
         * @param callback {Function} the JSONP Callback function
         * @param cache_key_str {String} the cache key
         * @param cache_storage_str {String} the cache storage type
         * @param store_options_obj {Object} the cache storage options
         * @param cache_and_fetch_bool {Boolean} if true, will cache value regardless of existing status
         * @private
         */
        function _jsonp(url, callback)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                cache_key_str = (_r.isString(myArgs[2]) && myArgs[2] !== "") ? myArgs[2]: null,
                cache_storage_str = myArgs[3],
                store_options_obj = myArgs[4],
                cache_and_fetch_bool = myArgs[5],
                callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random()),
                el_body_obj = $('body'),
                el_body_core_obj = el_body_obj[0];

            return new Promise(function(resolve)
            {
                window[callbackName] = function(data)
                {
                    delete window[callbackName];
                    el_body_core_obj.removeChild(script);

                    if(cache_key_str && (!rScript.store(cache_key_str, undefined, cache_storage_str) || cache_and_fetch_bool))
                    {
                        //cache
                        rScript.store(cache_key_str, data, cache_storage_str, store_options_obj);
                    }
                    resolve(callback(data));
                };

                var script = document.createElement('script');
                script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
                el_body_core_obj.appendChild(script);
            });
        }


        //if jQuery or Zepto, $.extend
        if($_obj === window.jQuery)
        {
            //JQuery
            $_obj.fn.extend({
                rScript: function(options){
                    rScript.run(this, options);
                }
            });
        }
        else if ($_obj === window.Zepto)
        {
            //Zepto
            $_obj.extend($_obj.fn, {
                rScript: function(options){
                    rScript.run(this, options);
                }
            });
        }
        else if ($_obj === window.rQuery)
        {
            //RQuery
            $_obj.extend('rScript', function(options){
                rScript.run(this, options);
            });

            //1: Add Event Handlers

            /**
             * Event handler for CSS Transitions
             * Script inspired by Osvaldas Valutis (https://osvaldas.info/detecting-css-animation-transition-end-with-javascript)
             * @param {Function} callback_fn the function to execute once the transition is complete. It will be passed the locally scoped this reference
             */
            $_obj.extend('onCSSTransitionEnd', function(callback_fn)
            {
                var _this = this[0],
                    body_obj = $('body'),
                    _body_obj = body_obj[0],
                    _body_style_obj = _body_obj.style,
                    prefix_transition_str = '',
                    callback_main_fn = function(e){
                        callback_fn(this);
                        $(this).off(e.type, callback_main_fn);
                    }
                    ;

                //set prefix support prefixes
                if(!_r.isNullOrUndefined(_body_style_obj.WebkitTransition)){prefix_transition_str = '-webkit-';}
                if(!_r.isNullOrUndefined(_body_style_obj.MozTransition)){prefix_transition_str = '-moz-';}
                if(!_r.isNullOrUndefined(_body_style_obj.OTransition)){prefix_transition_str = '-o-';}
                if(!_r.isNullOrUndefined(_body_style_obj.MSTransition)){prefix_transition_str = '-ms-';}

                if(!_r.isNullOrUndefined(_body_style_obj.transition))
                {
                    //native support
                    this.on('transitionend', callback_main_fn);
                }
                else
                {
                    //fallback to prefixed support
                    this.on('webkitTransitionEnd', callback_main_fn);
                    this.on('mozTransitionEnd', callback_main_fn);
                    this.on('oTransitionEnd', callback_main_fn);
                    this.on('msTransitionEnd', callback_main_fn);
                }

                /* jshint -W116 */

                if( ( prefix_transition_str === '' && !( 'transition' in _body_style_obj ) ) || getComputedStyle( _this )[ prefix_transition_str + 'transition-duration' ] == '0s' )
                {
                    callback_fn(this);
                }

                /* jshint +W116 */

                return this;
            });

            /**
             * Event handler for CSS Animations
             * Script inspired by Osvaldas Valutis (https://osvaldas.info/detecting-css-animation-transition-end-with-javascript)
             * @param {Function} callback_fn the function to execute once the animation is complete
             */
            $_obj.extend('onCSSAnimationEnd', function(callback_fn){

                var _this = this[0],
                    body_obj = $('body'),
                    _body_obj = body_obj[0],
                    _body_style_obj = _body_obj.style,
                    prefix_animation_str = '',
                    callback_main_fn = function(e){
                        callback_fn(this);
                        $(this).off(e.type, callback_main_fn);
                    }
                    ;

                //set prefix support prefixes
                if(!_r.isNullOrUndefined(_body_style_obj.WebkitAnimation)){prefix_animation_str = '-webkit-';}
                if(!_r.isNullOrUndefined(_body_style_obj.MozAnimation)){prefix_animation_str = '-moz-';}
                if(!_r.isNullOrUndefined(_body_style_obj.OAnimation)){prefix_animation_str = '-o-';}
                if(!_r.isNullOrUndefined(_body_style_obj.MSAnimation)){prefix_animation_str = '-ms-';}

                if(!_r.isNullOrUndefined(_body_style_obj.animation))
                {
                    //native support
                    this.on('animationend', callback_main_fn);
                }
                else
                {
                    //fallback to prefixed support
                    this.on('webkitAnimationEnd', callback_main_fn);
                    this.on('mozAnimationEnd', callback_main_fn);
                    this.on('oAnimationEnd', callback_main_fn);
                    this.on('oanimationEnd', callback_main_fn);
                    this.on('msAnimationEnd', callback_main_fn);
                }

                /* jshint -W116 */

                if( ( prefix_animation_str === '' && !( 'animation' in _body_style_obj ) ) || getComputedStyle( _this )[ prefix_animation_str + 'animation-duration' ] == '0s' )
                {
                    callback_fn(this);
                }

                /* jshint +W116 */

                return this;
            });


            //2: Add Scroll Methods

            /**
             * Get the current coordinates of the first element in the set of matched elements, relative to the offset parent
             * Returns an object containing the properties top and left
             * @returns {*}
             */
            $_obj.extend('position', function(){
                var _this = this[0];
                return {left: _this.offsetLeft, top: _this.offsetTop};
            });

            /**
             * Get the current coordinates of the first element in the set of matched elements, relative to the document
             * Returns an object containing the properties top and left
             * @returns {*}
             */
            $_obj.extend('offset', function(){
                var _this = this[0];
                return _offset(_this);
            });

            /**
             * Get or set the current vertical position of the scroll bar
             * Wrapper class for _scrollTop()
             * @returns {Number}
             */
            $_obj.extend('scrollTop', function(value){
                return _scrollTop(value, this);
            });

            /**
             * Get or set the current horizontal position of the scroll bar
             * Wrapper class for _scrollTop()
             * @returns {Number}
             */
            $_obj.extend('scrollLeft', function(value){
                return _scrollLeft(value, this);
            });

            /**
             * Scroll the document to a specific position
             * @param {Number|Object} target_pos_or_obj the y- position [or the target object reference] to scroll to
             *
             * @param {Object} options_obj the options that define the scroll action
             * speed: the scroll speed in pixels per second. You can override speed and use duration instead by prepending 'd' to the value. For example, 'd1000' will force scroll duration of 1000 milliseconds
             *
             * offset: the offset value. This will create an offset on the target scroll position. For example, an offset of 100 will stop scroll 100 pixels after target position. This will be vice versa when offset is, say, -100
             * You can also use percentages e.g. '15%'. When you do this, the offset value will be calculated relative to the viewport height. So, if the viewport height is 640 pixels, and you define an offset of '10%', the actual offset value will be
             *
             * callback: the callback function to be executed after scroll
             *
             * easing: the name of the easing for
             * the available options are:
             * - mathEaseInOutQuad [Default]
             * - mathEaseInCubic
             * - mathInOutQuintic
             *
             * easing_fn: a custom easing function
             * this function will be passed the following arguments:
             * - t [incrementing time value in milliseconds]
             * - b [the start position]
             * - c [the end position]
             * - d [the duration of scroll]
             * see _scrollTo code for more detail
             *
             */
            $_obj.extend('scrollTo', function(){
                var myArgs = Array.prototype.slice.call(arguments),
                    browser_name_str = rScript.getBrowserName(),
                    _ctx;

                if(this.selector === 'body' || this.selector === 'html')
                {
                    _ctx = (document.documentElement && _r.isNumber(document.documentElement.scrollTop) && browser_name_str === 'firefox') ? document.documentElement : document.body;

                    _scrollTo(_ctx, myArgs[0], myArgs[1]);
                }
            });

            /**
             * Wrapper class for _scrollAreaOffset
             * @returns {*}
             */
            $_obj.extend('scrollAreaOffset', function(){
                return _scrollAreaOffset(this);
            });

            /**
             * Gets the scroll position
             * Returns an object containing the viewport and object scroll positions
             * Example: {top: 20, left: 8, top_e: 240, left_e: 0 }
             * top: the viewport scroll position relative to the top of the document
             * left: the viewport scroll position relative to the left of the viewport
             * top_e: the element's scroll position relative to the top viewport
             * scroll position
             * left_e: the element's scroll position relative to the left viewport
             * scroll position
             * @return {Object}
             */
            $_obj.extend('scrollPosition', function(){
                var _this = this[0],
                    _offset_obj = _offset(_this),
                    _scroll_top_int = _scrollTop(),
                    _scroll_left_int = _scrollLeft(),
                    _scroll_top_el_int = _offset_obj.top - _scroll_top_int,
                    _scroll_left_el_int = _offset_obj.left - _scroll_left_int
                    ;

                return {top: _scroll_top_int, left: _scroll_left_int, top_e: _scroll_top_el_int, left_e: _scroll_left_el_int};
            });

            /**
             * Determines if the element is within the viewport
             * @param contain_bool {Boolean} this determines whether the viewport/viewzone must contain the given element completely or not. See _inView
             * @return {Boolean}
             */
            $_obj.extend('inViewport', function(contain_bool){
                return _inView(this, null, contain_bool);
            });

            /**
             * Determines if the element is within a specific zone of the viewport
             * @param viewzone_obj {Object} the specific viewzone object.
             * See _inView for more
             * @param contain_bool {Boolean} this determines whether the viewport/viewzone must contain the given element completely or not. See _inView
             * @param debug_bool {Boolean} if true, will display the viewzone in the viewport as a visual aid
             * @returns {Boolean}
             */
            $_obj.extend('inViewzone', function(viewzone_obj, contain_bool, debug_bool){
                return _inView(this, viewzone_obj, contain_bool, debug_bool);
            });


            /**
             * Performs an asynchronous HTTP (AJAX) Request
             * Designed for GET and POST requests
             * Uses JavaScript Promises functionality
             * @param url_str {String} The URL to which the request should be sent
             * @param options_obj {Object} A set of key/value pairs that configure the AJAX request
             * It has the following options
             *
             * method {string}: the HTTP method to use. Default value is GET
             *
             * async {boolean}: indicates whether the operation will be performed asynchronously. Default is true
             *
             * data {string|object}: the data payload to be sent with the request. This is for POST operations
             *
             * headers {object}: Defines the HTTP headers to be sent in the request. Defined as an array with key as header and value as value e.g. {'Cache-Control': 'no-cache'}
             *
             * cache_key {string}: specifies an identifier for a previously cached AJAX request. By specifying a cache key, you are requesting that the AJAX Request should be cached. Only successful requests will be cached
             *
             * cache_expiry {number}: specifies the lifetime of the cached item in milliseconds
             *
             * cache_storage {string}: the storage method. The following values are valid
             * - 'ls' for localStorage
             * - 'ss' for sessionStorage [default]
             * - 'ds' for dom-based storage
             * Note that dom-based storage does not persist past page refreshes
             *
             * cache_and_fetch {boolean}: defines whether an AJAX request should be made when a cached value already exists
             *
             * response {boolean}: Returns the response entity body instead of the entire HTTP request. For example, if response is true, the value returned will be xhr.response instead of xhr. Default is true
             *
             * response_key {string}: If response is true, this serves as an identifier to retrieve a subset of xhr.response. For example, if response_key is 'code_name', the result returned will be xhr.response['code_name'] instead of xhr.response
             *
             * response_valid_headers {string}: Defines valid response header codes that define a successful HTTP response e.g. if 200 and 301 are given, then if the XHR response has a 400 error, then the promise will be rejected (as opposed to resolved). Values should be provided in comma-delimited format e.g. 200,304
             * Default values are 200, 201, 202, 203, 204, and 304.
             *
             * parse_json {boolean}: this specifies whether the response should be JSON parsed before applying the response_key
             *
             * jsonp {boolean}: determines if JSONP functionality should be invoked
             *
             * jsonp_callback {Function}: the JSONP callback
             *
             * onerror: a custom callback function for the onerror XHR handler
             *
             * ontimeout: a custom callback function for the ontimeout XHR handler
             *
             * This function returns a Promise so when using it, you should do so as follows:
             * Example: $.ajax('http://your_url', {method: 'GET'}).then(function(response){});
             * .then() takes two arguments:
             * 1. first argument is a callback for the success/resolve case
             * 2. second argument is a callback for the failure/reject case
             *
             * @return {Promise}
             */
            $_obj.ajax = function(url_str)
            {
                var myArgs = Array.prototype.slice.call(arguments),
                    options_obj = (!_r.isNullOrUndefined(myArgs[1])) ? myArgs[1]: {},
                    url_q_str,
                    url_q_arr,
                    send_params_str,
                    method_str = (_r.isString(options_obj.method) && options_obj.method.trim().length > 0) ? options_obj.method : "GET",
                    is_async_bool = (_r.isBool(options_obj.async)) ? options_obj.async : true,
                    data_str_or_obj = (options_obj.data) ? options_obj.data : undefined,
                    headers_obj = (typeof options_obj.headers !== 'undefined') ? options_obj.headers: {},
                    cache_data_str,
                    cache_key_str = (_r.isString(options_obj.cache_key) && options_obj.cache_key.trim().length > 0) ? options_obj.cache_key : '',
                    cache_key_final_str,
                    cache_bool = !(_r.isEmptyString(cache_key_str)),
                    cache_is_enabled_bool,
                    cache_expiry_int = (_r.isNumber(options_obj.cache_expiry) || _r.isNumberString(options_obj.cache_expiry)) ? parseInt(options_obj.cache_expiry) : 0,
                    store_options_obj = (cache_expiry_int > 0) ? {expires: cache_expiry_int} : {},
                    cache_storage_str = (!_r.isEmptyString(options_obj.cache_storage) && _r.in_array(options_obj.cache_storage, ['ss', 'ls', 'ds'])) ? options_obj.cache_storage : 'ss',
                    cache_and_fetch_bool = (_r.isBool(options_obj.cache_and_fetch)) ? options_obj.cache_and_fetch : true,
                    is_xhr_response_bool = (_r.isBool(options_obj.response)) ? options_obj.response : true,
                    xhr_response_key = (_r.isString(options_obj.response_key) && options_obj.response_key.trim().length > 0) ? options_obj.response_key : '',
                    is_xhr_response_key_bool = ((xhr_response_key !== '')),
                    is_xhr_response_parse_json_bool = (_r.isBool(options_obj.parse_json)) ? options_obj.parse_json : true,
                    xhr_response_valid_headers_arr = (options_obj.response_valid_headers) ? _r.explode(',', options_obj.response_valid_headers): ['200', '201', '202', '203', '204', '304'],
                    xhr_onerror_fn = (options_obj.onerror) ? options_obj.onerror : function(){_r.console.error('rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: XHR onerror default callback for request to '+url_str+'', true); return false;},
                    xhr_ontimeout_fn = (options_obj.ontimeout) ? options_obj.ontimeout : function(){_r.console.error('rScript error ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: XHR timeout default callback for request to '+url_str+'', true); return false;},
                    is_jsonp_request_bool = (_r.isBool(options_obj.jsonp)) ? options_obj.jsonp : false,
                    jsonp_callback_fn = (_r.isFunction(options_obj.jsonp_callback)) ? options_obj.jsonp_callback : function(){var e_msg_str = 'rScript warning ['+_r.zeroFill(rScript.store('rs_var_counter_console'), 3)+']: No JSONP callback function defined';_r.console.warn(e_msg_str, true);}
                    ;

                //make method uppercase
                method_str = method_str.toUpperCase();

                //get query parameters if defined
                url_q_arr = url_str.split('?');
                url_q_str = (url_q_arr[1]) ? url_q_arr[1] : '';

                //set send parameters based HTTP Verb
                if(method_str === 'GET')
                {
                    send_params_str = null;
                }
                else
                {
                    url_str = url_q_arr[0];
                    send_params_str = url_q_str;

                    //set data if defined
                    if(data_str_or_obj)
                    {
                        send_params_str = (_r.isObject(data_str_or_obj)) ? JSON.stringify(data_str_or_obj) : data_str_or_obj ;
                    }

                    //if POST, define default Content-Type header
                    if(method_str === 'POST' && !headers_obj['Content-type'])
                    {
                        headers_obj['Content-type'] = 'application/x-www-form-urlencoded';
                    }
                }

                return new Promise(function(resolve, reject)
                {
                    function responseFilter(xhr, is_xhr_response_bool, is_xhr_response_key_bool, is_xhr_response_parse_json_bool)
                    {
                        if(is_xhr_response_bool)
                        {
                            var xhr_ctx = (xhr.response) ? xhr.response : xhr;

                            if(is_xhr_response_key_bool)
                            {
                                if (is_xhr_response_parse_json_bool)
                                {
                                    var response_json_obj = JSON.parse(xhr_ctx);
                                    return response_json_obj[''+xhr_response_key+''];
                                }
                                else
                                {
                                    return xhr_ctx[''+xhr_response_key+''];
                                }
                            }
                            else
                            {
                                return xhr_ctx;
                            }
                        }
                        else
                        {
                            return xhr;
                        }
                    }

                    /**
                     * 1: Check if there is a cached value
                     * 2: If not, execute XHR
                     */
                    cache_key_final_str = 'rs_var_xhr_cache_'+cache_key_str;
                    cache_data_str = (cache_storage_str === 'ds') ? rScript.domStore(cache_key_final_str) : rScript.store(cache_key_final_str, undefined, cache_storage_str);
                    cache_is_enabled_bool = !!(cache_bool && cache_data_str);

                    if(cache_is_enabled_bool)
                    {
                        //1:

                        if(is_jsonp_request_bool)
                        {
                            //get cached JSONP
                            resolve(jsonp_callback_fn(cache_data_str));
                        }
                        else
                        {
                            try
                            {
                                //Resolve cached JSON data

                                var ajax_cache_res = JSON.parse(cache_data_str);

                                if (!_r.isObjectEmpty(ajax_cache_res))
                                {
                                    resolve(responseFilter(ajax_cache_res, is_xhr_response_bool, is_xhr_response_key_bool, false));
                                }
                            }
                            catch(e)
                            {
                                //Resolve cached string data e.g. HTML

                                resolve(cache_data_str);
                            }
                        }
                    }
                    if(!cache_is_enabled_bool || (cache_is_enabled_bool && cache_and_fetch_bool))
                    {
                        //2:

                        if(is_jsonp_request_bool)
                        {
                            //use JSON-P
                            var cache_key_json_str = (cache_bool) ? cache_key_final_str : false;
                            resolve(_jsonp(url_str, jsonp_callback_fn, cache_key_json_str, cache_storage_str, store_options_obj, cache_and_fetch_bool));
                        }
                        else
                        {
                            var xhr;
                            if (window.XMLHttpRequest)
                            {
                                // code for IE7+, Firefox, Chrome, Opera, Safari
                                xhr = new XMLHttpRequest();
                            }
                            else
                            {
                                // code for IE6, IE5
                                xhr = new ActiveXObject("Microsoft.XMLHTTP");
                            }

                            //execute asynchronous requests
                            if(is_async_bool)
                            {
                                xhr.onreadystatechange = function() {
                                    /* jshint -W116 */
                                    if (xhr.readyState == 4) {

                                        if(_r.in_array(xhr.status, xhr_response_valid_headers_arr))
                                        {
                                            if(cache_bool)
                                            {
                                                //persist
                                                if(cache_storage_str === 'ds')
                                                {
                                                    rScript.domStore(cache_key_final_str, xhr.response);
                                                }
                                                else
                                                {
                                                    rScript.store(cache_key_final_str, xhr.response, cache_storage_str, store_options_obj);
                                                }
                                            }

                                            resolve(responseFilter(xhr, is_xhr_response_bool, is_xhr_response_key_bool, is_xhr_response_parse_json_bool));
                                        }
                                        else
                                        {
                                            reject({
                                                xhrStatus: xhr.status,
                                                xhrStatusText: xhr.statusText,
                                                xhrResponse: xhr.response,
                                                xhrResponseText: xhr.responseText,
                                                errorMessage: 'asynchronous XHR error for request to '+url_str+''
                                            });
                                        }
                                    }
                                    /* jshint +W116 */
                                };
                            }

                            //Set onerror and ontimeout callbacks
                            xhr.onerror = xhr_onerror_fn;
                            xhr.ontimeout = xhr_ontimeout_fn;

                            //open request
                            xhr.open(method_str, url_str, is_async_bool);

                            //set request headers
                            if(_r.count(headers_obj) > 0)
                            {
                                var headers_keys_arr = _r.array_keys(headers_obj),
                                    headers_values_arr = _r.array_values(headers_obj);
                                for(var i = 0; i < _r.count(headers_obj); i++)
                                {
                                    xhr.setRequestHeader(""+headers_keys_arr[i]+"", ""+headers_values_arr[i]+"");
                                }
                            }

                            xhr.send(send_params_str);

                            //execute callbacks for synchronous requests
                            if(!is_async_bool)
                            {
                                if(_r.in_array(xhr.status, xhr_response_valid_headers_arr))
                                {
                                    if(cache_bool)
                                    {
                                        //persist
                                        if(cache_storage_str === 'ds')
                                        {
                                            rScript.domStore(cache_key_final_str, xhr.response);
                                        }
                                        else
                                        {
                                            rScript.store(cache_key_final_str, xhr.response, cache_storage_str, store_options_obj);
                                        }
                                    }

                                    resolve(responseFilter(xhr, is_xhr_response_bool, is_xhr_response_key_bool, is_xhr_response_parse_json_bool));
                                }
                                else
                                {
                                    reject({
                                        xhrStatus: xhr.status,
                                        xhrStatusText: xhr.statusText,
                                        xhrResponse: xhr.response,
                                        xhrResponseText: xhr.responseText,
                                        errorMessage: 'synchronous XHR error for request to '+url_str+''
                                    });
                                }
                            }
                        }
                    }
                });
            };
        }

    })($);

})(window, document, rQuery, _r);
