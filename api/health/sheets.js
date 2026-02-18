const { app } = require('../../server/index');

module.exports = (req, res) => {
	req.url = '/health/sheets';
	req.originalUrl = '/health/sheets';
	return app(req, res);
};
