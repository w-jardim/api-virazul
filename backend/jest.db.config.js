const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  roots: ['<rootDir>/tests-db'],
};
