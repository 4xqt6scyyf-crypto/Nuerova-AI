const { app } = require('../server/index');

module.exports = (req, res) => {
	req.url = '/app-config.js';
	req.originalUrl = '/app-config.js';
	return app(req, res);
};
