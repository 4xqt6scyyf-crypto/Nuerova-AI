const { app } = require('../server/index');

module.exports = (req, res) => {
	req.url = '/api/signup';
	req.originalUrl = '/api/signup';
	return app(req, res);
};
