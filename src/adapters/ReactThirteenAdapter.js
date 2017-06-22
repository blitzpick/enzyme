// @flow
/* eslint no-underscore-dangle: 0, class-methods-use-this: 0 */
import React from 'react';
import type { Element } from 'react';
import ReactAddons from 'react/addons';
import PropTypes from 'prop-types';
import values from 'object.values';
import flatten from 'lodash/flatten';
import type { EnzymeRenderer, RSTNode, RendererOptions } from './types';
import EnzymeAdapter from './EnzymeAdapter';
import ReactContext from 'react/lib/ReactContext';
import {
  mapNativeEventNames,
  propFromEvent,
  withSetStateAllowed,
} from './Utils';
// this fixes some issues in React 0.13 with setState and jsdom...
// see issue: https://github.com/airbnb/enzyme/issues/27
require('react/lib/ExecutionEnvironment').canUseDOM = true;

const { TestUtils, batchedUpdates } = ReactAddons.addons;

const getEmptyElementType = (() => {
  let EmptyElementType = null;
  class Foo extends React.Component {
    render() {
      return null;
    }
  }

  return () => {
    if (EmptyElementType === null) {
      const instance = TestUtils.renderIntoDocument(<Foo />);
      EmptyElementType = instance._reactInternalInstance._renderedComponent._currentElement.type;
    }
    return EmptyElementType;
  };
})();

const createShallowRenderer = function createRendererCompatible() {
  const renderer = TestUtils.createRenderer();
  renderer.render = (originalRender => function contextCompatibleRender(node, context = {}) {
    ReactContext.current = context;
    originalRender.call(this, React.createElement(node.type, node.props), context);
    ReactContext.current = {};
    return renderer.getRenderOutput();
  })(renderer.render);
  return renderer;
};


function instanceToTree(inst): ?RSTNode {
  if (typeof inst !== 'object') {
    return inst;
  }
  const el = inst._currentElement;
  if (!el) {
    return null;
  }
  if (typeof el !== 'object') {
    return el;
  }
  if (el.type === getEmptyElementType()) {
    return null;
  }
  if (typeof el.type === 'string') {
    const innerInst = inst._renderedComponent;
    const children = innerInst._renderedChildren || { '.0': el._store.props.children };
    return {
      nodeType: 'host',
      type: el.type,
      props: el._store.props,
      instance: inst._instance.getDOMNode(),
      rendered: values(children).map(instanceToTree),
    };
  }
  if (inst._renderedComponent) {
    return {
      nodeType: 'class',
      type: el.type,
      props: el._store.props,
      instance: inst._instance || inst._hostNode || null,
      rendered: instanceToTree(inst._renderedComponent),
    };
  }
  console.log('LELAND: fallthrough', inst);
  return null;
}


function elementToTree(el: Element<*>): ?RSTNode {
  if (el === null || typeof el !== 'object') {
    return el;
  }
  const { type, props } = el;
  const { children } = props;
  let rendered = null;
  if (Array.isArray(children)) {
    rendered = flatten(children, true).map(elementToTree);
  } else if (children !== undefined) {
    rendered = elementToTree(children);
  }
  return {
    nodeType: typeof type === 'string' ? 'host' : 'class',
    type,
    props,
    instance: null,
    rendered,
  };
}

class SimpleWrapper extends React.Component {
  render() {
    return this.props.node || null;
  }
}

SimpleWrapper.propTypes = { node: PropTypes.node.isRequired };

class ReactThirteenAdapter extends EnzymeAdapter {
  // This is a method that will return a semver version string for the _react_ version that
  // it expects enzyme to target. This will allow enzyme to know what to expect in the `instance`
  // that it finds on an RSTNode, as well as intelligently toggle behavior across react versions
  // etc. For react adapters, this will likely just be `() => React.Version`, but for other
  // adapters for libraries like inferno or preact, it will allow those libraries to specify
  // a version of the API that they are committing to.
  // eslint-disable-next-line class-methods-use-this
  getTargetApiVersion(): string {
    return '0.13.x'; // TODO(lmr): do we need a separate adapter for 15.5.x and 15.4.x?
  }

