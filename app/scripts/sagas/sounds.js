import {
  all,
  call,
  put,
  select,
  take,
  takeEvery,
  throttle
} from 'redux-saga/effects';
import {
  allPass,
  always,
  apply,
  compose,
  cond,
  equals,
  map,
  mapObjIndexed,
  prop,
  propEq,
  propIs,
  T,
  values
} from 'ramda';
import { push } from 'react-router-redux';
import shortid from 'shortid';
import { bridgedSounds } from 'kakapoBridge';
import {
  getDefaultSounds,
  getCustomFile,
  getYoutubeURL,
  getCustomURL,
  getSoundCloudURL
} from 'api/';
import { soundActions, soundTypes, notifyActions } from 'actions/';
import awsCredentials from '../../../aws.json';

const connectDynamoDB = () => {
  const AWS = window.AWS;
  AWS.config.update(awsCredentials);
  return new AWS.DynamoDB({ params: { TableName: 'kakapo-playlists' } });
};

const getPlaylist = id =>
  new Promise((resolve, reject) => {
    const table = connectDynamoDB();
    table.getItem({ Key: { shareID: { S: id } } }, (err, data) => {
      if (err) return reject(err);
      return resolve(data);
    });
  });

const savePlaylist = sounds =>
  new Promise(resolve => {
    const table = connectDynamoDB();
    const playlistID = compose(btoa, JSON.stringify)(sounds);

    const shareID = shortid.generate();
    const putItem = {
      Item: { shareID: { S: shareID }, playlistID: { S: playlistID } }
    };

    table.putItem(putItem, () => resolve(shareID));
  });

function* soundsRequest() {
  try {
    const resp = yield getDefaultSounds();
    yield put(soundActions.requestSuccess(resp));
  } catch (err) {
    yield put(notifyActions.send(err));
  }
}

function* addLocal({ file }) {
  if (!__DESKTOP__) {
    return yield put(
      notifyActions.send(
        'You can only add desktop files with the Kakapo desktop app.'
      )
    );
  }

  return yield put(
    soundActions.addSoundComplete(getCustomFile(file.name, file.path))
  );
}

const isChannel = allPass(map(propIs(Function), ['flush', 'take', 'close']));

function* addSound({ service, data }) {
  const actionFn = cond([
    [equals('soundcloud'), always(getSoundCloudURL)],
    [equals('youtube'), always(getYoutubeURL)],
    [T, always(getCustomURL)]
  ])(service);

  try {
    const chan = yield call(actionFn, data);
    if (!isChannel(chan)) {
      yield put(soundActions.addSoundComplete(chan));
    } else {
      while (true) {
        const resp = yield take(chan);
        if (resp.progress === 1) {
          yield put(soundActions.addSoundComplete(resp));
        } else {
          yield put(soundActions.addSoundDownloading(resp));
        }
      }
    }
  } catch (err) {
    yield put(notifyActions.send(err.message));
  }
}

function* setVolume({ sound, volume }) {
  yield put(soundActions.volume(sound, volume));
}

const sourceEq = propEq('source');

function* createPlaylist() {
  try {
    const sounds = yield select(prop('sounds'));
    const shareID = yield call(savePlaylist, sounds);
    yield put(push(`/share-playlist/${shareID}`));
  } catch (err) {
    yield put(notifyActions.send(err));
  }
}

function* handlePlaylist({ id }) {
  try {
    const { Item: { playlistID: { S } } } = yield call(getPlaylist, id);
    yield put(push('/'));
    yield put(soundActions.reset(true));

    const mappedPlaylist = compose(
      map(compose(put, apply(soundActions.addSound))),
      values,
      mapObjIndexed(
        cond([
          [sourceEq('youtubeStream'), x => ['youtube', x]],
          [sourceEq('soundcloudStream'), x => ['soundcloud', x.file]],
          [T, x => ['kakapo', x]]
        ])
      ),
      JSON.parse,
      atob
    )(S);

    yield all(mappedPlaylist);
  } catch (err) {
    yield put(notifyActions.send(err));
  }
}

function* saveToStorage() {
  const sounds = yield select(prop('sounds'));
  compose(bridgedSounds.saveToStorage, JSON.stringify, values)(sounds);
}

export default function* rootSaga() {
  yield call(soundsRequest);
  yield takeEvery(soundTypes.ADD_LOCAL, addLocal);
  yield takeEvery(soundTypes.ADD_SOUND, addSound);
  yield throttle(500, soundTypes.THROTTLE_VOLUME, setVolume);
  yield throttle(1000, soundTypes.PLAYLIST, handlePlaylist);
  yield takeEvery(soundTypes.CREATE_PLAYLIST, createPlaylist);
  yield takeEvery('*', saveToStorage);
}
