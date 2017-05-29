// @flow
import type { Element } from 'react';
import type { EnzymeRenderer, RSTNode, RendererOptions } from './types';

function unimplementedError(methodName, classname) {
  return new Error(
    `${methodName} is a required method of ${classname}, but was not implemented.`,
  );
}

class EnzymeAdapter {
  // This is a method that will return a semver version string for the _react_ version that
  // it expects enzyme to target. This will allow enzyme to know what to expect in the `instance`
  // that it finds on an RSTNode, as well as intelligently toggle behavior across react versions
  // etc. For react adapters, this will likely just be `() => React.Version`, but for other
  // adapters for libraries like inferno or preact, it will allow those libraries to specify
  // a version of the API that they are committing to.
  // eslint-disable-next-line class-methods-use-this
  getTargetApiVersion(): string {
    throw unimplementedError('getTargetApiVersion', 'EnzymeAdapter');
  }

  // Provided a bag of options, return an `EnzymeRenderer`. Some options can be implementation
  // specific, like `attach` etc. for React, but not part of this interface explicitly.
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  createRenderer(options: RendererOptions): EnzymeRenderer {
    throw unimplementedError('createRenderer', 'EnzymeAdapter');
  }

  // converts an RSTNode to the corresponding JSX Pragma Element. This will be needed
  // in order to implement the `Wrapper.mount()` and `Wrapper.shallow()` methods, but should
  // be pretty straightforward for people to implement.
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  nodeToElement(node: RSTNode): Element<*> {
    throw unimplementedError('nodeToElement', 'EnzymeAdapter');
  }
}

module.exports = EnzymeAdapter;
