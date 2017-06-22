/* eslint global-require: 0 */
const Version = require('./src/version');
const Enzyme = require('./src');

let Adapter = null;

if (Version.REACT013) {
  Adapter = require('./src/adapters/ReactThirteenAdapter');
} else if (Version.REACT014) {
  Adapter = require('./src/adapters/ReactFourteenAdapter');
} else if (Version.REACT155) {
  Adapter = require('./src/adapters/ReactFifteenAdapter');
} else if (Version.REACT15) {
  Adapter = require('./src/adapters/ReactFifteenFourAdapter');
} else if (Version.REACT16) {
  Adapter = require('./src/adapters/ReactSixteenAdapter');
}

Enzyme.configure({ adapter: new Adapter() });
