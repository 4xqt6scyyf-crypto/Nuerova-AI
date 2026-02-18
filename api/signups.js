const { app } = require('../server/index');

module.exports = (req, res) => {
	req.url = '/signups';
	req.originalUrl = '/signups';
	return app(req, res);
};
