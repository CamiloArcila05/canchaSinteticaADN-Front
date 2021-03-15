var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Deberia crear producto|workspace-project Producto",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Cannot read property 'ver' of null"
        ],
        "trace": [
            "TypeError: Cannot read property 'ver' of null\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:716:56\n    at ManagedPromise.invokeCallback_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia crear producto\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\producto.e2e-spec.ts:16:5)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\producto.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "timestamp": 1615811605573,
        "duration": 9599
    },
    {
        "description": "Deberia listar productos|workspace-project Producto",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14376,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:675:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia listar productos\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\producto.e2e-spec.ts:30:5)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\producto.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "timestamp": 1615811615591,
        "duration": 48
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8564,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Error while running testForAngular: script timeout\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "Error: Error while running testForAngular: script timeout\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:727:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"should display welcome message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:11:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0069004b-00dc-0097-00ab-00fd00640080.png",
        "timestamp": 1615811772862,
        "duration": 15715
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4492,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Angular could not be found on the page http://localhost:4200/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page http://localhost:4200/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:720:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"should display welcome message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:11:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a100cd-0069-00ba-0065-00fc003a006e.png",
        "timestamp": 1615811857447,
        "duration": 14705
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, app-root h1)"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, app-root h1)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error: \n    at ElementArrayFinder.applyAction_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:831:22)\n    at AppPage.getTitleText (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.po.ts:9:43)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:13:17)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"should display welcome message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:11:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "009500e6-00b5-00b8-0066-0010002800e2.png",
        "timestamp": 1615812034634,
        "duration": 1096
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, app-root h1)"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, app-root h1)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error: \n    at ElementArrayFinder.applyAction_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:831:22)\n    at AppPage.getTitleText (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.po.ts:9:43)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:13:17)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"should display welcome message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:11:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "006000b6-0002-0055-00b3-00f500ba003e.png",
        "timestamp": 1615812225069,
        "duration": 918
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3176,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected '' to equal 'Cancha Sintetica  LA CERO'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:13:33)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00f2004f-00d5-00b2-0011-00bd001a00a2.png",
        "timestamp": 1615812409331,
        "duration": 986
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4616,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Error while running testForAngular: script timeout\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)",
            "Expected [ Entry({ level: SEVERE, message: 'http://localhost:4200/main.js 2217:26 Error: No base href set. Please provide a value for the APP_BASE_HREF token or add a base element to the document.\n    at new PathLocationStrategy (http://localhost:4200/vendor.js:19994:19)\n    at Object.provideLocationStrategy [as useFactory] (http://localhost:4200/vendor.js:107965:9)\n    at Object.factory (http://localhost:4200/vendor.js:44888:28)\n    at R3Injector.hydrate (http://localhost:4200/vendor.js:44755:63)\n    at R3Injector.get (http://localhost:4200/vendor.js:44505:33)\n    at injectInjectorOnly (http://localhost:4200/vendor.js:30324:33)\n    at Module.ɵɵinject (http://localhost:4200/vendor.js:30334:57)\n    at Object.Location_Factory [as factory] (http://localhost:4200/vendor.js:20428:129)\n    at R3Injector.hydrate (http://localhost:4200/vendor.js:44755:63)\n    at R3Injector.get (http://localhost:4200/vendor.js:44505:33)', timestamp: 1615812602896, type: '' }) ] not to contain <jasmine.objectContaining(Object({ level: SEVERE }))>."
        ],
        "trace": [
            "Error: Error while running testForAngular: script timeout\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:727:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"should display welcome message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:11:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "Error: Failed expectation\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:19:22\n    at step (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\tslib\\tslib.js:141:27)\n    at Object.next (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\tslib\\tslib.js:122:57)\n    at fulfilled (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\tslib\\tslib.js:112:62)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "007a002b-00cb-00d0-00c1-009e00b7006f.png",
        "timestamp": 1615812602221,
        "duration": 11740
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5684,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, app-root h1)"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, app-root h1)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error: \n    at ElementArrayFinder.applyAction_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\element.js:831:22)\n    at AppPage.getTitleText (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.po.ts:9:43)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:13:17)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"should display welcome message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:11:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "009e002c-004e-00fb-00f8-006b008200f8.png",
        "timestamp": 1615812863000,
        "duration": 1268
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5948,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'CANCHA SINTETICA \"LA CERO\" - INICIO' to equal 'Cancha Sintetica  LA CERO'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\app.e2e-spec.ts:13:33)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00680036-0017-00b6-00ac-00cd00ba0006.png",
        "timestamp": 1615813038065,
        "duration": 1408
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16344,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000a00ba-0004-001d-006a-004f0020000f.png",
        "timestamp": 1615813098479,
        "duration": 930
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 21476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 0 to be 7."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:30:15)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "000f002d-0069-0080-00b1-00240021007b.png",
        "timestamp": 1615814011097,
        "duration": 944
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12808,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 0 to be 7."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:30:15)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "006700ec-001a-00a5-004f-00ee002c009c.png",
        "timestamp": 1615814182044,
        "duration": 1239
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5876,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 0 to be 6."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:30:15)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "0013001c-0097-0071-00bf-0071009700f7.png",
        "timestamp": 1615814212723,
        "duration": 1412
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19604,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c006b-001c-0041-006a-00fc009f0093.png",
        "timestamp": 1615814298027,
        "duration": 988
    },
    {
        "description": "Deberia crear una cancha|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d4004a-00ce-00c8-000d-003400450079.png",
        "timestamp": 1615818054158,
        "duration": 1151
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9928,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 0 to be 7."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:33:15)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "004600f3-00f2-0062-00c1-00b2004300ed.png",
        "timestamp": 1615818055987,
        "duration": 748
    },
    {
        "description": "Deberia crear una cancha|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002c0073-00fa-00f4-0041-0017008500d0.png",
        "timestamp": 1615818082469,
        "duration": 1291
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0022000b-00cd-0028-00a9-00c300f100a1.png",
        "timestamp": 1615818084218,
        "duration": 629
    },
    {
        "description": "Deberia crear una cancha|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009a00f7-00b9-00c3-0097-003800180058.png",
        "timestamp": 1615818132482,
        "duration": 1270
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13196,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00440033-0052-005c-0056-0015000c003f.png",
        "timestamp": 1615818134184,
        "duration": 613
    },
    {
        "description": "Deberia crear una cancha|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15868,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008f008e-00ce-009e-0010-00f6007e0013.png",
        "timestamp": 1615818352265,
        "duration": 1263
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15868,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000400da-0092-00de-0043-00de00060031.png",
        "timestamp": 1615818353951,
        "duration": 759
    },
    {
        "description": "Deberia crear una cancha|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12184,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004c0055-0018-000e-0000-0087009f0087.png",
        "timestamp": 1615818745583,
        "duration": 1337
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12184,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003b000d-0060-00e4-0080-0009002800ce.png",
        "timestamp": 1615818747361,
        "duration": 762
    },
    {
        "description": "Deberia crear una cancha|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15616,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007600bb-008a-002a-002a-0014004600ef.png",
        "timestamp": 1615818862826,
        "duration": 1351
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15616,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 7 to be 0."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:33:15)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00ee009b-00a3-00a5-0019-001a00cf004c.png",
        "timestamp": 1615818864624,
        "duration": 740
    },
    {
        "description": "Deberia crear una cancha|workspace-project Producto",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d200aa-00c7-001e-0092-003400fd0038.png",
        "timestamp": 1615818987755,
        "duration": 1588
    },
    {
        "description": "Deberia listar canchas|workspace-project Producto",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 17256,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00970070-00e1-00f2-00d8-00b100860017.png",
        "timestamp": 1615818989771,
        "duration": 0
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d0000b-009a-0007-0013-000f00ac00dc.png",
        "timestamp": 1615819070117,
        "duration": 1359
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18444,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a00ca-00ac-00f4-0099-00ef00cb0012.png",
        "timestamp": 1615819071905,
        "duration": 743
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5864,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002900da-00cf-00c5-0025-00d5005a00af.png",
        "timestamp": 1615820130727,
        "duration": 1240
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5864,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820132961,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820132963,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820133185,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820133236,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820133238,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820133241,
                "type": ""
            }
        ],
        "screenShotFile": "00a50093-004a-00c8-00f7-00eb00630052.png",
        "timestamp": 1615820132414,
        "duration": 829
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5864,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 0 to be 7."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:33:15)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00200015-0034-002b-0054-009500c50037.png",
        "timestamp": 1615820133500,
        "duration": 710
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00400001-0021-00d9-008e-00ca0077000d.png",
        "timestamp": 1615820150053,
        "duration": 1113
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820152150,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820152154,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820152382,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820152431,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820152433,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615820152435,
                "type": ""
            }
        ],
        "screenShotFile": "003d00cc-0080-002a-009b-00b60074007f.png",
        "timestamp": 1615820151604,
        "duration": 833
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c3008f-00b2-002f-0037-001c006e006f.png",
        "timestamp": 1615820152704,
        "duration": 701
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19208,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008a00ac-002e-00a4-00e1-00b9008000cd.png",
        "timestamp": 1615821200278,
        "duration": 1365
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 19208,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 0 to be 7."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:34:15)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00280021-0040-0072-000a-0096004300bb.png",
        "timestamp": 1615821202088,
        "duration": 677
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7760,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00dc00db-004b-00d6-00b3-00cf00590081.png",
        "timestamp": 1615821264818,
        "duration": 1198
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7760,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cd0054-00f0-009b-0093-003f002e009e.png",
        "timestamp": 1615821266553,
        "duration": 820
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d700f2-00b3-0067-005f-0024002800eb.png",
        "timestamp": 1615823063560,
        "duration": 1774
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823066268,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823066268,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823066457,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823066458,
                "type": ""
            }
        ],
        "screenShotFile": "006a00bf-00e7-0035-0002-007400e30086.png",
        "timestamp": 1615823065761,
        "duration": 700
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 0 to be 9."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:33:15)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00f90045-00a0-0005-003a-008700eb00ce.png",
        "timestamp": 1615823066783,
        "duration": 685
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00720098-007a-0071-0038-004c0013004d.png",
        "timestamp": 1615823083765,
        "duration": 1309
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823086039,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823086040,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823086238,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823086239,
                "type": ""
            }
        ],
        "screenShotFile": "008e00ab-00a2-00b2-0084-008a00b30057.png",
        "timestamp": 1615823085533,
        "duration": 708
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0026003d-008e-001e-005a-007700050034.png",
        "timestamp": 1615823086514,
        "duration": 683
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4048,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003a0001-00e3-0098-00d8-0041008e0006.png",
        "timestamp": 1615823116812,
        "duration": 1225
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4048,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0073000b-00ec-0022-004e-00b80089003a.png",
        "timestamp": 1615823118468,
        "duration": 691
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4048,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00990054-008e-000b-0094-007600090038.png",
        "timestamp": 1615823119414,
        "duration": 689
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15184,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ad005f-0094-0099-0030-00a200f1005f.png",
        "timestamp": 1615823736215,
        "duration": 1341
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15184,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823738516,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823738517,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823738738,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823738739,
                "type": ""
            }
        ],
        "screenShotFile": "00730092-00a2-0069-0007-00df00e1009e.png",
        "timestamp": 1615823738013,
        "duration": 728
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15184,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739528,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739565,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739565,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739765,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739766,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739766,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739771,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739771,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739771,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739772,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739772,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739773,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739773,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823739774,
                "type": ""
            }
        ],
        "screenShotFile": "001b0015-005e-00c4-0057-007800fa00c1.png",
        "timestamp": 1615823739019,
        "duration": 772
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15184,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009d0039-00c8-00ae-00df-0087008d003a.png",
        "timestamp": 1615823740113,
        "duration": 707
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7264,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d600d8-0023-00cf-0070-00040031007d.png",
        "timestamp": 1615823780057,
        "duration": 1332
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7264,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823782377,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823782378,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823782545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823782546,
                "type": ""
            }
        ],
        "screenShotFile": "007d0021-00d6-0073-00d8-0055005d00d7.png",
        "timestamp": 1615823781842,
        "duration": 706
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7264,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783352,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783390,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783390,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783574,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783575,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783575,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783576,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783576,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783577,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783577,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783577,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783578,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783579,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783579,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783580,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783580,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783581,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783581,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783581,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783582,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783582,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783583,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823783583,
                "type": ""
            }
        ],
        "screenShotFile": "00190004-00e8-00d9-009a-003700620083.png",
        "timestamp": 1615823782832,
        "duration": 771
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7264,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00830058-00a5-00f3-00e2-00dc003f0043.png",
        "timestamp": 1615823783872,
        "duration": 682
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00760081-008f-001b-006e-007a008900d0.png",
        "timestamp": 1615823855729,
        "duration": 1340
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823858086,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823858087,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823858273,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823858273,
                "type": ""
            }
        ],
        "screenShotFile": "00bc0085-0036-007f-0077-004000a500e4.png",
        "timestamp": 1615823857542,
        "duration": 733
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859089,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859126,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859126,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859338,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859339,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859341,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859342,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859342,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859343,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859344,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859346,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859347,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859347,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859348,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859349,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859350,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859350,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859351,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859351,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823859352,
                "type": ""
            }
        ],
        "screenShotFile": "002a0002-0069-008e-0054-009e00d60053.png",
        "timestamp": 1615823858570,
        "duration": 804
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003200d1-0007-00c4-0070-003d00810004.png",
        "timestamp": 1615823859639,
        "duration": 694
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20536,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000b0093-00e8-00de-0044-0004002500a8.png",
        "timestamp": 1615823893892,
        "duration": 1712
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20536,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823896569,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823896570,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823896739,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823896739,
                "type": ""
            }
        ],
        "screenShotFile": "00e700af-001c-0091-0019-001300e400f6.png",
        "timestamp": 1615823896031,
        "duration": 711
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20536,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897544,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897777,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897778,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897779,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897780,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897781,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897782,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897783,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897784,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897784,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897785,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897785,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897786,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897786,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897787,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897787,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897788,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897788,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897789,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897789,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897790,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897836,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897836,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897838,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615823897839,
                "type": ""
            }
        ],
        "screenShotFile": "005f00e5-0019-0069-00b9-00c400f90053.png",
        "timestamp": 1615823897019,
        "duration": 823
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20536,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b10055-0036-0000-00f0-0054001a0002.png",
        "timestamp": 1615823898152,
        "duration": 681
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined",
            "Failed: Cannot read property 'navigateTo' of undefined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "TypeError: Cannot read property 'navigateTo' of undefined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:20:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia crear una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:19:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007100e3-007f-00e3-005c-0052009c0098.png",
        "timestamp": 1615823941717,
        "duration": 9
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined",
            "Failed: Cannot read property 'navigateTo' of undefined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "TypeError: Cannot read property 'navigateTo' of undefined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:30:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia cancelar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:29:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b000da-00ca-0068-009f-00340054009e.png",
        "timestamp": 1615823942173,
        "duration": 3
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined",
            "Failed: Cannot read property 'navigateTo' of undefined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "TypeError: Cannot read property 'navigateTo' of undefined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:35:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia finalizar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:34:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "006100b1-0034-0032-009c-003c00fc0098.png",
        "timestamp": 1615823942442,
        "duration": 6
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined",
            "Failed: Cannot read property 'navigateTo' of undefined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "TypeError: Cannot read property 'navigateTo' of undefined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:41:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia listar reservas\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:40:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00710027-0007-001c-0025-006d003f00ec.png",
        "timestamp": 1615823942709,
        "duration": 4
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ec0085-0028-000a-004f-0012002d00d7.png",
        "timestamp": 1615823975982,
        "duration": 1356
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:28:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia cancelar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:27:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "003a0062-0015-00a2-0062-000700e800b4.png",
        "timestamp": 1615823977776,
        "duration": 6
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:35:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia finalizar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:34:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "000f008e-000c-0099-0008-0063006800dc.png",
        "timestamp": 1615823978038,
        "duration": 3
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00960048-00d6-004d-0088-00d300120025.png",
        "timestamp": 1615823978289,
        "duration": 733
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15416,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ea0061-0000-0075-00e3-00a900f4002e.png",
        "timestamp": 1615824323862,
        "duration": 1308
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15416,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:33:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia cancelar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:32:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "005600d6-0033-006c-0095-00c2004c00d3.png",
        "timestamp": 1615824325652,
        "duration": 12
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15416,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:40:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia finalizar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:39:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "002e004b-003b-0018-001a-008a0001006b.png",
        "timestamp": 1615824325939,
        "duration": 6
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15416,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f700c9-00e7-0031-008f-0077002200eb.png",
        "timestamp": 1615824326207,
        "duration": 727
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b700d3-0021-00a3-0058-00ba000e001c.png",
        "timestamp": 1615824367343,
        "duration": 1385
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:33:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia cancelar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:32:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "009200f6-00d7-0090-00e9-00fe0024006c.png",
        "timestamp": 1615824369181,
        "duration": 14
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:40:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia finalizar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:39:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d60071-00f1-00c9-0033-0017001000c0.png",
        "timestamp": 1615824369476,
        "duration": 8
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18304,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000500e3-001f-0002-00ed-00de00a00040.png",
        "timestamp": 1615824369726,
        "duration": 786
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ca000e-0008-0034-00c2-00f100780036.png",
        "timestamp": 1615824551779,
        "duration": 1755
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:28:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia cancelar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:27:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e600a4-0085-00e3-00a7-008800b000a6.png",
        "timestamp": 1615824554016,
        "duration": 6
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: localStorage is not defined"
        ],
        "trace": [
            "ReferenceError: localStorage is not defined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:35:5)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Deberia finalizar una reserva\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:34:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bc008a-00cb-002c-0096-00f8003e003a.png",
        "timestamp": 1615824554290,
        "duration": 3
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a00ae-0068-00f1-00de-00fd00ac00ca.png",
        "timestamp": 1615824554561,
        "duration": 776
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3492,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001700bc-00b4-00ee-0094-008b00c50029.png",
        "timestamp": 1615824575412,
        "duration": 2021
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3492,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824578490,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824578491,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824578669,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824578670,
                "type": ""
            }
        ],
        "screenShotFile": "00be0036-00c5-0055-00fe-009d00510032.png",
        "timestamp": 1615824577891,
        "duration": 783
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3492,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579553,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579590,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579590,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579773,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579774,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579775,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579776,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579776,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579777,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579777,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579778,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579779,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579780,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579780,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579781,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579782,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579783,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579783,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579784,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579785,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579786,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579786,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579787,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579834,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579835,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579836,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824579837,
                "type": ""
            }
        ],
        "screenShotFile": "002c0022-0060-00a2-00b8-00cd00d5004d.png",
        "timestamp": 1615824578936,
        "duration": 904
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3492,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a5009b-0063-000f-0032-000b00fd00ac.png",
        "timestamp": 1615824580113,
        "duration": 743
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13620,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00910010-0096-0015-00b2-001f0096006f.png",
        "timestamp": 1615824628950,
        "duration": 1262
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13620,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824631261,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824631265,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824631393,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824631441,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824631443,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615824631445,
                "type": ""
            }
        ],
        "screenShotFile": "008c00f9-000e-00b9-0043-005d00960047.png",
        "timestamp": 1615824630661,
        "duration": 786
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13620,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00720054-003a-00db-00b8-00f700ec003d.png",
        "timestamp": 1615824631730,
        "duration": 649
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2868,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f200d5-0055-00d2-00a7-00a300160064.png",
        "timestamp": 1615825174632,
        "duration": 1298
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2868,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825177245,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825177250,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825177441,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825177512,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825177516,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825177519,
                "type": ""
            }
        ],
        "screenShotFile": "003f0024-00dc-00c0-0031-004600b60010.png",
        "timestamp": 1615825176451,
        "duration": 1072
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2868,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009500ba-00eb-00f9-002b-0066003b0083.png",
        "timestamp": 1615825177826,
        "duration": 1071
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2868,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c10029-00e9-001f-002b-002e005e009a.png",
        "timestamp": 1615825179199,
        "duration": 817
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c100d7-005c-0046-00f0-003e00fa00ad.png",
        "timestamp": 1615825446982,
        "duration": 1514
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825449726,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825449730,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825450018,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825450085,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825450088,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825450091,
                "type": ""
            }
        ],
        "screenShotFile": "00570068-0045-0042-006d-00e500470087.png",
        "timestamp": 1615825448980,
        "duration": 1115
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006e00f6-0010-00e0-00b1-004d00620097.png",
        "timestamp": 1615825450386,
        "duration": 1114
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3828,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ea005e-00d4-00cf-00ad-00db00db0090.png",
        "timestamp": 1615825451794,
        "duration": 941
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15200,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d100a5-0012-0015-00cd-00d6008c0000.png",
        "timestamp": 1615825568049,
        "duration": 1713
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 15200,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "007f002e-0043-00fb-0028-006100f30020.png",
        "timestamp": 1615825570285,
        "duration": 0
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 15200,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "0023002b-00ab-004f-00b3-00ce00e800e2.png",
        "timestamp": 1615825570316,
        "duration": 0
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 15200,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "0047002f-00b5-0069-00ac-00a3002b0095.png",
        "timestamp": 1615825570348,
        "duration": 0
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19172,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0005001d-0042-0067-009a-006d009700a7.png",
        "timestamp": 1615825603046,
        "duration": 1580
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19172,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825605966,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825605969,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825606262,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825606335,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825606339,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825606344,
                "type": ""
            }
        ],
        "screenShotFile": "008c0019-00bb-0007-009a-00d4005c00cb.png",
        "timestamp": 1615825605223,
        "duration": 1126
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19172,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005f0030-0077-0079-00a3-001200b0002a.png",
        "timestamp": 1615825606645,
        "duration": 1133
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19172,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f0084-00d1-00ba-00f6-00af00370064.png",
        "timestamp": 1615825608121,
        "duration": 2940
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00350027-00ee-0089-006c-003700d300af.png",
        "timestamp": 1615825624037,
        "duration": 1710
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825627115,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825627118,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825627375,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825627433,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825627435,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825627438,
                "type": ""
            }
        ],
        "screenShotFile": "00a700d9-0033-00ec-0048-007800310063.png",
        "timestamp": 1615825626352,
        "duration": 1088
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f60044-00cd-0067-003d-002300dd00e7.png",
        "timestamp": 1615825627733,
        "duration": 1101
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00130047-007f-00df-0020-005800a3003f.png",
        "timestamp": 1615825629143,
        "duration": 1007
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11872,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00be00d4-0036-00c1-009c-00a900910090.png",
        "timestamp": 1615825765218,
        "duration": 1645
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11872,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825768541,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825768547,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825768827,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825768891,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825768893,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615825768898,
                "type": ""
            }
        ],
        "screenShotFile": "00a500f2-0009-00f3-00e4-000b00cf003c.png",
        "timestamp": 1615825767555,
        "duration": 1347
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11872,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004d00f5-0077-00f2-00d6-00eb003e00ca.png",
        "timestamp": 1615825769219,
        "duration": 2496
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11872,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e00a2-0045-0074-0043-008200e90098.png",
        "timestamp": 1615825772219,
        "duration": 1363
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20904,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'La cancha: CANCHA PRUEBA ha sido creada exitosamente' to equal 'La cancha: CANCHA PRUEBA ha  creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:31:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "006000db-00be-0086-0081-00ac0038009f.png",
        "timestamp": 1615826408980,
        "duration": 1559
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20904,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826411774,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826411778,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826412055,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826412117,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826412119,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826412122,
                "type": ""
            }
        ],
        "screenShotFile": "001b004a-00b1-00dc-0014-007600660087.png",
        "timestamp": 1615826411040,
        "duration": 1085
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20904,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00290000-00da-0026-005c-00c3009d00e3.png",
        "timestamp": 1615826412430,
        "duration": 1059
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20904,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e10063-00da-005b-0030-0017003800f4.png",
        "timestamp": 1615826413828,
        "duration": 2339
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7756,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f0008-0009-0002-0020-0045009d0004.png",
        "timestamp": 1615826437662,
        "duration": 1856
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7756,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826440936,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826440942,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826441228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826441289,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826441291,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826441294,
                "type": ""
            }
        ],
        "screenShotFile": "008a0002-0085-00d4-00c7-00de001000fd.png",
        "timestamp": 1615826440135,
        "duration": 1162
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7756,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0048002c-000d-0098-0020-00c400d50020.png",
        "timestamp": 1615826441612,
        "duration": 1163
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7756,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e000d-00e9-003d-0006-00a900b1006b.png",
        "timestamp": 1615826443094,
        "duration": 1082
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001f0047-00e3-0084-0093-003600a6007e.png",
        "timestamp": 1615826875712,
        "duration": 1390
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826878113,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826878114,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826878287,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826878287,
                "type": ""
            }
        ],
        "screenShotFile": "00af0093-0052-0064-0030-003d003e00f7.png",
        "timestamp": 1615826877549,
        "duration": 740
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000b0039-008f-005a-00ad-005f00c80087.png",
        "timestamp": 1615826878570,
        "duration": 916
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880200,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880203,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880204,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880423,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880424,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880425,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880426,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880427,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880427,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880428,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880429,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880429,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880430,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880431,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880432,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880433,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880434,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880434,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880435,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880436,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880437,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880438,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880439,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880491,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880492,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880493,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826880494,
                "type": ""
            }
        ],
        "screenShotFile": "00920015-00bc-0023-0012-00a2003500e3.png",
        "timestamp": 1615826879783,
        "duration": 721
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6476,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0066004f-00b5-008f-00f6-005a0095005f.png",
        "timestamp": 1615826880791,
        "duration": 765
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004a0024-009d-00ae-00ee-00ca00d0008b.png",
        "timestamp": 1615826908759,
        "duration": 1774
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826911644,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826911648,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826911778,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826911824,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826911826,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826911829,
                "type": ""
            }
        ],
        "screenShotFile": "00b100fc-00a3-005a-007b-005900b700c4.png",
        "timestamp": 1615826911102,
        "duration": 731
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005b0042-00f3-0026-0073-00ee00000016.png",
        "timestamp": 1615826912124,
        "duration": 861
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000d008b-0079-00a5-0039-003b0068008e.png",
        "timestamp": 1615826913271,
        "duration": 690
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13732,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00850073-00eb-00c9-0006-009e00a900e8.png",
        "timestamp": 1615826942813,
        "duration": 1835
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13732,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826945678,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826945678,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826945865,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826945865,
                "type": ""
            }
        ],
        "screenShotFile": "00d200e1-0063-0089-007d-006200c4006b.png",
        "timestamp": 1615826945116,
        "duration": 752
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13732,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a0009a-00b2-0003-003c-004d003e0043.png",
        "timestamp": 1615826946168,
        "duration": 885
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13732,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947771,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947771,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947949,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947950,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947951,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947951,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947952,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947952,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947952,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947953,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947953,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947954,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947955,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947955,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947956,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947957,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947957,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947958,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947958,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947959,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947959,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826947960,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826948012,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826948013,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826948015,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615826948015,
                "type": ""
            }
        ],
        "screenShotFile": "00d700d9-00fa-00db-00f7-00f1001900bb.png",
        "timestamp": 1615826947354,
        "duration": 670
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13732,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004d0065-00e9-001f-0098-001700f1006d.png",
        "timestamp": 1615826948310,
        "duration": 628
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f300ea-006e-00f2-00eb-007500a80006.png",
        "timestamp": 1615827061580,
        "duration": 1338
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827063883,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827063883,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827064055,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827064056,
                "type": ""
            }
        ],
        "screenShotFile": "00e900a1-0057-00ef-00f6-003c00c40069.png",
        "timestamp": 1615827063333,
        "duration": 725
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008900fb-0037-001f-00c8-00d300160091.png",
        "timestamp": 1615827064362,
        "duration": 892
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827065958,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827065962,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827065963,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066138,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066138,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066139,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066140,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066140,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066141,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066141,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066142,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066142,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066143,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066143,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066144,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066144,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066145,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066145,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066147,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066147,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066148,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066149,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066149,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066195,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066196,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066198,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827066199,
                "type": ""
            }
        ],
        "screenShotFile": "00cf006e-0047-00fa-009d-003f0052007c.png",
        "timestamp": 1615827065530,
        "duration": 678
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ef0041-0034-00d5-00db-001d00b4003e.png",
        "timestamp": 1615827066515,
        "duration": 746
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4328,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00cd0027-00fd-00f1-007b-00c60060003e.png",
        "timestamp": 1615827153602,
        "duration": 1353
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4328,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827155913,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827155915,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827156100,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827156100,
                "type": ""
            }
        ],
        "screenShotFile": "00540084-0006-0092-0077-00d600e0008a.png",
        "timestamp": 1615827155392,
        "duration": 711
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4328,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e80063-00da-00d0-001d-004b00e40081.png",
        "timestamp": 1615827156372,
        "duration": 840
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4328,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827157968,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827157971,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827157972,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158142,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158143,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158144,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158145,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158145,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158146,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158147,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158147,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158148,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158149,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158149,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158150,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158151,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158151,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158152,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158152,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158153,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158154,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158154,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158155,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158202,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158203,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158204,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615827158205,
                "type": ""
            }
        ],
        "screenShotFile": "009000fa-00f3-0088-00e6-009500ca00da.png",
        "timestamp": 1615827157520,
        "duration": 694
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4328,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ed0049-006b-0085-0078-006300dc00a9.png",
        "timestamp": 1615827158484,
        "duration": 718
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002f0045-003b-00d7-004c-00bc004f0026.png",
        "timestamp": 1615835118694,
        "duration": 1855
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835121770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835121770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835121958,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835121958,
                "type": ""
            }
        ],
        "screenShotFile": "001300bc-00fd-0015-00be-006d00d9005a.png",
        "timestamp": 1615835121002,
        "duration": 959
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00330018-003a-0020-00ad-000d006200fa.png",
        "timestamp": 1615835122260,
        "duration": 980
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124041,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124045,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124046,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124218,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124219,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124220,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124221,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124222,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124223,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124224,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124224,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124225,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124225,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124226,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124227,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124227,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124229,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124230,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124230,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124231,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124231,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124278,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124279,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124280,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835124281,
                "type": ""
            }
        ],
        "screenShotFile": "00f6008c-0063-001c-0098-000b00790072.png",
        "timestamp": 1615835123567,
        "duration": 728
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9600,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005200df-00ce-0010-00a9-0002008c00ed.png",
        "timestamp": 1615835124601,
        "duration": 797
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7760,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000f00d3-004a-00ee-00a6-00c200d5009e.png",
        "timestamp": 1615835194963,
        "duration": 1491
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 7760,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "002d009f-00ca-00df-0097-00c1000c0086.png",
        "timestamp": 1615835196928,
        "duration": 0
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 7760,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "002b00a9-0023-001d-00b5-0051005800bb.png",
        "timestamp": 1615835196958,
        "duration": 0
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 7760,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00210070-0029-0061-000e-002d009100bc.png",
        "timestamp": 1615835196993,
        "duration": 0
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 7760,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00dc0083-008a-0025-0095-00f1001500b9.png",
        "timestamp": 1615835197020,
        "duration": 0
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17512,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f90038-0098-0098-0044-00b600e9005d.png",
        "timestamp": 1615835234608,
        "duration": 1498
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 17512,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00a100fc-0013-00bf-00f9-00dc000600b9.png",
        "timestamp": 1615835236551,
        "duration": 0
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 17512,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "001b0092-0038-007e-00f7-00cc001500b2.png",
        "timestamp": 1615835236588,
        "duration": 0
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 17512,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00dc0093-007c-00eb-00e7-003b00e600e7.png",
        "timestamp": 1615835236621,
        "duration": 0
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 17512,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "004500d4-002d-0087-00f7-0032002b00f4.png",
        "timestamp": 1615835236654,
        "duration": 0
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13388,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ocurrio un error inesperado, contacte al administrador del sistema' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:32:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615835264441,
                "type": ""
            }
        ],
        "screenShotFile": "0030001b-0061-002f-0041-000300f70015.png",
        "timestamp": 1615835262371,
        "duration": 2136
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 13388,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "002e001f-00d7-008c-002f-00da0058000e.png",
        "timestamp": 1615835265010,
        "duration": 0
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 13388,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00c700f3-0001-00c1-0059-006000d6003a.png",
        "timestamp": 1615835265034,
        "duration": 0
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 13388,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "003100bf-0069-0033-00e2-006a001a0075.png",
        "timestamp": 1615835265061,
        "duration": 0
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 13388,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00a000f1-00bb-0040-00d8-005f000d00aa.png",
        "timestamp": 1615835265089,
        "duration": 0
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ocurrio un error inesperado, contacte al administrador del sistema' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:32:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615835311598,
                "type": ""
            }
        ],
        "screenShotFile": "008a009c-005a-0031-0075-0029001700e6.png",
        "timestamp": 1615835309760,
        "duration": 1921
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 20668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "000200b9-00bd-0022-0005-009100e700a8.png",
        "timestamp": 1615835312220,
        "duration": 0
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 20668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "0015001e-0074-0040-0008-00b2004e0053.png",
        "timestamp": 1615835312251,
        "duration": 0
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 20668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00f900e1-002d-0065-005c-0004002a0083.png",
        "timestamp": 1615835312281,
        "duration": 0
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 20668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "003f00cf-0054-0021-0076-001100dd003c.png",
        "timestamp": 1615835312304,
        "duration": 0
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c00f3-000d-00e5-00d8-00e300040027.png",
        "timestamp": 1615835364012,
        "duration": 1574
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835366682,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835366683,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835366855,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835366856,
                "type": ""
            }
        ],
        "screenShotFile": "00590089-00eb-000d-0094-0088006a0043.png",
        "timestamp": 1615835366082,
        "duration": 777
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0078002f-0075-001e-0009-00fd008600e6.png",
        "timestamp": 1615835367143,
        "duration": 924
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368810,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368814,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368814,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368986,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368987,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368988,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368989,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368990,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368990,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368991,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368991,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368992,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368993,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368993,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368994,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368994,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368995,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368996,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368996,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368997,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368997,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368998,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835368999,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835369045,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835369046,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835369048,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835369049,
                "type": ""
            }
        ],
        "screenShotFile": "008600fd-00ec-009e-0060-00cf00bb00d8.png",
        "timestamp": 1615835368366,
        "duration": 693
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003a0059-00e1-006f-00ca-0025006200b2.png",
        "timestamp": 1615835369357,
        "duration": 763
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:32:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615835559457,
                "type": ""
            }
        ],
        "screenShotFile": "00550061-0092-0073-00f7-005a005a0097.png",
        "timestamp": 1615835557507,
        "duration": 2014
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835560650,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835560651,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835560833,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835560833,
                "type": ""
            }
        ],
        "screenShotFile": "002d0097-00e2-00f5-0026-00f700a9006f.png",
        "timestamp": 1615835560058,
        "duration": 814
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c90041-0097-0058-00fa-0030007c0020.png",
        "timestamp": 1615835561163,
        "duration": 913
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835562825,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835562829,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835562830,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563009,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563009,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563010,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563010,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563011,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563011,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563012,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563012,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563013,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563013,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563014,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563014,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563015,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563016,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563016,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563017,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563017,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563018,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563018,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563019,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563065,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563065,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563067,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835563068,
                "type": ""
            }
        ],
        "screenShotFile": "00c8001b-0078-005c-00a9-002700b7005a.png",
        "timestamp": 1615835562381,
        "duration": 695
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005800f2-00d0-004b-00d6-00d900c700ec.png",
        "timestamp": 1615835563354,
        "duration": 701
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7232,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00410099-00ab-0081-000f-00aa00cd00e2.png",
        "timestamp": 1615835609355,
        "duration": 1695
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7232,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835612196,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835612197,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835612372,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835612373,
                "type": ""
            }
        ],
        "screenShotFile": "00cd0096-00a5-0079-003c-0014003c00ae.png",
        "timestamp": 1615835611536,
        "duration": 876
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7232,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000b002d-009e-008c-0084-001c005e005b.png",
        "timestamp": 1615835612741,
        "duration": 1034
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7232,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614579,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614583,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614584,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614757,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614758,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614758,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614759,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614760,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614761,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614761,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614762,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614763,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614763,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614764,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614764,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614765,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614765,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614766,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614766,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614820,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614821,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614823,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835614824,
                "type": ""
            }
        ],
        "screenShotFile": "0006003b-0077-0030-0067-007c002500b5.png",
        "timestamp": 1615835614073,
        "duration": 760
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7232,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000900e5-00c4-0080-0085-004600c600ee.png",
        "timestamp": 1615835615112,
        "duration": 733
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3100,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e900ef-0063-00b4-004d-00a200e70034.png",
        "timestamp": 1615835725665,
        "duration": 1881
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3100,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835728961,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835728964,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835729188,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835729237,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835729239,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835729241,
                "type": ""
            }
        ],
        "screenShotFile": "00530004-0022-0006-0048-0090009d0083.png",
        "timestamp": 1615835728383,
        "duration": 861
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3100,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0085000a-0085-001c-00c1-00fc00b50053.png",
        "timestamp": 1615835729521,
        "duration": 894
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3100,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00190018-0016-00e7-00ab-009e0017002c.png",
        "timestamp": 1615835730727,
        "duration": 682
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9584,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "008c008a-00db-00d4-0039-008600fd0074.png",
        "timestamp": 1615835941591,
        "duration": 1386
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9584,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835944098,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835944101,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835944327,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835944378,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835944380,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615835944383,
                "type": ""
            }
        ],
        "screenShotFile": "008c008d-00d7-003b-00d0-00c20091009f.png",
        "timestamp": 1615835943506,
        "duration": 888
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9584,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "000a009d-00ed-004c-005f-00ee00fa0057.png",
        "timestamp": 1615835944691,
        "duration": 917
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9584,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "009200f9-0026-007e-00c5-00d500780027.png",
        "timestamp": 1615835945918,
        "duration": 808
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:17:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "004f00c2-0060-0043-00b9-0032009100a9.png",
        "timestamp": 1615836062647,
        "duration": 1472
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:17:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836065298,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836065300,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836065537,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836065585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836065586,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836065588,
                "type": ""
            }
        ],
        "screenShotFile": "0012009a-0008-0094-00db-002300c90067.png",
        "timestamp": 1615836064663,
        "duration": 943
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:17:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00120059-005b-0030-00bf-009600ff00f1.png",
        "timestamp": 1615836065896,
        "duration": 914
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9204,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:17:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "008c008c-0093-0013-0005-00b000d400e5.png",
        "timestamp": 1615836067129,
        "duration": 851
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8660,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)",
            "Expected '' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:17:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:42:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615836147535,
                "type": ""
            }
        ],
        "screenShotFile": "000b0013-003a-008c-00fc-000300dd0022.png",
        "timestamp": 1615836146026,
        "duration": 1599
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8660,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:17:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836148867,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836148869,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836149062,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836149063,
                "type": ""
            }
        ],
        "screenShotFile": "008000f1-00ed-00bd-0055-00e80009005b.png",
        "timestamp": 1615836148218,
        "duration": 904
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8660,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:17:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "008b0047-0004-00cd-005b-00c10046006e.png",
        "timestamp": 1615836149470,
        "duration": 857
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8660,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:17:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151128,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151132,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151133,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151312,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151313,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151313,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151314,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151315,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151316,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151317,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151318,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151319,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151320,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151320,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151321,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151321,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151322,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151322,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151323,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151324,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151324,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151325,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151326,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151376,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151377,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151379,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836151379,
                "type": ""
            }
        ],
        "screenShotFile": "00520095-0001-00d9-000c-004900ba0017.png",
        "timestamp": 1615836150647,
        "duration": 755
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8660,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:18:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:17:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b200b8-00cd-006c-00af-00fd00a20057.png",
        "timestamp": 1615836151693,
        "duration": 1515
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615836262778,
                "type": ""
            }
        ],
        "screenShotFile": "00fa0009-008a-00af-00a5-00dd0065008a.png",
        "timestamp": 1615836261205,
        "duration": 1659
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836264074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836264075,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836264263,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836264264,
                "type": ""
            }
        ],
        "screenShotFile": "005c0065-0076-00df-0068-009d00310055.png",
        "timestamp": 1615836263417,
        "duration": 904
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0041009d-0058-00bc-00c5-009200c1007a.png",
        "timestamp": 1615836264602,
        "duration": 755
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266111,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266113,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266113,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266289,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266290,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266291,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266291,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266292,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266293,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266293,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266294,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266295,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266296,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266296,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266297,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266298,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266298,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266299,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266299,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266300,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266300,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266301,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266302,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266352,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266353,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266354,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836266355,
                "type": ""
            }
        ],
        "screenShotFile": "00830069-00cc-008d-00fc-007d00f70094.png",
        "timestamp": 1615836265661,
        "duration": 717
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13004,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d4005e-00f1-000a-0057-00bf00f100aa.png",
        "timestamp": 1615836266678,
        "duration": 777
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4892,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d50047-000c-0037-001e-00de003a00d9.png",
        "timestamp": 1615836290478,
        "duration": 1585
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4892,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836293181,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836293182,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836293260,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836293261,
                "type": ""
            }
        ],
        "screenShotFile": "00870088-00ed-00b2-0034-00a700690082.png",
        "timestamp": 1615836292608,
        "duration": 699
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4892,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00660065-0048-0090-0059-00dd001000bb.png",
        "timestamp": 1615836293595,
        "duration": 871
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4892,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295494,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295532,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295533,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295713,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295714,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295714,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295715,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295716,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295717,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295717,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295719,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295719,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295720,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295720,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295721,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295722,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295723,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295723,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295724,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295724,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295725,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295725,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295726,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295774,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295774,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295776,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836295776,
                "type": ""
            }
        ],
        "screenShotFile": "000f00b8-0036-00d8-00ae-0028007000ca.png",
        "timestamp": 1615836294801,
        "duration": 988
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4892,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007000df-00f0-00d5-00b5-007e00da0056.png",
        "timestamp": 1615836296088,
        "duration": 802
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3592,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615836353925,
                "type": ""
            }
        ],
        "screenShotFile": "001c00b8-00b2-0010-0008-00fb00c7004b.png",
        "timestamp": 1615836352414,
        "duration": 1604
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3592,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836355183,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836355184,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836355266,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836355266,
                "type": ""
            }
        ],
        "screenShotFile": "00bf004b-00f3-008b-0010-008700310054.png",
        "timestamp": 1615836354579,
        "duration": 735
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3592,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007e00c3-005d-00c4-00a5-003600e70050.png",
        "timestamp": 1615836355608,
        "duration": 961
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3592,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357342,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357346,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357347,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357535,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357536,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357537,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357538,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357539,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357539,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357540,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357540,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357541,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357541,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357542,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357542,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357543,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357544,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357546,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357547,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357547,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357548,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357549,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357601,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357602,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357604,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836357605,
                "type": ""
            }
        ],
        "screenShotFile": "00f300e4-0056-00bf-0026-00390005003c.png",
        "timestamp": 1615836356878,
        "duration": 751
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3592,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b300ca-00fc-00e7-0022-0001001f0071.png",
        "timestamp": 1615836357913,
        "duration": 743
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15544,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615836378693,
                "type": ""
            }
        ],
        "screenShotFile": "00cf00d6-0058-00a2-002c-007f0074001e.png",
        "timestamp": 1615836377161,
        "duration": 1683
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15544,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836392976,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836392977,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836393560,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836393560,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836417518,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836417518,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836417518,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836417518,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836417518,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836417518,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836417518,
                "type": ""
            }
        ],
        "screenShotFile": "00810093-00fe-00c2-000c-001900420021.png",
        "timestamp": 1615836379375,
        "duration": 38215
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15544,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f3004c-0053-005c-009f-00dd00950063.png",
        "timestamp": 1615836417874,
        "duration": 1729
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15544,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420588,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420595,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420596,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420831,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420832,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420833,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420834,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420835,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420836,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420837,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420838,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420839,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420840,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420841,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420842,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420843,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420844,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420846,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420847,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420848,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420849,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420850,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420851,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420952,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420953,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420955,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836420957,
                "type": ""
            }
        ],
        "screenShotFile": "00e400f3-0015-0044-009e-000400890065.png",
        "timestamp": 1615836419927,
        "duration": 1081
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15544,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004f0063-00ef-00f6-00b6-00e3001b0028.png",
        "timestamp": 1615836421308,
        "duration": 916
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615836503961,
                "type": ""
            }
        ],
        "screenShotFile": "00e000a7-0049-00f3-008e-00eb00520036.png",
        "timestamp": 1615836502106,
        "duration": 2008
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836530262,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836530277,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836530713,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836530714,
                "type": ""
            }
        ],
        "screenShotFile": "001400a1-00a6-0007-00b1-0054002400fe.png",
        "timestamp": 1615836504699,
        "duration": 53090
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005f0063-0013-00de-00bd-00420080001c.png",
        "timestamp": 1615836558131,
        "duration": 1156
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560234,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560246,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560246,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560488,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560488,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560489,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560490,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560490,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560491,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560492,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560493,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560494,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560495,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560496,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560496,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560497,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560498,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560499,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560499,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560500,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560500,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560501,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560579,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560579,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836560589,
                "type": ""
            }
        ],
        "screenShotFile": "00fa00d5-008b-0023-0010-005000520052.png",
        "timestamp": 1615836559613,
        "duration": 1014
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001d00bd-00fd-0081-0007-009c001f0015.png",
        "timestamp": 1615836560948,
        "duration": 880
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615836602694,
                "type": ""
            }
        ],
        "screenShotFile": "00e50064-0095-0039-00f8-00ab008600f3.png",
        "timestamp": 1615836601247,
        "duration": 1543
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836604113,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836604113,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836605313,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836605314,
                "type": ""
            }
        ],
        "screenShotFile": "0062002c-002c-00ac-00f1-00c2006d00da.png",
        "timestamp": 1615836603328,
        "duration": 2033
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0073001f-0004-0006-0075-00b0006e0002.png",
        "timestamp": 1615836605649,
        "duration": 881
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607257,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607262,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607263,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607449,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607451,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607451,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607452,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607452,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607453,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607454,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607454,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607455,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607455,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607456,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607457,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607457,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607458,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607458,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607459,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607459,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607460,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607461,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607462,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607527,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607527,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607528,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836607528,
                "type": ""
            }
        ],
        "screenShotFile": "00ad00fe-0062-0058-00f9-001300cd003f.png",
        "timestamp": 1615836606829,
        "duration": 719
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e2006d-0084-00b4-0018-000e002e00c0.png",
        "timestamp": 1615836607875,
        "duration": 941
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615836659373,
                "type": ""
            }
        ],
        "screenShotFile": "00cf001c-0083-00e6-00a4-0037007b00f1.png",
        "timestamp": 1615836657964,
        "duration": 1495
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836661639,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836661642,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836661826,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836661826,
                "type": ""
            }
        ],
        "screenShotFile": "00d000d4-002a-0008-006b-000b00cf00d1.png",
        "timestamp": 1615836660020,
        "duration": 1856
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005200c0-005b-0068-0059-00b9002700b9.png",
        "timestamp": 1615836662189,
        "duration": 942
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836663862,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836663866,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836663866,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664040,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664041,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664042,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664042,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664043,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664044,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664045,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664046,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664046,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664047,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664048,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664048,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664049,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664049,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664050,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664050,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664051,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664052,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664052,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664053,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664100,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664101,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664102,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836664103,
                "type": ""
            }
        ],
        "screenShotFile": "001b0044-005a-0036-0069-003400ce001a.png",
        "timestamp": 1615836663441,
        "duration": 694
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18408,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ac0073-007a-00a2-0024-00a0001900ea.png",
        "timestamp": 1615836664442,
        "duration": 841
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected '' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615836713657,
                "type": ""
            }
        ],
        "screenShotFile": "007b0047-008f-00e7-00c5-007000b50066.png",
        "timestamp": 1615836711989,
        "duration": 1818
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Failed: <unknown>: Failed to read the 'sessionStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)",
            "WebDriverError: <unknown>: Failed to read the 'sessionStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run afterEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Timeout.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4283:11)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836767903,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836767921,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836768443,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836768443,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836790882,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836790882,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836790882,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836790883,
                "type": ""
            }
        ],
        "screenShotFile": "007f001b-00f6-005c-006b-00c400f000e2.png",
        "timestamp": 1615836714333,
        "duration": 76631
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ef007d-0089-001d-0018-00f9002700d1.png",
        "timestamp": 1615836791258,
        "duration": 1666
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836793933,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836793943,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836793943,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794161,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794162,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794162,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794163,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794164,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794165,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794166,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794166,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794167,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794168,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794169,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794171,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794172,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794173,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794174,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794175,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794176,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794178,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794179,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794249,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794250,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794252,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836794252,
                "type": ""
            }
        ],
        "screenShotFile": "000100bc-0073-00fa-00dd-004a00290071.png",
        "timestamp": 1615836793277,
        "duration": 1015
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0050006c-0037-000d-0037-00a1001400c0.png",
        "timestamp": 1615836794636,
        "duration": 877
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:32:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615836812734,
                "type": ""
            }
        ],
        "screenShotFile": "0057004c-00c0-0068-00fd-00b300d6001c.png",
        "timestamp": 1615836811130,
        "duration": 1777
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836841007,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836841011,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836841508,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836841509,
                "type": ""
            }
        ],
        "screenShotFile": "00e1004b-00f0-007f-004c-009400050062.png",
        "timestamp": 1615836813482,
        "duration": 32631
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ec0066-00d9-006f-00ef-005000bc002b.png",
        "timestamp": 1615836846471,
        "duration": 1176
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848636,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848647,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848875,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848876,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848877,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848877,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848878,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848879,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848879,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848880,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848880,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848881,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848881,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848882,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848883,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848884,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848886,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848886,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848889,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848889,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848890,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848962,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848962,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848964,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615836848965,
                "type": ""
            }
        ],
        "screenShotFile": "0022003e-0004-00ad-00cc-00ff00fe00a4.png",
        "timestamp": 1615836847991,
        "duration": 992
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b300b4-00eb-0089-002d-00850048007c.png",
        "timestamp": 1615836849333,
        "duration": 841
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)",
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615837027690,
                "type": ""
            }
        ],
        "screenShotFile": "004300f9-0080-0009-0071-00e3003c0032.png",
        "timestamp": 1615837026151,
        "duration": 1624
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837030003,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837030006,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837030182,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837030182,
                "type": ""
            }
        ],
        "screenShotFile": "002f000a-0042-00f3-0036-007300a900a1.png",
        "timestamp": 1615837028343,
        "duration": 1884
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ce00e5-0085-0043-0044-003800fc0008.png",
        "timestamp": 1615837030526,
        "duration": 947
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032226,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032229,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032230,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032401,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032401,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032402,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032403,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032403,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032404,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032404,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032405,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032405,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032406,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032406,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032407,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032407,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032408,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032408,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032410,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032410,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032411,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032411,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032455,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032456,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032457,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837032458,
                "type": ""
            }
        ],
        "screenShotFile": "00ff00ff-00b8-00e6-00d9-003200a70082.png",
        "timestamp": 1615837031774,
        "duration": 693
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12752,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: <unknown>: Failed to read the 'localStorage' property from 'Window': Storage is disabled inside 'data:' URLs.\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:13:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0063000c-003d-00ce-0074-00d500be00f1.png",
        "timestamp": 1615837032754,
        "duration": 883
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Cannot read property 'navigateTo' of undefined",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "TypeError: Cannot read property 'navigateTo' of undefined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615837124765,
                "type": ""
            }
        ],
        "screenShotFile": "006a008b-006e-006f-000c-004400390062.png",
        "timestamp": 1615837092962,
        "duration": 32005
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Cannot read property 'navigateTo' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'navigateTo' of undefined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837131841,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837131845,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837132130,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837132131,
                "type": ""
            }
        ],
        "screenShotFile": "0067003f-006d-00bb-008f-0029007800ec.png",
        "timestamp": 1615837125538,
        "duration": 6688
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Cannot read property 'navigateTo' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'navigateTo' of undefined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00910007-00ec-00cc-0046-0038006100d8.png",
        "timestamp": 1615837132596,
        "duration": 1091
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Cannot read property 'navigateTo' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'navigateTo' of undefined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134635,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134649,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134649,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134879,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134880,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134881,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134881,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134882,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134883,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134883,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134884,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134884,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134886,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134886,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134887,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134887,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134888,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134890,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134891,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134892,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134893,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134895,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134968,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134969,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134972,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837134972,
                "type": ""
            }
        ],
        "screenShotFile": "00ce00e4-00aa-0085-007d-0012007000ed.png",
        "timestamp": 1615837134002,
        "duration": 1002
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Cannot read property 'navigateTo' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'navigateTo' of undefined\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:14:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeAll in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\n    at UserContext.fn (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:5325:13)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at QueueRunner.execute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4199:10)\n    at queueRunnerFactory (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:909:35)\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "006e006e-003b-00b9-0089-00df00ff0059.png",
        "timestamp": 1615837135350,
        "duration": 908
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15808,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:34:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615837211582,
                "type": ""
            }
        ],
        "screenShotFile": "004f0099-0087-002d-00ae-0088001800ce.png",
        "timestamp": 1615837190101,
        "duration": 21626
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15808,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837222861,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837222862,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837223422,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837223422,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837267919,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837267919,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837267919,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837267919,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837267919,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837267920,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837267920,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837267920,
                "type": ""
            }
        ],
        "screenShotFile": "002e000f-0011-00d8-00c6-00ea00420072.png",
        "timestamp": 1615837212279,
        "duration": 55695
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15808,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006d0090-00ce-0072-003f-009a005d00c0.png",
        "timestamp": 1615837268284,
        "duration": 3320
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15808,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/vendor.js 138312 WebSocket connection to 'ws://localhost:4200/sockjs-node/188/q3w1mhtc/websocket' failed: WebSocket is closed before the connection is established.",
                "timestamp": 1615837272974,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273561,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273766,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273767,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273768,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273770,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273771,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273772,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273773,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273774,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273775,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273776,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273777,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273778,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273779,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273780,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273781,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273782,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273783,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273785,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273785,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273787,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273910,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273911,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273911,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837273911,
                "type": ""
            }
        ],
        "screenShotFile": "002c0005-0082-00f5-00f9-007300ec005a.png",
        "timestamp": 1615837271971,
        "duration": 1965
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15808,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/vendor.js 138312 WebSocket connection to 'ws://localhost:4200/sockjs-node/200/nhtgzigz/websocket' failed: WebSocket is closed before the connection is established.",
                "timestamp": 1615837275288,
                "type": ""
            }
        ],
        "screenShotFile": "00700071-00e8-00ef-0041-007c00930071.png",
        "timestamp": 1615837274266,
        "duration": 1779
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)",
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "JavascriptError: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:15:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:37:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/polyfills.js 880:28 \"Unhandled Promise rejection:\" \"missing ) after argument list\" \"; Zone:\" \"\\u003Croot>\" \"; Task:\" null \"; Value:\" SyntaxError: missing ) after argument list\n    at new Function (<anonymous>)\n    at executeScript (<anonymous>:480:16)\n    at <anonymous>:487:24\n    at callFunction (<anonymous>:450:22)\n    at <anonymous>:464:23\n    at <anonymous>:465:3 \"SyntaxError: missing ) after argument list\\n    at new Function (\\u003Canonymous>)\\n    at executeScript (\\u003Canonymous>:480:16)\\n    at \\u003Canonymous>:487:24\\n    at callFunction (\\u003Canonymous>:450:22)\\n    at \\u003Canonymous>:464:23\\n    at \\u003Canonymous>:465:3\"",
                "timestamp": 1615837595067,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615837624382,
                "type": ""
            }
        ],
        "screenShotFile": "00260025-00cc-00c7-007f-00f3003d00b0.png",
        "timestamp": 1615837594088,
        "duration": 30461
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:15:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615837625198,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/polyfills.js 880:28 \"Unhandled Promise rejection:\" \"missing ) after argument list\" \"; Zone:\" \"\\u003Croot>\" \"; Task:\" null \"; Value:\" SyntaxError: missing ) after argument list\n    at new Function (<anonymous>)\n    at executeScript (<anonymous>:480:16)\n    at <anonymous>:487:24\n    at callFunction (<anonymous>:450:22)\n    at <anonymous>:464:23\n    at <anonymous>:465:3 \"SyntaxError: missing ) after argument list\\n    at new Function (\\u003Canonymous>)\\n    at executeScript (\\u003Canonymous>:480:16)\\n    at \\u003Canonymous>:487:24\\n    at callFunction (\\u003Canonymous>:450:22)\\n    at \\u003Canonymous>:464:23\\n    at \\u003Canonymous>:465:3\"",
                "timestamp": 1615837626060,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837639812,
                "type": ""
            }
        ],
        "screenShotFile": "00d50098-007b-000f-00a3-00780068009f.png",
        "timestamp": 1615837625083,
        "duration": 14863
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:15:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/polyfills.js 880:28 \"Unhandled Promise rejection:\" \"missing ) after argument list\" \"; Zone:\" \"\\u003Croot>\" \"; Task:\" null \"; Value:\" SyntaxError: missing ) after argument list\n    at new Function (<anonymous>)\n    at executeScript (<anonymous>:480:16)\n    at <anonymous>:487:24\n    at callFunction (<anonymous>:450:22)\n    at <anonymous>:464:23\n    at <anonymous>:465:3 \"SyntaxError: missing ) after argument list\\n    at new Function (\\u003Canonymous>)\\n    at executeScript (\\u003Canonymous>:480:16)\\n    at \\u003Canonymous>:487:24\\n    at callFunction (\\u003Canonymous>:450:22)\\n    at \\u003Canonymous>:464:23\\n    at \\u003Canonymous>:465:3\"",
                "timestamp": 1615837641350,
                "type": ""
            }
        ],
        "screenShotFile": "007a0003-0022-0048-0018-007c00e500f4.png",
        "timestamp": 1615837640331,
        "duration": 2663
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:15:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/polyfills.js 880:28 \"Unhandled Promise rejection:\" \"missing ) after argument list\" \"; Zone:\" \"\\u003Croot>\" \"; Task:\" null \"; Value:\" SyntaxError: missing ) after argument list\n    at new Function (<anonymous>)\n    at executeScript (<anonymous>:480:16)\n    at <anonymous>:487:24\n    at callFunction (<anonymous>:450:22)\n    at <anonymous>:464:23\n    at <anonymous>:465:3 \"SyntaxError: missing ) after argument list\\n    at new Function (\\u003Canonymous>)\\n    at executeScript (\\u003Canonymous>:480:16)\\n    at \\u003Canonymous>:487:24\\n    at callFunction (\\u003Canonymous>:450:22)\\n    at \\u003Canonymous>:464:23\\n    at \\u003Canonymous>:465:3\"",
                "timestamp": 1615837644284,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837644930,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837644972,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837644973,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645184,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645185,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645185,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645186,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645187,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645187,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645188,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645189,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645189,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645190,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645191,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645191,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645192,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645193,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645193,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645194,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645195,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645195,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645196,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645196,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645268,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645269,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645271,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837645272,
                "type": ""
            }
        ],
        "screenShotFile": "00bb0024-0038-0018-0079-008300cf00f5.png",
        "timestamp": 1615837643324,
        "duration": 1970
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: missing ) after argument list\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:15:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:12:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/polyfills.js 880:28 \"Unhandled Promise rejection:\" \"missing ) after argument list\" \"; Zone:\" \"\\u003Croot>\" \"; Task:\" null \"; Value:\" SyntaxError: missing ) after argument list\n    at new Function (<anonymous>)\n    at executeScript (<anonymous>:480:16)\n    at <anonymous>:487:24\n    at callFunction (<anonymous>:450:22)\n    at <anonymous>:464:23\n    at <anonymous>:465:3 \"SyntaxError: missing ) after argument list\\n    at new Function (\\u003Canonymous>)\\n    at executeScript (\\u003Canonymous>:480:16)\\n    at \\u003Canonymous>:487:24\\n    at callFunction (\\u003Canonymous>:450:22)\\n    at \\u003Canonymous>:464:23\\n    at \\u003Canonymous>:465:3\"",
                "timestamp": 1615837646513,
                "type": ""
            }
        ],
        "screenShotFile": "00060043-003a-0039-0088-004900d600a0.png",
        "timestamp": 1615837645625,
        "duration": 1951
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:39:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615837816619,
                "type": ""
            }
        ],
        "screenShotFile": "00cb006a-00f3-00b1-0074-009200e300cc.png",
        "timestamp": 1615837775619,
        "duration": 41140
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615837817438,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837823518,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837824052,
                "type": ""
            }
        ],
        "screenShotFile": "0071004c-00d4-002a-00ed-003f00a600db.png",
        "timestamp": 1615837817322,
        "duration": 12794
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00db00dd-00f7-003a-0015-00c700dc0029.png",
        "timestamp": 1615837830453,
        "duration": 1935
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834254,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834259,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834528,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834528,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834529,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834530,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834530,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834531,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834532,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834532,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834533,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834533,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834534,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834535,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834535,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834536,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834536,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834537,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834537,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834538,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834539,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834539,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834605,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834606,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834608,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615837834608,
                "type": ""
            }
        ],
        "screenShotFile": "0026002a-00a2-0069-00ca-001d005100af.png",
        "timestamp": 1615837832742,
        "duration": 1875
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14144,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e0082-00eb-008e-0089-0074003800d0.png",
        "timestamp": 1615837834919,
        "duration": 1790
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:40:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615838501594,
                "type": ""
            }
        ],
        "screenShotFile": "00e0005e-0091-00eb-00cd-005200590072.png",
        "timestamp": 1615838499599,
        "duration": 2102
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838504250,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838504440,
                "type": ""
            }
        ],
        "screenShotFile": "0093000f-00af-004c-00ef-0060003b00a1.png",
        "timestamp": 1615838502357,
        "duration": 2132
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e6004a-005c-002d-00af-007600ce000e.png",
        "timestamp": 1615838504849,
        "duration": 1695
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508201,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508218,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508876,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508877,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508877,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508877,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508877,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508877,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508877,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508884,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508885,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508928,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508929,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508929,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838508929,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838509209,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838509210,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838509214,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615838509214,
                "type": ""
            }
        ],
        "screenShotFile": "003e0044-00d8-002a-00ff-003200f50028.png",
        "timestamp": 1615838506920,
        "duration": 2298
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000b00a4-0004-005f-0077-007500680057.png",
        "timestamp": 1615838509716,
        "duration": 1532
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:40:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615839102796,
                "type": ""
            }
        ],
        "screenShotFile": "00040030-0079-003d-00d8-00dc005900cf.png",
        "timestamp": 1615839074582,
        "duration": 28355
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/cancelar-reserva?reservaId=10 - Failed to load resource: the server responded with a status of 500 ()",
                "timestamp": 1615839109499,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839109510,
                "type": ""
            }
        ],
        "screenShotFile": "002a0050-0068-0085-004a-002700190022.png",
        "timestamp": 1615839103467,
        "duration": 6120
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fe0033-00e1-0091-00ee-007300a800c5.png",
        "timestamp": 1615839109951,
        "duration": 1807
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122534,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122844,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122845,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122846,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122846,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122847,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122847,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122848,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122848,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122849,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122850,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122850,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122850,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122851,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122852,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122852,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122853,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122853,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122854,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122854,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122855,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122924,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122924,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122929,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/finalizar-reserva?reservaId=10&valorIngresado=0 - Failed to load resource: the server responded with a status of 500 ()",
                "timestamp": 1615839122951,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122951,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839122952,
                "type": ""
            }
        ],
        "screenShotFile": "002e0053-0037-0036-0036-005e00b2000b.png",
        "timestamp": 1615839112095,
        "duration": 10846
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00450083-004d-00c2-00a8-00bd00ea0024.png",
        "timestamp": 1615839123274,
        "duration": 1570
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13264,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:40:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615839272014,
                "type": ""
            }
        ],
        "screenShotFile": "0011005a-005c-00eb-00d8-00670063006f.png",
        "timestamp": 1615839252062,
        "duration": 20086
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13264,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/cancelar-reserva?reservaId=10 - Failed to load resource: the server responded with a status of 500 ()",
                "timestamp": 1615839277981,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839277988,
                "type": ""
            }
        ],
        "screenShotFile": "004900a5-00d7-00c0-0098-001b002b0084.png",
        "timestamp": 1615839272728,
        "duration": 5343
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13264,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a70017-0066-0066-00f1-00770085006e.png",
        "timestamp": 1615839278448,
        "duration": 1750
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13264,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285755,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285974,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285975,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285977,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285978,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285981,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285982,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285984,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285985,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285987,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285988,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285990,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285991,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285993,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285994,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285996,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285997,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839285999,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839286000,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839286001,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839286150,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839286152,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839286162,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/finalizar-reserva?reservaId=10&valorIngresado=0 - Failed to load resource: the server responded with a status of 500 ()",
                "timestamp": 1615839286203,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839286203,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839286204,
                "type": ""
            }
        ],
        "screenShotFile": "00db008e-005f-00e0-008f-00a700e00069.png",
        "timestamp": 1615839280517,
        "duration": 5669
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13264,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009900b3-00f2-00a6-0034-0054005e00dc.png",
        "timestamp": 1615839286597,
        "duration": 2693
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:35:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615839409402,
                "type": ""
            }
        ],
        "screenShotFile": "002100e4-0065-00ec-0098-009500f300e0.png",
        "timestamp": 1615839380910,
        "duration": 28629
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f00092-003a-0075-00d4-00d4009c0014.png",
        "timestamp": 1615839410129,
        "duration": 3906
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004100d1-007f-009d-00ef-009a00b500f3.png",
        "timestamp": 1615839414445,
        "duration": 1847
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422091,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422476,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422477,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422478,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422480,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422481,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422483,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422484,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422486,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422489,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422490,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422492,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422493,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422494,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422496,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422498,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422499,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422500,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422501,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422503,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422624,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422625,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422637,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/finalizar-reserva?reservaId=119&valorIngresado=0 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1615839422672,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422673,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/main.js 619:27 \"Error inesperado:\\n\" Object",
                "timestamp": 1615839422674,
                "type": ""
            }
        ],
        "screenShotFile": "00930026-00d3-0048-0027-00230026004d.png",
        "timestamp": 1615839416631,
        "duration": 6025
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ab00d2-0015-0077-003e-006900b50013.png",
        "timestamp": 1615839423050,
        "duration": 2876
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7464,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:35:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615839589922,
                "type": ""
            }
        ],
        "screenShotFile": "002700d4-006e-00b2-00de-00b0003f00e5.png",
        "timestamp": 1615839583723,
        "duration": 6325
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7464,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e6007b-009d-0029-0032-003c00e60038.png",
        "timestamp": 1615839590611,
        "duration": 8278
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7464,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c80042-0014-00fa-00e6-003000120022.png",
        "timestamp": 1615839599264,
        "duration": 1456
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9700,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:35:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615839881050,
                "type": ""
            }
        ],
        "screenShotFile": "006800f8-002d-00ce-000c-007a00f10048.png",
        "timestamp": 1615839874400,
        "duration": 6790
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9700,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00560079-00bb-0092-00c7-009c00bc0044.png",
        "timestamp": 1615839881786,
        "duration": 5428
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9700,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00040043-00b6-0084-00ee-000e00540007.png",
        "timestamp": 1615839887600,
        "duration": 1410
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9700,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d20011-0069-006b-004b-006200f2003c.png",
        "timestamp": 1615839889358,
        "duration": 5533
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9700,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dd00b1-009c-0048-002b-0078001d0094.png",
        "timestamp": 1615839895307,
        "duration": 8141
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15724,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005100d7-0037-0057-0023-001300400028.png",
        "timestamp": 1615840013910,
        "duration": 2335
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15724,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bb0068-0025-0000-003d-004300460058.png",
        "timestamp": 1615840016792,
        "duration": 2246
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15724,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00430002-00a8-00ee-006d-00f4002f00eb.png",
        "timestamp": 1615840019366,
        "duration": 1660
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15724,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ac000c-00ee-00c7-008f-00c200ce0016.png",
        "timestamp": 1615840021354,
        "duration": 1595
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15724,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00aa0081-00a4-0049-00c6-002f00c200fe.png",
        "timestamp": 1615840023287,
        "duration": 1278
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f100e5-006b-00fc-0018-003d007d00ed.png",
        "timestamp": 1615840112439,
        "duration": 1767
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002600e1-0012-0025-00eb-003000770088.png",
        "timestamp": 1615840114738,
        "duration": 956
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004900f7-00e8-0050-00b4-007700e90088.png",
        "timestamp": 1615840116027,
        "duration": 987
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00880001-00c0-00ce-00b7-003c008a00be.png",
        "timestamp": 1615840117347,
        "duration": 1113
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0050004f-0052-00f8-0017-002600a200c5.png",
        "timestamp": 1615840118778,
        "duration": 825
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4632,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:36:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615840252975,
                "type": ""
            }
        ],
        "screenShotFile": "00a60041-006d-003b-0020-004e00510090.png",
        "timestamp": 1615840251547,
        "duration": 1500
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4632,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected '' to equal 'La reserva ha sido cancelada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:50:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "000d001d-00ec-0005-003c-0097002700ce.png",
        "timestamp": 1615840253620,
        "duration": 896
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4632,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cc00fe-000b-004f-0035-00fb008a0011.png",
        "timestamp": 1615840254861,
        "duration": 1027
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4632,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006100ee-00d6-0051-0010-004e000400af.png",
        "timestamp": 1615840256231,
        "duration": 774
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4632,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000e00fa-00c2-00f3-00d3-009000960017.png",
        "timestamp": 1615840257314,
        "duration": 744
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b9006d-00de-00f0-0069-00a600f1003a.png",
        "timestamp": 1615840272819,
        "duration": 1633
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009b007a-0007-0006-0041-009600950092.png",
        "timestamp": 1615840275056,
        "duration": 966
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006800f4-0053-0038-0001-008c0070002b.png",
        "timestamp": 1615840276360,
        "duration": 1042
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003200e6-0034-0001-0080-00f100450083.png",
        "timestamp": 1615840277731,
        "duration": 1149
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001b0003-0055-0016-00eb-00dc00930043.png",
        "timestamp": 1615840279231,
        "duration": 914
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00740079-0088-00e8-00a7-001a009d006e.png",
        "timestamp": 1615841272381,
        "duration": 1922
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: Invalid or unexpected token\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: Invalid or unexpected token\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:38:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Deberia actualizar una cancha\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:37:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/polyfills.js 880:28 \"Unhandled Promise rejection:\" \"Invalid or unexpected token\" \"; Zone:\" \"\\u003Croot>\" \"; Task:\" null \"; Value:\" SyntaxError: Invalid or unexpected token\n    at new Function (<anonymous>)\n    at executeScript (<anonymous>:480:16)\n    at <anonymous>:487:24\n    at callFunction (<anonymous>:450:22)\n    at <anonymous>:464:23\n    at <anonymous>:465:3 \"SyntaxError: Invalid or unexpected token\\n    at new Function (\\u003Canonymous>)\\n    at executeScript (\\u003Canonymous>:480:16)\\n    at \\u003Canonymous>:487:24\\n    at callFunction (\\u003Canonymous>:450:22)\\n    at \\u003Canonymous>:464:23\\n    at \\u003Canonymous>:465:3\"",
                "timestamp": 1615841274873,
                "type": ""
            }
        ],
        "screenShotFile": "000b0048-0011-00db-0042-000200ea0065.png",
        "timestamp": 1615841274865,
        "duration": 23
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fb0049-00e9-0064-00df-00cd009100bf.png",
        "timestamp": 1615841275186,
        "duration": 840
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001a0092-00e8-009e-00c2-00ff00380029.png",
        "timestamp": 1615841276331,
        "duration": 738
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17916,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: Invalid or unexpected token\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: Invalid or unexpected token\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:38:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Deberia actualizar una cancha\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:37:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "006b00ce-001b-0033-00dc-007a006000a0.png",
        "timestamp": 1615841349713,
        "duration": 16364
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17916,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ed00a4-00c9-00cc-00f5-00de00ec00aa.png",
        "timestamp": 1615841366593,
        "duration": 6268
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17916,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007400fe-006c-005a-0031-00a4008500e0.png",
        "timestamp": 1615841373205,
        "duration": 3417
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 19820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ya existe una reserva en esa fecha y en esa hora para esta cancha' to equal 'La reserva del señor(a): Camilo Prueba ha sido creada exitosamente'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\reserva.e2e-spec.ts:36:26)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:9999/reserva/registrar-reserva - Failed to load resource: the server responded with a status of 400 ()",
                "timestamp": 1615841424533,
                "type": ""
            }
        ],
        "screenShotFile": "00ca005a-00c3-0024-0015-00da000f0026.png",
        "timestamp": 1615841422542,
        "duration": 2070
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006b009d-00ab-00a0-005d-007d00e10059.png",
        "timestamp": 1615841425167,
        "duration": 838
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00320057-00ee-002d-009e-0007006b001d.png",
        "timestamp": 1615841426326,
        "duration": 861
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007c0002-0013-0019-00e7-00dd004c00a4.png",
        "timestamp": 1615841427497,
        "duration": 733
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19820,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ae006b-00f5-00a7-0096-007600a10048.png",
        "timestamp": 1615841428563,
        "duration": 720
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14516,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0091000d-00db-0010-0001-008e007f00c5.png",
        "timestamp": 1615841797742,
        "duration": 13243
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14516,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: Invalid or unexpected token\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: Invalid or unexpected token\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:37:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Deberia actualizar una cancha\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:36:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/polyfills.js 880:28 \"Unhandled Promise rejection:\" \"Invalid or unexpected token\" \"; Zone:\" \"\\u003Croot>\" \"; Task:\" null \"; Value:\" SyntaxError: Invalid or unexpected token\n    at new Function (<anonymous>)\n    at executeScript (<anonymous>:480:16)\n    at <anonymous>:487:24\n    at callFunction (<anonymous>:450:22)\n    at <anonymous>:464:23\n    at <anonymous>:465:3 \"SyntaxError: Invalid or unexpected token\\n    at new Function (\\u003Canonymous>)\\n    at executeScript (\\u003Canonymous>:480:16)\\n    at \\u003Canonymous>:487:24\\n    at callFunction (\\u003Canonymous>:450:22)\\n    at \\u003Canonymous>:464:23\\n    at \\u003Canonymous>:465:3\"",
                "timestamp": 1615841827562,
                "type": ""
            }
        ],
        "screenShotFile": "00640075-00cd-00fc-0037-00f200e500d6.png",
        "timestamp": 1615841811573,
        "duration": 19464
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14516,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ad00b6-00c5-0079-0036-00da007c006b.png",
        "timestamp": 1615841831363,
        "duration": 4981
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14516,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d200d1-002a-0018-00a5-006800f50088.png",
        "timestamp": 1615841836700,
        "duration": 16660
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "005e007e-00b4-0044-0034-001c001e00e9.png",
        "timestamp": 1615841869650,
        "duration": 38411
    },
    {
        "description": "Deberia actualizar una cancha|workspace-project Cancha",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: javascript error: Invalid or unexpected token\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "JavascriptError: javascript error: Invalid or unexpected token\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.executeScript()\n    at Driver.schedule (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.executeScript (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\webdriver.js:878:16)\n    at run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.<computed> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\protractor\\built\\browser.js:67:16)\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:37:13)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Deberia actualizar una cancha\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:36:3)\n    at addSpecsToSuite (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\jasmine\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\e2e\\src\\test\\cancha.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (C:\\Users\\camilo.arcila\\Documents\\canchaSinteticaADN-Front\\canchaSinteticaADN\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/polyfills.js 880:28 \"Unhandled Promise rejection:\" \"Invalid or unexpected token\" \"; Zone:\" \"\\u003Croot>\" \"; Task:\" null \"; Value:\" SyntaxError: Invalid or unexpected token\n    at new Function (<anonymous>)\n    at executeScript (<anonymous>:480:16)\n    at <anonymous>:487:24\n    at callFunction (<anonymous>:450:22)\n    at <anonymous>:464:23\n    at <anonymous>:465:3 \"SyntaxError: Invalid or unexpected token\\n    at new Function (\\u003Canonymous>)\\n    at executeScript (\\u003Canonymous>:480:16)\\n    at \\u003Canonymous>:487:24\\n    at callFunction (\\u003Canonymous>:450:22)\\n    at \\u003Canonymous>:464:23\\n    at \\u003Canonymous>:465:3\"",
                "timestamp": 1615841916439,
                "type": ""
            }
        ],
        "screenShotFile": "001a00d6-0071-0084-0045-004e004b00a6.png",
        "timestamp": 1615841908590,
        "duration": 7884
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008c0083-002f-0036-005d-00e60014008a.png",
        "timestamp": 1615841916823,
        "duration": 8272
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15696,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0006000a-0071-00c8-0098-00aa001b0016.png",
        "timestamp": 1615841925439,
        "duration": 2478
    },
    {
        "description": "Deberia crear una cancha|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19540,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e3006f-00fd-0095-0034-0068003d00ac.png",
        "timestamp": 1615841961476,
        "duration": 1513
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19540,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00600056-0035-00da-00a6-00d800ab0081.png",
        "timestamp": 1615841963498,
        "duration": 900
    },
    {
        "description": "Deberia listar canchas|workspace-project Cancha",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19540,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d70074-0037-0049-006d-00d1006f00ee.png",
        "timestamp": 1615841964720,
        "duration": 671
    },
    {
        "description": "Deberia crear una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20224,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b1005d-00ca-0096-00e2-007000e10085.png",
        "timestamp": 1615842984681,
        "duration": 1612
    },
    {
        "description": "Deberia cancelar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20224,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000500e6-004f-00e9-0055-0053005b00cf.png",
        "timestamp": 1615842987104,
        "duration": 875
    },
    {
        "description": "Debería estar deshabilitado el boton de Registrar cancha si el formulario es invalido|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20224,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c600f5-003c-009f-0007-0072006e000a.png",
        "timestamp": 1615842988299,
        "duration": 875
    },
    {
        "description": "Deberia finalizar una reserva|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20224,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006b002a-002e-0024-00ac-00cf003200f4.png",
        "timestamp": 1615842989490,
        "duration": 727
    },
    {
        "description": "Deberia listar reservas|workspace-project Reserva",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20224,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00af00d8-00b9-00af-00b0-0052003700b0.png",
        "timestamp": 1615842990551,
        "duration": 599
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
