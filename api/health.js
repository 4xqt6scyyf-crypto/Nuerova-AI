const { app } = require('../server/index');

module.exports = (req, res) => {
	req.url = '/health';
	req.originalUrl = '/health';
	return app(req, res);
};
