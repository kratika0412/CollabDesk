const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const httpError = require('../utils/httpError');

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      throw httpError(400, 'Name, email and password are required');
    }

    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      throw httpError(400, 'Name must be between 2 and 80 characters');
    }

    if (typeof email !== 'string' || email.length > 120) {
      throw httpError(400, 'Email is invalid');
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      throw httpError(400, 'Password must be between 6 and 128 characters');
    }

    const existing = await User.findOne({ email });
    if (existing) {
      throw httpError(409, 'Email already in use');
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw httpError(400, 'Email and password are required');
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      throw httpError(400, 'Invalid credentials');
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw httpError(401, 'Invalid credentials');
    }

    const match = await user.comparePassword(password);
    if (!match) {
      throw httpError(401, 'Invalid credentials');
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = req.user;
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  me,
};

