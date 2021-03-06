import 'intl';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import configureStore, { history } from 'stores/configureStore';
import sagas from 'sagas/';
import { safe } from 'utils/';
import 'styles/base.css';

const store = configureStore();
const target = document.querySelector('[app]');

store.runSaga(sagas);

let render = () => {
  const Root = require('./root').default; // eslint-disable-line global-require

  ReactDOM.render(
    <Provider store={store}>
      <Root {...{ state: store.getState(), history }} />
    </Provider>,
    target
  );
};

if (module.hot) {
  const renderApp = render;
  const renderError = err => {
    const RedBox = require('redbox-react'); // eslint-disable-line global-require

    ReactDOM.render(<RedBox error={err} />, target);
  };

  render = safe(() => renderApp, renderError);

  module.hot.accept('./root', () => setTimeout(render));
}

render();
