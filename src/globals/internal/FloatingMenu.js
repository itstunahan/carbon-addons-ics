import warning from 'warning';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import window from 'window-or-global';

/**
 * The structure for the position of floating menu.
 * @typedef {Object} FloatingMenu~position
 * @property {number} left The left position.
 * @property {number} top The top position.
 * @property {number} right The right position.
 * @property {number} bottom The bottom position.
 */

/**
 * The structure for the size of floating menu.
 * @typedef {Object} FloatingMenu~size
 * @property {number} width The width.
 * @property {number} height The height.
 */

/**
 * The structure for the position offset of floating menu.
 * @typedef {Object} FloatingMenu~offset
 * @property {number} top The top position.
 * @property {number} left The left position.
 */

export const DIRECTION_LEFT = 'left';
export const DIRECTION_TOP = 'top';
export const DIRECTION_RIGHT = 'right';
export const DIRECTION_BOTTOM = 'bottom';

const hasCreatePortal = typeof ReactDOM.createPortal === 'function';

/**
 * @param {FloatingMenu~offset} [oldMenuOffset={}] The old value.
 * @param {FloatingMenu~offset} [menuOffset={}] The new value.
 * @returns `true` if the parent component wants to change in the adjustment of the floating menu position.
 * @private
 */
const hasChangeInOffset = (oldMenuOffset = {}, menuOffset = {}) => {
  if (typeof oldMenuOffset !== typeof menuOffset) {
    return true;
  } else if (
    Object(menuOffset) === menuOffset &&
    typeof menuOffset !== 'function'
  ) {
    return (
      oldMenuOffset.top !== menuOffset.top ||
      oldMenuOffset.left !== menuOffset.left
    );
  }
  return oldMenuOffset !== menuOffset;
};

/**
 * @param {Object} params The parameters.
 * @param {FloatingMenu~size} params.menuSize The size of the menu.
 * @param {FloatingMenu~position} params.refPosition The position of the triggering element.
 * @param {FloatingMenu~offset} [params.offset={ left: 0, top: 0 }] The position offset of the menu.
 * @param {string} [params.direction=bottom] The menu direction.
 * @param {number} [params.scrollX=0] The scroll position of the viewport.
 * @param {number} [params.scrollY=0] The scroll position of the viewport.
 * @returns {FloatingMenu~offset} The position of the menu, relative to the top-left corner of the viewport.
 * @private
 */
const getFloatingPosition = ({
  menuSize,
  refPosition,
  offset = {},
  direction = DIRECTION_BOTTOM,
  scrollX = 0,
  scrollY = 0,
}) => {
  const {
    left: refLeft = 0,
    top: refTop = 0,
    right: refRight = 0,
    bottom: refBottom = 0,
  } = refPosition;

  const { width, height } = menuSize;
  const { top = 0, left = 0 } = offset;
  const refCenterHorizontal = (refLeft + refRight) / 2;
  const refCenterVertical = (refTop + refBottom) / 2;
  const caretWidth = 8;

  return {
    [DIRECTION_LEFT]: () => ({
      left: refLeft - width + scrollX - left,
      top: refCenterVertical - height / 2 + scrollY + top,
    }),
    [DIRECTION_TOP]: () => ({
      left: refCenterHorizontal - width / 2 + scrollX + left,
      top: refTop - height + scrollY - top - caretWidth,
    }),
    [DIRECTION_RIGHT]: () => ({
      left: refRight + scrollX + left,
      top: refCenterVertical - height / 2 + scrollY + top,
    }),
    [DIRECTION_BOTTOM]: () => ({
      left: refCenterHorizontal - width / 2 + scrollX + left,
      top: refBottom + scrollY + top + caretWidth,
    }),
  }[direction]();
};

/**
 * A menu that is detached from the triggering element.
 * Useful when the container of the triggering element cannot have `overflow:visible` style, etc.
 */
class FloatingMenu extends React.Component {
  static propTypes = {
    /**
     * Contents to put into the floating menu.
     */
    children: PropTypes.object,

    /**
     * The position in the viewport of the trigger button.
     */
    menuPosition: PropTypes.shape({
      top: PropTypes.number,
      right: PropTypes.number,
      bottom: PropTypes.number,
      left: PropTypes.number,
    }),

    /**
     * Where to put the tooltip, relative to the trigger button.
     */
    menuDirection: PropTypes.oneOf([
      DIRECTION_LEFT,
      DIRECTION_TOP,
      DIRECTION_RIGHT,
      DIRECTION_BOTTOM,
    ]),

    /**
     * The adjustment of the floating menu position, considering the position of dropdown arrow, etc.
     */
    menuOffset: PropTypes.oneOfType([
      PropTypes.shape({
        top: PropTypes.number,
        left: PropTypes.number,
      }),
      PropTypes.func,
    ]),

    /**
     * The additional styles to put to the floating menu.
     */
    styles: PropTypes.object,

    /**
     * The callback called when the menu body has been mounted to/will be unmounted from the DOM.
     */
    menuRef: PropTypes.func,

    /**
     * The callback called when the menu body has been mounted and positioned.
     */
    onPlace: PropTypes.func,
  };

  static defaultProps = {
    menuPosition: {},
    menuOffset: {},
    menuDirection: DIRECTION_BOTTOM,
  };

  // `true` if the menu body is mounted and calculation of the position is in progress.
  _placeInProgress = false;

  state = {
    /**
     * The position of the menu, relative to the top-left corner of the viewport.
     * @type {FloatingMenu~offset}
     */
    floatingPosition: undefined,
    menuRendered: false,
  };

