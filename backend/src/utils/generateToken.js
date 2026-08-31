const jwt = require('jsonwebtoken');

function generateToken(user) {
  const payload = {
    id: user._id,
    email: user.email,
  };

  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';

  return jwt.sign(payload, secret, {
    expiresIn: '7d',
  });
}

module.exports = generateToken;

