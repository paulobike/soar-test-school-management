const loader = require('./_common/fileLoader');

module.exports = class ResponsesLoader {
    load() {
        return loader('./managers/**/*.res.js');
    }
}