  /**
   * The cached refernce to the menu container.
   * Only used if React portal API is not available.
   * @type {Element}
   * @private
   */
  _menuContainer = null;

  /**
   * The cached refernce to the menu body.
   * @type {Element}
   * @private
   */
  _menuBody = null;

  constructor(props) {
    super(props);
    if (typeof document !== 'undefined' && hasCreatePortal) {
      this.el = document.createElement('div');
    }
  }

  /**
   * Calculates the position in the viewport of floating menu,
   * once this component is mounted or updated upon change in the following props:
   *
   * * `menuPosition` (The position in the viewport of the trigger button)
   * * `menuOffset` (The adjustment that should be applied to the calculated floating menu's position)
   * * `menuDirection` (Where the floating menu menu should be placed relative to the trigger button)
   *
   * @private
   */
  _updateMenuSize = (prevProps = {}) => {
    const menuBody = this._menuBody;
    warning(
      menuBody,
      'The DOM node for menu body for calculating its position is not available. Skipping...'
    );
    if (!menuBody) {
      return;
    }

    const {
      menuPosition: oldRefPosition = {},
      menuOffset: oldMenuOffset = {},
      menuDirection: oldMenuDirection,
    } = prevProps;
    const {
      menuPosition: refPosition = {},
      menuOffset = {},
      menuDirection,
    } = this.props;

    if (
      oldRefPosition.top !== refPosition.top ||
      oldRefPosition.right !== refPosition.right ||
      oldRefPosition.bottom !== refPosition.bottom ||
      oldRefPosition.left !== refPosition.left ||
      hasChangeInOffset(oldMenuOffset, menuOffset) ||
      oldMenuDirection !== menuDirection ||
      !this.state.menuRendered
    ) {
      const menuSize = menuBody.getBoundingClientRect();
      const offset =
        typeof menuOffset !== 'function'
          ? menuOffset
          : menuOffset(menuBody, menuDirection);
      // Skips if either in the following condition:
      // a) Menu body has `display:none`
      // b) `menuOffset` as a callback returns `undefined` (The callback saw that it couldn't calculate the value)
      if (menuSize.width > 0 && menuSize.height > 0 && offset) {
        this.setState({
          menuRendered: true,
          floatingPosition: getFloatingPosition({
            menuSize,
            refPosition,
            direction: menuDirection,
            offset,
            scrollX: window.pageXOffset,
            scrollY: window.pageYOffset,
          }),
        });
      }
    }
  };

  componentDidUpdate(prevProps) {
    const invokeOnPlace = () => {
      const { onPlace } = this.props;
      if (
        this._placeInProgress &&
        this.state.floatingPosition &&
        typeof onPlace === 'function'
      ) {
        onPlace(this._menuBody);
        this._placeInProgress = false;
      }
    };
    if (!hasCreatePortal) {
      ReactDOM.render(
        this._getChildrenWithProps(),
        this._menuContainer,
        invokeOnPlace
      );
    } else {
      this._updateMenuSize(prevProps);
      invokeOnPlace();
    }
  }

  componentDidMount() {
    const { menuRef } = this.props;
    if (!hasCreatePortal) {
      this._menuContainer = document.createElement('div');
      document.body.appendChild(this._menuContainer);
      const style = {
        display: 'block',
        opacity: 0,
      };
      const childrenWithProps = React.cloneElement(this.props.children, {
        style,
      });
      ReactDOM.render(childrenWithProps, this._menuContainer, () => {
        this._placeInProgress = true;
        this._menuBody = this._menuContainer.firstChild;
        this._updateMenuSize();
        ReactDOM.render(
          this._getChildrenWithProps(),
          this._menuContainer,
          () => {
            menuRef && menuRef(this._menuBody);
          }
        );
      });
    } else {
      if (this.el && this.el.firstChild) {
        this._menuBody = this.el.firstChild;
        document.body.appendChild(this._menuBody);
        this._placeInProgress = true;
        menuRef && menuRef(this._menuBody);
      }
      this._updateMenuSize();
    }
  }

  componentWillUnmount() {
    const { menuRef } = this.props;
    menuRef && menuRef(null);
    this._placeInProgress = false;
    if (!hasCreatePortal) {
      const menuContainer = this._menuContainer;
      ReactDOM.unmountComponentAtNode(menuContainer);
      if (menuContainer && menuContainer.parentNode) {
        menuContainer.parentNode.removeChild(menuContainer);
      }
      this._menuContainer = null;
    } else if (this._menuBody) {
      // Moves the menu body back to the portal container so that React unmount code does not crash
      this.el.appendChild(this._menuBody);
    }
  }

  /**
   * @returns The child nodes, with styles containing the floating menu position.
   * @private
   */
  _getChildrenWithProps = () => {
    const { styles, children } = this.props;
    const { floatingPosition: pos } = this.state;
    // If no pos available, we need to hide the element (offscreen to the left)
    // This is done so we can measure the content before positioning it correctly.
    const positioningStyle = pos
      ? {
          left: `${pos.left}px`,
          top: `${pos.top}px`,
          right: 'auto',
        }
      : {
          visibility: 'hidden',
          top: '0px',
        };
    return React.cloneElement(children, {
      style: {
        ...styles,
        ...positioningStyle,
        position: 'absolute',
        margin: 0,
        opacity: 1,
      },
    });
  };

  render() {
    if (typeof document !== 'undefined' && hasCreatePortal) {
      return ReactDOM.createPortal(this._getChildrenWithProps(), this.el);
    }
    return null;
  }
}

export default FloatingMenu;
