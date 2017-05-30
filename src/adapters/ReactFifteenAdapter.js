// @flow
/* eslint no-underscore-dangle: 0, class-methods-use-this: 0 */
import React from 'react';
import type { Element } from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
import PropTypes from 'prop-types';
import values from 'object.values';
import flatten from 'lodash/flatten';
import type { EnzymeRenderer, RSTNode, RendererOptions } from './types';
import EnzymeAdapter from './EnzymeAdapter';
// import createWrapperComponent from '../ReactWrapperComponent';

function compositeTypeToNodeType(type) {
  switch (type) {
    case 0: return 'class';
    case 2: return 'function';
    default:
      console.log('LELAND: Unknown composite type', type);
      return 'class';
  }
}

function instanceToTree(inst): ?RSTNode {
  if (typeof inst !== 'object') {
    return inst;
  }
  const el = inst._currentElement;
  if (!el) {
    return null;
  }
  // if (!inst._instance) {
  //   console.log(inst);
  // }
  if (inst._renderedChildren) {
    return {
      nodeType: inst._hostNode ? 'host' : compositeTypeToNodeType(inst._compositeType),
      type: el.type,
      props: el.props,
      instance: inst._instance || inst._hostNode || null,
      rendered: values(inst._renderedChildren).map(instanceToTree),
    };
  }
  if (inst._hostNode) {
    if (typeof el !== 'object') {
      return el;
    }
    const children = inst._renderedChildren || { '.0': el.props.children };
    return {
      nodeType: 'host',
      type: el.type,
      props: el.props,
      instance: inst._instance || inst._hostNode || null,
      rendered: values(children).map(instanceToTree),
    };
  }
  if (inst._renderedComponent) {
    return {
      nodeType: compositeTypeToNodeType(inst._compositeType),
      type: el.type,
      props: el.props,
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

class ReactFifteenAdapter extends EnzymeAdapter {
  // This is a method that will return a semver version string for the _react_ version that
  // it expects enzyme to target. This will allow enzyme to know what to expect in the `instance`
  // that it finds on an RSTNode, as well as intelligently toggle behavior across react versions
  // etc. For react adapters, this will likely just be `() => React.Version`, but for other
  // adapters for libraries like inferno or preact, it will allow those libraries to specify
  // a version of the API that they are committing to.
  // eslint-disable-next-line class-methods-use-this
  getTargetApiVersion(): string {
    return '15.5.x'; // TODO(lmr): do we need a separate adapter for 15.5.x and 15.4.x?
  }

  createMountRenderer(options: RendererOptions): EnzymeRenderer {
    const domNode = options.attachTo || global.document.createElement('div');
    let instance = null;
    return {
      render(el: Element<*>, context?: any) {
        const wrappedEl = React.createElement(SimpleWrapper, {
          node: el,
        });
        instance = ReactDOM.render(wrappedEl, domNode);
      },
      getNode(): ?RSTNode {
        return instanceToTree(instance._reactInternalInstance._renderedComponent);
      },
    };
  }

  createShallowRenderer(options: RendererOptions): EnzymeRenderer {
    const renderer = TestUtils.createRenderer();
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
    };
  }

  // Provided a bag of options, return an `EnzymeRenderer`. Some options can be implementation
  // specific, like `attach` etc. for React, but not part of this interface explicitly.
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  createRenderer(options: RendererOptions): EnzymeRenderer {
    switch (options.mode) {
      case 'mount': return this.createMountRenderer(options);
      case 'shallow': return this.createShallowRenderer(options);
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
}

module.exports = ReactFifteenAdapter;
