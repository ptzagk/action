import React, {PropTypes} from 'react';
import withStyles from 'universal/styles/withStyles';
import {css} from 'aphrodite-local-styles/no-important';
import appTheme from 'universal/styles/theme/appTheme';
import ui from 'universal/styles/ui';

const DashModal = (props) => {
  const {
    children,
    onBackdropClick,
    position,
    showsOver,
    styles
  } = props;
  const backdropStyles = css(
    styles.backdrop,
    position && styles[position],
    showsOver && styles[showsOver],
  );
  return (
    <div className={backdropStyles} onClick={onBackdropClick}>
      <div className={css(styles.modal)}>
        {children}
      </div>
    </div>
  );
};

DashModal.propTypes = {
  children: PropTypes.any,
  onBackdropClick: PropTypes.func,

  // NOTE: Use 'fixed' to show over 'viewport'.
  //       Default styles use 'fixed' and 'viewport' values.
  //       Use 'absolute' to show over 'main'.

  position: PropTypes.oneOf([
    'absolute',
    'fixed'
  ]),
  showsOver: PropTypes.oneOf([
    'main',
    'viewport'
  ]),
  styles: PropTypes.object
};

const styleThunk = () => ({
  backdrop: {
    alignItems: 'center',
    background: 'rgba(255, 255, 255, .5)',
    bottom: 0,
    display: 'flex !important',
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    left: 0,
    position: 'fixed',
    right: 0,
    textAlign: 'center',
    top: 0,
    zIndex: 400
  },

  viewport: {
    left: 0
  },

  main: {
    left: ui.dashSidebarWidth
  },

  absolute: {
    position: 'absolute'
  },

  fixed: {
    position: 'fixed'
  },

  modal: {
    background: '#fff',
    boxShadow: `0 0 0 .25rem ${appTheme.palette.mid30a}`,
    borderRadius: '.5rem',
    padding: '2rem',
    width: '30rem'
  }
});

export default withStyles(styleThunk)(DashModal);