  createMountRenderer(options: RendererOptions): EnzymeRenderer {
    const domNode = options.attachTo || global.document.createElement('div');
    let instance = null;
    return {
      render(el: Element<*>, context?: any) {
        const wrappedEl = React.createElement(SimpleWrapper, {
          node: el,
        });
        instance = React.render(wrappedEl, domNode);
      },
      unmount() {
        React.unmountComponentAtNode(domNode);
      },
      getNode(): ?RSTNode {
        return instanceToTree(instance._reactInternalInstance._renderedComponent);
      },
      simulateEvent(node, event, mock) {
        const mappedEvent = mapNativeEventNames(event);
        const eventFn = TestUtils.Simulate[mappedEvent];
        if (!eventFn) {
          throw new TypeError(`ReactWrapper::simulate() event '${event}' does not exist`);
        }
        // eslint-disable-next-line react/no-find-dom-node
        eventFn(React.findDOMNode(node.instance), mock);
      },
      batchedUpdates(fn) {
        return batchedUpdates(fn);
      },
    };
  }

  createShallowRenderer(options: RendererOptions): EnzymeRenderer {
    const renderer = createShallowRenderer();
    let isDOM = false;
    let cachedNode = null;
    return {
      render(el: Element<*>, context?: any) {
        cachedNode = el;
        /* eslint consistent-return: 0 */
        if (typeof el.type === 'string') {
          isDOM = true;
        } else {
          isDOM = false;
          return renderer.render(el, context); // TODO: context
        }
      },
      unmount() {
        renderer.unmount();
      },
      getNode(): ?RSTNode {
        if (isDOM) {
          return elementToTree(cachedNode);
        }
        const output = renderer.getRenderOutput();
        return {
          nodeType: 'class',
          type: cachedNode.type,
          props: cachedNode.props,
          instance: renderer._instance._instance,
          rendered: elementToTree(output),
        };
      },
      simulateEvent(node, event, ...args) {
        const handler = node.props[propFromEvent(event)];
        if (handler) {
          withSetStateAllowed(() => {
            // TODO(lmr): create/use synthetic events
            // TODO(lmr): emulate React's event propagation
            batchedUpdates(() => {
              handler(...args);
            });
          });
        }
      },
      batchedUpdates(fn) {
        return withSetStateAllowed(() => batchedUpdates(fn));
      },
    };
  }

  createStringRenderer(options) {
    return {
      render(el: Element<*>, context?: any) {
        return React.renderToStaticMarkup(el);
      },
    };
  }

  // Provided a bag of options, return an `EnzymeRenderer`. Some options can be implementation
  // specific, like `attach` etc. for React, but not part of this interface explicitly.
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  createRenderer(options: RendererOptions): EnzymeRenderer {
    switch (options.mode) {
      case 'mount': return this.createMountRenderer(options);
      case 'shallow': return this.createShallowRenderer(options);
      case 'string': return this.createStringRenderer(options);
      default:
        throw new Error('Unrecognized mode');
    }
  }

  // converts an RSTNode to the corresponding JSX Pragma Element. This will be needed
  // in order to implement the `Wrapper.mount()` and `Wrapper.shallow()` methods, but should
  // be pretty straightforward for people to implement.
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  nodeToElement(node: RSTNode): Element<*> {
    if (!node || typeof node !== 'object') return null;
    return React.createElement(node.type, node.props);
  }

  elementToNode(element: Element<*>): RSTNode {
    return elementToTree(element);
  }

  nodeToHostNode(node: RSTNode): any {
    return React.findDOMNode(node.instance);
  }
}

module.exports = ReactThirteenAdapter;
