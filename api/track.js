const { app } = require('../server/index');

module.exports = (req, res) => {
	req.url = '/track';
	req.originalUrl = '/track';
	return app(req, res);
};
