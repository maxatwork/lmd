(function (global, main, modules, sandboxed_modules) {
    var initialized_modules = {},
        global_eval = global.eval,
        /**
         * @param {String} moduleName module name or path to file
         * @param {*}      module module content
         *
         * @returns {*}
         */
        register_module = function (moduleName, module) {
            // Predefine in case of recursive require
            var output = {exports: {}};
            initialized_modules[moduleName] = 1;
            modules[moduleName] = output.exports;

            if (!module) {
                // if undefined - try to pick up module from globals (like jQuery)
                module = global[moduleName];
            } else if (typeof module === "function") {
                // Ex-Lazy LMD module or unpacked module ("pack": false)
                module = module(sandboxed_modules[moduleName] ? null : require, output.exports, output) || output.exports;
            }

            return modules[moduleName] = module;
        },
        require = function (moduleName) {
            var module = modules[moduleName];

            // Already inited - return as is
            if (initialized_modules[moduleName] && module) {
                return module;
            }

            // Lazy LMD module not a string
            if (/^\(function\(/.test(module)) {
                module = global_eval(module);
            }

            return register_module(moduleName, module);
        },
        output = {exports: {}};

    for (var moduleName in modules) {
        // reset module init flag in case of overwriting
        initialized_modules[moduleName] = 0;
    }

    require.async = function (moduleName, callback) {
        var module = modules[moduleName];

        // Already inited - return as is
        if (initialized_modules[moduleName] && module) {
            return module;
        }

        // Optimized tiny ajax get
        // @see https://gist.github.com/1625623
        var xhr = new(global.XMLHttpRequest||global.ActiveXObject)("Microsoft.XMLHTTP");
        xhr.onreadystatechange = function () {
            // if readyState === 4
            xhr.readyState^4 ||
            // 4. Then callback it
            callback(
                // 3. Check for correct status 200 or 0 - OK?
                xhr.status < 201 ?
                // 2. Register and init module module
                register_module(
                    moduleName,
                    // 1. Parse or return as is
                    // application/javascript   - parse
                    // application/x-javascript - parse
                    // text/javascript          - parse
                    // application/json         - parse
                    // */*                      - as is
                    (/script$|json$/.test(xhr.getResponseHeader('content-type')) ? global_eval : String)
                        (xhr.responseText)
                ) :
                // 1. Not OK - Return undefined
                void 0
            );
        };
        xhr.open('get', moduleName);
        xhr.send();
    };



    require.js = function (moduleName, callback) {
        var module = modules[moduleName],
            readyState = 'readyState',
            isNotLoaded = 1,
            doc = global.document,
            head;

        // Already inited - return as is
        if (initialized_modules[moduleName] && module) {
            return module;
        }

        var script = doc.createElement("script");
        global.setTimeout(script.onreadystatechange = script.onload = function (e) {
            if (isNotLoaded &&
                (!e ||
                !script[readyState] ||
                script[readyState] == "loaded" ||
                script[readyState] == "complete")) {
                
                isNotLoaded = 0;
                callback(e ? register_module(moduleName, script) : e); // e === undefined
            }
        }, 3000, head); // in that moment head === undefined

        script.src = moduleName;
        head = doc.getElementsByTagName("head")[0];
        head.insertBefore(script, head.firstChild);
    };



    // Inspired by yepnope.css.js
    // @see https://github.com/SlexAxton/yepnope.js/blob/master/plugins/yepnope.css.js
    require.css = function (moduleName, callback) {
        var module = modules[moduleName];

        // Already inited - return as is
        if (initialized_modules[moduleName] && module) {
            return module;
        }

        // Create stylesheet link
        var isNotLoaded = 1,
            doc = global.document,
            head,
            link = doc.createElement("link"),
            id = +new Date;

        // Add attributes
        link.href = moduleName;
        link.rel = "stylesheet";
        link.id = id;

        global.setTimeout(link.onload = function (e) {
            if (isNotLoaded) {
                isNotLoaded = 0;
                callback(e ? register_module(moduleName, link) : e);
            }
        }, 3000, head); // in that moment head === undefined

        head = doc.getElementsByTagName("head")[0];
        head.insertBefore(link, head.firstChild);

        (function poll() {
            if (isNotLoaded) {
                try {
                    var sheets = document.styleSheets;
                    for (var j = 0, k = sheets.length; j < k; j++) {
                        if(sheets[j].ownerNode.id == id && sheets[j].cssRules.length) {
                            return link.onload(1);
                        }
                    }
                    // if we get here, its not in document.styleSheets (we never saw the ID)
                    throw 1;
                } catch(e) {
                    // Keep polling
                    global.setTimeout(poll, 20);
                }
            }
        }());
    };



    main(require, output.exports, output);
})(this,function main(require) {
    // Common Worker or Browser
    var i18n = require('i18n'),
        text = i18n.hello +  ', lmd',
        $, print, Worker, worker, cfg, tpl, escape;


    if (typeof window !== "undefined") {
        // Browser
        print = require('depA');
        escape = require('depB');
        Worker = require('Worker'); // grab from globals
        cfg = require('config');
        tpl = require('template'); // template string

        $ = require('$'); // grab module from globals: LMD version 1.2.0

        $(function () {
            // require off-package module config. Config flag: `async: true`
            // LMD parses content of module depend on Content-type header!
            // *** You must work on you HTTP server for correct headers,
            // *** if you work offline (using file:// protocol) then
            // *** Content-type header will be INVALID so all modules will be strings
            require.async('./modules/templates/async_template.html', function (async_template) {
                $('#log').html(
                    // use template to render text
                    typeof async_template !== "undefined" ?
                        async_template.replace('${content}', tpl.replace('${content}', escape(text))) :
                        tpl.replace('${content}', escape(text))
                );
            });

            // require some off-package javascript file - not a lmd module. Config flag: `js: true`
            require.js('./vendors/jquery.someplugin.js', function (scriptTag) {
                if (typeof scriptTag !== "undefined") {
                    print($.somePlugin());
                } else {
                    print('fail to load: ./vendors/jquery.someplugin.js');
                }
            });

            // require some off-package css file. Config flag: `css: true`
            require.css('./css/b-template.css', function (linkTag) {
                if (typeof linkTag !== "undefined") {
                    print('CSS - OK!');
                } else {
                    print('fail to load: ./css/b-template.css');
                }
            })
        });

        if (Worker) { // test if browser support workers
            worker = new Worker(cfg.worker);
            worker.addEventListener('message', function (event) {
                print("Received some data from worker: " + event.data);
            }, false);
        }
    } else {
        // Worker
        print = require('workerDepA');
    }


    // Common Worker or Browser
    print(text);
},{
"depA": (function (require) {
    var escape = require('depB');
    return function(message) {
        console.log(escape(message));
    }
}),
"template": "<i class=\"b-template\">${content}</i>",
"depB": (function (require, exports, module) { /* wrapped by builder */
// module is sandboxed(see cfgs) - it cannot require
// CommonJS Module exports
// or exports.feature = function () {}
// This module is common for worker and browser
module.exports = function(message) {
    return message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

// hack comment
}),
"workerDepA": function workerDepA(require){
    var escape = require('depB'), // shared module
        postMessage = require('postMessage'); // grab from global

    return function(message) {
        postMessage(escape(message));
    }
},
"i18n": {
    "hello": "Привет"
},
"config": {
    "worker": "./out/index.development.lmd.js"
}
},{"depB":true})